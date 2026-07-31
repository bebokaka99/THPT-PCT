import multer from 'multer';
import { HttpError } from '../../utils/http-error.js';

export const academicCsvUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    files: 1,
    fileSize: 2 * 1024 * 1024,
  },
  fileFilter: (_req, file, callback) => {
    if (
      file.mimetype !== 'text/csv' &&
      !file.originalname.toLowerCase().endsWith('.csv')
    ) {
      callback(new HttpError(400, 'Only CSV files are accepted'));
      return;
    }
    callback(null, true);
  },
});

