import { randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import multer from 'multer';
import { HttpError } from '../../utils/http-error.js';
import { detectMediaType } from '../media/media.validation.js';

export const assignmentSubmissionUploadRoot = path.resolve(
  process.cwd(),
  'private-uploads',
  'assignments',
);

export const assignmentSubmissionUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, callback) => {
      mkdirSync(assignmentSubmissionUploadRoot, { recursive: true });
      callback(null, assignmentSubmissionUploadRoot);
    },
    filename: (_req, file, callback) => {
      callback(
        null,
        `${Date.now()}-${randomUUID()}${path.extname(file.originalname).toLowerCase()}`,
      );
    },
  }),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, callback) => {
    if (detectMediaType(file.mimetype, file.originalname) === 'other') {
      callback(
        new HttpError(
          400,
          'Unsupported submission file. Allowed: jpg, jpeg, png, webp, pdf, doc, docx, xls, xlsx',
        ),
      );
      return;
    }
    callback(null, true);
  },
});
