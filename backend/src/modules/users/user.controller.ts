import type { RequestHandler } from 'express';
import {
  createUser,
  bulkCreateStudentAccounts,
  getUserById,
  listUsers,
  updateUserRoles,
  updateUserAsRequester,
  updateUserStatusAsRequester,
} from './user.service.js';
import {
  validateCreateUser,
  validateBulkCreateStudents,
  validateListUsersQuery,
  validateUpdateUser,
  validateUpdateUserRoles,
  validateUpdateUserStatus,
  validateUserId,
} from './user.validation.js';

export const listUsersController: RequestHandler = async (req, res, next) => {
  try {
    const query = validateListUsersQuery(req.query);
    res.json(await listUsers(query));
  } catch (error) {
    next(error);
  }
};

export const getUserController: RequestHandler = async (req, res, next) => {
  try {
    const id = validateUserId(req.params.id);
    res.json({ data: await getUserById(id) });
  } catch (error) {
    next(error);
  }
};

export const createUserController: RequestHandler = async (req, res, next) => {
  try {
    const input = validateCreateUser(req.body);
    res.status(201).json({ data: await createUser(input) });
  } catch (error) {
    next(error);
  }
};

export const bulkCreateStudentAccountsController: RequestHandler = async (req, res, next) => {
  try {
    const input = validateBulkCreateStudents(req.body);
    const result = await bulkCreateStudentAccounts(input, req.user?.id);
    res.status(201).json({ data: result });
  } catch (error) {
    next(error);
  }
};

export const updateUserController: RequestHandler = async (req, res, next) => {
  try {
    const id = validateUserId(req.params.id);
    const input = validateUpdateUser(req.body);
    res.json({ data: await updateUserAsRequester(req.user?.id ?? 0, id, input) });
  } catch (error) {
    next(error);
  }
};

export const updateUserStatusController: RequestHandler = async (req, res, next) => {
  try {
    const id = validateUserId(req.params.id);
    const input = validateUpdateUserStatus(req.body);
    res.json({ data: await updateUserStatusAsRequester(req.user?.id ?? 0, id, input.status) });
  } catch (error) {
    next(error);
  }
};

export const updateUserRolesController: RequestHandler = async (req, res, next) => {
  try {
    const id = validateUserId(req.params.id);
    const input = validateUpdateUserRoles(req.body);
    res.json({ data: await updateUserRoles(id, input.roles) });
  } catch (error) {
    next(error);
  }
};
