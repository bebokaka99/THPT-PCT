import { HttpError } from '../../utils/http-error.js';
import {
  activateAcademicYearRecord,
  activateSemesterRecord,
  closeAcademicYearRecord,
  closeSemesterRecord,
  deleteAcademicYearRecord,
  deleteSemesterRecord,
  findAcademicYearById,
  findAcademicYearByName,
  findAcademicYears,
  findActiveAcademicPeriods,
  findSemesterById,
  hasAcademicYearDateOverlap,
  hasSemesterDateOverlap,
  insertAcademicYear,
  insertSemester,
  setAcademicYearLockRecord,
  setSemesterLockRecord,
  updateAcademicYearRecord,
  updateSemesterRecord,
} from './academic-period.repository.js';
import type {
  AcademicYearInput,
  ListAcademicPeriodsQuery,
  SemesterInput,
  UpdateAcademicYearInput,
  UpdateSemesterInput,
} from './academic-period.types.js';
import { createSemesterTranscriptSnapshots } from '../transcripts/transcript.service.js';

function ensureDateOrder(startDate: string, endDate: string) {
  if (startDate > endDate) {
    throw new HttpError(400, 'start_date must be before or equal to end_date');
  }
}

async function ensureYearDatesAvailable(
  startDate: string,
  endDate: string,
  excludeId?: number,
) {
  ensureDateOrder(startDate, endDate);
  if (await hasAcademicYearDateOverlap(startDate, endDate, excludeId)) {
    throw new HttpError(409, 'Academic year date range overlaps an existing year');
  }
}

async function getYearOrThrow(id: number) {
  const year = await findAcademicYearById(id);
  if (!year) throw new HttpError(404, 'Academic year not found');
  return year;
}

async function getSemesterOrThrow(id: number) {
  const semester = await findSemesterById(id);
  if (!semester) throw new HttpError(404, 'Semester not found');
  return semester;
}

function ensureNotClosedOrLocked(period: {
  status: string;
  is_locked: boolean;
}) {
  if (period.status === 'closed' || period.is_locked) {
    throw new HttpError(409, 'Academic period is closed or locked');
  }
}

export function listAcademicPeriods(query: ListAcademicPeriodsQuery) {
  return findAcademicYears(query);
}

export function getActiveAcademicPeriods() {
  return findActiveAcademicPeriods();
}

export function getAcademicYear(id: number) {
  return getYearOrThrow(id);
}

export async function createAcademicYear(input: AcademicYearInput) {
  await ensureYearDatesAvailable(input.start_date, input.end_date);
  if (await findAcademicYearByName(input.name)) {
    throw new HttpError(409, 'Academic year name already exists');
  }
  const year = await insertAcademicYear(input);
  if (!year) throw new HttpError(500, 'Failed to create academic year');
  return year;
}

export async function updateAcademicYear(
  id: number,
  input: UpdateAcademicYearInput,
) {
  const current = await getYearOrThrow(id);
  ensureNotClosedOrLocked(current);
  const next = {
    name: input.name ?? current.name,
    start_date: input.start_date ?? current.start_date,
    end_date: input.end_date ?? current.end_date,
  };
  await ensureYearDatesAvailable(next.start_date, next.end_date, id);
  const sameName = await findAcademicYearByName(next.name);
  if (sameName && sameName.id !== id) {
    throw new HttpError(409, 'Academic year name already exists');
  }
  for (const semester of current.semesters) {
    if (
      semester.start_date < next.start_date ||
      semester.end_date > next.end_date
    ) {
      throw new HttpError(
        409,
        'Academic year dates must contain all existing semesters',
      );
    }
  }
  return updateAcademicYearRecord(id, next);
}

export async function activateAcademicYear(id: number) {
  const year = await getYearOrThrow(id);
  ensureNotClosedOrLocked(year);
  return activateAcademicYearRecord(id);
}

export async function closeAcademicYear(id: number) {
  const year = await getYearOrThrow(id);
  if (year.status === 'closed') return year;
  for (const semester of year.semesters) {
    await createSemesterTranscriptSnapshots(semester.id, null);
  }
  return closeAcademicYearRecord(id);
}

