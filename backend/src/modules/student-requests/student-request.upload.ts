import { randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import multer from 'multer';
import { HttpError } from '../../utils/http-error.js';

export const studentRequestUploadRoot = path.resolve(
  process.cwd(),
  'private-uploads',
  'student-requests',
);
mkdirSync(studentRequestUploadRoot, { recursive: true });

const allowedExtensions = new Set([
  '.pdf',
  '.doc',
  '.docx',
  '.jpg',
  '.jpeg',
  '.png',
  '.webp',
]);

export const studentRequestAttachmentUpload = multer({
  storage: multer.diskStorage({
    destination: studentRequestUploadRoot,
    filename: (_req, file, callback) => {
      callback(
        null,
        `${Date.now()}-${randomUUID()}${path.extname(file.originalname).toLowerCase()}`,
      );
    },
  }),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, callback) => {
    if (!allowedExtensions.has(path.extname(file.originalname).toLowerCase())) {
      callback(
        new HttpError(
          400,
          'Unsupported attachment. Allowed: pdf, doc, docx, jpg, jpeg, png, webp',
        ),
      );
      return;
    }
    callback(null, true);
  },
});
