import { HttpError } from '../../utils/http-error.js';
import {
  asRecord,
  firstQueryValue as first,
  flexibleBoolean,
  nullableStringValue as stringValue,
  positiveIntegerValue as idValue,
} from '../../validators/common.js';
import type {
  CreateNotificationInput,
  ListMyNotificationsQuery,
  ListNotificationsQuery,
  NotificationPriority,
  NotificationTargetRole,
  NotificationTargetScope,
  NotificationType,
} from './notification.types.js';

const types = new Set<NotificationType>(['system', 'school', 'classroom', 'post', 'document', 'event', 'timetable']);
const targetRoles = new Set<NotificationTargetRole>(['all', 'admin', 'teacher', 'student', 'guardian']);
const priorities = new Set<NotificationPriority>(['normal', 'important', 'urgent']);
const targetScopes = new Set<NotificationTargetScope>(['school', 'role', 'grade', 'classroom', 'users']);

export function validateId(value: string, field = 'id') {
  return idValue(value, field, true) as number;
}

export function validateMyNotificationsQuery(query: Record<string, unknown>): ListMyNotificationsQuery {
  return {
    page: idValue(first(query.page), 'page') ?? 1,
    limit: Math.min(idValue(first(query.limit), 'limit') ?? 10, 50),
    unread: flexibleBoolean(first(query.unread), 'unread'),
    unacknowledged: flexibleBoolean(first(query.unacknowledged), 'unacknowledged'),
  };
}

export function validateNotificationsQuery(query: Record<string, unknown>): ListNotificationsQuery {
  const type = stringValue(first(query.type), 'type') ?? undefined;
  const targetRole = stringValue(first(query.target_role), 'target_role') ?? undefined;
  if (type && !types.has(type as NotificationType)) throw new HttpError(400, 'Loại thông báo không hợp lệ');
  if (targetRole && !targetRoles.has(targetRole as NotificationTargetRole)) throw new HttpError(400, 'Vai trò nhận thông báo không hợp lệ');
  return {
    page: idValue(first(query.page), 'page') ?? 1,
    limit: Math.min(idValue(first(query.limit), 'limit') ?? 10, 50),
    q: (stringValue(first(query.q), 'q') ?? undefined) as string | undefined,
    type: type as NotificationType | undefined,
    target_role: targetRole as NotificationTargetRole | undefined,
  };
}

function optionalDate(value: unknown, field: string) {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string') throw new HttpError(400, `${field} phải là chuỗi ngày giờ`);
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new HttpError(400, `${field} không hợp lệ`);
  return date;
}

export function validateCreateNotification(body: unknown): CreateNotificationInput {
  const input = asRecord(body);
  const type = (stringValue(input.type, 'type') ?? 'system') as NotificationType;
  const targetRole = (stringValue(input.target_role, 'target_role') ?? 'all') as NotificationTargetRole;
  const targetScope = (stringValue(input.target_scope, 'target_scope') ?? 'role') as NotificationTargetScope;
  const priority = (stringValue(input.priority, 'priority') ?? 'normal') as NotificationPriority;
  if (!types.has(type)) throw new HttpError(400, 'Loại thông báo không hợp lệ');
  if (!targetRoles.has(targetRole)) throw new HttpError(400, 'Vai trò nhận thông báo không hợp lệ');
  if (!targetScopes.has(targetScope)) throw new HttpError(400, 'Phạm vi nhận thông báo không hợp lệ');
  if (!priorities.has(priority)) throw new HttpError(400, 'Mức ưu tiên không hợp lệ');

  const classroomId = idValue(input.classroom_id, 'classroom_id') ?? null;
  const gradeLevel = idValue(input.grade_level, 'grade_level') ?? null;
  if (gradeLevel !== null && ![10, 11, 12].includes(gradeLevel)) {
    throw new HttpError(400, 'Khối lớp phải là 10, 11 hoặc 12');
  }
  const userIds = input.user_ids === undefined
    ? []
    : Array.isArray(input.user_ids)
      ? [...new Set(input.user_ids.map((value) => idValue(value, 'user_ids') as number))]
      : (() => { throw new HttpError(400, 'user_ids phải là một mảng'); })();

  if (targetScope === 'classroom' && !classroomId) throw new HttpError(400, 'Vui lòng chọn lớp nhận thông báo');
  if (targetScope === 'grade' && !gradeLevel) throw new HttpError(400, 'Vui lòng chọn khối nhận thông báo');
  if (targetScope === 'users' && userIds.length === 0) throw new HttpError(400, 'Vui lòng chọn ít nhất một người nhận');

  const requiresAcknowledgement = flexibleBoolean(input.requires_acknowledgement, 'requires_acknowledgement') ?? false;
  return {
    title: stringValue(input.title, 'title', true) as string,
    message: stringValue(input.message, 'message', true) as string,
    type,
    target_role: targetRole,
    target_scope: targetScope,
    priority,
    classroom_id: classroomId,
    grade_level: gradeLevel,
    user_ids: userIds,
    related_url: stringValue(input.related_url, 'related_url') ?? null,
    requires_acknowledgement: requiresAcknowledgement,
    idempotency_key: stringValue(input.idempotency_key, 'idempotency_key') ?? null,
    expires_at: optionalDate(input.expires_at, 'expires_at'),
  };
}
