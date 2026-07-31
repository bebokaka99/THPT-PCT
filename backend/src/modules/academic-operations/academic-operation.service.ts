import { createHash } from 'node:crypto';
import type { AuthUser } from '../auth/auth.types.js';
import { getAttendanceSession, saveAttendance } from '../attendance/attendance.service.js';
import { getGradebook, updateGradebookScores } from '../gradebooks/gradebook.service.js';
import { listClassroomTranscripts } from '../transcripts/transcript.service.js';
import { HttpError } from '../../utils/http-error.js';
import { createCsv, importTemplates, parseAcademicCsv } from './academic-operation.csv.js';
import {
  addImportAudit,
  commitAssignmentRows,
  commitEnrollmentRows,
  createImportJob,
  exportClassroomAttendance,
  exportClassroomRoster,
  findClassroomImportScopes,
  findExistingEnrollmentScopes,
  findImportJobById,
  findImportJobByKey,
  findStudentScopes,
  findTeachingAssignmentImportScopes,
  getAcademicReportSummary,
  listImportJobs,
  setImportJobStatus,
} from './academic-operation.repository.js';
import type {
  AcademicImportJob,
  AcademicImportType,
  CsvRow,
  ImportJobListQuery,
  ImportValidationError,
  ReportFilters,
} from './academic-operation.types.js';

type ValidationResult = {
  rows: CsvRow[];
  errors: ImportValidationError[];
};

function requireAdmin(user: AuthUser) {
  if (!user.roles.includes('admin')) {
    throw new HttpError(403, 'Administrator role required');
  }
}

function required(row: CsvRow, key: string, rowNumber: number) {
  const value = row[key]?.trim();
  if (!value) throw new Error(`Row ${rowNumber}: ${key} is required`);
  return value;
}

function positiveId(value: string, field: string, rowNumber: number) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`Row ${rowNumber}: ${field} must be a positive integer`);
  }
  return parsed;
}

function dateOnly(value: string, field: string, rowNumber: number) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(`Row ${rowNumber}: ${field} must use YYYY-MM-DD`);
  }
  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    throw new Error(`Row ${rowNumber}: ${field} is not a valid date`);
  }
  return value;
}

