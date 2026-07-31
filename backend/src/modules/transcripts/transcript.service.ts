import type { AuthUser } from '../auth/auth.types.js';
import { findGradebookTotals } from '../gradebooks/gradebook.repository.js';
import {
  findPublishedConductForSemester,
  findPublishedConductForStudent,
} from '../conduct/conduct.repository.js';
import { HttpError } from '../../utils/http-error.js';
import {
  findClassroomStudentIds,
  findPublishedGradebooksForSemester,
  findSemesterSnapshotStudentIds,
  findSemesterStudentIds,
  findTeacherClassroomSubjectScope,
  findTeacherTranscriptScope,
  findTranscriptPeriod,
  findTranscriptSnapshot,
  findTranscriptStudent,
  insertTranscriptSnapshot,
} from './transcript.repository.js';
import type {
  StudentTranscript,
  TranscriptAccessScope,
  TranscriptClassStudent,
} from './transcript.types.js';

function isAdmin(user: AuthUser) {
  return user.roles.includes('admin');
}

function average(values: number[]) {
  if (values.length === 0) return null;
  return Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 100) / 100;
}

async function buildLiveTranscript(
  studentUserId: number,
  semesterId: number,
): Promise<{
  transcript: StudentTranscript;
  classroomId: number;
  academicYearId: number;
}> {
  const [period, student, gradebooks, conduct] = await Promise.all([
    findTranscriptPeriod(semesterId),
    findTranscriptStudent(studentUserId, semesterId),
    findPublishedGradebooksForSemester(semesterId),
    findPublishedConductForStudent(studentUserId, semesterId),
  ]);
  if (!period) throw new HttpError(404, 'Semester not found');
  if (!student) throw new HttpError(404, 'Student enrollment not found for semester');

  const subjects = [];
  for (const gradebook of gradebooks) {
    if (Number(gradebook.classroom_id) !== Number(student.classroom_id)) continue;
    const totals = await findGradebookTotals(Number(gradebook.id));
    const total = totals.find((item) => item.student_user_id === studentUserId);
    subjects.push({
      subject_id: Number(gradebook.subject_id),
      subject_code: String(gradebook.subject_code),
      subject_name: String(gradebook.subject_name),
      final_score: total?.final_score ?? null,
      score_scale: Number(gradebook.score_scale),
      gradebook_status: gradebook.status as 'approved' | 'locked',
    });
  }
  const completedScores = subjects
    .map((subject) => subject.final_score)
    .filter((score): score is number => score !== null);
  return {
    transcript: {
      student: {
        full_name: String(student.full_name),
        student_code: student.student_code ? String(student.student_code) : null,
      },
      classroom: { name: String(student.classroom_name) },
      period: {
        semester_id: Number(period.id),
        semester_name: String(period.name),
        academic_year_name: String(period.academic_year_name),
        is_locked: Boolean(period.is_locked),
        status: String(period.status),
      },
      subjects,
      overall_average: average(completedScores),
      completed_subjects: completedScores.length,
      total_subjects: subjects.length,
      conduct: conduct
        ? {
            rating: conduct.rating,
            homeroom_comment: conduct.homeroom_comment,
          }
        : null,
      source: 'live',
      generated_at: null,
    },
    classroomId: Number(student.classroom_id),
    academicYearId: Number(period.academic_year_id),
  };
}

