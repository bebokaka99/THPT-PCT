import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import sharp, { type Metadata } from 'sharp';
import { HttpError } from '../../utils/http-error.js';
import { createMedia, deleteMediaRecord, findMediaById, findMediaFiles } from './media.repository.js';
import type {
  ListMediaQuery,
  MediaType,
  MediaVariants,
} from './media.types.js';
import { validateUploadedFileContent } from './media.validation.js';

const uploadsRoot = path.resolve(process.cwd(), 'uploads');

export function getUploadSubdirectory(type: MediaType) {
  if (type === 'image') {
    return 'images';
  }

  if (type === 'document') {
    return 'documents';
  }

  return 'others';
}

function safeBaseName(originalName: string) {
  const extension = path.extname(originalName).toLowerCase();
  return path
    .basename(originalName, extension)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
    .slice(0, 60) || 'file';
}

function createStoredFileName(originalName: string) {
  const extension = path.extname(originalName).toLowerCase();
  return `${Date.now()}-${randomUUID().slice(0, 8)}-${safeBaseName(originalName)}${extension}`;
}

function getSafeUploadPath(filePath: string) {
  const resolvedPath = path.resolve(filePath);
  const uploadsPrefix = `${uploadsRoot}${path.sep}`;
  if (!resolvedPath.startsWith(uploadsPrefix)) {
    throw new Error('Resolved media path is outside uploads directory');
  }
  return resolvedPath;
}

async function inspectAndBuildImageVariants(
  buffer: Buffer,
  fileName: string,
) {
  let metadata: Metadata;
  try {
    metadata = await sharp(buffer, { failOn: 'error' }).metadata();
  } catch {
    throw new HttpError(400, 'Uploaded file is not a valid readable image');
  }

  if (!metadata.width || !metadata.height) {
    throw new HttpError(400, 'Uploaded image dimensions could not be detected');
  }

  const source = sharp(buffer, { failOn: 'error' }).rotate();
  const variants: MediaVariants = {};
  const variantFiles: Array<{ path: string; buffer: Buffer }> = [];

  for (const variant of [
    { name: 'thumbnail', width: 320, quality: 78 },
    { name: 'medium', width: 1280, quality: 82 },
  ] as const) {
    const variantBuffer = await source
      .clone()
      .resize({ width: variant.width, withoutEnlargement: true })
      .webp({ quality: variant.quality })
      .toBuffer();
    const variantMetadata = await sharp(variantBuffer).metadata();
    if (!variantMetadata.width || !variantMetadata.height) {
      throw new HttpError(400, 'Generated image variant has invalid dimensions');
    }

    const variantFileName = `${path.basename(fileName, path.extname(fileName))}-${variant.name}.webp`;
    variantFiles.push({
      path: variantFileName,
      buffer: variantBuffer,
    });
    variants[variant.name] = {
      url: `/uploads/images/${variantFileName}`,
      width: variantMetadata.width,
      height: variantMetadata.height,
      size: variantBuffer.byteLength,
      mime_type: 'image/webp',
    };
  }

  return {
    width: metadata.width,
    height: metadata.height,
    variants,
    variantFiles,
    optimizedSize: Object.values(variants).reduce(
      (total, variant) => total + variant.size,
      0,
    ),
  };
}

export async function saveUploadedMedia(
  file: Express.Multer.File,
  type: MediaType,
  uploadedBy: number | null,
) {
  if (!file.buffer) {
    throw new HttpError(400, 'Uploaded file buffer is missing');
  }

  validateUploadedFileContent(file, type);

  const fileName = createStoredFileName(file.originalname);
  const directory = path.join(uploadsRoot, getUploadSubdirectory(type));
  const originalPath = path.join(directory, fileName);
  const createdPaths = [originalPath];
  let width: number | null = null;
  let height: number | null = null;
  let optimizedSize: number | null = null;
  let variants: MediaVariants = {};

  try {
    await fs.mkdir(directory, { recursive: true });
    await fs.writeFile(originalPath, file.buffer);

    if (type === 'image') {
      const imageData = await inspectAndBuildImageVariants(file.buffer, fileName);
      width = imageData.width;
      height = imageData.height;
      optimizedSize = imageData.optimizedSize;
      variants = imageData.variants;

      for (const variantFile of imageData.variantFiles) {
        const variantPath = path.join(directory, variantFile.path);
        await fs.writeFile(variantPath, variantFile.buffer);
        createdPaths.push(variantPath);
      }
    }

    const media = await createMedia({
      original_name: file.originalname,
      file_name: fileName,
      mime_type: file.mimetype,
      size: file.size,
      type,
      url: `/uploads/${getUploadSubdirectory(type)}/${fileName}`,
      storage_path: originalPath,
      uploaded_by: uploadedBy,
      width,
      height,
      optimized_size: optimizedSize,
      variants,
    });

    if (!media) {
      throw new HttpError(500, 'Failed to save media record');
    }

    return media;
  } catch (error) {
    await Promise.all(
      createdPaths.map((createdPath) =>
        fs.rm(getSafeUploadPath(createdPath), { force: true }),
      ),
    );
    throw error;
  }
}

export async function listMedia(query: ListMediaQuery) {
  const { data, total } = await findMediaFiles(query);

  return {
    data,
    meta: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.ceil(total / query.limit),
    },
  };
}

export async function deleteMedia(id: number) {
  const media = await findMediaById(id);

  if (!media) {
    throw new HttpError(404, 'Media file not found');
  }

  await deleteMediaRecord(id);

  const paths = [
    media.storage_path,
    ...Object.values(media.variants).map((variant) =>
      path.join(uploadsRoot, variant.url.replace(/^\/uploads\//, '')),
    ),
  ];
  await Promise.all(
    paths.map((filePath) =>
      fs.rm(getSafeUploadPath(filePath), { force: true }),
    ),
  );
}