export async function setAcademicYearLock(id: number, isLocked: boolean) {
  const year = await getYearOrThrow(id);
  if (year.status === 'closed' && !isLocked) {
    throw new HttpError(409, 'Closed academic year cannot be unlocked');
  }
  return setAcademicYearLockRecord(id, isLocked);
}

export async function deleteAcademicYear(id: number) {
  const year = await getYearOrThrow(id);
  if (year.usage_count > 0) {
    throw new HttpError(409, 'Academic year has academic data and cannot be deleted');
  }
  if (year.semesters.length > 0) {
    throw new HttpError(409, 'Delete all semesters before deleting the academic year');
  }
  if (!(await deleteAcademicYearRecord(id))) {
    throw new HttpError(404, 'Academic year not found');
  }
}

export async function createSemester(
  academicYearId: number,
  input: SemesterInput,
) {
  const year = await getYearOrThrow(academicYearId);
  ensureNotClosedOrLocked(year);
  ensureDateOrder(input.start_date, input.end_date);
  if (input.start_date < year.start_date || input.end_date > year.end_date) {
    throw new HttpError(400, 'Semester dates must be inside the academic year');
  }
  if (
    await hasSemesterDateOverlap(
      academicYearId,
      input.start_date,
      input.end_date,
    )
  ) {
    throw new HttpError(409, 'Semester date range overlaps an existing semester');
  }
  const semester = await insertSemester(academicYearId, input);
  if (!semester) throw new HttpError(500, 'Failed to create semester');
  return semester;
}

export async function updateSemester(
  id: number,
  input: UpdateSemesterInput,
) {
  const current = await getSemesterOrThrow(id);
  const year = await getYearOrThrow(current.academic_year_id);
  ensureNotClosedOrLocked(year);
  ensureNotClosedOrLocked(current);
  const next = {
    name: input.name ?? current.name,
    code: input.code ?? current.code,
    start_date: input.start_date ?? current.start_date,
    end_date: input.end_date ?? current.end_date,
  };
  ensureDateOrder(next.start_date, next.end_date);
  if (next.start_date < year.start_date || next.end_date > year.end_date) {
    throw new HttpError(400, 'Semester dates must be inside the academic year');
  }
  if (
    await hasSemesterDateOverlap(
      current.academic_year_id,
      next.start_date,
      next.end_date,
      id,
    )
  ) {
    throw new HttpError(409, 'Semester date range overlaps an existing semester');
  }
  return updateSemesterRecord(id, next);
}

export async function activateSemester(id: number) {
  const semester = await getSemesterOrThrow(id);
  const year = await getYearOrThrow(semester.academic_year_id);
  ensureNotClosedOrLocked(year);
  ensureNotClosedOrLocked(semester);
  return activateSemesterRecord(id, semester.academic_year_id);
}

export async function closeSemester(id: number) {
  const semester = await getSemesterOrThrow(id);
  if (semester.status === 'closed') return semester;
  await createSemesterTranscriptSnapshots(id, null);
  return closeSemesterRecord(id);
}

export async function setSemesterLock(id: number, isLocked: boolean) {
  const semester = await getSemesterOrThrow(id);
  if (semester.status === 'closed' && !isLocked) {
    throw new HttpError(409, 'Closed semester cannot be unlocked');
  }
  if (isLocked && !semester.is_locked) {
    await createSemesterTranscriptSnapshots(id, null);
  }
  return setSemesterLockRecord(id, isLocked);
}

export async function deleteSemester(id: number) {
  const semester = await getSemesterOrThrow(id);
  if (semester.usage_count > 0) {
    throw new HttpError(409, 'Semester has academic data and cannot be deleted');
  }
  if (!(await deleteSemesterRecord(id))) {
    throw new HttpError(404, 'Semester not found');
  }
}

export async function assertAcademicYearWritable(id: number) {
  const year = await getYearOrThrow(id);
  ensureNotClosedOrLocked(year);
  return year;
}

export async function assertSemesterWritable(
  semesterId: number,
  academicYearId?: number,
) {
  const semester = await getSemesterOrThrow(semesterId);
  if (academicYearId && semester.academic_year_id !== academicYearId) {
    throw new HttpError(400, 'Semester does not belong to the academic year');
  }
  await assertAcademicYearWritable(semester.academic_year_id);
  ensureNotClosedOrLocked(semester);
  return semester;
}
