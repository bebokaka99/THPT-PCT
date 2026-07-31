import { HttpError } from '../../utils/http-error.js';
import { hashPassword } from '../../utils/password.js';
import { randomInt } from 'node:crypto';
import { findClassroomById } from '../classrooms/classroom.repository.js';
import { assertAcademicYearWritable } from '../academic-periods/academic-period.service.js';
import { revokeRefreshSessionsForUser } from '../auth/auth.repository.js';
import {
  countActiveAdmins,
  createBulkStudentAccountsRecord,
  createUserRecord,
  findRoleIdsByNames,
  findUserById,
  findUsers,
  isEmailTaken,
  isUsernameTaken,
  updateUserRecord,
  updateUserRolesRecord,
  updateUserStatusRecord,
} from './user.repository.js';
import type {
  BulkCreateStudentsInput,
  CreateUserInput,
  GeneratedStudentCredential,
  ListUsersQuery,
  UpdateUserInput,
  UserStatus,
} from './user.types.js';

async function ensureRolesExist(roleNames: string[]) {
  if (roleNames.length === 0) {
    return;
  }

  const roles = await findRoleIdsByNames(roleNames);
  const foundNames = new Set(roles.map((role) => role.name));
  const missing = roleNames.filter((name) => !foundNames.has(name));

  if (missing.length > 0) {
    throw new HttpError(400, `Unknown roles: ${missing.join(', ')}`);
  }
}

export async function listUsers(query: ListUsersQuery) {
  const { total, users } = await findUsers(query);

  return {
    data: users,
    meta: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.ceil(total / query.limit),
    },
  };
}

export async function getUserById(id: number) {
  const user = await findUserById(id);

  if (!user) {
    throw new HttpError(404, 'User not found');
  }

  return user;
}

export async function createUser(input: CreateUserInput) {
  if (await isEmailTaken(input.email)) {
    throw new HttpError(409, 'Email already exists');
  }

  const roles = input.roles ?? [];
  await ensureRolesExist(roles);

  const user = await createUserRecord({
    email: input.email,
    full_name: input.full_name,
    password_hash: await hashPassword(input.password),
    status: input.status ?? 'active',
    roles,
  });

  if (!user) {
    throw new HttpError(500, 'Failed to create user');
  }

  return user;
}

export async function updateUser(id: number, input: UpdateUserInput, requestUserId?: number) {
  const existing = await getUserById(id);

  ensureSelfStatusChangeAllowed(requestUserId, id, input.status);
  if (input.status) {
    await ensureAdminStatusChangeAllowed(existing, input.status);
  }

  const nextEmail = input.email ?? existing.email;
  if (nextEmail && nextEmail !== existing.email && (await isEmailTaken(nextEmail, id))) {
    throw new HttpError(409, 'Email already exists');
  }

  const roles = input.roles;
  if (roles) {
    await ensureRolesExist(roles);
    await ensureAdminRoleChangeAllowed(existing, roles);
  }

  const user = await updateUserRecord(id, {
    email: nextEmail,
    full_name: input.full_name ?? existing.full_name,
    status: input.status ?? existing.status,
    password_hash: input.password ? await hashPassword(input.password) : undefined,
    roles,
  });

  if (!user) {
    throw new HttpError(500, 'Failed to update user');
  }

  if (
    input.password
    || input.roles !== undefined
    || (input.status !== undefined && input.status !== existing.status)
  ) {
    await revokeRefreshSessionsForUser(id);
  }

  return user;
}

export async function updateUserStatus(id: number, status: UserStatus, requestUserId?: number) {
  const existing = await getUserById(id);
  ensureSelfStatusChangeAllowed(requestUserId, id, status);
  await ensureAdminStatusChangeAllowed(existing, status);
  const user = await updateUserStatusRecord(id, status);

  if (!user) {
    throw new HttpError(500, 'Failed to update user status');
  }

  if (status !== existing.status) {
    await revokeRefreshSessionsForUser(id);
  }

  return user;
}

export async function updateUserRoles(id: number, roles: string[]) {
  const existing = await getUserById(id);
  await ensureRolesExist(roles);
  await ensureAdminRoleChangeAllowed(existing, roles);

  const user = await updateUserRolesRecord(id, roles);

  if (!user) {
    throw new HttpError(500, 'Failed to update user roles');
  }

  await revokeRefreshSessionsForUser(id);

  return user;
}

function ensureSelfStatusChangeAllowed(
  requestUserId: number | undefined,
  targetUserId: number,
  status: UserStatus | undefined,
) {
  if (!status || status === 'active') {
    return;
  }

  if (requestUserId === targetUserId) {
    throw new HttpError(400, 'You cannot lock or deactivate your own account');
  }
}

