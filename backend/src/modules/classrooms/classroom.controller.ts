import type { Request, RequestHandler } from 'express';
import { HttpError } from '../../utils/http-error.js';
import {
  addClassroomMember,
  createClassroom,
  createClassroomDocument,
  createClassroomPost,
  deleteClassroom,
  deleteClassroomDocument,
  deleteClassroomPost,
  getClassroomDocuments,
  getClassroomForUser,
  getClassroomPosts,
  getMembers,
  listClassroomsForUser,
  removeClassroomMember,
  setClassroomDocumentStatus,
  setClassroomPostStatus,
  updateClassroom,
  updateClassroomDocument,
  updateClassroomPost,
} from './classroom.service.js';
import {
  validateClassroom,
  validateClassroomDocument,
  validateClassroomPost,
  validateId,
  validateListClassroomsQuery,
  validateMember,
  validateMemberRole,
} from './classroom.validation.js';

function user(req: Request) {
  if (!req.user) throw new HttpError(401, 'Authentication required');
  return req.user;
}

export const listClassroomsController: RequestHandler = async (req, res, next) => {
  try { res.json(await listClassroomsForUser(user(req), validateListClassroomsQuery(req.query))); } catch (error) { next(error); }
};
export const getClassroomController: RequestHandler = async (req, res, next) => {
  try { res.json({ data: await getClassroomForUser(user(req), validateId(req.params.id)) }); } catch (error) { next(error); }
};
export const createClassroomController: RequestHandler = async (req, res, next) => {
  try { res.status(201).json({ data: await createClassroom(user(req), validateClassroom(req.body)) }); } catch (error) { next(error); }
};
export const updateClassroomController: RequestHandler = async (req, res, next) => {
  try { res.json({ data: await updateClassroom(user(req), validateId(req.params.id), validateClassroom(req.body)) }); } catch (error) { next(error); }
};
export const deleteClassroomController: RequestHandler = async (req, res, next) => {
  try { await deleteClassroom(user(req), validateId(req.params.id)); res.status(204).send(); } catch (error) { next(error); }
};
export const listMembersController: RequestHandler = async (req, res, next) => {
  try { res.json({ data: await getMembers(user(req), validateId(req.params.id)) }); } catch (error) { next(error); }
};
export const addMemberController: RequestHandler = async (req, res, next) => {
  try { res.status(201).json({ data: await addClassroomMember(user(req), validateId(req.params.id), validateMember(req.body)) }); } catch (error) { next(error); }
};
export const removeMemberController: RequestHandler = async (req, res, next) => {
  try {
    await removeClassroomMember(
      user(req),
      validateId(req.params.id),
      validateId(req.params.memberId, 'memberId'),
      validateMemberRole(req.query.role),
    );
    res.status(204).send();
  } catch (error) { next(error); }
};
export const listPostsController: RequestHandler = async (req, res, next) => {
  try { res.json({ data: await getClassroomPosts(user(req), validateId(req.params.id)) }); } catch (error) { next(error); }
};
export const createPostController: RequestHandler = async (req, res, next) => {
  try { res.status(201).json({ data: await createClassroomPost(user(req), validateId(req.params.id), validateClassroomPost(req.body)) }); } catch (error) { next(error); }
};
export const updatePostController: RequestHandler = async (req, res, next) => {
  try { res.json({ data: await updateClassroomPost(user(req), validateId(req.params.id), validateId(req.params.postId, 'postId'), validateClassroomPost(req.body)) }); } catch (error) { next(error); }
};
export const publishPostController: RequestHandler = async (req, res, next) => {
  try { res.json({ data: await setClassroomPostStatus(user(req), validateId(req.params.id), validateId(req.params.postId, 'postId'), 'published') }); } catch (error) { next(error); }
};
export const archivePostController: RequestHandler = async (req, res, next) => {
  try { res.json({ data: await setClassroomPostStatus(user(req), validateId(req.params.id), validateId(req.params.postId, 'postId'), 'archived') }); } catch (error) { next(error); }
};
export const deletePostController: RequestHandler = async (req, res, next) => {
  try { await deleteClassroomPost(user(req), validateId(req.params.id), validateId(req.params.postId, 'postId')); res.status(204).send(); } catch (error) { next(error); }
};
export const listDocumentsController: RequestHandler = async (req, res, next) => {
  try { res.json({ data: await getClassroomDocuments(user(req), validateId(req.params.id)) }); } catch (error) { next(error); }
};
export const createDocumentController: RequestHandler = async (req, res, next) => {
  try { res.status(201).json({ data: await createClassroomDocument(user(req), validateId(req.params.id), validateClassroomDocument(req.body)) }); } catch (error) { next(error); }
};
export const updateDocumentController: RequestHandler = async (req, res, next) => {
  try { res.json({ data: await updateClassroomDocument(user(req), validateId(req.params.id), validateId(req.params.documentId, 'documentId'), validateClassroomDocument(req.body)) }); } catch (error) { next(error); }
};
export const publishDocumentController: RequestHandler = async (req, res, next) => {
  try { res.json({ data: await setClassroomDocumentStatus(user(req), validateId(req.params.id), validateId(req.params.documentId, 'documentId'), 'published') }); } catch (error) { next(error); }
};
export const archiveDocumentController: RequestHandler = async (req, res, next) => {
  try { res.json({ data: await setClassroomDocumentStatus(user(req), validateId(req.params.id), validateId(req.params.documentId, 'documentId'), 'archived') }); } catch (error) { next(error); }
};
export const deleteDocumentController: RequestHandler = async (req, res, next) => {
  try { await deleteClassroomDocument(user(req), validateId(req.params.id), validateId(req.params.documentId, 'documentId')); res.status(204).send(); } catch (error) { next(error); }
};
