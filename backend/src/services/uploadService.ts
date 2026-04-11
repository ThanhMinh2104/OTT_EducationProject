import { Readable } from 'stream';
import cloudinary from '../config/cloudinary';

const FILE_TYPE_MATCH: Record<string, string[]> = {
  image: ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp'],
  video: ['video/mp4', 'video/quicktime', 'video/x-msvideo'],
  audio: ['audio/mpeg', 'audio/wav', 'audio/webm', 'audio/ogg'],
  document: [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    // TV3: thêm Excel
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
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

  for (const [type, mimes] of Object.entries(FILE_TYPE_MATCH)) {
    if (mimes.includes(file.mimetype)) {
      fileType = type;
      break;
    }
  }

  if (!fileType) throw new Error(`${file.originalname} is not a supported file format`);

  const ext = file.originalname.split('.').pop();
  const publicId = `${fileType}_${randomString()}_${Date.now()}.${ext}`;
  const resourceType = ['image', 'video', 'audio'].includes(fileType) ? fileType : 'raw';

  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      { folder: 'AnhChat', public_id: publicId, resource_type: resourceType as any },
      (error, result) => {
        if (error) return reject(error);
        return resolve(result!.secure_url);
      }
    );
    bufferToStream(file.buffer).pipe(uploadStream);
  });
}
