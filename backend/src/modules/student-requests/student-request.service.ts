import { unlink } from 'node:fs/promises';
import path from 'node:path';
import type { AuthUser } from '../auth/auth.types.js';
import {
  createNotificationRecord,
  findRecipientUserIds,
} from '../notifications/notification.repository.js';
import { HttpError } from '../../utils/http-error.js';
import {
  addStudentRequestAttachmentRecord,
  createStudentRequestRecord,
  createStudentRequestTypeRecord,
  findHomeroomTeacherUserIds,
  findStudentRequestAttachmentRecord,
  findStudentRequestById,
  findStudentRequestHistory,
  findStudentRequests,
  findStudentRequestTypeById,
  findStudentRequestTypes,
  isHomeroomReviewer,
  transitionStudentRequestRecord,
  updateStudentRequestTypeRecord,
} from './student-request.repository.js';
import { studentRequestUploadRoot } from './student-request.upload.js';
import type {
  StudentRequest,
  StudentRequestCreateInput,
  StudentRequestListQuery,
  StudentRequestTypeInput,
} from './student-request.types.js';

function isAdmin(user: AuthUser) {
  return user.roles.includes('admin');
}

function isStudent(user: AuthUser) {
  return user.roles.includes('student');
}

function isTeacher(user: AuthUser) {
  return user.roles.includes('teacher');
}

function ensureAdmin(user: AuthUser) {
  if (
    !isAdmin(user) &&
    !user.permissions.includes('student_request_types.manage')
  ) {
    throw new HttpError(403, 'Permission denied');
  }
}

async function canReview(user: AuthUser, request: StudentRequest) {
  if (request.status === 'draft') return false;
  if (isAdmin(user)) return true;
  return (
    isTeacher(user) &&
    request.reviewer_scope === 'homeroom' &&
    (await isHomeroomReviewer(user.id, request.student_user_id))
  );
}

async function ensureCanAccess(user: AuthUser, request: StudentRequest) {
  if (
    request.student_user_id !== user.id &&
    !(await canReview(user, request))
  ) {
    throw new HttpError(403, 'You cannot access this student request');
  }
}

export function listRequestTypes(user: AuthUser) {
  return findStudentRequestTypes(!isAdmin(user));
}

export async function createRequestType(
  user: AuthUser,
  input: StudentRequestTypeInput,
) {
  ensureAdmin(user);
  return createStudentRequestTypeRecord(input, user.id);
}

export async function updateRequestType(
  user: AuthUser,
  id: number,
  input: StudentRequestTypeInput,
) {
  ensureAdmin(user);
  const result = await updateStudentRequestTypeRecord(id, input);
  if (!result) throw new HttpError(404, 'Student request type not found');
  return result;
}

export async function listRequests(
  user: AuthUser,
  query: StudentRequestListQuery,
) {
  const role = isAdmin(user)
    ? 'admin'
    : isTeacher(user)
      ? 'teacher'
      : isStudent(user)
        ? 'student'
        : null;
  if (!role) throw new HttpError(403, 'Permission denied');
  const { data, total } = await findStudentRequests(query, {
    role,
    userId: user.id,
  });
  return {
    data,
    meta: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.ceil(total / query.limit),
    },
  };
}

export async function getRequest(user: AuthUser, id: number) {
  const request = await findStudentRequestById(id);
  if (!request) throw new HttpError(404, 'Student request not found');
  await ensureCanAccess(user, request);
  return request;
}

export async function createRequest(
  user: AuthUser,
  input: StudentRequestCreateInput,
) {
  if (!isStudent(user)) {
    throw new HttpError(403, 'Only students can create requests');
  }
  const type = await findStudentRequestTypeById(input.request_type_id);
  if (!type || !type.is_active) {
    throw new HttpError(400, 'Student request type is unavailable');
  }
  return createStudentRequestRecord(user.id, input);
}

export async function addRequestAttachment(
  user: AuthUser,
  id: number,
  file?: Express.Multer.File,
) {
  if (!file) throw new HttpError(400, 'Attachment file is required');
  try {
    const request = await getRequest(user, id);
    if (request.student_user_id !== user.id || request.status !== 'draft') {
      throw new HttpError(
        403,
        'Attachments can only be added to your own draft request',
      );
    }
    return await addStudentRequestAttachmentRecord(id, user.id, file);
  } catch (error) {
    await unlink(file.path).catch(() => undefined);
    throw error;
  }
}

