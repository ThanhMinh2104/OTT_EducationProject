import axios from 'axios';

/**
 * SMS Service - InfiniReach
 * Gửi SMS qua InfiniReach API
 */

const INFINIREACH_API_URL = 'https://api.infinireach.io/api/v1/messages';
const INFINIREACH_API_KEY = process.env.INFINIREACH_API_KEY || '';
const INFINIREACH_FROM_PHONE = process.env.INFINIREACH_FROM_PHONE || ''; // SĐT của SIM trong điện thoại Android

/**
 * Format SĐT về chuẩn E.164 (+84xxxxxxxxx)
 * Ví dụ: 0987654321 -> +84987654321
 */
function formatPhoneE164(phone: string): string {
  let cleaned = phone.replace(/\s+/g, '').replace(/-/g, '');
  if (cleaned.startsWith('+84')) return cleaned;
  if (cleaned.startsWith('84')) return '+' + cleaned;
  if (cleaned.startsWith('0')) {
    return '+84' + cleaned.substring(1);
  }
  return '+84' + cleaned;
}

/**
 * Gửi SMS OTP qua InfiniReach
 */
export async function sendOtpSMS(phoneNumber: string, otp: string): Promise<void> {
  const formattedPhone = formatPhoneE164(phoneNumber);

  // Nội dung SMS dạng tự nhiên để KHÔNG bị nhà mạng VN chặn anti-spam
  const variants = [
    `[OTT_Education] Chao ban, ma cua ban la ${otp}. Hieu luc 10 phut.`,
    `[OTT_Education] Ma so cua ban: ${otp}. Su dung trong 10 phut nhe.`,
    `[OTT_Education] Ban dung ma ${otp} de tiep tuc. Het han sau 10 phut.`,
    `[OTT_Education] Ma: ${otp}. Vui long su dung trong 10 phut.`,
  ];
  const messageBody = variants[Math.floor(Math.random() * variants.length)];

  // Mock mode khi chưa cấu hình InfiniReach (dev)
  if (!INFINIREACH_API_KEY || !INFINIREACH_FROM_PHONE) {
    return;
  }

  try {
    await axios.post(
      INFINIREACH_API_URL,
      {
        to: formattedPhone,
        message: messageBody,
        from: INFINIREACH_FROM_PHONE,
        channel: 'sms',
        externalId: `otp-${Date.now()}`,
      },
      {
        headers: {
          'X-API-Key': INFINIREACH_API_KEY,
          'Content-Type': 'application/json',
        },
        timeout: 15000,
      }
    );
  } catch (error: any) {
    // Timeout hoặc self-SMS: coi như thành công (SMS thường vẫn về máy)
    if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
      return;
    }
    if (formattedPhone === INFINIREACH_FROM_PHONE) {
      return;
    }
    throw new Error(
      `Không thể gửi SMS OTP: ${error.response?.data?.message || error.response?.data?.error || error.message}`
    );
  }
}

/**
 * Gửi SMS thông thường (không phải OTP)
 */
export async function sendSMS(phoneNumber: string, message: string): Promise<void> {
  const formattedPhone = formatPhoneE164(phoneNumber);

  if (!INFINIREACH_API_KEY || !INFINIREACH_FROM_PHONE) {
    return;
  }

  try {
    await axios.post(
      INFINIREACH_API_URL,
      {
        to: formattedPhone,
        message,
        from: INFINIREACH_FROM_PHONE,
        channel: 'sms',
      },
      {
        headers: {
          'X-API-Key': INFINIREACH_API_KEY,
          'Content-Type': 'application/json',
        },
        timeout: 10000,
      }
    );
  } catch (error: any) {
    throw new Error('Không thể gửi SMS.');
  }
}