function dateTime(value: string, field: string, rowNumber: number) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Row ${rowNumber}: ${field} must be a valid ISO date-time`);
  }
  return parsed.toISOString();
}

function bool(value: string, field: string, rowNumber: number) {
  if (['true', '1', 'yes'].includes(value.toLowerCase())) return true;
  if (['false', '0', 'no', ''].includes(value.toLowerCase())) return false;
  throw new Error(`Row ${rowNumber}: ${field} must be true or false`);
}

function rowError(
  errors: ImportValidationError[],
  rowNumber: number,
  error: unknown,
) {
  errors.push({
    row: rowNumber,
    message: error instanceof Error ? error.message : `Row ${rowNumber}: invalid data`,
  });
}

async function validateEnrollmentRows(rows: CsvRow[]): Promise<ValidationResult> {
  const errors: ImportValidationError[] = [];
  const codes = [...new Set(rows.map((row) => row.student_code).filter(Boolean))];
  const classroomIds = [
    ...new Set(
      rows
        .map((row) => Number(row.classroom_id))
        .filter((value) => Number.isInteger(value) && value > 0),
    ),
  ];
  const [students, classrooms] = await Promise.all([
    findStudentScopes(codes),
    findClassroomImportScopes(classroomIds),
  ]);
  const studentMap = new Map(students.map((student) => [student.student_code, student]));
  const classroomMap = new Map(classrooms.map((classroom) => [classroom.id, classroom]));
  const existing = await findExistingEnrollmentScopes(
    students.map((student) => student.user_id),
    classrooms.map((classroom) => classroom.academic_year_id),
  );
  const existingKeys = new Set(
    existing.map((item) => `${item.student_user_id}:${item.academic_year_id}`),
  );
  const seen = new Set<string>();
  const valid: CsvRow[] = [];
  rows.forEach((row, index) => {
    const rowNumber = index + 2;
    try {
      const studentCode = required(row, 'student_code', rowNumber);
      const classroomId = positiveId(
        required(row, 'classroom_id', rowNumber),
        'classroom_id',
        rowNumber,
      );
      const enrolledAt = dateOnly(
        required(row, 'enrolled_at', rowNumber),
        'enrolled_at',
        rowNumber,
      );
      const student = studentMap.get(studentCode);
      if (!student || !student.is_student || student.user_status !== 'active') {
        throw new Error(`Row ${rowNumber}: active student_code was not found`);
      }
      const classroom = classroomMap.get(classroomId);
      if (!classroom || !classroom.is_active) {
        throw new Error(`Row ${rowNumber}: active classroom was not found`);
      }
      if (
        classroom.year_is_locked ||
        !['active', 'planned'].includes(classroom.year_status)
      ) {
        throw new Error(`Row ${rowNumber}: academic year is closed or locked`);
      }
      if (
        enrolledAt < classroom.year_start_date ||
        enrolledAt > classroom.year_end_date
      ) {
        throw new Error(`Row ${rowNumber}: enrolled_at is outside academic year`);
      }
      const key = `${student.user_id}:${classroom.academic_year_id}`;
      if (seen.has(key) || existingKeys.has(key)) {
        throw new Error(`Row ${rowNumber}: student already has an active enrollment`);
      }
      seen.add(key);
      valid.push({
        student_code: studentCode,
        student_user_id: String(student.user_id),
        classroom_id: String(classroomId),
        academic_year_id: String(classroom.academic_year_id),
        enrolled_at: enrolledAt,
        note: row.note ?? '',
      });
    } catch (error) {
      rowError(errors, rowNumber, error);
    }
  });
  return { rows: valid, errors };
}

async function validateAssignmentRows(rows: CsvRow[]): Promise<ValidationResult> {
  const errors: ImportValidationError[] = [];
  const ids = [
    ...new Set(
      rows
        .map((row) => Number(row.teaching_assignment_id))
        .filter((value) => Number.isInteger(value) && value > 0),
    ),
  ];
  const scopes = await findTeachingAssignmentImportScopes(ids);
  const scopeMap = new Map(scopes.map((scope) => [scope.id, scope]));
  const valid: CsvRow[] = [];
  rows.forEach((row, index) => {
    const rowNumber = index + 2;
    try {
      const assignmentId = positiveId(
        required(row, 'teaching_assignment_id', rowNumber),
        'teaching_assignment_id',
        rowNumber,
      );
      const title = required(row, 'title', rowNumber);
      const dueAt = dateTime(
        required(row, 'due_at', rowNumber),
        'due_at',
        rowNumber,
      );
      const scope = scopeMap.get(assignmentId);
      if (!scope || scope.status !== 'active') {
        throw new Error(`Row ${rowNumber}: active teaching assignment was not found`);
      }
      if (
        scope.semester_is_locked ||
        scope.year_is_locked ||
        scope.semester_status === 'closed'
      ) {
        throw new Error(`Row ${rowNumber}: semester is closed or locked`);
      }
      const dueDate = dueAt.slice(0, 10);
      if (
        dueDate < scope.semester_start_date ||
        dueDate > scope.semester_end_date
      ) {
        throw new Error(`Row ${rowNumber}: due_at is outside the semester`);
      }
      valid.push({
        teaching_assignment_id: String(assignmentId),
        classroom_id: String(scope.classroom_id),
        subject_id: String(scope.subject_id),
        semester_id: String(scope.semester_id),
        title,
        description: row.description ?? '',
        due_at: dueAt,
        allow_late: String(bool(row.allow_late ?? '', 'allow_late', rowNumber)),
      });
    } catch (error) {
      rowError(errors, rowNumber, error);
    }
  });
  return { rows: valid, errors };
}

async function validateAttendanceRows(
  user: AuthUser,
  rows: CsvRow[],
): Promise<ValidationResult> {
  const errors: ImportValidationError[] = [];
  const sessionIds = [...new Set(rows.map((row) => row.session_id).filter(Boolean))];
  if (sessionIds.length !== 1) {
    return {
      rows: [],
      errors: rows.map((_, index) => ({
        row: index + 2,
        message: `Row ${index + 2}: all rows must use one session_id`,
      })),
    };
  }
  const sessionId = positiveId(sessionIds[0], 'session_id', 2);
  const detail = await getAttendanceSession(user, sessionId);
  if (!detail) throw new HttpError(404, 'Attendance session not found');
  const studentMap = new Map(
    detail.records
      .filter((record) => record.student_code)
      .map((record) => [record.student_code!, record]),
  );
  const statuses = new Set(['present', 'excused', 'unexcused', 'late']);
  const seen = new Set<string>();
  const valid: CsvRow[] = [];
  rows.forEach((row, index) => {
    const rowNumber = index + 2;
    try {
      const studentCode = required(row, 'student_code', rowNumber);
      const status = required(row, 'status', rowNumber);
      if (!statuses.has(status)) {
        throw new Error(`Row ${rowNumber}: attendance status is invalid`);
      }
      const student = studentMap.get(studentCode);
      if (!student) {
        throw new Error(`Row ${rowNumber}: student is not in this session roster`);
      }
      if (seen.has(studentCode)) {
        throw new Error(`Row ${rowNumber}: duplicate student_code`);
      }
      seen.add(studentCode);
      valid.push({
        session_id: String(sessionId),
        student_code: studentCode,
        student_user_id: String(student.student_user_id),
        status,
        note: row.note ?? '',
        correction_reason: row.correction_reason ?? '',
      });
    } catch (error) {
      rowError(errors, rowNumber, error);
    }
  });
  return { rows: valid, errors };
}

async function validateGradeRows(
  user: AuthUser,
  rows: CsvRow[],
): Promise<ValidationResult> {
  const errors: ImportValidationError[] = [];
  const gradebookIds = [...new Set(rows.map((row) => row.gradebook_id).filter(Boolean))];
  if (gradebookIds.length !== 1) {
    return {
      rows: [],
      errors: rows.map((_, index) => ({
        row: index + 2,
        message: `Row ${index + 2}: all rows must use one gradebook_id`,
      })),
    };
  }
  const gradebookId = positiveId(gradebookIds[0], 'gradebook_id', 2);
  const detail = await getGradebook(user, gradebookId);
  if (detail.status !== 'draft') {
    throw new HttpError(409, 'Grade import is allowed only for a draft gradebook');
  }
  const studentMap = new Map(
    detail.students
      .filter((student) => student.student_code)
      .map((student) => [student.student_code!, student]),
  );
  const columnMap = new Map(detail.columns.map((column) => [column.label, column]));
  const scoreMap = new Map(
    detail.scores.map((score) => [
      `${score.student_user_id}:${score.column_id}`,
      score,
    ]),
  );
  const states = new Set(['scored', 'absent', 'exempt']);
  const seen = new Set<string>();
  const valid: CsvRow[] = [];
  rows.forEach((row, index) => {
    const rowNumber = index + 2;
    try {
      const studentCode = required(row, 'student_code', rowNumber);
      const columnLabel = required(row, 'column_label', rowNumber);
      const state = required(row, 'state', rowNumber);
      if (!states.has(state)) throw new Error(`Row ${rowNumber}: score state is invalid`);
      const student = studentMap.get(studentCode);
      const column = columnMap.get(columnLabel);
      if (!student) throw new Error(`Row ${rowNumber}: student_code was not found`);
      if (!column) throw new Error(`Row ${rowNumber}: column_label was not found`);
      const key = `${student.user_id}:${column.id}`;
      if (seen.has(key)) throw new Error(`Row ${rowNumber}: duplicate student and column`);
      seen.add(key);
      const current = scoreMap.get(key);
      const expectedVersion = row.expected_version
        ? Number(row.expected_version)
        : current?.version ?? 0;
      if (!Number.isInteger(expectedVersion) || expectedVersion < 0) {
        throw new Error(`Row ${rowNumber}: expected_version must be zero or greater`);
      }
      let score = '';
      if (state === 'scored') {
        score = required(row, 'score', rowNumber);
        const numericScore = Number(score);
        if (
          !Number.isFinite(numericScore) ||
          numericScore < 0 ||
          numericScore > Number(column.max_score)
        ) {
          throw new Error(
            `Row ${rowNumber}: score must be between 0 and ${column.max_score}`,
          );
        }
      } else if (row.score) {
        throw new Error(`Row ${rowNumber}: score must be empty for ${state}`);
      }
      valid.push({
        gradebook_id: String(gradebookId),
        student_code: studentCode,
        student_user_id: String(student.user_id),
        column_label: columnLabel,
        column_id: String(column.id),
        state,
        score,
        expected_version: String(expectedVersion),
        reason: row.reason ?? '',
      });
    } catch (error) {
      rowError(errors, rowNumber, error);
    }
  });
  return { rows: valid, errors };
}

async function validateRows(
  user: AuthUser,
  type: AcademicImportType,
  rows: CsvRow[],
) {
  if (type === 'enrollments') return validateEnrollmentRows(rows);
  if (type === 'assignments') return validateAssignmentRows(rows);
  if (type === 'attendance') return validateAttendanceRows(user, rows);
  return validateGradeRows(user, rows);
}

export function getImportTemplate(type: AcademicImportType) {
  const template = importTemplates[type];
  return createCsv(template.headers, [template.example]);
}

export async function previewAcademicImport(
  user: AuthUser,
  input: {
    type: AcademicImportType;
    idempotencyKey: string;
    file: Express.Multer.File;
  },
) {
  requireAdmin(user);
  const hash = createHash('sha256').update(input.file.buffer).digest('hex');
  const existing = await findImportJobByKey(user.id, input.idempotencyKey);
  if (existing) {
    if (existing.import_type !== input.type || existing.file_sha256 !== hash) {
      throw new HttpError(
        409,
        'idempotency_key was already used for a different file or import type',
      );
    }
    return existing;
  }
  const rawRows = parseAcademicCsv(input.file.buffer);
  const validation = await validateRows(user, input.type, rawRows);
  return createImportJob(
    {
      type: input.type,
      idempotencyKey: input.idempotencyKey,
      originalFileName: input.file.originalname.slice(0, 255),
      fileSha256: hash,
      rows: validation.rows,
      errors: validation.errors,
    },
    user.id,
  );
}

export async function getAcademicImportJob(user: AuthUser, id: number) {
  requireAdmin(user);
  const job = await findImportJobById(id);
  if (!job || job.created_by_user_id !== user.id) {
    throw new HttpError(404, 'Academic import job not found');
  }
  return job;
}

export async function listAcademicImportJobs(
  user: AuthUser,
  query: ImportJobListQuery,
) {
  requireAdmin(user);
  const result = await listImportJobs(user.id, query);
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

function assertCommittable(job: AcademicImportJob) {
  if (job.status === 'completed') return false;
  if (job.status !== 'preview_ready') {
    throw new HttpError(409, 'Import job is not ready to commit');
  }
  if (job.invalid_rows > 0) {
    throw new HttpError(
      409,
      'Import cannot be committed while validation errors remain',
    );
  }
  return true;
}

export async function commitAcademicImport(user: AuthUser, id: number) {
  const job = await getAcademicImportJob(user, id);
  if (!assertCommittable(job)) return job;
  try {
    if (job.import_type === 'enrollments') {
      return await commitEnrollmentRows(
        id,
        user.id,
        job.preview_rows.map((row) => ({
          student_user_id: Number(row.student_user_id),
          classroom_id: Number(row.classroom_id),
          academic_year_id: Number(row.academic_year_id),
          enrolled_at: row.enrolled_at,
          note: row.note || null,
        })),
      );
    }
    if (job.import_type === 'assignments') {
      return await commitAssignmentRows(
        id,
        user.id,
        job.preview_rows.map((row) => ({
          teaching_assignment_id: Number(row.teaching_assignment_id),
          classroom_id: Number(row.classroom_id),
          subject_id: Number(row.subject_id),
          semester_id: Number(row.semester_id),
          title: row.title,
          description: row.description || null,
          due_at: row.due_at,
          allow_late: row.allow_late === 'true',
        })),
      );
    }
    await setImportJobStatus(id, 'committing');
    await addImportAudit(id, user.id, 'commit_started', {
      rows: job.preview_rows.length,
    });
    if (job.import_type === 'attendance') {
      const sessionId = Number(job.preview_rows[0]?.session_id);
      const correctionReason =
        job.preview_rows.find((row) => row.correction_reason)?.correction_reason ||
        undefined;
      await saveAttendance(user, sessionId, {
        records: job.preview_rows.map((row) => ({
          student_user_id: Number(row.student_user_id),
          status: row.status as 'present' | 'excused' | 'unexcused' | 'late',
          note: row.note || undefined,
        })),
        correction_reason: correctionReason,
      });
    } else {
      const gradebookId = Number(job.preview_rows[0]?.gradebook_id);
      const reason =
        job.preview_rows.find((row) => row.reason)?.reason || undefined;
      await updateGradebookScores(user, gradebookId, {
        entries: job.preview_rows.map((row) => ({
          student_user_id: Number(row.student_user_id),
          column_id: Number(row.column_id),
          state: row.state as 'scored' | 'absent' | 'exempt',
          score: row.state === 'scored' ? row.score : null,
          expected_version: Number(row.expected_version),
        })),
        reason,
      });
    }
    const summary = { committed_rows: job.preview_rows.length };
    await setImportJobStatus(id, 'completed', summary);
    await addImportAudit(id, user.id, 'commit_completed', summary);
    return getAcademicImportJob(user, id);
  } catch (error) {
    const publicMessage =
      error instanceof HttpError ? error.message : 'Academic import commit failed';
    await setImportJobStatus(id, 'failed', {}, publicMessage);
    await addImportAudit(id, user.id, 'commit_failed', {
      message: publicMessage,
    });
    throw error;
  }
}

export async function exportImportErrors(user: AuthUser, id: number) {
  const job = await getAcademicImportJob(user, id);
  return createCsv(
    ['row', 'message'],
    job.validation_errors.map((error) => ({
      row: error.row,
      message: error.message,
    })),
  );
}

export async function exportRoster(user: AuthUser, classroomId: number) {
  requireAdmin(user);
  const rows = await exportClassroomRoster(classroomId);
  return createCsv(
    [
      'student_code',
      'full_name',
      'email',
      'classroom_name',
      'academic_year',
      'status',
      'enrolled_at',
      'ended_at',
    ],
    rows,
  );
}

export async function exportAttendance(
  user: AuthUser,
  classroomId: number,
  semesterId: number,
) {
  requireAdmin(user);
  const rows = await exportClassroomAttendance(classroomId, semesterId);
  return createCsv(
    [
      'session_date',
      'lesson_index',
      'subject_name',
      'student_code',
      'full_name',
      'status',
      'note',
    ],
    rows,
  );
}

export async function exportGradebook(user: AuthUser, gradebookId: number) {
  requireAdmin(user);
  const detail = await getGradebook(user, gradebookId);
  const scoreMap = new Map(
    detail.scores.map((score) => [
      `${score.student_user_id}:${score.column_id}`,
      score,
    ]),
  );
  const rows = detail.students.flatMap((student) =>
    detail.columns.map((column) => {
      const score = scoreMap.get(`${student.user_id}:${column.id}`);
      return {
        gradebook_id: detail.id,
        student_code: student.student_code,
        full_name: student.full_name,
        column_label: column.label,
        state: score?.state ?? '',
        score: score?.score ?? '',
        version: score?.version ?? 0,
        final_score:
          detail.totals.find((total) => total.student_user_id === student.user_id)
            ?.final_score ?? '',
      };
    }),
  );
  return createCsv(
    [
      'gradebook_id',
      'student_code',
      'full_name',
      'column_label',
      'state',
      'score',
      'version',
      'final_score',
    ],
    rows,
  );
}

export async function exportTranscriptSummary(
  user: AuthUser,
  classroomId: number,
  semesterId: number,
) {
  requireAdmin(user);
  const result = await listClassroomTranscripts(user, classroomId, semesterId);
  return createCsv(
    [
      'student_code',
      'full_name',
      'overall_average',
      'completed_subjects',
      'total_subjects',
      'source',
    ],
    result.data,
  );
}

export async function getReportSummary(
  user: AuthUser,
  filters: ReportFilters,
) {
  requireAdmin(user);
  return getAcademicReportSummary(filters);
}
