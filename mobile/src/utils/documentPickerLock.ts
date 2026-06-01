/**
 * Global lock + retry helper cho expo-document-picker
 *
 * Lý do: expo-document-picker SDK 54 trên iOS có 2 vấn đề:
 *  1. Cờ "currentPickingContext" ở native bị kẹt khi bị gọi 2 lần đồng thời
 *  2. Khi picker bị conflict với animation modal cha đóng, Promise có thể
 *     bị treo vĩnh viễn → finally không chạy → lock JS kẹt mãi
 *
 * Workaround:
 *  1. JS lock + auto release sau timeout (chống treo)
 *  2. Đợi modal cha đóng xong trước khi gọi picker
 *  3. Auto retry với delay tăng dần khi gặp lỗi "in progress"
 */

import * as DocumentPicker from 'expo-document-picker';

let isDocumentPickerActive = false;
let lockAcquiredAt = 0;
// Sau 30 giây mà chưa release thì coi như Promise treo, force unlock
const LOCK_TIMEOUT_MS = 30_000;

export const isDocumentPickerLocked = (): boolean => {
  // Auto unlock nếu lock quá lâu (Promise có thể đã bị treo)
  if (isDocumentPickerActive && Date.now() - lockAcquiredAt > LOCK_TIMEOUT_MS) {
    console.warn('⚠️  Lock kẹt quá lâu, auto force unlock');
    isDocumentPickerActive = false;
  }
  return isDocumentPickerActive;
};

export const forceResetDocumentPickerLock = (): void => {
  if (isDocumentPickerActive) {
    console.warn('⚠️  Force reset DocumentPicker lock');
    isDocumentPickerActive = false;
  }
};

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Wrap getDocumentAsync với timeout để tránh Promise bị treo vĩnh viễn.
 * Nếu picker không phản hồi trong `timeoutMs`, coi như user đã hủy.
 */
const getDocumentAsyncWithTimeout = (
  options: DocumentPicker.DocumentPickerOptions,
  timeoutMs: number = 60_000
): Promise<DocumentPicker.DocumentPickerResult> => {
  return new Promise((resolve, reject) => {
    let settled = false;

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      console.warn('⏱️  DocumentPicker timeout - coi như đã hủy');
      resolve({ canceled: true, assets: null } as DocumentPicker.DocumentPickerResult);
    }, timeoutMs);

    DocumentPicker.getDocumentAsync(options)
      .then((result) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(result);
      })
      .catch((err) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        reject(err);
      });
  });
};

/**
 * Mở DocumentPicker an toàn:
 *  - JS lock chống double-tap
 *  - Đợi 400ms cho modal cha đóng xong (tránh conflict animation iOS)
 *  - Timeout 60s để Promise không treo vĩnh viễn
 *  - Auto retry khi gặp "in progress"
 */
export const safePickDocument = async (
  options: DocumentPicker.DocumentPickerOptions,
  maxRetries: number = 1
): Promise<DocumentPicker.DocumentPickerResult> => {
  if (isDocumentPickerLocked()) {
    console.log('⏸️  DocumentPicker đang được dùng, bỏ qua');
    return { canceled: true, assets: null } as DocumentPicker.DocumentPickerResult;
  }

  isDocumentPickerActive = true;
  lockAcquiredAt = Date.now();
  console.log('🔒 DocumentPicker lock acquired');

  try {
    let lastError: any = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        // Đợi modal cha đóng xong (animation ~ 250-350ms trên iOS)
        if (attempt === 0) {
          await sleep(400);
        } else {
          const delay = 800 * (attempt + 1);
          console.log(`🔄 Retry DocumentPicker lần ${attempt} sau ${delay}ms...`);
          await sleep(delay);
        }

        const result = await getDocumentAsyncWithTimeout(options);
        console.log('📎 DocumentPicker result:', {
          canceled: result.canceled,
          assetCount: result.assets?.length,
          attempt,
        });
        return result;
      } catch (err: any) {
        lastError = err;
        const msg = err?.message || '';
        if (msg.includes('in progress') || msg.includes('Different document')) {
          console.warn(`⚠️  Native picker bị kẹt (attempt ${attempt}), thử lại...`);
          continue;
        }
        throw err;
      }
    }
    throw lastError || new Error('DocumentPicker thất bại sau nhiều lần thử');
  } finally {
    isDocumentPickerActive = false;
    console.log('🔓 DocumentPicker lock released');
  }
};
