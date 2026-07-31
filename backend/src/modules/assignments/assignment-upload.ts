import multer from 'multer';
import { HttpError } from '../../utils/http-error.js';
import { detectMediaType } from '../media/media.validation.js';

export const assignmentSubmissionUpload = multer({
  storage: multer.memoryStorage(),
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
