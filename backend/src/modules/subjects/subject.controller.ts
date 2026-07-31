import type { RequestHandler } from 'express';
import {
  createCurriculumSubject,
  createSubject,
  deleteCurriculumSubject,
  deleteSubject,
  getSubject,
  importSubjects,
  listCurriculum,
  listSubjects,
  updateCurriculumSubject,
  updateSubject,
} from './subject.service.js';
import {
  validateCurriculum,
  validateCurriculumUpdate,
  validateListCurriculumQuery,
  validateListSubjectsQuery,
  validateSubject,
  validateSubjectId,
  validateSubjectImport,
  validateSubjectUpdate,
} from './subject.validation.js';

export const listSubjectsController: RequestHandler = async (
  req,
  res,
  next,
) => {
  try {
    res.json(await listSubjects(validateListSubjectsQuery(req.query)));
  } catch (error) {
    next(error);
  }
};

export const getSubjectController: RequestHandler = async (req, res, next) => {
  try {
    res.json({ data: await getSubject(validateSubjectId(req.params.id)) });
  } catch (error) {
    next(error);
  }
};

export const createSubjectController: RequestHandler = async (
  req,
  res,
  next,
) => {
  try {
    res.status(201).json({ data: await createSubject(validateSubject(req.body)) });
  } catch (error) {
    next(error);
  }
};

export const updateSubjectController: RequestHandler = async (
  req,
  res,
  next,
) => {
  try {
    res.json({
      data: await updateSubject(
        validateSubjectId(req.params.id),
        validateSubjectUpdate(req.body),
      ),
    });
  } catch (error) {
    next(error);
  }
};

export const importSubjectsController: RequestHandler = async (
  req,
  res,
  next,
) => {
  try {
    const data = await importSubjects(validateSubjectImport(req.body));
    res.status(201).json({ data, total: data.length });
  } catch (error) {
    next(error);
  }
};

export const deleteSubjectController: RequestHandler = async (
  req,
  res,
  next,
) => {
  try {
    await deleteSubject(validateSubjectId(req.params.id));
    res.status(204).send();
  } catch (error) {
    next(error);
  }
};

export const listCurriculumController: RequestHandler = async (
  req,
  res,
  next,
) => {
  try {
    res.json({
      data: await listCurriculum(validateListCurriculumQuery(req.query)),
    });
  } catch (error) {
    next(error);
  }
};

export const createCurriculumController: RequestHandler = async (
  req,
  res,
  next,
) => {
  try {
    res.status(201).json({
      data: await createCurriculumSubject(validateCurriculum(req.body)),
    });
  } catch (error) {
    next(error);
  }
};

export const updateCurriculumController: RequestHandler = async (
  req,
  res,
  next,
) => {
  try {
    res.json({
      data: await updateCurriculumSubject(
        validateSubjectId(req.params.id),
        validateCurriculumUpdate(req.body),
      ),
    });
  } catch (error) {
    next(error);
  }
};

export const deleteCurriculumController: RequestHandler = async (
  req,
  res,
  next,
) => {
  try {
    await deleteCurriculumSubject(validateSubjectId(req.params.id));
    res.status(204).send();
  } catch (error) {
    next(error);
  }
};

