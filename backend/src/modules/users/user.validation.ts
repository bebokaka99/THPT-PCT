import { HttpError } from '../../utils/http-error.js';
import {
  asRecord,
  firstQueryValue,
  optionalString,
  parsePositiveInteger,
  requiredString as parseRequiredString,
} from '../../validators/common.js';
import type {
  BulkCreateStudentsInput,
  BulkStudentInput,
  CreateUserInput,
  ListUsersQuery,
  UpdateUserInput,
  UpdateUserRolesInput,
  UpdateUserStatusInput,
  UserStatus,
} from './user.types.js';

const validStatuses = new Set<UserStatus>(['active', 'inactive', 'locked']);
const maxLimit = 50;

function optionalStatus(value: unknown) {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  if (typeof value !== 'string' || !validStatuses.has(value as UserStatus)) {
    throw new HttpError(400, 'status must be active, inactive, or locked');
  }

  return value as UserStatus;
}

function parseRoles(value: unknown) {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (!Array.isArray(value)) {
    throw new HttpError(400, 'roles must be an array');
  }

  const roles = value.map((item) => {
    if (typeof item !== 'string') {
      throw new HttpError(400, 'roles must be an array of strings');
    }

    return item.trim();
  }).filter(Boolean);

  return Array.from(new Set(roles));
}

function validateEmail(email: string) {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new HttpError(400, 'email is invalid');
  }
}

function validatePassword(password: string) {
  if (password.length < 10) {
    throw new HttpError(400, 'password must be at least 10 characters');
  }

  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    throw new HttpError(
      400,
      'password must contain at least one letter and one number',
    );
  }
}

function optionalEmail(value: unknown) {
  const email = optionalString(value, 'email')?.toLowerCase();
  if (email) {
    validateEmail(email);
  }
  return email ?? null;
}

function parseDateOfBirth(value: unknown) {
  const parsed = parseRequiredString(value, 'date_of_birth');
  if (!/^(\d{2}\/\d{2}\/\d{4}|\d{4}-\d{2}-\d{2})$/.test(parsed)) {
    throw new HttpError(400, 'date_of_birth must use DD/MM/YYYY or YYYY-MM-DD');
  }
  return parsed;
}

export function validateListUsersQuery(query: Record<string, unknown>): ListUsersQuery {
  const status = firstQueryValue(query.status);

  if (status !== undefined && status !== null && status !== '' && status !== 'all' && !validStatuses.has(status as UserStatus)) {
    throw new HttpError(400, 'status must be all, active, inactive, or locked');
  }

  return {
    page: parsePositiveInteger(query.page, 1, 'page'),
    limit: Math.min(parsePositiveInteger(query.limit, 10, 'limit'), maxLimit),
    q: optionalString(firstQueryValue(query.q), 'q'),
    role: optionalString(firstQueryValue(query.role), 'role'),
    status: status === 'all' ? undefined : optionalStatus(status),
  };
}

export function validateCreateUser(body: unknown): CreateUserInput {
  const input = asRecord(body);
  const email = parseRequiredString(input.email, 'email').toLowerCase();
  const password = parseRequiredString(input.password, 'password');

  validateEmail(email);
  validatePassword(password);

  return {
    email,
    full_name: parseRequiredString(input.full_name, 'full_name'),
    password,
    status: optionalStatus(input.status),
    roles: parseRoles(input.roles),
  };
}

export function validateUpdateUser(body: unknown): UpdateUserInput {
  const input = asRecord(body);
  const email = optionalString(input.email, 'email')?.toLowerCase();
  const password = optionalString(input.password, 'password');

  if (email) {
    validateEmail(email);
  }

  if (password) {
    validatePassword(password);
  }

  return {
    email,
    full_name: optionalString(input.full_name, 'full_name'),
    password,
    status: optionalStatus(input.status),
    roles: parseRoles(input.roles),
  };
}

export function validateUpdateUserStatus(body: unknown): UpdateUserStatusInput {
  const input = asRecord(body);
  const status = optionalStatus(input.status);

  if (!status) {
    throw new HttpError(400, 'status is required');
  }

  return { status };
}

export function validateUpdateUserRoles(body: unknown): UpdateUserRolesInput {
  const input = asRecord(body);
  const roles = parseRoles(input.roles);

  if (!roles) {
    throw new HttpError(400, 'roles is required');
  }

  return { roles };
}

export function validateUserId(value: string) {
  const id = Number(value);

  if (!Number.isInteger(id) || id <= 0) {
    throw new HttpError(400, 'Invalid user id');
  }

  return id;
}

export function validateBulkCreateStudents(body: unknown): BulkCreateStudentsInput {
  const input = asRecord(body);
  const cohort = parseRequiredString(input.cohort, 'cohort');
  if (!/^\d{1,2}$/.test(cohort)) {
    throw new HttpError(400, 'cohort must contain 1 or 2 digits');
  }

  if (!Array.isArray(input.students) || input.students.length === 0) {
    throw new HttpError(400, 'students must contain at least one student');
  }
  if (input.students.length > 1000) {
    throw new HttpError(400, 'students cannot contain more than 1000 rows per batch');
  }

  const classroomId =
    input.classroom_id === undefined || input.classroom_id === null || input.classroom_id === ''
      ? undefined
      : Number(input.classroom_id);
  if (classroomId !== undefined && (!Number.isInteger(classroomId) || classroomId <= 0)) {
    throw new HttpError(400, 'classroom_id must be a positive integer');
  }

  const students = input.students.map((value, index) => {
    if (typeof value !== 'object' || value === null) {
      throw new HttpError(400, `students[${index}] must be an object`);
    }
    const row = value as Record<string, unknown>;
    const student: BulkStudentInput = {
      full_name: parseRequiredString(row.full_name, `students[${index}].full_name`),
      date_of_birth: parseDateOfBirth(row.date_of_birth),
      class_name: optionalString(row.class_name, `students[${index}].class_name`) ?? null,
      student_code: optionalString(row.student_code, `students[${index}].student_code`) ?? null,
      phone: optionalString(row.phone, `students[${index}].phone`) ?? null,
      parent_phone: optionalString(row.parent_phone, `students[${index}].parent_phone`) ?? null,
      email: optionalEmail(row.email),
    };
    return student;
  });

  return { cohort, classroom_id: classroomId, students };
}
