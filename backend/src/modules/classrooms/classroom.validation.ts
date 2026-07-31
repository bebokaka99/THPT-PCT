import { HttpError } from '../../utils/http-error.js';
import {
  asRecord,
  firstQueryValue as first,
  flexibleBoolean as boolValue,
  nullableStringValue as stringValue,
  positiveIntegerValue as idValue,
} from '../../validators/common.js';
import type { ClassroomContentStatus, ClassroomDocumentInput, ClassroomInput, ClassroomPostInput, ClassroomRole, ListClassroomsQuery, MemberInput } from './classroom.types.js';

const statuses = new Set<ClassroomContentStatus>(['draft', 'published', 'archived']);
const memberRoles = new Set<ClassroomRole>(['teacher', 'student']);

function parseBoolean(value: unknown) {
  return boolValue(value, 'is_active');
}

function statusValue(value: unknown) {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value !== 'string' || !statuses.has(value as ClassroomContentStatus)) {
    throw new HttpError(400, 'status must be draft, published, or archived');
  }
  return value as ClassroomContentStatus;
}

export function validateId(value: string, field = 'id') {
  return idValue(value, field, true) as number;
}

export function validateListClassroomsQuery(query: Record<string, unknown>): ListClassroomsQuery {
  return {
    page: idValue(first(query.page), 'page') ?? 1,
    limit: Math.min(idValue(first(query.limit), 'limit') ?? 10, 50),
    q: (stringValue(first(query.q), 'q') ?? undefined) as string | undefined,
    school_year: (stringValue(first(query.school_year), 'school_year') ?? undefined) as string | undefined,
    is_active: parseBoolean(first(query.is_active)),
  };
}

export function validateClassroom(body: unknown): ClassroomInput {
  const input = asRecord(body);
  const academicYearId = idValue(input.academic_year_id, 'academic_year_id');
  const schoolYear = stringValue(input.school_year, 'school_year') ?? undefined;
  if (!academicYearId && !schoolYear) {
    throw new HttpError(400, 'academic_year_id is required');
  }
  return {
    name: stringValue(input.name, 'name', true) as string,
    school_year: schoolYear as string | undefined,
    academic_year_id: academicYearId,
    grade_level: idValue(input.grade_level, 'grade_level') ?? null,
    homeroom_teacher_user_id: idValue(input.homeroom_teacher_user_id, 'homeroom_teacher_user_id') ?? null,
    description: stringValue(input.description, 'description') ?? null,
    is_active: parseBoolean(input.is_active) ?? true,
  };
}

export function validateMember(body: unknown): MemberInput {
  const input = asRecord(body);
  if (typeof input.role !== 'string' || !memberRoles.has(input.role as ClassroomRole)) {
    throw new HttpError(400, 'role must be teacher or student');
  }
  return {
    user_id: idValue(input.user_id, 'user_id', true) as number,
    role: input.role as ClassroomRole,
  };
}

export function validateMemberRole(value: unknown): ClassroomRole | undefined {
  const raw = first(value);
  if (raw === undefined) return undefined;
  if (typeof raw !== 'string' || !memberRoles.has(raw as ClassroomRole)) {
    throw new HttpError(400, 'role must be teacher or student');
  }
  return raw as ClassroomRole;
}

export function validateClassroomPost(body: unknown): ClassroomPostInput {
  const input = asRecord(body);
  return {
    title: stringValue(input.title, 'title', true) as string,
    content: stringValue(input.content, 'content') ?? '',
    status: statusValue(input.status) ?? 'draft',
  };
}

export function validateClassroomDocument(body: unknown): ClassroomDocumentInput {
  const input = asRecord(body);
  return {
    title: stringValue(input.title, 'title', true) as string,
    description: stringValue(input.description, 'description') ?? null,
    file_url: stringValue(input.file_url, 'file_url', true) as string,
    status: statusValue(input.status) ?? 'draft',
  };
}
