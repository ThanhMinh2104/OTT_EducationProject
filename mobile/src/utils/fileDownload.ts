import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { Alert, Platform } from 'react-native';

/**
 * Download và mở file từ URL
 * @param url - URL của file trên Cloudinary
 * @param fileName - Tên file gốc (có extension)
 * @param mimeType - MIME type của file
 */
export const downloadAndOpenFile = async (
  url: string,
  fileName: string,
  mimeType?: string
): Promise<void> => {
  try {
    // Lấy extension từ fileName hoặc URL
    let extension = '';
    if (fileName && fileName.includes('.')) {
      extension = fileName.split('.').pop() || '';
    } else if (url.includes('.')) {
      const urlParts = url.split('.');
      extension = urlParts[urlParts.length - 1].split('?')[0]; // Remove query params
    }

    // Nếu không có extension, thử đoán từ mimeType
    if (!extension && mimeType) {
      extension = getExtensionFromMimeType(mimeType);
    }

    // Tạo tên file với extension
    const finalFileName = fileName.includes('.')
      ? fileName
      : `${fileName || 'document'}.${extension}`;

    // Đường dẫn lưu file
    const fileUri = `${FileSystem.documentDirectory || ''}${finalFileName}`;

    console.log('Downloading file:', {
      url,
      fileName: finalFileName,
      fileUri,
      mimeType,
    });

    // Download file
    const downloadResult = await FileSystem.downloadAsync(url, fileUri);

    if (downloadResult.status !== 200) {
      throw new Error(`Download failed with status ${downloadResult.status}`);
    }

    console.log('Download success:', downloadResult.uri);

    // Kiểm tra xem có thể share không
    const canShare = await Sharing.isAvailableAsync();

    if (canShare) {
      // Mở file bằng app phù hợp
      await Sharing.shareAsync(downloadResult.uri, {
        mimeType: mimeType || getMimeTypeFromExtension(extension),
        dialogTitle: `Mở ${finalFileName}`,
        UTI: getUTIFromExtension(extension), // iOS only
      });
    } else {
      Alert.alert(
        'Thành công',
        `File đã được tải về: ${finalFileName}\nĐường dẫn: ${downloadResult.uri}`,
        [{ text: 'OK' }]
      );
    }
  } catch (error: any) {
    console.error('Download error:', error);
    Alert.alert(
      'Lỗi tải file',
      error.message || 'Không thể tải file. Vui lòng thử lại.',
      [{ text: 'OK' }]
    );
  }
};

/**
 * Lấy extension từ MIME type
 */
const getExtensionFromMimeType = (mimeType: string): string => {
  const mimeMap: Record<string, string> = {
    'application/pdf': 'pdf',
    'application/msword': 'doc',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
    'application/vnd.ms-excel': 'xls',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
    'application/vnd.ms-powerpoint': 'ppt',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
    'text/plain': 'txt',
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/gif': 'gif',
    'video/mp4': 'mp4',
    'audio/mpeg': 'mp3',
    'application/zip': 'zip',
  };

  return mimeMap[mimeType] || 'bin';
};

/**
 * Lấy MIME type từ extension
 */
const getMimeTypeFromExtension = (extension: string): string => {
  const extMap: Record<string, string> = {
    pdf: 'application/pdf',
    doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    xls: 'application/vnd.ms-excel',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ppt: 'application/vnd.ms-powerpoint',
    pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    txt: 'text/plain',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    gif: 'image/gif',
    mp4: 'video/mp4',
    mp3: 'audio/mpeg',
    zip: 'application/zip',
  };

  return extMap[extension.toLowerCase()] || 'application/octet-stream';
};

/**
 * Lấy UTI (Uniform Type Identifier) cho iOS
 */
const getUTIFromExtension = (extension: string): string | undefined => {
  if (Platform.OS !== 'ios') return undefined;

  const utiMap: Record<string, string> = {
    pdf: 'com.adobe.pdf',
    doc: 'com.microsoft.word.doc',
    docx: 'org.openxmlformats.wordprocessingml.document',
    xls: 'com.microsoft.excel.xls',
    xlsx: 'org.openxmlformats.spreadsheetml.sheet',
    ppt: 'com.microsoft.powerpoint.ppt',
    pptx: 'org.openxmlformats.presentationml.presentation',
    txt: 'public.plain-text',
    jpg: 'public.jpeg',
    jpeg: 'public.jpeg',
    png: 'public.png',
    gif: 'public.gif',
    mp4: 'public.mpeg-4',
    mp3: 'public.mp3',
    zip: 'public.zip-archive',
  };

  return utiMap[extension.toLowerCase()];
};

/**
 * Lấy tên file từ URL Cloudinary
 */
export const getFileNameFromUrl = (url: string): string => {
  try {
    // URL format: https://res.cloudinary.com/.../upload/v123456/filename.ext
    const parts = url.split('/');
    const lastPart = parts[parts.length - 1];
    
    // Remove query params
    const fileName = lastPart.split('?')[0];
    
    return decodeURIComponent(fileName);
  } catch (error) {
    return 'document';
  }
};

/**
 * Format file size
 */
export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
};
