import { HttpError } from '../../utils/http-error.js';
import { slugify } from '../../utils/slug.js';
import {
  createCategory as insertCategory,
  deleteCategory as removeCategory,
  findAllCategories,
  findCategories,
  findCategoryById,
  findCategoryBySlug,
  isCategorySlugTaken,
  updateCategory as patchCategory,
} from './category.repository.js';
import type { CreateCategoryInput, UpdateCategoryInput } from './category.types.js';

export function listCategories() {
  return findCategories();
}

export function listAllCategories() {
  return findAllCategories();
}

export async function getCategoryBySlug(slug: string) {
  const category = await findCategoryBySlug(slug);

  if (!category) {
    throw new HttpError(404, 'Category not found');
  }

  return category;
}

export async function createCategory(input: CreateCategoryInput) {
  const slug = input.slug ?? slugify(input.name);

  if (!slug) {
    throw new HttpError(400, 'slug is invalid');
  }

  if (await isCategorySlugTaken(slug)) {
    throw new HttpError(409, 'Category slug already exists');
  }

  const category = await insertCategory({
    name: input.name,
    slug,
    description: input.description ?? null,
    sort_order: input.sort_order ?? 0,
    is_active: input.is_active ?? true,
  });

  if (!category) {
    throw new HttpError(500, 'Failed to create category');
  }

  return category;
}

export async function updateCategory(id: number, input: UpdateCategoryInput) {
  const existing = await findCategoryById(id);

  if (!existing) {
    throw new HttpError(404, 'Category not found');
  }

  const slug = input.slug ?? (input.name ? slugify(input.name) : existing.slug);

  if (!slug) {
    throw new HttpError(400, 'slug is invalid');
  }

  if (await isCategorySlugTaken(slug, id)) {
    throw new HttpError(409, 'Category slug already exists');
  }

  const category = await patchCategory(id, {
    name: input.name ?? existing.name,
    slug,
    description: input.description === undefined ? existing.description : input.description,
    sort_order: input.sort_order ?? existing.sort_order,
    is_active: input.is_active ?? existing.is_active,
  });

  if (!category) {
    throw new HttpError(500, 'Failed to update category');
  }

  return category;
}

export async function deleteCategory(id: number) {
  const deleted = await removeCategory(id);

  if (!deleted) {
    throw new HttpError(404, 'Category not found');
  }
}
