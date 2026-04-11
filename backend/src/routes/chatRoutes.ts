import { Router, Response } from 'express';
import { Server } from 'socket.io';
import multer from 'multer';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { uploadToCloudinary } from '../services/uploadService';


const uploadAudio = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

const uploadDocument = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
});

const ALLOWED_AUDIO_TYPES = ['audio/mpeg', 'audio/wav', 'audio/webm', 'audio/ogg', 'audio/mp4'];
const ALLOWED_DOCUMENT_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
];

export default function chatRoutes(io: Server) {
  const router = Router();

  // POST /upload/audio — upload audio với validate type & size limit
  router.post('/upload/audio', authMiddleware, uploadAudio.single('file'), async (req: AuthRequest, res: Response) => {
    try {
      const file = req.file;
      if (!file) return res.status(400).json({ error: 'Không có file' }) as any;
      if (!ALLOWED_AUDIO_TYPES.includes(file.mimetype)) {
        return res.status(400).json({ error: 'Chỉ chấp nhận file audio (mp3, wav, webm, ogg, mp4)' }) as any;
      }
      const url = await uploadToCloudinary(file);
      res.json({ url, fileName: file.originalname, fileSize: file.size, mimeType: file.mimetype });
    } catch (e: any) {
      res.status(500).json({ error: 'Upload audio thất bại', detail: e.message });
    }
  });

  // POST /upload/document — upload PDF, Word, Excel với metadata
  router.post('/upload/document', authMiddleware, uploadDocument.single('file'), async (req: AuthRequest, res: Response) => {
    try {
      const file = req.file;
      if (!file) return res.status(400).json({ error: 'Không có file' }) as any;
      if (!ALLOWED_DOCUMENT_TYPES.includes(file.mimetype)) {
        return res.status(400).json({ error: 'Chỉ chấp nhận PDF, Word (.doc/.docx), Excel (.xls/.xlsx)' }) as any;
      }
      const url = await uploadToCloudinary(file);
      res.json({ url, fileName: file.originalname, fileSize: file.size, mimeType: file.mimetype });
    } catch (e: any) {
      res.status(500).json({ error: 'Upload document thất bại', detail: e.message });
    }
  });

  return router;
}
