import { HttpError } from '../../utils/http-error.js';
import { assertAcademicYearWritable } from '../academic-periods/academic-period.service.js';
import {
  curriculumExists,
  deleteCurriculumSubjectRecord,
  deleteSubjectRecord,
  findActiveCurriculumSubject,
  findCurriculumSubjectById,
  findCurriculumSubjects,
  findSubjectByCode,
  findSubjectById,
  findSubjects,
  importSubjectRecords,
  insertCurriculumSubject,
  insertSubject,
  subjectHasTimetableUsage,
  updateCurriculumSubjectRecord,
  updateSubjectRecord,
} from './subject.repository.js';
import type {
  CurriculumSubjectInput,
  ListCurriculumQuery,
  ListSubjectsQuery,
  SubjectInput,
  UpdateCurriculumSubjectInput,
  UpdateSubjectInput,
} from './subject.types.js';

async function getSubjectOrThrow(id: number) {
  const subject = await findSubjectById(id);
  if (!subject) throw new HttpError(404, 'Subject not found');
  return subject;
}

async function getCurriculumOrThrow(id: number) {
  const curriculum = await findCurriculumSubjectById(id);
  if (!curriculum) throw new HttpError(404, 'Curriculum subject not found');
  return curriculum;
}

export async function listSubjects(query: ListSubjectsQuery) {
  const result = await findSubjects(query);
  return {
    data: result.data,
    meta: {
      page: query.page,
      limit: query.limit,
      total: result.total,
      totalPages: Math.ceil(result.total / query.limit),
    },
  };
}

export async function getSubject(id: number) {
  return getSubjectOrThrow(id);
}

export async function createSubject(input: SubjectInput) {
  if (await findSubjectByCode(input.code)) {
    throw new HttpError(409, 'Subject code already exists');
  }
  const subject = await insertSubject(input);
  if (!subject) throw new HttpError(500, 'Failed to create subject');
  return subject;
}

export async function updateSubject(id: number, input: UpdateSubjectInput) {
  const current = await getSubjectOrThrow(id);
  const subject = await updateSubjectRecord(id, {
    name: input.name ?? current.name,
    subject_group: input.subject_group ?? current.subject_group,
    description:
      input.description === undefined ? current.description : input.description,
    is_active: input.is_active ?? current.is_active,
  });
  if (!subject) throw new HttpError(404, 'Subject not found');
  return subject;
}

export async function importSubjects(inputs: SubjectInput[]) {
  await importSubjectRecords(inputs);
  const imported = await Promise.all(
    inputs.map((input) => findSubjectByCode(input.code)),
  );
  return imported.filter(Boolean);
}

export async function deleteSubject(id: number) {
  const subject = await getSubjectOrThrow(id);
  if (subject.usage_count > 0 || (await subjectHasTimetableUsage(id))) {
    throw new HttpError(
      409,
      'Subject is referenced by academic data; deactivate it instead',
    );
  }
  if (!(await deleteSubjectRecord(id))) {
    throw new HttpError(404, 'Subject not found');
  }
}

export function listCurriculum(query: ListCurriculumQuery) {
  return findCurriculumSubjects(query);
}

async function ensureSubjectAvailable(subjectId: number) {
  const subject = await getSubjectOrThrow(subjectId);
  if (!subject.is_active) {
    throw new HttpError(409, 'Inactive subject cannot be assigned');
  }
  return subject;
}

export async function createCurriculumSubject(input: CurriculumSubjectInput) {
  await assertAcademicYearWritable(input.academic_year_id);
  await ensureSubjectAvailable(input.subject_id);
  if (
    await curriculumExists(
      input.academic_year_id,
      input.subject_id,
      input.grade_level,
    )
  ) {
    throw new HttpError(
      409,
      'Subject already exists in this year and grade curriculum',
    );
  }
  const curriculum = await insertCurriculumSubject(input);
  if (!curriculum) {
    throw new HttpError(500, 'Failed to create curriculum subject');
  }
  return curriculum;
}

export async function updateCurriculumSubject(
  id: number,
  input: UpdateCurriculumSubjectInput,
) {
  const current = await getCurriculumOrThrow(id);
  await assertAcademicYearWritable(current.academic_year_id);
  const subjectId = input.subject_id ?? current.subject_id;
  await ensureSubjectAvailable(subjectId);
  if (
    await curriculumExists(
      current.academic_year_id,
      subjectId,
      current.grade_level,
      id,
    )
  ) {
    throw new HttpError(
      409,
      'Subject already exists in this year and grade curriculum',
    );
  }
  return updateCurriculumSubjectRecord(id, {
    academic_year_id: current.academic_year_id,
    grade_level: current.grade_level,
    subject_id: subjectId,
    periods_per_week:
      input.periods_per_week ?? current.periods_per_week,
    is_required: input.is_required ?? current.is_required,
    is_active: input.is_active ?? current.is_active,
  });
}

export async function deleteCurriculumSubject(id: number) {
  const current = await getCurriculumOrThrow(id);
  await assertAcademicYearWritable(current.academic_year_id);
  if (await subjectHasTimetableUsage(current.subject_id)) {
    throw new HttpError(
      409,
      'Curriculum subject is used in a timetable; deactivate it instead',
    );
  }
  if (!(await deleteCurriculumSubjectRecord(id))) {
    throw new HttpError(404, 'Curriculum subject not found');
  }
}

export async function resolveTimetableCurriculumSubject(
  academicYearId: number,
  gradeLevel: number,
  subjectId: number,
) {
  const curriculum = await findActiveCurriculumSubject(
    academicYearId,
    gradeLevel,
    subjectId,
  );
  if (!curriculum) {
    throw new HttpError(
      409,
      'Subject is not active in the classroom curriculum',
    );
  }
  return curriculum;
}

