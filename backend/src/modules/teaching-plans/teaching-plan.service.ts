import type { AuthUser } from '../auth/auth.types.js';
import { findTeachingAssignmentById } from '../teaching-assignments/teaching-assignment.repository.js';
import { HttpError } from '../../utils/http-error.js';
import {
  deleteTeachingPlanRecord,
  findTeachingPlanByAssignmentId,
  findTeachingPlanById,
  findTeachingPlanOptions,
  findTeachingPlanSummary,
  findTeachingPlans,
  insertTeachingPlan,
  transitionTeachingPlan,
  updateTeachingPlanRecord,
} from './teaching-plan.repository.js';
import type { TeachingPlanInput, TeachingPlanListQuery, TeachingPlanReviewInput, TeachingPlanStatus, TeachingPlanUpdateInput } from './teaching-plan.types.js';

function isAdmin(user: AuthUser) {
  return user.roles.includes('admin') || user.permissions.includes('teaching_plans.review');
}

function canManage(user: AuthUser) {
  return isAdmin(user) || user.roles.includes('teacher') && user.permissions.includes('teaching_plans.manage');
}

function ensureManage(user: AuthUser) {
  if (!canManage(user)) throw new HttpError(403, 'Bạn không có quyền quản lý kế hoạch giảng dạy');
}

function ensureReview(user: AuthUser) {
  if (!isAdmin(user)) throw new HttpError(403, 'Chỉ reviewer được duyệt kế hoạch giảng dạy');
}

async function getPlanOrThrow(id: number) {
  const plan = await findTeachingPlanById(id);
  if (!plan) throw new HttpError(404, 'Không tìm thấy kế hoạch giảng dạy');
  return plan;
}

async function getAssignmentOrThrow(id: number) {
  const assignment = await findTeachingAssignmentById(id);
  if (!assignment) throw new HttpError(404, 'Không tìm thấy phân công giảng dạy');
  if (assignment.status !== 'active') throw new HttpError(409, 'Chỉ assignment đang active mới được tạo kế hoạch');
  return assignment;
}

export async function listTeachingPlans(user: AuthUser, query: TeachingPlanListQuery) {
  ensureManage(user);
  const scopedQuery = isAdmin(user) ? query : { ...query, teacher_user_id: user.id };
  const result = await findTeachingPlans(scopedQuery);
  return { data: result.data, meta: { page: query.page, limit: query.limit, total: result.total, totalPages: Math.ceil(result.total / query.limit) } };
}

export async function getTeachingPlan(user: AuthUser, id: number) {
  ensureManage(user);
  const plan = await getPlanOrThrow(id);
  if (!isAdmin(user) && plan.teacher_user_id !== user.id) throw new HttpError(403, 'Bạn không được xem kế hoạch của giáo viên khác');
  return plan;
}

export async function getTeachingPlanOptions(user: AuthUser) {
  ensureManage(user);
  return findTeachingPlanOptions(isAdmin(user) ? undefined : user.id);
}

export async function getTeachingPlansSummary(user: AuthUser) {
  ensureReview(user);
  return findTeachingPlanSummary();
}

export async function createTeachingPlan(user: AuthUser, input: TeachingPlanInput) {
  ensureManage(user);
  const assignment = await getAssignmentOrThrow(input.teaching_assignment_id);
  if (!isAdmin(user) && assignment.teacher_user_id !== user.id) throw new HttpError(403, 'Bạn chỉ được tạo kế hoạch cho assignment của mình');
  if (await findTeachingPlanByAssignmentId(input.teaching_assignment_id)) throw new HttpError(409, 'Assignment này đã có kế hoạch; hãy sửa bản hiện tại');
  const plan = await insertTeachingPlan(input, assignment, user.id);
  if (!plan) throw new HttpError(500, 'Không thể tạo kế hoạch giảng dạy');
  return plan;
}

export async function updateTeachingPlan(user: AuthUser, id: number, input: TeachingPlanUpdateInput) {
  ensureManage(user);
  const current = await getPlanOrThrow(id);
  if (!isAdmin(user) && current.teacher_user_id !== user.id) throw new HttpError(403, 'Bạn không được sửa kế hoạch của giáo viên khác');
  if (!['draft', 'rejected'].includes(current.status)) {
    throw new HttpError(409, current.status === 'approved'
      ? 'Bản đã duyệt là immutable; không được sửa trực tiếp'
      : 'Chỉ kế hoạch draft hoặc bị từ chối mới được sửa');
  }
  return updateTeachingPlanRecord(id, input, current.version_number, current.status, user.id);
}

export async function submitTeachingPlan(user: AuthUser, id: number) {
  ensureManage(user);
  const current = await getPlanOrThrow(id);
  if (current.teacher_user_id !== user.id && !isAdmin(user)) throw new HttpError(403, 'Bạn không được gửi kế hoạch của giáo viên khác');
  if (!['draft', 'rejected'].includes(current.status)) throw new HttpError(409, 'Chỉ draft hoặc rejected mới được gửi duyệt');
  return transitionTeachingPlan(id, 'submitted', user.id);
}

export async function approveTeachingPlan(user: AuthUser, id: number, input: TeachingPlanReviewInput) {
  ensureReview(user);
  const current = await getPlanOrThrow(id);
  if (current.status !== 'submitted') throw new HttpError(409, 'Chỉ kế hoạch đã gửi mới được duyệt');
  return transitionTeachingPlan(id, 'approved', user.id, input.comment);
}

export async function rejectTeachingPlan(user: AuthUser, id: number, input: TeachingPlanReviewInput) {
  ensureReview(user);
  const current = await getPlanOrThrow(id);
  if (current.status !== 'submitted') throw new HttpError(409, 'Chỉ kế hoạch đã gửi mới được từ chối');
  if (!input.comment?.trim()) throw new HttpError(400, 'Vui lòng nhập lý do từ chối');
  return transitionTeachingPlan(id, 'rejected', user.id, input.comment);
}

export async function archiveTeachingPlan(user: AuthUser, id: number) {
  ensureReview(user);
  const current = await getPlanOrThrow(id);
  if (current.status === 'archived') return current;
  if (current.status !== 'approved' && current.status !== 'rejected') throw new HttpError(409, 'Chỉ kế hoạch approved hoặc rejected mới được lưu trữ');
  return transitionTeachingPlan(id, 'archived', user.id);
}

export async function deleteTeachingPlan(user: AuthUser, id: number) {
  ensureManage(user);
  const current = await getPlanOrThrow(id);
  if (!isAdmin(user) && current.teacher_user_id !== user.id) throw new HttpError(403, 'Bạn không được xóa kế hoạch của giáo viên khác');
  if (!(await deleteTeachingPlanRecord(id))) throw new HttpError(409, 'Chỉ draft hoặc rejected mới được xóa');
}
