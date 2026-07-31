import { HttpError } from '../utils/http-error.js';

export function asRecord(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new HttpError(400, 'Request body is required');
  }
  return value as Record<string, unknown>;
}

export function firstQueryValue(value: unknown) {
  return Array.isArray(value) ? value[0] : value;
}

export function optionalString(value: unknown, field: string) {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'string') {
    throw new HttpError(400, `${field} must be a string`);
  }
  return value.trim() || undefined;
}

export function optionalQueryString(value: unknown, field: string) {
  return optionalString(firstQueryValue(value), field);
}

export function requiredString(value: unknown, field: string) {
  const parsed = optionalString(value, field);
  if (!parsed) {
    throw new HttpError(400, `${field} is required`);
  }
  return parsed;
}

export function optionalNullableString(value: unknown, field: string) {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== 'string') {
    throw new HttpError(400, `${field} must be a string`);
  }
  return value.trim() || null;
}

export function nullableStringValue(
  value: unknown,
  field: string,
  required = false,
) {
  if (value === undefined || value === null) {
    if (required) throw new HttpError(400, `${field} is required`);
    return undefined;
  }
  if (typeof value !== 'string') {
    throw new HttpError(400, `${field} must be a string`);
  }
  const trimmed = value.trim();
  if (required && !trimmed) {
    throw new HttpError(400, `${field} is required`);
  }
  return trimmed || null;
}

export function parsePositiveInteger(
  value: unknown,
  fallback: number,
  field: string,
) {
  const rawValue = firstQueryValue(value);
  if (rawValue === undefined || rawValue === null || rawValue === '') {
    return fallback;
  }
  const numberValue = Number(rawValue);
  if (!Number.isInteger(numberValue) || numberValue <= 0) {
    throw new HttpError(400, `${field} must be a positive integer`);
  }
  return numberValue;
}

export function positiveIntegerValue(
  value: unknown,
  field: string,
  required = false,
) {
  if (value === undefined || value === null || value === '') {
    if (required) throw new HttpError(400, `${field} is required`);
    return undefined;
  }
  const numberValue = Number(value);
  if (!Number.isInteger(numberValue) || numberValue <= 0) {
    throw new HttpError(400, `${field} must be a positive integer`);
  }
  return numberValue;
}

export function optionalPositiveId(value: unknown, field: string) {
  return positiveIntegerValue(value, field);
}

export function optionalNullableId(value: unknown, field: string) {
  if (value === undefined) return undefined;
  if (value === null) return null;
  return positiveIntegerValue(value, field);
}

export function optionalNonNegativeInteger(value: unknown, field: string) {
  if (value === undefined || value === null || value === '') return undefined;
  const numberValue = Number(value);
  if (!Number.isInteger(numberValue) || numberValue < 0) {
    throw new HttpError(400, `${field} must be a non-negative integer`);
  }
  return numberValue;
}

export function optionalBoolean(value: unknown, field: string) {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'boolean') {
    throw new HttpError(400, `${field} must be a boolean`);
  }
  return value;
}

export function flexibleBoolean(value: unknown, field: string) {
  if (value === undefined || value === null || value === '') return undefined;
  if (value === true || value === 'true' || value === '1' || value === 1) return true;
  if (value === false || value === 'false' || value === '0' || value === 0) return false;
  throw new HttpError(400, `${field} must be boolean`);
}
