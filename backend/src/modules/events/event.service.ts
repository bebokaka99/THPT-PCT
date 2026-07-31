import { HttpError } from '../../utils/http-error.js';
import { slugify } from '../../utils/slug.js';
import {
  deleteEventRecord,
  findEventById,
  findEvents,
  findPublicEventBySlug,
  insertEvent,
  isEventSlugTaken,
  updateEventRecord,
  updateEventState,
} from './event.repository.js';
import type {
  EventInput,
  EventStatus,
  ListEventsQuery,
  UpdateEventInput,
} from './event.types.js';

export async function listEvents(query: ListEventsQuery, publicOnly: boolean) {
  const result = await findEvents(query, publicOnly);
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

export async function getPublicEvent(slug: string) {
  const event = await findPublicEventBySlug(slug);
  if (!event) throw new HttpError(404, 'Event not found');
  return event;
}

export async function getAdminEvent(id: number) {
  const event = await findEventById(id);
  if (!event) throw new HttpError(404, 'Event not found');
  return event;
}

export async function createEvent(input: EventInput, userId: number) {
  const slug = input.slug ? slugify(input.slug) : slugify(input.title);
  if (!slug) throw new HttpError(400, 'slug is invalid');
  if (await isEventSlugTaken(slug)) {
    throw new HttpError(409, 'Event slug already exists');
  }
  const event = await insertEvent({ ...input, slug, created_by: userId });
  if (!event) throw new HttpError(500, 'Failed to create event');
  return event;
}

export async function updateEvent(id: number, input: UpdateEventInput) {
  const current = await getAdminEvent(id);
  const slug = input.slug
    ? slugify(input.slug)
    : input.title
      ? slugify(input.title)
      : current.slug;
  if (!slug) throw new HttpError(400, 'slug is invalid');
  if (await isEventSlugTaken(slug, id)) {
    throw new HttpError(409, 'Event slug already exists');
  }
  const startTime = input.start_time ?? current.start_time;
  const endTime = input.end_time === undefined ? current.end_time : input.end_time;
  if (endTime && new Date(endTime).getTime() < new Date(startTime).getTime()) {
    throw new HttpError(400, 'end_time must be after start_time');
  }
  const event = await updateEventRecord(id, {
    title: input.title ?? current.title,
    slug,
    description:
      input.description === undefined ? current.description : input.description,
    category: input.category === undefined ? current.category : input.category,
    location: input.location === undefined ? current.location : input.location,
    cover_image_url:
      input.cover_image_url === undefined
        ? current.cover_image_url
        : input.cover_image_url,
    start_time: startTime,
    end_time: endTime,
    all_day: input.all_day ?? current.all_day,
    status: input.status ?? current.status,
    is_public: input.is_public ?? current.is_public,
  });
  if (!event) throw new HttpError(404, 'Event not found');
  return event;
}

export async function setEventStatus(id: number, status: EventStatus) {
  await getAdminEvent(id);
  const event = await updateEventState(id, { status });
  if (!event) throw new HttpError(404, 'Event not found');
  return event;
}

export async function setEventVisibility(id: number, isPublic: boolean) {
  await getAdminEvent(id);
  const event = await updateEventState(id, { isPublic });
  if (!event) throw new HttpError(404, 'Event not found');
  return event;
}

export async function deleteEvent(id: number) {
  if (!(await deleteEventRecord(id))) throw new HttpError(404, 'Event not found');
}
