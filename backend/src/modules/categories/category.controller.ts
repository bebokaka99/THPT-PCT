import type { RequestHandler } from 'express';
import {
  createCategory,
  deleteCategory,
  getCategoryBySlug,
  listAllCategories,
  listCategories,
  updateCategory,
} from './category.service.js';
import {
  validateCategoryId,
  validateCreateCategory,
  validateUpdateCategory,
} from './category.validation.js';

export const listCategoriesController: RequestHandler = async (_req, res, next) => {
  try {
    res.json({ data: await listCategories() });
  } catch (error) {
    next(error);
  }
};

export const listAdminCategoriesController: RequestHandler = async (_req, res, next) => {
  try {
    res.json({ data: await listAllCategories() });
  } catch (error) {
    next(error);
  }
};

export const getCategoryController: RequestHandler = async (req, res, next) => {
  try {
    res.json({ data: await getCategoryBySlug(req.params.slug) });
  } catch (error) {
    next(error);
  }
};

export const createCategoryController: RequestHandler = async (req, res, next) => {
  try {
    const input = validateCreateCategory(req.body);
    const category = await createCategory(input);
    res.status(201).json({ data: category });
  } catch (error) {
    next(error);
  }
};

export const updateCategoryController: RequestHandler = async (req, res, next) => {
  try {
    const id = validateCategoryId(req.params.id);
    const input = validateUpdateCategory(req.body);
    res.json({ data: await updateCategory(id, input) });
  } catch (error) {
    next(error);
  }
};

export const deleteCategoryController: RequestHandler = async (req, res, next) => {
  try {
    const id = validateCategoryId(req.params.id);
    await deleteCategory(id);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
};
