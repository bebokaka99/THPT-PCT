import { HttpError } from '../../utils/http-error.js';

function positiveId(value: unknown, field: string) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new HttpError(400, `${field} must be a positive integer`);
  }
  return parsed;
}

export function validateStudentId(value: unknown) {
  return positiveId(value, 'studentId');
}

export function validateClassroomId(value: unknown) {
  return positiveId(value, 'classroomId');
}

export function validateSemesterId(value: unknown) {
  return positiveId(value, 'semesterId');
}

export function validateOptionalSemesterId(value: unknown) {
  return value === undefined || value === '' ? undefined : validateSemesterId(value);
}
