import type { AuthUser } from '../auth/auth.types.js';
import { findSemesterById } from '../academic-periods/academic-period.repository.js';
import { findAttendanceSessionById } from '../attendance/attendance.repository.js';
import { findDailyScheduleForTeacher } from '../schedule-overrides/schedule-override.repository.js';
import { HttpError } from '../../utils/http-error.js';
import {
  findClassJournalAudits,
  findClassJournalById,
  findClassJournalReport,
  findClassJournals,
  findEffectiveJournalSlot,
  insertClassJournal,
  updateClassJournalRecord,
} from './class-journal.repository.js';
import type { ClassJournal, ClassJournalInput, ClassJournalListQuery } from './class-journal.types.js';

function isAdmin(user: AuthUser) {
  return user.roles.includes('admin');
}

function canReview(user: AuthUser) {
  return isAdmin(user) || user.permissions.includes('class_journals.review');
}

function canView(user: AuthUser) {
  return canReview(user) || user.permissions.includes('class_journals.manage');
}

function canCorrect(user: AuthUser) {
  return isAdmin(user) || user.permissions.includes('class_journals.correct');
}

function canManage(user: AuthUser) {
  return isAdmin(user) || user.roles.includes('teacher') && user.permissions.includes('class_journals.manage');
}

function ensureManage(user: AuthUser) {
  if (!canManage(user)) throw new HttpError(403, 'Bạn không có quyền ghi sổ đầu bài');
}

function ensureReview(user: AuthUser) {
  if (!canView(user)) throw new HttpError(403, 'Bạn không có quyền theo dõi sổ đầu bài');
}

async function journalOrThrow(id: number) {
  const journal = await findClassJournalById(id);
  if (!journal) throw new HttpError(404, 'Không tìm thấy sổ đầu bài');
  return journal;
}

async function ensureSemesterWritable(semesterId: number, allowCorrection: boolean, reason?: string | null) {
  const semester = await findSemesterById(semesterId);
  if (!semester) throw new HttpError(404, 'Không tìm thấy học kỳ');
  if ((semester.status === 'closed' || semester.is_locked) && (!allowCorrection || !reason?.trim())) {
    throw new HttpError(409, allowCorrection
      ? 'Học kỳ đã khóa; chỉnh lý phải có lý do'
      : 'Học kỳ đã đóng hoặc khóa, không thể sửa sổ đầu bài');
  }
  return semester;
}

async function ensureAttendanceScope(input: ClassJournalInput, slot: Awaited<ReturnType<typeof findEffectiveJournalSlot>>) {
  if (!input.attendance_session_id) return;
  const session = await findAttendanceSessionById(input.attendance_session_id);
  if (!session
    || session.classroom_id !== slot?.classroom_id
    || session.semester_id !== slot.semester_id
    || session.subject_id !== slot.subject_id
    || session.session_date !== input.journal_date
    || session.lesson_index !== slot.lesson_index
  ) {
    throw new HttpError(400, 'attendance_session_id không khớp lớp, môn, ngày hoặc tiết hiệu lực');
  }
}

function ensureTeacherOwnsSlot(user: AuthUser, slot: NonNullable<Awaited<ReturnType<typeof findEffectiveJournalSlot>>>) {
  if (!isAdmin(user) && slot.teacher_user_id !== user.id) {
    throw new HttpError(403, 'Bạn không phải giáo viên hiệu lực của tiết này');
  }
}

export async function listClassJournals(user: AuthUser, query: ClassJournalListQuery) {
  ensureReview(user);
  const result = await findClassJournals(query, isAdmin(user) ? undefined : user.id);
  return { data: result.data, meta: { page: query.page, limit: query.limit, total: result.total, totalPages: Math.ceil(result.total / query.limit) } };
}

export async function getClassJournal(user: AuthUser, id: number) {
  ensureReview(user);
  const journal = await journalOrThrow(id);
  if (!isAdmin(user) && journal.effective_teacher_user_id !== user.id) {
    const allowed = await findClassJournals({ page: 1, limit: 1, classroom_id: journal.classroom_id, semester_id: journal.semester_id }, user.id);
    if (allowed.total === 0) throw new HttpError(403, 'Bạn không có quyền xem sổ đầu bài lớp này');
  }
  return journal;
}

export async function getClassJournalOptions(user: AuthUser, date: string) {
  ensureManage(user);
  if (isAdmin(user)) return { data: [] };
  const data = await findDailyScheduleForTeacher(user.id, date);
  return { data: data.map((slot) => ({ ...slot, journal_date: date })) };
}

export async function createClassJournal(user: AuthUser, input: ClassJournalInput) {
  ensureManage(user);
  const slot = await findEffectiveJournalSlot(input.timetable_item_id, input.journal_date);
  if (!slot) throw new HttpError(404, 'Không tìm thấy tiết thời khóa biểu đã công bố');
  ensureTeacherOwnsSlot(user, slot);
  await ensureSemesterWritable(slot.semester_id, false);
  await ensureAttendanceScope(input, slot);
  if (slot.is_cancelled && input.status !== 'cancelled') {
    throw new HttpError(409, 'Tiết đã bị hủy theo lịch hiệu lực; chỉ được ghi trạng thái cancelled');
  }
  try {
    const journal = await insertClassJournal(slot, input, user.id);
    if (!journal) throw new HttpError(500, 'Không thể tạo sổ đầu bài');
    return journal;
  } catch (error) {
    if (error instanceof Error && (error.message.includes('duplicate key') || error.message.includes('CLASS_JOURNAL'))) {
      throw new HttpError(409, 'Tiết này đã có sổ đầu bài hoặc dữ liệu không khớp scope');
    }
    throw error;
  }
}

export async function updateClassJournal(user: AuthUser, id: number, input: ClassJournalInput) {
  ensureManage(user);
  const current = await journalOrThrow(id);
  const correction = canCorrect(user);
  if (!isAdmin(user) && current.effective_teacher_user_id !== user.id) {
    throw new HttpError(403, 'Bạn không phải giáo viên hiệu lực của tiết này');
  }
  if (isAdmin(user) && !input.correction_reason?.trim()) {
    throw new HttpError(400, 'Admin chỉnh lý sổ đầu bài phải nhập lý do');
  }
  await ensureSemesterWritable(current.semester_id, correction, input.correction_reason);
  await ensureAttendanceScope(input, {
    classroom_id: current.classroom_id,
    semester_id: current.semester_id,
    subject_id: current.subject_id,
    lesson_index: current.effective_lesson_index,
  } as Awaited<ReturnType<typeof findEffectiveJournalSlot>>);
  return updateClassJournalRecord(id, input, current, user.id);
}

export async function getClassJournalAudit(user: AuthUser, id: number) {
  await getClassJournal(user, id);
  return findClassJournalAudits(id);
}

export async function getClassJournalReport(user: AuthUser, query: { from: string; to: string; classroom_id?: number; semester_id?: number }) {
  if (!canReview(user)) throw new HttpError(403, 'Chỉ admin hoặc reviewer được xem báo cáo sổ đầu bài');
  return findClassJournalReport(query);
}

export type ClassJournalView = ClassJournal;
