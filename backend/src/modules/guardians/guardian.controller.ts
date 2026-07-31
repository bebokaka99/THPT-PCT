import type { Request, RequestHandler } from 'express';
import { HttpError } from '../../utils/http-error.js';
import {
  getGuardianStudentSummary,
  getMyGuardianPreferences,
  inviteGuardian,
  listAdminGuardianLinks,
  listGuardianAudits,
  listMyGuardianChildren,
  revokeGuardian,
  updateMyGuardianPreferences,
  verifyGuardian,
} from './guardian.service.js';
import {
  validateGuardianInvite,
  validateGuardianLinkId,
  validateGuardianLinkQuery,
  validateGuardianPreferences,
  validateGuardianReason,
  validateGuardianSemesterId,
  validateGuardianStudentId,
} from './guardian.validation.js';

function user(req: Request) {
  if (!req.user) throw new HttpError(401, 'Authentication required');
  return req.user;
}

export const listGuardianLinksController: RequestHandler = async (
  req,
  res,
  next,
) => {
  try {
    res.json(
      await listAdminGuardianLinks(
        user(req),
        validateGuardianLinkQuery(req.query as Record<string, unknown>),
      ),
    );
  } catch (error) {
    next(error);
  }
};

export const inviteGuardianController: RequestHandler = async (
  req,
  res,
  next,
) => {
  try {
    res.status(201).json({
      data: await inviteGuardian(user(req), validateGuardianInvite(req.body)),
    });
  } catch (error) {
    next(error);
  }
};

function transitionController(action: 'verify' | 'revoke'): RequestHandler {
  return async (req, res, next) => {
    try {
      const data =
        action === 'verify'
          ? await verifyGuardian(
              user(req),
              validateGuardianLinkId(req.params.id),
              validateGuardianReason(req.body),
            )
          : await revokeGuardian(
              user(req),
              validateGuardianLinkId(req.params.id),
              validateGuardianReason(req.body),
            );
      res.json({ data });
    } catch (error) {
      next(error);
    }
  };
}

export const verifyGuardianController = transitionController('verify');
export const revokeGuardianController = transitionController('revoke');

export const listMyGuardianChildrenController: RequestHandler = async (
  req,
  res,
  next,
) => {
  try {
    res.json(await listMyGuardianChildren(user(req)));
  } catch (error) {
    next(error);
  }
};

export const getGuardianStudentSummaryController: RequestHandler = async (
  req,
  res,
  next,
) => {
  try {
    res.json({
      data: await getGuardianStudentSummary(
        user(req),
        validateGuardianStudentId(req.params.studentId),
        validateGuardianSemesterId(req.query.semester_id),
      ),
    });
  } catch (error) {
    next(error);
  }
};

export const getGuardianPreferencesController: RequestHandler = async (
  req,
  res,
  next,
) => {
  try {
    res.json({ data: await getMyGuardianPreferences(user(req)) });
  } catch (error) {
    next(error);
  }
};

export const updateGuardianPreferencesController: RequestHandler = async (
  req,
  res,
  next,
) => {
  try {
    res.json({
      data: await updateMyGuardianPreferences(
        user(req),
        validateGuardianPreferences(req.body),
      ),
    });
  } catch (error) {
    next(error);
  }
};

export const listGuardianAuditsController: RequestHandler = async (
  req,
  res,
  next,
) => {
  try {
    res.json(
      await listGuardianAudits(
        user(req),
        validateGuardianLinkId(req.params.id),
      ),
    );
  } catch (error) {
    next(error);
  }
};
