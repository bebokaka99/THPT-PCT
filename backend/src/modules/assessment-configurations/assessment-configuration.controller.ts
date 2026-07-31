import type { Request, RequestHandler } from 'express';
import { HttpError } from '../../utils/http-error.js';
import {
  activateAssessmentConfiguration,
  calculateAssessmentPreview,
  createAssessmentConfiguration,
  createAssessmentConfigurationVersion,
  deleteAssessmentConfiguration,
  getAssessmentConfigurationForUser,
  listAssessmentConfigurationsForAdmin,
  listMyAssessmentConfigurations,
  updateAssessmentConfiguration,
} from './assessment-configuration.service.js';
import {
  validateAssessmentCalculation,
  validateAssessmentConfiguration,
  validateAssessmentConfigurationId,
  validateAssessmentConfigurationUpdate,
  validateListAssessmentConfigurationsQuery,
} from './assessment-configuration.validation.js';

function user(req: Request) {
  if (!req.user) throw new HttpError(401, 'Authentication required');
  return req.user;
}

export const listAssessmentConfigurationsController: RequestHandler = async (
  req,
  res,
  next,
) => {
  try {
    res.json(
      await listAssessmentConfigurationsForAdmin(
        user(req),
        validateListAssessmentConfigurationsQuery(req.query),
      ),
    );
  } catch (error) {
    next(error);
  }
};

export const listMyAssessmentConfigurationsController: RequestHandler = async (
  req,
  res,
  next,
) => {
  try {
    res.json(
      await listMyAssessmentConfigurations(
        user(req),
        validateListAssessmentConfigurationsQuery(req.query),
      ),
    );
  } catch (error) {
    next(error);
  }
};

export const getAssessmentConfigurationController: RequestHandler = async (
  req,
  res,
  next,
) => {
  try {
    res.json({
      data: await getAssessmentConfigurationForUser(
        user(req),
        validateAssessmentConfigurationId(req.params.id),
      ),
    });
  } catch (error) {
    next(error);
  }
};

export const createAssessmentConfigurationController: RequestHandler = async (
  req,
  res,
  next,
) => {
  try {
    res.status(201).json({
      data: await createAssessmentConfiguration(
        user(req),
        validateAssessmentConfiguration(req.body),
      ),
    });
  } catch (error) {
    next(error);
  }
};

export const updateAssessmentConfigurationController: RequestHandler = async (
  req,
  res,
  next,
) => {
  try {
    res.json({
      data: await updateAssessmentConfiguration(
        user(req),
        validateAssessmentConfigurationId(req.params.id),
        validateAssessmentConfigurationUpdate(req.body),
      ),
    });
  } catch (error) {
    next(error);
  }
};

export const createAssessmentConfigurationVersionController: RequestHandler =
  async (req, res, next) => {
    try {
      res.status(201).json({
        data: await createAssessmentConfigurationVersion(
          user(req),
          validateAssessmentConfigurationId(req.params.id),
        ),
      });
    } catch (error) {
      next(error);
    }
  };

export const activateAssessmentConfigurationController: RequestHandler = async (
  req,
  res,
  next,
) => {
  try {
    res.json({
      data: await activateAssessmentConfiguration(
        user(req),
        validateAssessmentConfigurationId(req.params.id),
      ),
    });
  } catch (error) {
    next(error);
  }
};

export const calculateAssessmentPreviewController: RequestHandler = async (
  req,
  res,
  next,
) => {
  try {
    res.json({
      data: await calculateAssessmentPreview(
        user(req),
        validateAssessmentConfigurationId(req.params.id),
        validateAssessmentCalculation(req.body),
      ),
    });
  } catch (error) {
    next(error);
  }
};

export const deleteAssessmentConfigurationController: RequestHandler = async (
  req,
  res,
  next,
) => {
  try {
    await deleteAssessmentConfiguration(
      user(req),
      validateAssessmentConfigurationId(req.params.id),
    );
    res.status(204).send();
  } catch (error) {
    next(error);
  }
};
