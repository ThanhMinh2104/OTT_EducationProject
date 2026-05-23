import { Readable } from 'stream';
import cloudinary from '../config/cloudinary';

// ── MIME types ──────────────────────────────────────────────────────────────
// Bao quát Android (JPEG/PNG/WebP/GIF) và iOS/iPhone (HEIC/HEIF) + các định dạng phổ biến
const IMAGE_MIMES = new Set([
  // JPEG - Android, iOS, mọi thiết bị
  'image/jpeg', 'image/jpg', 'image/pjpeg',
  // PNG
  'image/png', 'image/x-png',
  // WebP - Android native
  'image/webp',
  // GIF
  'image/gif',
  // BMP
  'image/bmp', 'image/x-bmp', 'image/x-ms-bmp',
  // HEIC/HEIF - iPhone iOS 11+
  'image/heic', 'image/heif', 'image/heic-sequence', 'image/heif-sequence',
  // AVIF - Android 12+
  'image/avif',
  // TIFF
  'image/tiff', 'image/x-tiff',
  // SVG
  'image/svg+xml',
  // ICO
  'image/x-icon', 'image/vnd.microsoft.icon',
]);

const VIDEO_MIMES = new Set([
  'video/mp4', 'video/quicktime', 'video/x-msvideo',
  'video/webm', 'video/ogg', 'video/3gpp', 'video/3gpp2',
  'video/x-matroska', 'video/mpeg',
]);

const AUDIO_MIMES = new Set([
  'audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/wave',
  'audio/webm', 'audio/ogg', 'audio/mp4', 'audio/aac',
  'audio/m4a', 'audio/x-m4a', 'audio/flac', 'audio/x-flac',
  'audio/amr', // Android voice recording
]);

// ── Extensions ───────────────────────────────────────────────────────────────
const IMAGE_EXTS = new Set([
  'jpg', 'jpeg', 'jfif', 'pjpeg', 'pjp',  // JPEG variants
  'png', 'webp', 'gif', 'bmp', 'tiff', 'tif',
  'heic', 'heif',                           // iPhone
  'avif',                                   // Android 12+
  'svg', 'ico',
]);

const VIDEO_EXTS = new Set(['mp4', 'mov', 'avi', 'webm', 'mkv', 'ogv', '3gp', '3g2', 'mpeg', 'mpg']);
const AUDIO_EXTS = new Set(['mp3', 'wav', 'ogg', 'm4a', 'aac', 'flac', 'amr', 'opus', 'weba']);

// ── Helpers ──────────────────────────────────────────────────────────────────
function bufferToStream(buffer: Buffer): Readable {
  const readable = new Readable();
  readable.push(buffer);
  readable.push(null);
  return readable;
}

function randomString(length = 6): string {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

function detectFileType(mimetype: string, filename: string): 'image' | 'video' | 'audio' | 'document' {
  // 1. Thử detect từ mimetype trước
  const mime = (mimetype || '').toLowerCase().trim();
  if (mime && mime !== 'application/octet-stream') {
    if (IMAGE_MIMES.has(mime) || mime.startsWith('image/')) return 'image';
    if (VIDEO_MIMES.has(mime) || mime.startsWith('video/')) return 'video';
    if (AUDIO_MIMES.has(mime) || mime.startsWith('audio/')) return 'audio';
  }

  // 2. Fallback: detect từ extension
  const ext = (filename.split('.').pop() || '').toLowerCase().trim();
  if (IMAGE_EXTS.has(ext)) return 'image';
  if (VIDEO_EXTS.has(ext)) return 'video';
  if (AUDIO_EXTS.has(ext)) return 'audio';

  return 'document';
}

// ── Main export ───────────────────────────────────────────────────────────────
export async function uploadToCloudinary(file: Express.Multer.File): Promise<string> {
  const fileType = detectFileType(file.mimetype, file.originalname);

  // Xác định resource_type cho Cloudinary
  let resourceType: 'image' | 'video' | 'raw' = 'raw';
  if (fileType === 'image') resourceType = 'image';
  else if (fileType === 'video') resourceType = 'video';
  else if (fileType === 'audio') resourceType = 'video'; // Cloudinary xử lý audio như video

  const publicId = `${fileType}_${randomString()}_${Date.now()}`;

  console.log('Uploading to Cloudinary:', {
    fileType, resourceType, publicId,
    mimetype: file.mimetype,
    filename: file.originalname,
    size: file.size,
  });

  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: 'AnhChat',
        public_id: publicId,
        resource_type: resourceType,
        access_mode: 'public',
        type: 'upload',
      },
      (error, result) => {
        if (error) {
          console.error('Cloudinary upload error:', error);
          return reject(error);
        }
        console.log('Cloudinary upload success:', result?.secure_url);
        return resolve(result!.secure_url);
      }
    );
    bufferToStream(file.buffer).pipe(uploadStream);
  });
}
