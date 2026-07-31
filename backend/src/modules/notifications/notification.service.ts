import type { AuthUser } from '../auth/auth.types.js';
import { HttpError } from '../../utils/http-error.js';
import type { CreateNotificationInput, ListMyNotificationsQuery, ListNotificationsQuery } from './notification.types.js';
import {
  acknowledgeUserNotification,
  canTeacherSendToClassroom,
  countUnreadNotifications,
  createNotificationRecord,
  deleteNotificationRecord,
  findActiveUserOptions,
  findClassroomStudentUserIds,
  findClassroomStudentUserIdsAtDate,
  findClassroomGuardianUserIdsAtDate,
  findCommunicationClassroomOptions,
  findMyNotifications,
  findNotificationReport,
  findNotifications,
  findRecipientUserIds,
  findScopedRecipientUserIds,
  isNotificationAuthor,
  markAllUserNotificationsRead,
  markUserNotificationRead,
} from './notification.repository.js';

function ensureAdmin(user: AuthUser) {
  if (!user.roles.includes('admin') && !user.permissions.includes('notifications.manage')) {
    throw new HttpError(403, 'Permission denied');
  }
}

function isAdmin(user: AuthUser) {
  return user.roles.includes('admin');
}

function canSend(user: AuthUser) {
  return isAdmin(user) || user.permissions.includes('notifications.send') || user.permissions.includes('notifications.manage');
}

function canReport(user: AuthUser) {
  return isAdmin(user) || user.permissions.includes('notifications.report') || user.permissions.includes('notifications.manage');
}

export async function listMyNotifications(user: AuthUser, query: ListMyNotificationsQuery) {
  const { data, total } = await findMyNotifications(user.id, query);
  return { data, meta: { page: query.page, limit: query.limit, total, totalPages: Math.ceil(total / query.limit) } };
}

export function getMyUnreadCount(user: AuthUser) {
  return countUnreadNotifications(user.id);
}

export async function readMyNotification(user: AuthUser, notificationId: number) {
  if (!(await markUserNotificationRead(user.id, notificationId))) {
    throw new HttpError(404, 'Notification not found');
  }
}

export function readAllMyNotifications(user: AuthUser) {
  return markAllUserNotificationsRead(user.id);
}

export async function acknowledgeMyNotification(user: AuthUser, notificationId: number) {
  if (!(await acknowledgeUserNotification(user.id, notificationId))) {
    throw new HttpError(404, 'Không tìm thấy thông báo cần xác nhận');
  }
}

export async function listAdminNotifications(user: AuthUser, query: ListNotificationsQuery) {
  if (!canReport(user)) throw new HttpError(403, 'Bạn không có quyền xem báo cáo thông báo');
  const { data, total } = await findNotifications(query, isAdmin(user) ? undefined : user.id);
  return { data, meta: { page: query.page, limit: query.limit, total, totalPages: Math.ceil(total / query.limit) } };
}

export async function createAdminNotification(user: AuthUser, input: CreateNotificationInput) {
  if (!canSend(user)) throw new HttpError(403, 'Bạn không có quyền gửi thông báo');
  if (!isAdmin(user)) {
    if (!user.roles.includes('teacher')) throw new HttpError(403, 'Chỉ quản trị viên hoặc giáo viên được gửi thông báo');
    if (input.target_scope !== 'classroom' || !input.classroom_id) {
      throw new HttpError(403, 'Giáo viên chỉ được gửi thông báo trong lớp được phân công');
    }
    if (!(await canTeacherSendToClassroom(user.id, input.classroom_id))) {
      throw new HttpError(403, 'Bạn không được phân công vào lớp này');
    }
    if (!['all', 'student', 'guardian'].includes(input.target_role)) {
      throw new HttpError(403, 'Giáo viên chỉ được gửi cho học sinh hoặc phụ huynh trong lớp');
    }
  }
  const recipients = await findScopedRecipientUserIds(input);
  if (recipients.length === 0) throw new HttpError(400, 'Phạm vi đã chọn không có người nhận hợp lệ');
  const notification = await createNotificationRecord(input, user.id, recipients);
  if (!notification) throw new HttpError(500, 'Failed to create notification');
  return notification;
}

export async function deleteAdminNotification(user: AuthUser, id: number) {
  ensureAdmin(user);
  if (!(await deleteNotificationRecord(id, user.id))) throw new HttpError(404, 'Notification not found');
}

export async function getCommunicationOptions(user: AuthUser) {
  if (!canSend(user)) throw new HttpError(403, 'Bạn không có quyền gửi thông báo');
  const admin = isAdmin(user);
  const [classrooms, users] = await Promise.all([
    findCommunicationClassroomOptions(user.id, admin),
    admin ? findActiveUserOptions() : Promise.resolve([]),
  ]);
  return { classrooms, users, grades: [10, 11, 12] };
}

export async function getNotificationDeliveryReport(user: AuthUser, id: number) {
  if (!canReport(user)) throw new HttpError(403, 'Bạn không có quyền xem báo cáo thông báo');
  if (!isAdmin(user) && !(await isNotificationAuthor(id, user.id))) {
    throw new HttpError(403, 'Giáo viên chỉ được xem báo cáo thông báo do mình gửi');
  }
  const report = await findNotificationReport(id);
  if (!report) throw new HttpError(404, 'Không tìm thấy thông báo');
  return report;
}

