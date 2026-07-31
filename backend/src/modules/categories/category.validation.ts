import { HttpError } from '../../utils/http-error.js';
import {
  asRecord,
  optionalBoolean as parseOptionalBoolean,
  optionalNonNegativeInteger as parseOptionalNumber,
  optionalNullableString as parseOptionalNullableString,
  optionalString as parseOptionalString,
} from '../../validators/common.js';
import type { CreateCategoryInput, UpdateCategoryInput } from './category.types.js';

export function validateCreateCategory(body: unknown): CreateCategoryInput {
  const input = asRecord(body);
  const name = parseOptionalString(input.name, 'name');

  if (!name) {
    throw new HttpError(400, 'name is required');
  }

  return {
    name,
    slug: parseOptionalString(input.slug, 'slug'),
    description: parseOptionalNullableString(input.description, 'description'),
    sort_order: parseOptionalNumber(input.sort_order, 'sort_order'),
    is_active: parseOptionalBoolean(input.is_active, 'is_active'),
  };
}

export function validateUpdateCategory(body: unknown): UpdateCategoryInput {
  const input = asRecord(body);

  return {
    name: parseOptionalString(input.name, 'name'),
    slug: parseOptionalString(input.slug, 'slug'),
    description: parseOptionalNullableString(input.description, 'description'),
    sort_order: parseOptionalNumber(input.sort_order, 'sort_order'),
    is_active: parseOptionalBoolean(input.is_active, 'is_active'),
  };
}

export function validateCategoryId(value: string) {
  const id = Number(value);

  if (!Number.isInteger(id) || id <= 0) {
    throw new HttpError(400, 'Invalid category id');
  }

  return id;
}
