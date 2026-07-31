import { HttpError } from '../../utils/http-error.js';
import {
  asRecord,
  firstQueryValue,
  flexibleBoolean,
  optionalNullableString,
  parsePositiveInteger,
  positiveIntegerValue,
  requiredString,
} from '../../validators/common.js';
import type {
  EventInput,
  EventScope,
  EventStatus,
  ListEventsQuery,
  UpdateEventInput,
} from './event.types.js';

const statuses = new Set<EventStatus>(['scheduled', 'cancelled', 'completed']);
const scopes = new Set<EventScope>(['upcoming', 'past', 'all']);

function limitedString(value: unknown, field: string, maxLength: number) {
  const parsed = optionalNullableString(value, field);
  if (parsed && parsed.length > maxLength) {
    throw new HttpError(400, `${field} must not exceed ${maxLength} characters`);
  }
  return parsed;
}

function optionalDate(value: unknown, field: string) {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  if (typeof value !== 'string' && !(value instanceof Date)) {
    throw new HttpError(400, `${field} must be a valid date`);
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new HttpError(400, `${field} must be a valid date`);
  }
  return date;
}

function statusValue(value: unknown) {
  if (value === undefined) return undefined;
  if (typeof value !== 'string' || !statuses.has(value as EventStatus)) {
    throw new HttpError(400, 'status must be scheduled, cancelled, or completed');
  }
  return value as EventStatus;
}

function coverUrlValue(value: unknown) {
  const url = limitedString(value, 'cover_image_url', 500);
  if (!url) return url;
  if (url.startsWith('/uploads/images/') && !url.includes('\\')) return url;
  try {
    const parsed = new URL(url);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') return url;
  } catch {
    // Fall through to a clear validation error.
  }
  throw new HttpError(
    400,
    'cover_image_url must be an http(s) URL or start with /uploads/images/',
  );
}

function validateDateRange(startTime?: Date | null, endTime?: Date | null) {
  if (startTime && endTime && endTime.getTime() < startTime.getTime()) {
    throw new HttpError(400, 'end_time must be after start_time');
  }
}

export function validateEventId(value: string) {
  return positiveIntegerValue(value, 'event id', true) as number;
}

export function validateListEventsQuery(
  query: Record<string, unknown>,
): ListEventsQuery {
  const rawStatus = firstQueryValue(query.status);
  const rawScope = firstQueryValue(query.scope) ?? 'upcoming';
  const status = rawStatus === undefined ? undefined : statusValue(rawStatus);
  if (typeof rawScope !== 'string' || !scopes.has(rawScope as EventScope)) {
    throw new HttpError(400, 'scope must be upcoming, past, or all');
  }
  return {
    page: parsePositiveInteger(query.page, 1, 'page'),
    limit: Math.min(parsePositiveInteger(query.limit, 10, 'limit'), 50),
    q: limitedString(firstQueryValue(query.q), 'q', 120) ?? undefined,
    status,
    scope: rawScope as EventScope,
  };
}

export function validateCreateEvent(body: unknown): EventInput {
  const input = asRecord(body);
  const startTime = optionalDate(input.start_time, 'start_time');
  const endTime = optionalDate(input.end_time, 'end_time');
  if (!startTime) throw new HttpError(400, 'start_time is required');
  validateDateRange(startTime, endTime);
  return {
    title: requiredString(input.title, 'title'),
    slug: limitedString(input.slug, 'slug', 280) ?? undefined,
    description: limitedString(input.description, 'description', 10_000),
    category: limitedString(input.category, 'category', 120),
    location: limitedString(input.location, 'location', 255),
    cover_image_url: coverUrlValue(input.cover_image_url),
    start_time: startTime,
    end_time: endTime,
    all_day: flexibleBoolean(input.all_day, 'all_day') ?? false,
    status: statusValue(input.status) ?? 'scheduled',
    is_public: flexibleBoolean(input.is_public, 'is_public') ?? false,
  };
}

export function validateUpdateEvent(body: unknown): UpdateEventInput {
  const input = asRecord(body);
  const startTime = optionalDate(input.start_time, 'start_time');
  const endTime = optionalDate(input.end_time, 'end_time');
  validateDateRange(startTime, endTime);
  return {
    title:
      input.title === undefined ? undefined : requiredString(input.title, 'title'),
    slug: limitedString(input.slug, 'slug', 280) ?? undefined,
    description: limitedString(input.description, 'description', 10_000),
    category: limitedString(input.category, 'category', 120),
    location: limitedString(input.location, 'location', 255),
    cover_image_url: coverUrlValue(input.cover_image_url),
    start_time: startTime ?? undefined,
    end_time: endTime,
    all_day: flexibleBoolean(input.all_day, 'all_day'),
    status: statusValue(input.status),
    is_public: flexibleBoolean(input.is_public, 'is_public'),
  };
}
