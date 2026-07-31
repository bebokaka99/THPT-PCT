import type { AuthUser } from '../auth/auth.types.js';
import { HttpError } from '../../utils/http-error.js';
import type { CreateNotificationInput, ListMyNotificationsQuery, ListNotificationsQuery } from './notification.types.js';
import {
  countUnreadNotifications,
  createNotificationRecord,
  deleteNotificationRecord,
  findClassroomStudentUserIds,
  findClassroomStudentUserIdsAtDate,
  findClassroomGuardianUserIdsAtDate,
  findMyNotifications,
  findNotifications,
  findRecipientUserIds,
  markAllUserNotificationsRead,
  markUserNotificationRead,
} from './notification.repository.js';

function ensureAdmin(user: AuthUser) {
  if (!user.roles.includes('admin') && !user.permissions.includes('notifications.manage')) {
    throw new HttpError(403, 'Permission denied');
  }
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

export async function listAdminNotifications(user: AuthUser, query: ListNotificationsQuery) {
  ensureAdmin(user);
  const { data, total } = await findNotifications(query);
  return { data, meta: { page: query.page, limit: query.limit, total, totalPages: Math.ceil(total / query.limit) } };
}

export async function createAdminNotification(user: AuthUser, input: CreateNotificationInput) {
  ensureAdmin(user);
  const recipients = await findRecipientUserIds(input.target_role);
  const notification = await createNotificationRecord(input, user.id, recipients);
  if (!notification) throw new HttpError(500, 'Failed to create notification');
  return notification;
}

export async function deleteAdminNotification(user: AuthUser, id: number) {
  ensureAdmin(user);
  if (!(await deleteNotificationRecord(id))) throw new HttpError(404, 'Notification not found');
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
