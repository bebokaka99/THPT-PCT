import multer from 'multer';
import { HttpError } from '../../utils/http-error.js';
import { detectMediaType } from './media.validation.js';
import type { MediaType } from './media.types.js';

const storage = multer.memoryStorage();

function createUpload(options: {
  allowedTypes: MediaType[];
  maxFileSize: number;
  invalidTypeMessage: string;
}) {
  const allowedTypes = new Set(options.allowedTypes);

  return multer({
    storage,
    limits: {
      fileSize: options.maxFileSize,
    },
    fileFilter: (_req, file, callback) => {
      if (!allowedTypes.has(detectMediaType(file.mimetype, file.originalname))) {
        callback(new HttpError(400, options.invalidTypeMessage));
        return;
      }
      callback(null, true);
    },
  });
}

export const mediaUpload = createUpload({
  allowedTypes: ['image', 'document'],
  maxFileSize: 10 * 1024 * 1024,
  invalidTypeMessage:
    'Unsupported file type. Allowed: jpg, jpeg, png, webp, pdf, doc, docx, xls, xlsx',
});

export const avatarUpload = createUpload({
  allowedTypes: ['image'],
  maxFileSize: 5 * 1024 * 1024,
  invalidTypeMessage: 'Avatar must be a jpg, jpeg, png, or webp image',
});