export async function getRequestAttachmentDownload(
  user: AuthUser,
  requestId: number,
  attachmentId: number,
) {
  await getRequest(user, requestId);
  const attachment = await findStudentRequestAttachmentRecord(
    requestId,
    attachmentId,
  );
  if (!attachment) throw new HttpError(404, 'Attachment not found');
  return {
    path: path.join(studentRequestUploadRoot, String(attachment.storage_path)),
    name: String(attachment.original_name),
    mimeType: String(attachment.mime_type),
  };
}

export async function submitRequest(user: AuthUser, id: number) {
  const request = await getRequest(user, id);
  if (request.student_user_id !== user.id) {
    throw new HttpError(403, 'Only the request owner can submit it');
  }
  if (request.status !== 'draft') {
    throw new HttpError(409, 'Only draft requests can be submitted');
  }
  if (request.requires_attachment && request.attachment_count === 0) {
    throw new HttpError(400, 'This request type requires an attachment');
  }
  const dueAt = new Date(Date.now() + request.sla_days * 86_400_000);
  const updated = await transitionStudentRequestRecord(id, user.id, {
    action: 'submit',
    expectedStatuses: ['draft'],
    status: 'pending',
    dueAt,
  });
  if (!updated) throw new HttpError(409, 'Request state changed');
  const recipients =
    request.reviewer_scope === 'admin'
      ? await findRecipientUserIds('admin')
      : await findHomeroomTeacherUserIds(request.student_user_id);
  if (recipients.length) {
    await createNotificationRecord(
      {
        title: 'Có đơn học sinh cần xử lý',
        message: 'Một yêu cầu mới đã được gửi và đang chờ xét duyệt.',
        type: 'school',
        target_role:
          request.reviewer_scope === 'admin' ? 'admin' : 'teacher',
        related_url:
          request.reviewer_scope === 'admin'
            ? '/admin/student-requests'
            : '/teacher/student-requests',
      },
      user.id,
      recipients,
    );
  }
  return updated;
}

export async function cancelRequest(user: AuthUser, id: number) {
  const request = await getRequest(user, id);
  if (request.student_user_id !== user.id) {
    throw new HttpError(403, 'Only the request owner can cancel it');
  }
  if (!['draft', 'pending'].includes(request.status)) {
    throw new HttpError(409, 'This request can no longer be cancelled');
  }
  const result = await transitionStudentRequestRecord(id, user.id, {
    action: 'cancel',
    expectedStatuses: ['draft', 'pending'],
    status: 'cancelled',
  });
  if (!result) throw new HttpError(409, 'Request state changed');
  return result;
}

export async function startRequestReview(user: AuthUser, id: number) {
  const request = await getRequest(user, id);
  if (!(await canReview(user, request))) throw new HttpError(403, 'Permission denied');
  if (request.status !== 'pending') {
    throw new HttpError(409, 'Only pending requests can enter review');
  }
  const result = await transitionStudentRequestRecord(id, user.id, {
    action: 'start_review',
    expectedStatuses: ['pending'],
    status: 'in_review',
  });
  if (!result) throw new HttpError(409, 'Request state changed');
  return result;
}

async function decideRequest(
  user: AuthUser,
  id: number,
  action: 'approve' | 'reject',
  reason: string,
) {
  const request = await getRequest(user, id);
  if (!(await canReview(user, request))) throw new HttpError(403, 'Permission denied');
  if (!['pending', 'in_review'].includes(request.status)) {
    throw new HttpError(409, 'Only pending or in-review requests can be decided');
  }
  const result = await transitionStudentRequestRecord(id, user.id, {
    action,
    expectedStatuses: ['pending', 'in_review'],
    status: action === 'approve' ? 'approved' : 'rejected',
    reason,
  });
  if (!result) throw new HttpError(409, 'Request state changed');
  await createNotificationRecord(
    {
      title:
        action === 'approve'
          ? 'Đơn của bạn đã được duyệt'
          : 'Đơn của bạn đã bị từ chối',
      message: 'Kết quả xử lý yêu cầu đã được cập nhật trong cổng học sinh.',
      type: 'school',
      target_role: 'student',
      related_url: '/student/requests',
    },
    user.id,
    [request.student_user_id],
  );
  return result;
}

export function approveRequest(
  user: AuthUser,
  id: number,
  reason: string,
) {
  return decideRequest(user, id, 'approve', reason);
}

export function rejectRequest(user: AuthUser, id: number, reason: string) {
  return decideRequest(user, id, 'reject', reason);
}

export async function getRequestHistory(user: AuthUser, id: number) {
  await getRequest(user, id);
  return findStudentRequestHistory(id);
}