async function buildSemesterLiveTranscripts(
  semesterId: number,
  studentUserIds: number[],
) {
  const [period, gradebooks, conductRecords] = await Promise.all([
    findTranscriptPeriod(semesterId),
    findPublishedGradebooksForSemester(semesterId),
    findPublishedConductForSemester(semesterId),
  ]);
  if (!period) throw new HttpError(404, 'Semester not found');
  const conductByStudent = new Map(
    conductRecords.map((record) => [record.student_user_id, record]),
  );

  const gradebookTotals = new Map<number, Awaited<ReturnType<typeof findGradebookTotals>>>();
  await Promise.all(
    gradebooks.map(async (gradebook) => {
      gradebookTotals.set(
        Number(gradebook.id),
        await findGradebookTotals(Number(gradebook.id)),
      );
    }),
  );

  const built = [];
  for (const studentUserId of studentUserIds) {
    const student = await findTranscriptStudent(studentUserId, semesterId);
    if (!student) continue;
    const subjects = gradebooks
      .filter(
        (gradebook) =>
          Number(gradebook.classroom_id) === Number(student.classroom_id),
      )
      .map((gradebook) => {
        const total = gradebookTotals
          .get(Number(gradebook.id))
          ?.find((item) => item.student_user_id === studentUserId);
        return {
          subject_id: Number(gradebook.subject_id),
          subject_code: String(gradebook.subject_code),
          subject_name: String(gradebook.subject_name),
          final_score: total?.final_score ?? null,
          score_scale: Number(gradebook.score_scale),
          gradebook_status: gradebook.status as 'approved' | 'locked',
        };
      });
    const completedScores = subjects
      .map((subject) => subject.final_score)
      .filter((score): score is number => score !== null);
    const conduct = conductByStudent.get(studentUserId);
    built.push({
      transcript: {
        student: {
          full_name: String(student.full_name),
          student_code: student.student_code
            ? String(student.student_code)
            : null,
        },
        classroom: { name: String(student.classroom_name) },
        period: {
          semester_id: Number(period.id),
          semester_name: String(period.name),
          academic_year_name: String(period.academic_year_name),
          is_locked: Boolean(period.is_locked),
          status: String(period.status),
        },
        subjects,
        overall_average: average(completedScores),
        completed_subjects: completedScores.length,
        total_subjects: subjects.length,
        conduct: conduct
          ? {
              rating: conduct.rating,
              homeroom_comment: conduct.homeroom_comment,
            }
          : null,
        source: 'live' as const,
        generated_at: null,
      },
      studentUserId,
      classroomId: Number(student.classroom_id),
      academicYearId: Number(period.academic_year_id),
    });
  }
  return built;
}

function applyScope(
  transcript: StudentTranscript,
  scope: TranscriptAccessScope,
): StudentTranscript {
  if (scope.subjectIds === null) return transcript;
  const allowed = new Set(scope.subjectIds);
  const subjects = transcript.subjects.filter((subject) => allowed.has(subject.subject_id));
  const scores = subjects
    .map((subject) => subject.final_score)
    .filter((score): score is number => score !== null);
  return {
    ...transcript,
    subjects,
    overall_average: average(scores),
    completed_subjects: scores.length,
    total_subjects: subjects.length,
  };
}

async function resolveSemesterId(studentUserId: number, semesterId?: number) {
  const period = await findTranscriptPeriod(semesterId, semesterId ? undefined : studentUserId);
  if (!period) throw new HttpError(404, 'No report card period found');
  return Number(period.id);
}

async function transcriptForStudent(
  studentUserId: number,
  semesterId: number,
) {
  const period = await findTranscriptPeriod(semesterId);
  if (!period) throw new HttpError(404, 'Semester not found');
  if (period.is_locked || period.status === 'closed') {
    const snapshot = await findTranscriptSnapshot(studentUserId, semesterId);
    if (snapshot) return snapshot;
  }
  return (await buildLiveTranscript(studentUserId, semesterId)).transcript;
}

export async function getAuthorizedStudentTranscript(
  studentUserId: number,
  semesterId?: number,
) {
  const resolvedSemesterId = await resolveSemesterId(studentUserId, semesterId);
  return transcriptForStudent(studentUserId, resolvedSemesterId);
}

export async function getMyTranscript(user: AuthUser, semesterId?: number) {
  if (!user.roles.includes('student') && !isAdmin(user)) {
    throw new HttpError(403, 'Student role required');
  }
  if (isAdmin(user) && !user.roles.includes('student')) {
    throw new HttpError(400, 'Admin must select a student');
  }
  const resolvedSemesterId = await resolveSemesterId(user.id, semesterId);
  return transcriptForStudent(user.id, resolvedSemesterId);
}