export async function createClassroomStudentNotification(input: {
  classroomId: number;
  createdByUserId: number;
  title: string;
  message: string;
  kind: 'post' | 'document';
  relatedUrl: string;
}) {
  const recipients = await findClassroomStudentUserIds(input.classroomId);
  if (recipients.length === 0) return null;
  return createNotificationRecord(
    {
      title: input.title,
      message: input.message,
      type: input.kind,
      target_role: 'student',
      classroom_id: input.classroomId,
      related_url: input.relatedUrl,
    },
    input.createdByUserId,
    recipients,
  );
}

export async function createAssignmentStudentNotification(input: {
  classroomId: number;
  createdByUserId: number;
  assignmentId: number;
  title: string;
  message: string;
  publishedAt: Date;
}) {
  const recipients = await findClassroomStudentUserIdsAtDate(
    input.classroomId,
    input.publishedAt,
  );
  if (recipients.length === 0) return null;
  return createNotificationRecord(
    {
      title: input.title,
      message: input.message,
      type: 'classroom',
      target_role: 'student',
      classroom_id: input.classroomId,
      related_url: `/student/assignments?assignment=${input.assignmentId}`,
    },
    input.createdByUserId,
    recipients,
  );
}

export async function createGradebookWorkflowNotification(input: {
  createdByUserId: number;
  recipient: 'admin' | 'teacher' | 'students';
  teacherUserId: number;
  classroomId: number;
  title: string;
  message: string;
  relatedUrl: string;
}) {
  const recipients =
    input.recipient === 'admin'
      ? await findRecipientUserIds('admin')
      : input.recipient === 'teacher'
        ? [input.teacherUserId]
        : await findClassroomStudentUserIds(input.classroomId);
  if (recipients.length === 0) return null;
  return createNotificationRecord(
    {
      title: input.title,
      message: input.message,
      type: 'school',
      target_role:
        input.recipient === 'admin'
          ? 'admin'
          : input.recipient === 'teacher'
            ? 'teacher'
            : 'student',
      classroom_id: input.classroomId,
      related_url: input.relatedUrl,
    },
    input.createdByUserId,
    recipients,
  );
}

export async function createAcademicCalendarNotifications(input: {
  classroomId: number | null;
  teacherUserId: number | null;
  createdByUserId: number;
  entryId: number;
  title: string;
  message: string;
  effectiveAt: Date;
  isUpdate: boolean;
}) {
  const prefix = input.isUpdate ? 'Lịch học vụ đã cập nhật' : 'Lịch học vụ mới';
  const jobs: Array<Promise<unknown>> = [];
  if (input.classroomId) {
    const [students, guardians] = await Promise.all([
      findClassroomStudentUserIdsAtDate(input.classroomId, input.effectiveAt),
      findClassroomGuardianUserIdsAtDate(input.classroomId, input.effectiveAt),
    ]);
    if (students.length) {
      jobs.push(createNotificationRecord({
        title: `${prefix}: ${input.title}`,
        message: input.message,
        type: 'timetable',
        target_role: 'student',
        classroom_id: input.classroomId,
        related_url: `/student/academic-calendar?entry=${input.entryId}`,
      }, input.createdByUserId, students));
    }
    if (guardians.length) {
      jobs.push(createNotificationRecord({
        title: `${prefix}: ${input.title}`,
        message: input.message,
        type: 'timetable',
        target_role: 'guardian',
        classroom_id: input.classroomId,
        related_url: '/parent/academic-calendar',
      }, input.createdByUserId, guardians));
    }
  } else {
    for (const role of ['teacher', 'student', 'guardian'] as const) {
      const recipients = await findRecipientUserIds(role);
      if (recipients.length) {
        jobs.push(createNotificationRecord({
          title: `${prefix}: ${input.title}`,
          message: input.message,
          type: 'timetable',
          target_role: role,
          related_url: role === 'teacher' ? '/teacher/academic-calendar' : role === 'student' ? '/student/academic-calendar' : '/parent/academic-calendar',
        }, input.createdByUserId, recipients));
      }
    }
  }
  if (input.teacherUserId && input.teacherUserId !== input.createdByUserId) {
    jobs.push(createNotificationRecord({
      title: `${prefix}: ${input.title}`,
      message: input.message,
      type: 'timetable',
      target_role: 'teacher',
      classroom_id: input.classroomId,
      related_url: `/teacher/academic-calendar?entry=${input.entryId}`,
    }, input.createdByUserId, [input.teacherUserId]));
  }
  await Promise.all(jobs);
}

export async function createScheduleOverrideNotifications(input: {
  classroomId: number;
  overrideId: number;
  date: string;
  createdByUserId: number;
  title: string;
  message: string;
}) {
  // Use midday so PostgreSQL date casts cannot move a Vietnam calendar date
  // to the previous UTC day when the local date is midnight.
  const effectiveDate = new Date(`${input.date}T12:00:00+07:00`);
  const [students, guardians] = await Promise.all([
    findClassroomStudentUserIdsAtDate(input.classroomId, effectiveDate),
    findClassroomGuardianUserIdsAtDate(input.classroomId, effectiveDate),
  ]);
  const jobs: Array<Promise<unknown>> = [];
  if (students.length) {
    jobs.push(createNotificationRecord({
      title: input.title,
      message: input.message,
      type: 'timetable',
      target_role: 'student',
      classroom_id: input.classroomId,
      related_url: `/student/classes/${input.classroomId}?tab=timetable&date=${input.date}`,
    }, input.createdByUserId, students));
  }
  if (guardians.length) {
    jobs.push(createNotificationRecord({
      title: input.title,
      message: input.message,
      type: 'timetable',
      target_role: 'guardian',
      classroom_id: input.classroomId,
      related_url: '/parent/academic-calendar',
    }, input.createdByUserId, guardians));
  }
  await Promise.all(jobs);
}
