import path from 'node:path';
import type { Request } from 'express';
import { HttpError } from '../../utils/http-error.js';
import { firstQueryValue, parsePositiveInteger } from '../../validators/common.js';
import type { ListMediaQuery, MediaType } from './media.types.js';

const imageMimeTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);
const documentMimeTypes = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
]);

const allowedImageExtensions = new Set(['.jpg', '.jpeg', '.png', '.webp']);
const allowedDocumentExtensions = new Set(['.pdf', '.doc', '.docx', '.xls', '.xlsx']);

function startsWithBytes(buffer: Buffer, signature: number[]) {
  return signature.every((byte, index) => buffer[index] === byte);
}

export function validateUploadedFileContent(
  file: Express.Multer.File,
  type: MediaType,
) {
  if (type !== 'document') {
    return;
  }

  const extension = path.extname(file.originalname).toLowerCase();
  const isPdf = extension === '.pdf'
    && file.buffer.subarray(0, 5).toString('ascii') === '%PDF-';
  const isZipOffice = ['.docx', '.xlsx'].includes(extension)
    && (
      startsWithBytes(file.buffer, [0x50, 0x4b, 0x03, 0x04])
      || startsWithBytes(file.buffer, [0x50, 0x4b, 0x05, 0x06])
      || startsWithBytes(file.buffer, [0x50, 0x4b, 0x07, 0x08])
    );
  const isLegacyOffice = ['.doc', '.xls'].includes(extension)
    && startsWithBytes(
      file.buffer,
      [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1],
    );

  if (!isPdf && !isZipOffice && !isLegacyOffice) {
    throw new HttpError(
      400,
      'File content does not match the declared PDF or Office document type',
    );
  }
}

export function detectMediaType(mimeType: string, originalName: string): MediaType {
  const extension = path.extname(originalName).toLowerCase();

  if (imageMimeTypes.has(mimeType) && allowedImageExtensions.has(extension)) {
    return 'image';
  }

  if (documentMimeTypes.has(mimeType) && allowedDocumentExtensions.has(extension)) {
    return 'document';
  }

  return 'other';
}

export function validateUploadedFile(file: Express.Multer.File | undefined) {
  if (!file) {
    throw new HttpError(400, 'File is required');
  }

  const type = detectMediaType(file.mimetype, file.originalname);

  if (type === 'other') {
    throw new HttpError(
      400,
      'Unsupported file type. Allowed: jpg, jpeg, png, webp, pdf, doc, docx, xls, xlsx',
    );
  }

  return type;
}

export function validateListMediaQuery(query: Request['query']): ListMediaQuery {
  const rawType = firstQueryValue(query.type);
  const type = typeof rawType === 'string' && rawType !== 'all' ? rawType : undefined;

  if (type !== undefined && !['image', 'document', 'other'].includes(type)) {
    throw new HttpError(400, 'type must be image, document, other, or all');
  }

  return {
    type: type as MediaType | undefined,
    page: parsePositiveInteger(query.page, 1, 'page'),
    limit: Math.min(parsePositiveInteger(query.limit, 20, 'limit'), 50),
  };
}
