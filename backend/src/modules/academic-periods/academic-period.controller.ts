import type { RequestHandler } from 'express';
import {
  activateAcademicYear,
  activateSemester,
  closeAcademicYear,
  closeSemester,
  createAcademicYear,
  createSemester,
  deleteAcademicYear,
  deleteSemester,
  getAcademicYear,
  getActiveAcademicPeriods,
  listAcademicPeriods,
  setAcademicYearLock,
  setSemesterLock,
  updateAcademicYear,
  updateSemester,
} from './academic-period.service.js';
import {
  validateAcademicPeriodId,
  validateAcademicYear,
  validateAcademicYearUpdate,
  validateListAcademicPeriodsQuery,
  validateLockInput,
  validateSemester,
  validateSemesterUpdate,
} from './academic-period.validation.js';

export const listAcademicPeriodsController: RequestHandler = async (
  req,
  res,
  next,
) => {
  try {
    res.json({
      data: await listAcademicPeriods(
        validateListAcademicPeriodsQuery(req.query),
      ),
    });
  } catch (error) {
    next(error);
  }
};

export const getActiveAcademicPeriodsController: RequestHandler = async (
  _req,
  res,
  next,
) => {
  try {
    res.json({ data: await getActiveAcademicPeriods() });
  } catch (error) {
    next(error);
  }
};

export const getAcademicYearController: RequestHandler = async (
  req,
  res,
  next,
) => {
  try {
    res.json({
      data: await getAcademicYear(
        validateAcademicPeriodId(req.params.yearId, 'yearId'),
      ),
    });
  } catch (error) {
    next(error);
  }
};

export const createAcademicYearController: RequestHandler = async (
  req,
  res,
  next,
) => {
  try {
    res.status(201).json({
      data: await createAcademicYear(validateAcademicYear(req.body)),
    });
  } catch (error) {
    next(error);
  }
};

export const updateAcademicYearController: RequestHandler = async (
  req,
  res,
  next,
) => {
  try {
    res.json({
      data: await updateAcademicYear(
        validateAcademicPeriodId(req.params.yearId, 'yearId'),
        validateAcademicYearUpdate(req.body),
      ),
    });
  } catch (error) {
    next(error);
  }
};

function yearAction(
  action: (id: number) => Promise<unknown>,
): RequestHandler {
  return async (req, res, next) => {
    try {
      res.json({
        data: await action(
          validateAcademicPeriodId(req.params.yearId, 'yearId'),
        ),
      });
    } catch (error) {
      next(error);
    }
  };
}

export const activateAcademicYearController = yearAction(activateAcademicYear);
export const closeAcademicYearController = yearAction(closeAcademicYear);

export const lockAcademicYearController: RequestHandler = async (
  req,
  res,
  next,
) => {
  try {
    res.json({
      data: await setAcademicYearLock(
        validateAcademicPeriodId(req.params.yearId, 'yearId'),
        validateLockInput(req.body),
      ),
    });
  } catch (error) {
    next(error);
  }
};

export const deleteAcademicYearController: RequestHandler = async (
  req,
  res,
  next,
) => {
  try {
    await deleteAcademicYear(
      validateAcademicPeriodId(req.params.yearId, 'yearId'),
    );
    res.status(204).send();
  } catch (error) {
    next(error);
  }
};

export const createSemesterController: RequestHandler = async (
  req,
  res,
  next,
) => {
  try {
    res.status(201).json({
      data: await createSemester(
        validateAcademicPeriodId(req.params.yearId, 'yearId'),
        validateSemester(req.body),
      ),
    });
  } catch (error) {
    next(error);
  }
};

export const updateSemesterController: RequestHandler = async (
  req,
  res,
  next,
) => {
  try {
    res.json({
      data: await updateSemester(
        validateAcademicPeriodId(req.params.semesterId, 'semesterId'),
        validateSemesterUpdate(req.body),
      ),
    });
  } catch (error) {
    next(error);
  }
};

function semesterAction(
  action: (id: number) => Promise<unknown>,
): RequestHandler {
  return async (req, res, next) => {
    try {
      res.json({
        data: await action(
          validateAcademicPeriodId(req.params.semesterId, 'semesterId'),
        ),
      });
    } catch (error) {
      next(error);
    }
  };
}

export const activateSemesterController = semesterAction(activateSemester);
export const closeSemesterController = semesterAction(closeSemester);

export const lockSemesterController: RequestHandler = async (
  req,
  res,
  next,
) => {
  try {
    res.json({
      data: await setSemesterLock(
        validateAcademicPeriodId(req.params.semesterId, 'semesterId'),
        validateLockInput(req.body),
      ),
    });
  } catch (error) {
    next(error);
  }
};

export const deleteSemesterController: RequestHandler = async (
  req,
  res,
  next,
) => {
  try {
    await deleteSemester(
      validateAcademicPeriodId(req.params.semesterId, 'semesterId'),
    );
    res.status(204).send();
  } catch (error) {
    next(error);
  }
};