async function ensureAdminStatusChangeAllowed(
  existing: Awaited<ReturnType<typeof getUserById>>,
  nextStatus: UserStatus,
) {
  if (nextStatus === 'active' || existing.status !== 'active' || !existing.roles.includes('admin')) {
    return;
  }

  if ((await countActiveAdmins()) <= 1) {
    throw new HttpError(400, 'Cannot lock or deactivate the last active admin account');
  }
}

async function ensureAdminRoleChangeAllowed(
  existing: Awaited<ReturnType<typeof getUserById>>,
  nextRoles: string[],
) {
  if (!existing.roles.includes('admin') || nextRoles.includes('admin') || existing.status !== 'active') {
    return;
  }

  if ((await countActiveAdmins()) <= 1) {
    throw new HttpError(400, 'Cannot remove admin role from the last active admin account');
  }
}

export async function updateUserAsRequester(requestUserId: number, id: number, input: UpdateUserInput) {
  return updateUser(id, input, requestUserId);
}

export async function updateUserStatusAsRequester(requestUserId: number, id: number, status: UserStatus) {
  return updateUserStatus(id, status, requestUserId);
}

function normalizeDateOfBirth(value: string) {
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(value)) {
    const [day, month, year] = value.split('/');
    return `${year}-${month}-${day}`;
  }
  return value;
}

function birthDayMonth(value: string) {
  const normalized = normalizeDateOfBirth(value);
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(normalized);
  if (!match) {
    throw new HttpError(400, `Invalid date_of_birth: ${value}`);
  }

  const date = new Date(`${normalized}T00:00:00Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== normalized) {
    throw new HttpError(400, `Invalid date_of_birth: ${value}`);
  }

  return {
    normalized,
    dayMonth: `${match[3]}${match[2]}`,
  };
}

async function generateStudentCredential(cohort: string, dateOfBirth: string, reserved: Set<string>) {
  const { normalized, dayMonth } = birthDayMonth(dateOfBirth);

  for (let attempt = 0; attempt < 100; attempt += 1) {
    const randomSuffix = randomInt(0, 10_000).toString().padStart(4, '0');
    const password = `${dayMonth}${randomSuffix}`;
    const username = `${cohort}pct${password}`;

    if (!reserved.has(username) && !(await isUsernameTaken(username))) {
      reserved.add(username);
      return { username, password, normalized };
    }
  }

  throw new HttpError(500, 'Could not generate a unique student account');
}

export async function bulkCreateStudentAccounts(
  input: BulkCreateStudentsInput,
  createdByUserId?: number,
) {
  let enrollmentDate: string | undefined;
  if (input.classroom_id) {
    const classroom = await findClassroomById(input.classroom_id);
    if (!classroom) {
      throw new HttpError(404, 'Classroom not found');
    }
    if (!classroom.academic_year_id) {
      throw new HttpError(409, 'Classroom does not have an academic year');
    }
    const academicYear = await assertAcademicYearWritable(
      classroom.academic_year_id,
    );
    const today = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Ho_Chi_Minh',
    }).format(new Date());
    enrollmentDate =
      today < academicYear.start_date
        ? academicYear.start_date
        : today > academicYear.end_date
          ? academicYear.end_date
          : today;
  }

  const reserved = new Set<string>();
  const batchEmails = new Set<string>();
  const generated: Array<{
    source: BulkCreateStudentsInput['students'][number];
    username: string;
    password: string;
    normalized: string;
    password_hash: string;
  }> = [];

  for (const student of input.students) {
    if (student.email) {
      const email = student.email.toLowerCase();
      if (batchEmails.has(email) || await isEmailTaken(email)) {
        throw new HttpError(409, `Email already exists: ${email}`);
      }
      batchEmails.add(email);
    }

    const credential = await generateStudentCredential(input.cohort, student.date_of_birth, reserved);
    generated.push({
      source: student,
      ...credential,
      password_hash: await hashPassword(credential.password),
    });
  }

  const created = await createBulkStudentAccountsRecord({
    classroom_id: input.classroom_id,
    created_by_user_id: createdByUserId,
    enrolled_at: enrollmentDate,
    students: generated.map((student) => ({
      username: student.username,
      email: student.source.email ?? null,
      password_hash: student.password_hash,
      full_name: student.source.full_name,
      date_of_birth: student.normalized,
      class_name: student.source.class_name ?? null,
      student_code: student.source.student_code ?? null,
      phone: student.source.phone ?? null,
      parent_phone: student.source.parent_phone ?? null,
    })),
  });

  return {
    createdCount: created.length,
    credentials: created.map((record, index): GeneratedStudentCredential => ({
      ...record,
      password: generated[index].password,
    })),
    note: 'Passwords are shown once. Store or distribute them securely, then require a password change in a future release.',
  };
}
