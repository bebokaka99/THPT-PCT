import type { RequestHandler } from 'express';
import { HttpError } from '../../utils/http-error.js';
import {
  createEvent,
  deleteEvent,
  getAdminEvent,
  getPublicEvent,
  listEvents,
  setEventStatus,
  setEventVisibility,
  updateEvent,
} from './event.service.js';
import {
  validateCreateEvent,
  validateEventId,
  validateListEventsQuery,
  validateUpdateEvent,
} from './event.validation.js';

export const listPublicEventsController: RequestHandler = async (req, res, next) => {
  try {
    res.json(await listEvents(validateListEventsQuery(req.query), true));
  } catch (error) { next(error); }
};

export const listAdminEventsController: RequestHandler = async (req, res, next) => {
  try {
    res.json(await listEvents(validateListEventsQuery(req.query), false));
  } catch (error) { next(error); }
};

export const getPublicEventController: RequestHandler = async (req, res, next) => {
  try { res.json({ data: await getPublicEvent(req.params.slug) }); } catch (error) { next(error); }
};

export const getAdminEventController: RequestHandler = async (req, res, next) => {
  try { res.json({ data: await getAdminEvent(validateEventId(req.params.id)) }); } catch (error) { next(error); }
};

export const createEventController: RequestHandler = async (req, res, next) => {
  try {
    if (!req.user) throw new HttpError(401, 'Authentication required');
    res.status(201).json({ data: await createEvent(validateCreateEvent(req.body), req.user.id) });
  } catch (error) { next(error); }
};

export const updateEventController: RequestHandler = async (req, res, next) => {
  try {
    res.json({ data: await updateEvent(validateEventId(req.params.id), validateUpdateEvent(req.body)) });
  } catch (error) { next(error); }
};

function stateController(action: 'cancel' | 'complete' | 'publish' | 'hide'): RequestHandler {
  return async (req, res, next) => {
    try {
      const id = validateEventId(req.params.id);
      const event =
        action === 'cancel'
          ? await setEventStatus(id, 'cancelled')
          : action === 'complete'
            ? await setEventStatus(id, 'completed')
            : await setEventVisibility(id, action === 'publish');
      res.json({ data: event });
    } catch (error) { next(error); }
  };
}

export const cancelEventController = stateController('cancel');
export const completeEventController = stateController('complete');
export const publishEventController = stateController('publish');
export const hideEventController = stateController('hide');

export const deleteEventController: RequestHandler = async (req, res, next) => {
  try {
    await deleteEvent(validateEventId(req.params.id));
    res.status(204).send();
  } catch (error) { next(error); }
};
