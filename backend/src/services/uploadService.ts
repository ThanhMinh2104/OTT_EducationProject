import { Readable } from 'stream';
import cloudinary from '../config/cloudinary';

const FILE_TYPE_MATCH: Record<string, string[]> = {
  image: ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp', 'image/svg+xml', 'image/bmp'],
  video: ['video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/webm', 'video/ogg'],
  audio: ['audio/mpeg', 'audio/wav', 'audio/webm', 'audio/ogg', 'audio/mp4', 'audio/aac', 'audio/m4a', 'audio/x-m4a'],
  document: [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/plain',
    'text/csv',
    'application/zip',
    'application/x-zip-compressed',
    'application/x-rar-compressed',
    'application/x-7z-compressed',
  ],
};

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

export async function uploadToCloudinary(file: Express.Multer.File): Promise<string> {
  let fileType: string | null = null;

  // Nếu không có mimetype hoặc mimetype là application/octet-stream, coi như file thông thường
  if (!file.mimetype || file.mimetype === 'application/octet-stream') {
    fileType = 'document';
  } else {
    for (const [type, mimes] of Object.entries(FILE_TYPE_MATCH)) {
      if (mimes.includes(file.mimetype)) {
        fileType = type;
        break;
      }
    }
  }

  // Nếu vẫn không match, coi như document/raw file
  if (!fileType) {
    console.warn(`Unknown file type: ${file.mimetype}, treating as document`);
    fileType = 'document';
  }

  const ext = file.originalname.split('.').pop() || 'bin';
  const publicId = `${fileType}_${randomString()}_${Date.now()}`; // Không thêm extension vào publicId
  
  // Xác định resource_type cho Cloudinary
  let resourceType: 'image' | 'video' | 'raw' = 'raw';
  if (fileType === 'image') resourceType = 'image';
  else if (fileType === 'video') resourceType = 'video';
  else if (fileType === 'audio') resourceType = 'video'; // Cloudinary xử lý audio như video

  console.log('Uploading to Cloudinary:', { fileType, resourceType, publicId, mimetype: file.mimetype, size: file.size });

  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      { 
        folder: 'AnhChat', 
        public_id: publicId, 
        resource_type: resourceType,
        // Không convert format, giữ nguyên m4a
        access_mode: 'public', // Đảm bảo file có thể truy cập public
        type: 'upload' // Upload type
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
