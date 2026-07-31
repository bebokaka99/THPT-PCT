import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import { app } from '../src/app.js';
import { closeDatabasePool, postgresPool } from '../src/database/postgres.js';
import { canTeachSubjectInClass } from '../src/modules/teaching-assignments/teaching-assignment.service.js';
import { hashPassword } from '../src/utils/password.js';

type LoginResponse = {
  accessToken: string;
  user: {
    id: number;
    username: string | null;
    email: string | null;
    fullName: string;
    roles: string[];
    permissions: string[];
  };
};

type DataResponse<T> = { data: T };

async function createUser(
  email: string,
  password: string,
  role: 'admin' | 'teacher',
) {
  const result = await postgresPool.query<{ id: number }>(
    `INSERT INTO users (email, full_name, password_hash, status)
     VALUES ($1, $2, $3, 'active')
     RETURNING id`,
    [email, `Assignment smoke ${role}`, await hashPassword(password)],
  );
  const id = Number(result.rows[0].id);
  await postgresPool.query(
    `INSERT INTO user_roles (user_id, role_id)
     SELECT $1, id FROM roles WHERE name = $2`,
    [id, role],
  );
  return id;
}

async function login(baseUrl: string, email: string, password: string) {
  const response = await fetch(`${baseUrl}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: email, password }),
  });
  assert.equal(response.status, 200);
  return (await response.json()) as LoginResponse;
}

async function run() {
  const suffix = Date.now();
  const password = 'teaching-assignment-test';
  const userIds: number[] = [];
  const subjectIds: number[] = [];
  const curriculumIds: number[] = [];
  let classroomId: number | undefined;

  const period = await postgresPool.query<{
    academic_year_id: number;
    semester_id: number;
    start_date: string;
  }>(
    `SELECT
       year_record.id AS academic_year_id,
       semester.id AS semester_id,
       semester.start_date::text AS start_date
     FROM academic_years year_record
     JOIN semesters semester ON semester.academic_year_id = year_record.id
     WHERE year_record.status <> 'closed'
       AND year_record.is_locked = FALSE
       AND semester.status <> 'closed'
       AND semester.is_locked = FALSE
     ORDER BY year_record.start_date DESC, semester.start_date ASC
     LIMIT 1`,
  );
  assert.ok(period.rows[0], 'A writable semester is required');
  const academicYearId = Number(period.rows[0].academic_year_id);
  const semesterId = Number(period.rows[0].semester_id);
  const assignedAt = period.rows[0].start_date;

  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });

  try {
    const adminEmail = `assignment-admin-${suffix}@pct.local`;
    const teacherOneEmail = `assignment-teacher-one-${suffix}@pct.local`;
    const teacherTwoEmail = `assignment-teacher-two-${suffix}@pct.local`;
    const adminId = await createUser(adminEmail, password, 'admin');
    const teacherOneId = await createUser(
      teacherOneEmail,
      password,
      'teacher',
    );
    const teacherTwoId = await createUser(
      teacherTwoEmail,
      password,
      'teacher',
    );
    userIds.push(adminId, teacherOneId, teacherTwoId);

    const address = server.address() as AddressInfo;
    const baseUrl = `http://127.0.0.1:${address.port}/api`;
    const admin = await login(baseUrl, adminEmail, password);
    const teacherOne = await login(baseUrl, teacherOneEmail, password);
    const teacherTwo = await login(baseUrl, teacherTwoEmail, password);
    const adminHeaders = {
      Authorization: `Bearer ${admin.accessToken}`,
      'Content-Type': 'application/json',
    };
    const teacherOneHeaders = {
      Authorization: `Bearer ${teacherOne.accessToken}`,
      'Content-Type': 'application/json',
    };

    const classroomResponse = await fetch(`${baseUrl}/classrooms`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        name: `Assignment Smoke ${suffix}`,
        academic_year_id: academicYearId,
        grade_level: 11,
        is_active: true,
      }),
    });
    assert.equal(classroomResponse.status, 201);
    classroomId = (
      (await classroomResponse.json()) as DataResponse<{ id: number }>
    ).data.id;

    for (const label of ['A', 'B']) {
      const subjectResponse = await fetch(`${baseUrl}/subjects`, {
        method: 'POST',
        headers: adminHeaders,
        body: JSON.stringify({
          code: `ASSIGN_${label}_${suffix}`,
          name: `Assignment subject ${label} ${suffix}`,
          subject_group: 'other',
          is_active: true,
        }),
      });
      assert.equal(subjectResponse.status, 201);
      const subjectId = (
        (await subjectResponse.json()) as DataResponse<{ id: number }>
      ).data.id;
      subjectIds.push(subjectId);

      const curriculumResponse = await fetch(
        `${baseUrl}/subjects/curriculum`,
        {
          method: 'POST',
          headers: adminHeaders,
          body: JSON.stringify({
            academic_year_id: academicYearId,
            subject_id: subjectId,
            grade_level: 11,
            periods_per_week: 2,
            is_required: false,
            is_active: true,
          }),
        },
      );
      assert.equal(curriculumResponse.status, 201);
      curriculumIds.push(
        (
          (await curriculumResponse.json()) as DataResponse<{ id: number }>
        ).data.id,
      );
    }

    await postgresPool.query(
      `INSERT INTO classroom_members (classroom_id, user_id, role)
       VALUES ($1, $2, 'teacher')`,
      [classroomId, teacherOneId],
    );
    assert.equal(
      await canTeachSubjectInClass(
        teacherOne.user,
        classroomId,
        subjectIds[0],
        semesterId,
      ),
      false,
      'Classroom membership must not grant subject teaching rights',
    );

    const firstInput = {
      teacher_user_id: teacherOneId,
      classroom_id: classroomId,
      subject_id: subjectIds[0],
      semester_id: semesterId,
      role: 'primary',
      assigned_at: assignedAt,
    };
    const firstResponse = await fetch(`${baseUrl}/teaching-assignments`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify(firstInput),
    });
    assert.equal(firstResponse.status, 201);
    const firstAssignment = (
      (await firstResponse.json()) as DataResponse<{ id: number }>
    ).data;
    assert.equal(
      await canTeachSubjectInClass(
        teacherOne.user,
        classroomId,
        subjectIds[0],
        semesterId,
      ),
      true,
    );

    const timetableResponse = await fetch(
      `${baseUrl}/classrooms/${classroomId}/timetable`,
      {
        method: 'POST',
        headers: adminHeaders,
        body: JSON.stringify({
          title: `Assignment timetable ${suffix}`,
          academic_year_id: academicYearId,
          semester_id: semesterId,
          is_active: true,
          items: [
            {
              day_of_week: 2,
              lesson_index: 1,
              subject_id: subjectIds[0],
              teaching_assignment_id: firstAssignment.id,
              subject_name: 'Must be normalized',
              teacher_name: 'Must be normalized',
            },
          ],
        }),
      },
    );
    assert.equal(timetableResponse.status, 201);
    const timetable = (
      (await timetableResponse.json()) as DataResponse<{
        items: Array<{
          teaching_assignment_id: number;
          teacher_name: string;
        }>;
      }>
    ).data;
    assert.equal(
      timetable.items[0].teaching_assignment_id,
      firstAssignment.id,
    );
    assert.equal(timetable.items[0].teacher_name, teacherOne.user.fullName);

    const duplicateResponse = await fetch(`${baseUrl}/teaching-assignments`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify(firstInput),
    });
    assert.equal(duplicateResponse.status, 409);

    const secondTeacherSameSubject = await fetch(
      `${baseUrl}/teaching-assignments`,
      {
        method: 'POST',
        headers: adminHeaders,
        body: JSON.stringify({
          ...firstInput,
          teacher_user_id: teacherTwoId,
          role: 'assistant',
        }),
      },
    );
    assert.equal(secondTeacherSameSubject.status, 201);
    const secondAssignment = (
      (await secondTeacherSameSubject.json()) as DataResponse<{ id: number }>
    ).data;

    const teacherCreateForbidden = await fetch(
      `${baseUrl}/teaching-assignments`,
      {
        method: 'POST',
        headers: teacherOneHeaders,
        body: JSON.stringify({
          ...firstInput,
          subject_id: subjectIds[1],
        }),
      },
    );
    assert.equal(teacherCreateForbidden.status, 403);

    const teacherOneList = await fetch(
      `${baseUrl}/teaching-assignments/me?limit=100`,
      { headers: teacherOneHeaders },
    );
    assert.equal(teacherOneList.status, 200);
    const ownRows = (
      (await teacherOneList.json()) as {
        data: Array<{ teacher_user_id: number }>;
      }
    ).data;
    assert.ok(ownRows.length >= 1);
    assert.ok(ownRows.every((row) => row.teacher_user_id === teacherOneId));

    const foreignDetail = await fetch(
      `${baseUrl}/teaching-assignments/${secondAssignment.id}`,
      { headers: teacherOneHeaders },
    );
    assert.equal(foreignDetail.status, 403);

    const atomicBulkConflict = await fetch(
      `${baseUrl}/teaching-assignments/bulk`,
      {
        method: 'POST',
        headers: adminHeaders,
        body: JSON.stringify({
          assignments: [
            {
              ...firstInput,
              subject_id: subjectIds[1],
            },
            firstInput,
          ],
        }),
      },
    );
    assert.equal(atomicBulkConflict.status, 409);
    const rolledBackCount = await postgresPool.query<{ total: number }>(
      `SELECT COUNT(*)::int AS total
       FROM teaching_assignments
       WHERE teacher_user_id = $1
         AND classroom_id = $2
         AND subject_id = $3
         AND semester_id = $4`,
      [teacherOneId, classroomId, subjectIds[1], semesterId],
    );
    assert.equal(rolledBackCount.rows[0].total, 0);

    const endResponse = await fetch(
      `${baseUrl}/teaching-assignments/${firstAssignment.id}/status`,
      {
        method: 'PATCH',
        headers: adminHeaders,
        body: JSON.stringify({
          status: 'inactive',
          effective_date: assignedAt,
        }),
      },
    );
    assert.equal(endResponse.status, 200);
    assert.equal(
      await canTeachSubjectInClass(
        teacherOne.user,
        classroomId,
        subjectIds[0],
        semesterId,
      ),
      false,
      'Inactive assignment must not grant write scope',
    );

    const historyResponse = await fetch(
      `${baseUrl}/teaching-assignments/me?status=inactive`,
      { headers: teacherOneHeaders },
    );
    assert.equal(historyResponse.status, 200);
    assert.equal(
      (
        (await historyResponse.json()) as {
          data: Array<{ id: number }>;
        }
      ).data.some((row) => row.id === firstAssignment.id),
      true,
    );

    console.log(
      'Teaching assignment scope, multi-teacher, and atomic bulk smoke test passed.',
    );
  } finally {
    if (classroomId) {
      await postgresPool.query(
        `DELETE FROM timetable_items
         WHERE timetable_id IN (
           SELECT id FROM timetables WHERE classroom_id = $1
         )`,
        [classroomId],
      );
      await postgresPool.query(
        'DELETE FROM timetables WHERE classroom_id = $1',
        [classroomId],
      );
      await postgresPool.query(
        'DELETE FROM teaching_assignments WHERE classroom_id = $1',
        [classroomId],
      );
      await postgresPool.query('DELETE FROM classrooms WHERE id = $1', [
        classroomId,
      ]);
    }
    if (curriculumIds.length) {
      await postgresPool.query(
        'DELETE FROM curriculum_subjects WHERE id = ANY($1::bigint[])',
        [curriculumIds],
      );
    }
    if (subjectIds.length) {
      await postgresPool.query(
        'DELETE FROM subjects WHERE id = ANY($1::bigint[])',
        [subjectIds],
      );
    }
    if (userIds.length) {
      await postgresPool.query(
        'DELETE FROM users WHERE id = ANY($1::bigint[])',
        [userIds],
      );
    }
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
    await closeDatabasePool();
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
