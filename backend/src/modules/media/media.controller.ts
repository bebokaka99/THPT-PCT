import type { RequestHandler } from 'express';
import { HttpError } from '../../utils/http-error.js';
import { deleteMedia, listMedia, saveUploadedMedia } from './media.service.js';
import { validateListMediaQuery, validateUploadedFile } from './media.validation.js';

export const uploadMediaController: RequestHandler = async (req, res, next) => {
  try {
    if (!req.user) {
      throw new HttpError(401, 'Authentication required');
    }

    const type = validateUploadedFile(req.file);
    const media = await saveUploadedMedia(req.file as Express.Multer.File, type, req.user.id);

    res.status(201).json({ data: media });
  } catch (error) {
    next(error);
  }
};

export const listMediaController: RequestHandler = async (req, res, next) => {
  try {
    res.json(await listMedia(validateListMediaQuery(req.query)));
  } catch (error) {
    next(error);
  }
};

export const deleteMediaController: RequestHandler = async (req, res, next) => {
  try {
    const id = Number(req.params.id);

    if (!Number.isInteger(id) || id <= 0) {
      throw new HttpError(400, 'Invalid media id');
    }

    await deleteMedia(id);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
};