export async function getStudentTranscript(
  user: AuthUser,
  studentUserId: number,
  semesterId?: number,
) {
  if (user.roles.includes('student')) {
    if (user.id !== studentUserId) throw new HttpError(403, 'Transcript access denied');
    return getMyTranscript(user, semesterId);
  }
  const resolvedSemesterId = await resolveSemesterId(studentUserId, semesterId);
  let scope: TranscriptAccessScope = { allowed: true, subjectIds: null };
  if (!isAdmin(user)) {
    if (!user.roles.includes('teacher')) throw new HttpError(403, 'Transcript access denied');
    scope = await findTeacherTranscriptScope(user.id, studentUserId, resolvedSemesterId);
  }
  if (!scope.allowed) throw new HttpError(403, 'Transcript access denied');
  return applyScope(
    await transcriptForStudent(studentUserId, resolvedSemesterId),
    scope,
  );
}

export async function listClassroomTranscripts(
  user: AuthUser,
  classroomId: number,
  semesterId: number,
) {
  let scope: TranscriptAccessScope = { allowed: true, subjectIds: null };
  if (!isAdmin(user)) {
    if (!user.roles.includes('teacher')) throw new HttpError(403, 'Transcript access denied');
    scope = await findTeacherClassroomSubjectScope(user.id, classroomId, semesterId);
  }
  if (!scope.allowed) throw new HttpError(403, 'Transcript access denied');
  const studentIds = await findClassroomStudentIds(classroomId, semesterId);
  const data: TranscriptClassStudent[] = [];
  for (const studentId of studentIds) {
    const transcript = applyScope(
      await transcriptForStudent(studentId, semesterId),
      scope,
    );
    data.push({
      student_user_id: studentId,
      full_name: transcript.student.full_name,
      student_code: transcript.student.student_code,
      overall_average: transcript.overall_average,
      completed_subjects: transcript.completed_subjects,
      total_subjects: transcript.total_subjects,
      source: transcript.source,
    });
  }
  return { data };
}

export async function createSemesterTranscriptSnapshots(
  semesterId: number,
  generatedByUserId: number | null,
) {
  const period = await findTranscriptPeriod(semesterId);
  if (!period) throw new HttpError(404, 'Semester not found');
  const [studentIds, snapshotStudentIds] = await Promise.all([
    findSemesterStudentIds(semesterId),
    findSemesterSnapshotStudentIds(semesterId),
  ]);
  const existing = new Set(snapshotStudentIds);
  const pendingStudentIds = studentIds.filter((studentId) => !existing.has(studentId));
  const transcripts = await buildSemesterLiveTranscripts(
    semesterId,
    pendingStudentIds,
  );
  let created = 0;
  for (const built of transcripts) {
    await insertTranscriptSnapshot(
      built.transcript,
      built.studentUserId,
      built.classroomId,
      built.academicYearId,
      generatedByUserId,
    );
    created += 1;
  }
  return { semester_id: semesterId, created, total_students: studentIds.length };
}

export async function createStudentTranscriptSnapshot(
  studentUserId: number,
  semesterId: number,
  generatedByUserId: number | null,
) {
  if (await findTranscriptSnapshot(studentUserId, semesterId)) return false;
  const built = await buildLiveTranscript(studentUserId, semesterId);
  await insertTranscriptSnapshot(
    built.transcript,
    studentUserId,
    built.classroomId,
    built.academicYearId,
    generatedByUserId,
  );
  return true;
}

export async function generateSemesterSnapshots(
  user: AuthUser,
  semesterId: number,
) {
  if (!isAdmin(user) && !user.permissions.includes('transcripts.manage')) {
    throw new HttpError(403, 'Transcript management permission required');
  }
  const period = await findTranscriptPeriod(semesterId);
  if (!period) throw new HttpError(404, 'Semester not found');
  if (!period.is_locked && period.status !== 'closed') {
    throw new HttpError(409, 'Semester must be locked before manual snapshot');
  }
  return createSemesterTranscriptSnapshots(semesterId, user.id);
}
