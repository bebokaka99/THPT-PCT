import { HttpError } from '../../utils/http-error.js';
import {
  asRecord,
  firstQueryValue as first,
  flexibleBoolean,
  nullableStringValue as stringValue,
  positiveIntegerValue as idValue,
} from '../../validators/common.js';
import type { CreateNotificationInput, ListMyNotificationsQuery, ListNotificationsQuery, NotificationTargetRole, NotificationType } from './notification.types.js';

const types = new Set<NotificationType>(['system', 'school', 'classroom', 'post', 'document']);
const targetRoles = new Set<NotificationTargetRole>([
  'all',
  'admin',
  'teacher',
  'student',
  'guardian',
]);

export function validateId(value: string, field = 'id') {
  return idValue(value, field, true) as number;
}

export function validateMyNotificationsQuery(query: Record<string, unknown>): ListMyNotificationsQuery {
  return {
    page: idValue(first(query.page), 'page') ?? 1,
    limit: Math.min(idValue(first(query.limit), 'limit') ?? 10, 50),
    unread: flexibleBoolean(first(query.unread), 'unread'),
  };
}

export function validateNotificationsQuery(query: Record<string, unknown>): ListNotificationsQuery {
  const type = stringValue(first(query.type), 'type') ?? undefined;
  const targetRole = stringValue(first(query.target_role), 'target_role') ?? undefined;
  if (type && !types.has(type as NotificationType)) throw new HttpError(400, 'type is invalid');
  if (targetRole && !targetRoles.has(targetRole as NotificationTargetRole)) throw new HttpError(400, 'target_role is invalid');
  return {
    page: idValue(first(query.page), 'page') ?? 1,
    limit: Math.min(idValue(first(query.limit), 'limit') ?? 10, 50),
    q: (stringValue(first(query.q), 'q') ?? undefined) as string | undefined,
    type: type as NotificationType | undefined,
    target_role: targetRole as NotificationTargetRole | undefined,
  };
}

export function validateCreateNotification(body: unknown): CreateNotificationInput {
  const input = asRecord(body);
  const type = (stringValue(input.type, 'type') ?? 'system') as NotificationType;
  const targetRole = (stringValue(input.target_role, 'target_role') ?? 'all') as NotificationTargetRole;
  if (!types.has(type)) throw new HttpError(400, 'type is invalid');
  if (!targetRoles.has(targetRole)) throw new HttpError(400, 'target_role is invalid');
  return {
    title: stringValue(input.title, 'title', true) as string,
    message: stringValue(input.message, 'message', true) as string,
    type,
    target_role: targetRole,
    classroom_id: idValue(input.classroom_id, 'classroom_id') ?? null,
    related_url: stringValue(input.related_url, 'related_url') ?? null,
  };
}
