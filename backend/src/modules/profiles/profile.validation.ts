import { HttpError } from '../../utils/http-error.js';
import {
  asRecord,
  optionalNullableString as optionalString,
  requiredString,
} from '../../validators/common.js';
import type { UpdateMyProfileInput, UpsertStudentProfileInput, UpsertTeacherProfileInput } from './profile.types.js';

function limitedString(
  value: unknown,
  field: string,
  maxLength: number,
) {
  const parsed = optionalString(value, field);
  if (parsed && parsed.length > maxLength) {
    throw new HttpError(400, `${field} must not exceed ${maxLength} characters`);
  }
  return parsed;
}

function phoneValue(value: unknown, field: string) {
  const phone = limitedString(value, field, 50);
  if (phone && !/^[0-9+().\-\s]+$/.test(phone)) {
    throw new HttpError(400, `${field} contains invalid characters`);
  }
  return phone;
}

function avatarUrlValue(value: unknown) {
  const avatarUrl = limitedString(value, 'avatar_url', 500);
  if (!avatarUrl) return avatarUrl;
  if (avatarUrl.startsWith('/uploads/images/') && !avatarUrl.includes('\\')) {
    return avatarUrl;
  }

  try {
    const parsed = new URL(avatarUrl);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') return avatarUrl;
  } catch {
    // Fall through to a clear validation response.
  }

  throw new HttpError(
    400,
    'avatar_url must be an http(s) URL or start with /uploads/images/',
  );
}

function requiredId(value: unknown, field: string) {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) throw new HttpError(400, `${field} must be a positive integer`);
  return id;
}

export function validateProfileId(value: string) {
  return requiredId(value, 'profile id');
}

export function validateUpdateMyProfile(body: unknown): UpdateMyProfileInput {
  const input = asRecord(body);
  return {
    phone: phoneValue(input.phone, 'phone'),
    avatar_url: avatarUrlValue(input.avatar_url),
    bio: limitedString(input.bio, 'bio', 2000),
    parent_phone: phoneValue(input.parent_phone, 'parent_phone'),
  };
}

export function validateTeacherProfile(body: unknown): UpsertTeacherProfileInput {
  const input = asRecord(body);
  return {
    user_id: requiredId(input.user_id, 'user_id'),
    teacher_code: limitedString(input.teacher_code, 'teacher_code', 50),
    full_name: requiredString(input.full_name, 'full_name'),
    department: limitedString(input.department, 'department', 255),
    phone: phoneValue(input.phone, 'phone'),
    avatar_url: avatarUrlValue(input.avatar_url),
    bio: limitedString(input.bio, 'bio', 2000),
  };
}

export function validateStudentProfile(body: unknown): UpsertStudentProfileInput {
  const input = asRecord(body);
  return {
    user_id: requiredId(input.user_id, 'user_id'),
    student_code: limitedString(input.student_code, 'student_code', 50),
    full_name: requiredString(input.full_name, 'full_name'),
    class_name: limitedString(input.class_name, 'class_name', 50),
    date_of_birth: limitedString(input.date_of_birth, 'date_of_birth', 10),
    phone: phoneValue(input.phone, 'phone'),
    parent_phone: phoneValue(input.parent_phone, 'parent_phone'),
    avatar_url: avatarUrlValue(input.avatar_url),
  };
}
