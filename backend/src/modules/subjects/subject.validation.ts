import { HttpError } from '../../utils/http-error.js';
import {
  asRecord,
  firstQueryValue,
  flexibleBoolean,
  nullableStringValue,
  optionalString,
  positiveIntegerValue,
  requiredString,
} from '../../validators/common.js';
import type {
  CurriculumSubjectInput,
  ListCurriculumQuery,
  ListSubjectsQuery,
  SubjectGroup,
  SubjectInput,
  UpdateCurriculumSubjectInput,
  UpdateSubjectInput,
} from './subject.types.js';

const groups = new Set<SubjectGroup>([
  'natural_sciences',
  'social_sciences',
  'languages',
  'technology_arts',
  'physical_education',
  'other',
]);

function groupValue(value: unknown, required = false) {
  const parsed = optionalString(value, 'subject_group');
  if (!parsed && required) {
    throw new HttpError(400, 'subject_group is required');
  }
  if (parsed && !groups.has(parsed as SubjectGroup)) {
    throw new HttpError(400, 'subject_group is invalid');
  }
  return parsed as SubjectGroup | undefined;
}

function subjectCode(value: unknown) {
  const code = requiredString(value, 'code').toUpperCase();
  if (!/^[A-Z0-9_]{2,30}$/.test(code)) {
    throw new HttpError(
      400,
      'code must contain 2-30 uppercase letters, numbers, or underscores',
    );
  }
  return code;
}

function gradeLevel(value: unknown, required = false) {
  const parsed = positiveIntegerValue(value, 'grade_level', required);
  if (parsed !== undefined && (parsed < 10 || parsed > 12)) {
    throw new HttpError(400, 'grade_level must be 10, 11, or 12');
  }
  return parsed;
}

function periodsPerWeek(value: unknown, required = false) {
  if (value === undefined || value === null || value === '') {
    if (required) throw new HttpError(400, 'periods_per_week is required');
    return undefined;
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0 || parsed > 30) {
    throw new HttpError(400, 'periods_per_week must be from 0.1 to 30');
  }
  return Math.round(parsed * 10) / 10;
}

export function validateSubjectId(value: string, field = 'id') {
  return positiveIntegerValue(value, field, true) as number;
}

export function validateListSubjectsQuery(
  query: Record<string, unknown>,
): ListSubjectsQuery {
  return {
    page: positiveIntegerValue(firstQueryValue(query.page), 'page') ?? 1,
    limit: Math.min(
      positiveIntegerValue(firstQueryValue(query.limit), 'limit') ?? 20,
      100,
    ),
    q: optionalString(firstQueryValue(query.q), 'q'),
    subject_group: groupValue(firstQueryValue(query.subject_group)),
    is_active: flexibleBoolean(firstQueryValue(query.is_active), 'is_active'),
  };
}

export function validateSubject(body: unknown): SubjectInput {
  const input = asRecord(body);
  return {
    code: subjectCode(input.code),
    name: requiredString(input.name, 'name'),
    subject_group: groupValue(input.subject_group, true) as SubjectGroup,
    description:
      nullableStringValue(input.description, 'description') ?? null,
    is_active: flexibleBoolean(input.is_active, 'is_active') ?? true,
  };
}

export function validateSubjectUpdate(body: unknown): UpdateSubjectInput {
  const input = asRecord(body);
  if (input.code !== undefined) {
    throw new HttpError(400, 'Subject code is immutable');
  }
  return {
    name: optionalString(input.name, 'name'),
    subject_group: groupValue(input.subject_group),
    description: nullableStringValue(input.description, 'description'),
    is_active: flexibleBoolean(input.is_active, 'is_active'),
  };
}

export function validateSubjectImport(body: unknown) {
  const input = asRecord(body);
  if (!Array.isArray(input.subjects) || input.subjects.length === 0) {
    throw new HttpError(400, 'subjects must be a non-empty array');
  }
  if (input.subjects.length > 200) {
    throw new HttpError(400, 'subjects import is limited to 200 items');
  }
  return input.subjects.map(validateSubject);
}

export function validateListCurriculumQuery(
  query: Record<string, unknown>,
): ListCurriculumQuery {
  return {
    academic_year_id: positiveIntegerValue(
      firstQueryValue(query.academic_year_id),
      'academic_year_id',
    ),
    grade_level: gradeLevel(firstQueryValue(query.grade_level)),
    is_active: flexibleBoolean(firstQueryValue(query.is_active), 'is_active'),
  };
}

export function validateCurriculum(
  body: unknown,
): CurriculumSubjectInput {
  const input = asRecord(body);
  return {
    academic_year_id: positiveIntegerValue(
      input.academic_year_id,
      'academic_year_id',
      true,
    ) as number,
    subject_id: positiveIntegerValue(
      input.subject_id,
      'subject_id',
      true,
    ) as number,
    grade_level: gradeLevel(input.grade_level, true) as number,
    periods_per_week: periodsPerWeek(
      input.periods_per_week,
      true,
    ) as number,
    is_required: flexibleBoolean(input.is_required, 'is_required') ?? true,
    is_active: flexibleBoolean(input.is_active, 'is_active') ?? true,
  };
}

export function validateCurriculumUpdate(
  body: unknown,
): UpdateCurriculumSubjectInput {
  const input = asRecord(body);
  if (input.academic_year_id !== undefined || input.grade_level !== undefined) {
    throw new HttpError(
      400,
      'academic_year_id and grade_level are immutable; create a new entry',
    );
  }
  return {
    subject_id: positiveIntegerValue(input.subject_id, 'subject_id'),
    periods_per_week: periodsPerWeek(input.periods_per_week),
    is_required: flexibleBoolean(input.is_required, 'is_required'),
    is_active: flexibleBoolean(input.is_active, 'is_active'),
  };
}

