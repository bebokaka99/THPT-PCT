import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import { app } from '../src/app.js';
import { closeDatabasePool, postgresPool } from '../src/database/postgres.js';
import { hashPassword } from '../src/utils/password.js';
import { createStudentTranscriptSnapshot } from '../src/modules/transcripts/transcript.service.js';

type LoginResponse = { accessToken: string };
type DataResponse<T> = { data: T };

async function createUser(
  email: string,
  password: string,
  role: 'admin' | 'teacher' | 'student',
  fullName: string,
) {
  const result = await postgresPool.query<{ id: number }>(
    `INSERT INTO users (email, full_name, password_hash, status)
     VALUES ($1, $2, $3, 'active') RETURNING id`,
    [email, fullName, await hashPassword(password)],
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
  const password = 'gradebook-smoke-password';
  const userIds: number[] = [];
  let classroomId = 0;
  let subjectId = 0;
  let curriculumId = 0;
  let teachingAssignmentId = 0;
  let configurationId = 0;
  let gradebookId = 0;
  let semesterLockedForSnapshot = false;

  const period = await postgresPool.query<{
    academic_year_id: number;
    academic_year_name: string;
    semester_id: number;
    start_date: string;
    end_date: string;
  }>(
    `SELECT academic_year.id AS academic_year_id,
       academic_year.name AS academic_year_name,
       semester.id AS semester_id,
       semester.start_date::text,
       semester.end_date::text
     FROM academic_years academic_year
     JOIN semesters semester ON semester.academic_year_id = academic_year.id
     WHERE academic_year.status <> 'closed'
       AND academic_year.is_locked = FALSE
       AND semester.status <> 'closed'
       AND semester.is_locked = FALSE
     ORDER BY semester.end_date DESC
     LIMIT 1`,
  );
  assert.ok(period.rows[0], 'A writable semester is required');
  const academicYearId = Number(period.rows[0].academic_year_id);
  const semesterId = Number(period.rows[0].semester_id);

  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });

  try {
    const teacherEmail = `gradebook-teacher-${suffix}@pct.local`;
    const outsiderEmail = `gradebook-outsider-${suffix}@pct.local`;
    const teacherId = await createUser(
      teacherEmail,
      password,
      'teacher',
      'Gradebook Teacher',
    );
    const outsiderId = await createUser(
      outsiderEmail,
      password,
      'teacher',
      'Gradebook Outsider',
    );
    const adminEmail = `gradebook-admin-${suffix}@pct.local`;
    const adminId = await createUser(
      adminEmail,
      password,
      'admin',
      'Gradebook Reviewer',
    );
    userIds.push(teacherId, outsiderId, adminId);

    const studentIds: number[] = [];
    for (let index = 0; index < 40; index += 1) {
      const studentId = await createUser(
        `gradebook-student-${index}-${suffix}@pct.local`,
        password,
        'student',
        `Gradebook Student ${String(index + 1).padStart(2, '0')}`,
      );
      studentIds.push(studentId);
      userIds.push(studentId);
    }

    const classroom = await postgresPool.query<{ id: number }>(
      `INSERT INTO classrooms (
         name, school_year, academic_year_id, grade_level, is_active
       ) VALUES ($1, $2, $3, 12, TRUE) RETURNING id`,
      [
        `Gradebook Smoke ${suffix}`,
        period.rows[0].academic_year_name,
        academicYearId,
      ],
    );
    classroomId = Number(classroom.rows[0].id);
    const subject = await postgresPool.query<{ id: number }>(
      `INSERT INTO subjects (code, name, subject_group)
       VALUES ($1, $2, 'other') RETURNING id`,
      [`GB_${String(suffix).slice(-10)}`, `Gradebook ${suffix}`],
    );
    subjectId = Number(subject.rows[0].id);
    const curriculum = await postgresPool.query<{ id: number }>(
      `INSERT INTO curriculum_subjects (
         academic_year_id, subject_id, grade_level, periods_per_week
       ) VALUES ($1, $2, 12, 2) RETURNING id`,
      [academicYearId, subjectId],
    );
    curriculumId = Number(curriculum.rows[0].id);
    const teaching = await postgresPool.query<{ id: number }>(
      `INSERT INTO teaching_assignments (
         teacher_user_id, classroom_id, subject_id, semester_id, status,
         assigned_at
       ) VALUES ($1, $2, $3, $4, 'active', $5::date) RETURNING id`,
      [
        teacherId,
        classroomId,
        subjectId,
        semesterId,
        period.rows[0].start_date,
      ],
    );
    teachingAssignmentId = Number(teaching.rows[0].id);

    for (const studentId of studentIds) {
      await postgresPool.query(
        `INSERT INTO student_enrollments (
           student_user_id, classroom_id, academic_year_id, status, enrolled_at
         ) VALUES ($1, $2, $3, 'active', $4::date)`,
        [
          studentId,
          classroomId,
          academicYearId,
          period.rows[0].start_date,
        ],
      );
    }

    const client = await postgresPool.connect();
    try {
      await client.query('BEGIN');
      const configuration = await client.query<{ id: number }>(
        `INSERT INTO assessment_configurations (
           subject_id, semester_id, grade_level, version, title,
           score_scale, decimal_places, rounding_mode
         ) VALUES ($1, $2, 12, 1, 'Gradebook smoke formula',
           10, 1, 'half_up') RETURNING id`,
        [subjectId, semesterId],
      );
      configurationId = Number(configuration.rows[0].id);
      await client.query(
        `INSERT INTO assessment_categories (
           configuration_id, code, name, weight_percent, coefficient,
           max_entries, score_scale, sort_order
         ) VALUES
           ($1, 'REGULAR', 'Thuong xuyen', 60, 1, 2, 10, 1),
           ($1, 'FINAL', 'Cuoi ky', 40, 1, 1, 10, 2)`,
        [configurationId],
      );
      await client.query(
        `UPDATE assessment_configurations
         SET status = 'active', activated_at = CURRENT_TIMESTAMP
         WHERE id = $1`,
        [configurationId],
      );
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

    const address = server.address() as AddressInfo;
    const baseUrl = `http://127.0.0.1:${address.port}/api`;
    const teacher = await login(baseUrl, teacherEmail, password);
    const outsider = await login(baseUrl, outsiderEmail, password);
    const admin = await login(baseUrl, adminEmail, password);
    const student = await login(
      baseUrl,
      `gradebook-student-0-${suffix}@pct.local`,
      password,
    );
    const headers = (token: string) => ({
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    });

    const outsiderCreate = await fetch(`${baseUrl}/gradebooks`, {
      method: 'POST',
      headers: headers(outsider.accessToken),
      body: JSON.stringify({ teaching_assignment_id: teachingAssignmentId }),
    });
    assert.equal(outsiderCreate.status, 403);

    const createResponse = await fetch(`${baseUrl}/gradebooks`, {
      method: 'POST',
      headers: headers(teacher.accessToken),
      body: JSON.stringify({ teaching_assignment_id: teachingAssignmentId }),
    });
    assert.equal(createResponse.status, 201);
    const created = (
      (await createResponse.json()) as DataResponse<{
        id: number;
        columns: Array<{ id: number }>;
        students: Array<{ user_id: number }>;
      }>
    ).data;
    gradebookId = created.id;
    assert.equal(created.columns.length, 3);
    assert.equal(created.students.length, 40);

    const entries = studentIds.flatMap((studentId, index) => {
      const regularState =
        index === 2 ? 'absent' : index === 3 ? 'exempt' : 'scored';
      const regularScore =
        regularState === 'scored'
          ? index === 0
            ? '0'
            : index === 1
              ? '7.25'
              : '8'
          : null;
      return [
        {
          student_user_id: studentId,
          column_id: created.columns[0].id,
          state: regularState,
          score: regularScore,
          expected_version: 0,
        },
        {
          student_user_id: studentId,
          column_id: created.columns[2].id,
          state: 'scored',
          score: index === 0 ? '8.5' : index === 1 ? '9' : '10',
          expected_version: 0,
        },
      ];
    });
    const saveResponse = await fetch(
      `${baseUrl}/gradebooks/${gradebookId}/scores`,
      {
        method: 'PUT',
        headers: headers(teacher.accessToken),
        body: JSON.stringify({ entries, reason: '40-student smoke batch' }),
      },
    );
    assert.equal(saveResponse.status, 200);
    const saved = (
      (await saveResponse.json()) as DataResponse<{
        totals: Array<{
          student_user_id: number;
          is_complete: boolean;
          final_score: number | null;
        }>;
      }>
    ).data;
    const totalFor = (id: number) =>
      saved.totals.find((item) => item.student_user_id === id)!;
    assert.equal(totalFor(studentIds[0]).final_score, 3.4);
    assert.equal(totalFor(studentIds[1]).final_score, 8);
    assert.equal(totalFor(studentIds[2]).final_score, 4);
    assert.equal(totalFor(studentIds[3]).is_complete, false);
    assert.equal(totalFor(studentIds[3]).final_score, null);

    const staleResponse = await fetch(
      `${baseUrl}/gradebooks/${gradebookId}/scores`,
      {
        method: 'PUT',
        headers: headers(teacher.accessToken),
        body: JSON.stringify({
          entries: [
            {
              student_user_id: studentIds[0],
              column_id: created.columns[0].id,
              state: 'scored',
              score: '5',
              expected_version: 0,
            },
            {
              student_user_id: studentIds[1],
              column_id: created.columns[0].id,
              state: 'scored',
              score: '6',
              expected_version: 1,
            },
          ],
        }),
      },
    );
    assert.equal(staleResponse.status, 409);
    const rollbackCheck = await postgresPool.query<{
      score: string;
      version: number;
    }>(
      `SELECT score::text, version
       FROM student_scores
       WHERE gradebook_id = $1 AND student_user_id = $2 AND column_id = $3`,
      [gradebookId, studentIds[1], created.columns[0].id],
    );
    assert.equal(Number(rollbackCheck.rows[0].score), 7.25);
    assert.equal(Number(rollbackCheck.rows[0].version), 1);

    const auditResponse = await fetch(
      `${baseUrl}/gradebooks/${gradebookId}/audit`,
      { headers: headers(teacher.accessToken) },
    );
    assert.equal(auditResponse.status, 200);
    const auditBody = (await auditResponse.json()) as {
      data: Array<{ id: number }>;
    };
    assert.equal(auditBody.data.length, 80);

    const studentDrafts = await fetch(`${baseUrl}/gradebooks/me`, {
      headers: headers(student.accessToken),
    });
    assert.equal(studentDrafts.status, 200);
    assert.deepEqual((await studentDrafts.json()) as { data: unknown[] }, {
      data: [],
    });

    const workflowPost = (
      token: string,
      path: string,
      body: object = {},
    ) =>
      fetch(`${baseUrl}${path}`, {
        method: 'POST',
        headers: headers(token),
        body: JSON.stringify(body),
      });

    const submitted = await workflowPost(
      teacher.accessToken,
      `/gradebooks/${gradebookId}/submit`,
    );
    assert.equal(submitted.status, 200);
    const submittedAgain = await workflowPost(
      teacher.accessToken,
      `/gradebooks/${gradebookId}/submit`,
    );
    assert.equal(submittedAgain.status, 200);

    const writeWhileSubmitted = await fetch(
      `${baseUrl}/gradebooks/${gradebookId}/scores`,
      {
        method: 'PUT',
        headers: headers(teacher.accessToken),
        body: JSON.stringify({ entries: [entries[0]] }),
      },
    );
    assert.equal(writeWhileSubmitted.status, 409);

    const rejectWithoutReason = await workflowPost(
      admin.accessToken,
      `/gradebooks/${gradebookId}/reject`,
    );
    assert.equal(rejectWithoutReason.status, 400);
    const rejected = await workflowPost(
      admin.accessToken,
      `/gradebooks/${gradebookId}/reject`,
      { reason: 'Cần rà soát điểm thường xuyên' },
    );
    assert.equal(rejected.status, 200);

    const resubmitted = await workflowPost(
      teacher.accessToken,
      `/gradebooks/${gradebookId}/submit`,
    );
    assert.equal(resubmitted.status, 200);
    const approved = await workflowPost(
      admin.accessToken,
      `/gradebooks/${gradebookId}/approve`,
    );
    assert.equal(approved.status, 200);
    const studentApproved = await fetch(`${baseUrl}/gradebooks/me`, {
      headers: headers(student.accessToken),
    });
    assert.equal(studentApproved.status, 200);
    const studentApprovedBody = (await studentApproved.json()) as {
      data: Array<{ id: number; status: string }>;
    };
    assert.equal(studentApprovedBody.data.length, 1);
    assert.equal(studentApprovedBody.data[0].status, 'approved');

    const liveTranscript = await fetch(
      `${baseUrl}/transcripts/me?semester_id=${semesterId}`,
      { headers: headers(student.accessToken) },
    );
    assert.equal(liveTranscript.status, 200);
    const liveTranscriptBody = (await liveTranscript.json()) as DataResponse<{
      source: string;
      subjects: Array<{ final_score: number | null }>;
    }>;
    assert.equal(liveTranscriptBody.data.source, 'live');
    assert.equal(liveTranscriptBody.data.subjects.length, 1);
    assert.equal(liveTranscriptBody.data.subjects[0].final_score, 3.4);

    const crossStudentTranscript = await fetch(
      `${baseUrl}/transcripts/students/${studentIds[1]}?semester_id=${semesterId}`,
      { headers: headers(student.accessToken) },
    );
    assert.equal(crossStudentTranscript.status, 403);
    const outsiderTranscript = await fetch(
      `${baseUrl}/transcripts/students/${studentIds[0]}?semester_id=${semesterId}`,
      { headers: headers(outsider.accessToken) },
    );
    assert.equal(outsiderTranscript.status, 403);
    const ownerTeacherTranscript = await fetch(
      `${baseUrl}/transcripts/students/${studentIds[0]}?semester_id=${semesterId}`,
      { headers: headers(teacher.accessToken) },
    );
    assert.equal(ownerTeacherTranscript.status, 200);

    const locked = await workflowPost(
      admin.accessToken,
      `/gradebooks/${gradebookId}/lock`,
    );
    assert.equal(locked.status, 200);
    const snapshotCreated = await createStudentTranscriptSnapshot(
      studentIds[0],
      semesterId,
      adminId,
    );
    assert.equal(snapshotCreated, true);
    await postgresPool.query(
      'UPDATE semesters SET is_locked = TRUE WHERE id = $1',
      [semesterId],
    );
    semesterLockedForSnapshot = true;
    await assert.rejects(
      postgresPool.query(
        `UPDATE student_scores SET score = 9
         WHERE gradebook_id = $1 AND student_user_id = $2`,
        [gradebookId, studentIds[0]],
      ),
      /Scores can only be changed while gradebook is draft/,
    );

    const changeRequest = await workflowPost(
      teacher.accessToken,
      `/gradebooks/${gradebookId}/change-requests`,
      { reason: 'Điều chỉnh sai sót nhập liệu' },
    );
    assert.equal(changeRequest.status, 201);
    const changeRequestBody = (await changeRequest.json()) as DataResponse<{
      id: number;
    }>;
    const duplicateRequest = await workflowPost(
      teacher.accessToken,
      `/gradebooks/${gradebookId}/change-requests`,
      { reason: 'Yêu cầu trùng' },
    );
    assert.equal(duplicateRequest.status, 201);
    const teacherSelfReview = await workflowPost(
      teacher.accessToken,
      `/gradebooks/change-requests/${changeRequestBody.data.id}/approve`,
      { reason: 'Không hợp lệ' },
    );
    assert.equal(teacherSelfReview.status, 403);
    const reopened = await workflowPost(
      admin.accessToken,
      `/gradebooks/change-requests/${changeRequestBody.data.id}/approve`,
      { reason: 'Cho phép sửa một lần' },
    );
    assert.equal(reopened.status, 200);

    const historicalTranscript = await fetch(
      `${baseUrl}/transcripts/me?semester_id=${semesterId}`,
      { headers: headers(student.accessToken) },
    );
    assert.equal(historicalTranscript.status, 200);
    const historicalBody = (await historicalTranscript.json()) as DataResponse<{
      source: string;
      subjects: Array<{ final_score: number | null }>;
    }>;
    assert.equal(historicalBody.data.source, 'snapshot');
    assert.equal(historicalBody.data.subjects[0].final_score, 3.4);
    await postgresPool.query(
      'UPDATE semesters SET is_locked = FALSE WHERE id = $1',
      [semesterId],
    );
    semesterLockedForSnapshot = false;

    const workflowAudit = await fetch(
      `${baseUrl}/gradebooks/${gradebookId}/workflow-audit`,
      { headers: headers(admin.accessToken) },
    );
    assert.equal(workflowAudit.status, 200);
    const workflowAuditBody = (await workflowAudit.json()) as {
      data: Array<{ action: string }>;
    };
    for (const action of [
      'submit',
      'reject',
      'approve',
      'lock',
      'change_request_create',
      'change_request_approve',
    ]) {
      assert.ok(
        workflowAuditBody.data.some((item) => item.action === action),
        `Missing workflow audit action ${action}`,
      );
    }

    console.log(
      'Gradebook 40-student batch, approval workflow, locking, change request, RBAC, and audit smoke test passed.',
    );
  } finally {
    if (semesterLockedForSnapshot) {
      await postgresPool.query(
        'UPDATE semesters SET is_locked = FALSE WHERE id = $1',
        [semesterId],
      );
    }
    if (teachingAssignmentId) {
      const gradebookRows = await postgresPool.query<{ id: number }>(
        'SELECT id FROM gradebooks WHERE teaching_assignment_id = $1',
        [teachingAssignmentId],
      );
      gradebookId = Number(gradebookRows.rows[0]?.id ?? gradebookId);
    }
    if (gradebookId) {
      const cleanupClient = await postgresPool.connect();
      try {
        await cleanupClient.query('BEGIN');
        await cleanupClient.query(
          "SET LOCAL app.allow_audit_cleanup = 'on'",
        );
        await cleanupClient.query(
          "SET LOCAL app.allow_snapshot_cleanup = 'on'",
        );
        await cleanupClient.query(
          `DELETE FROM student_report_snapshot_subjects
           WHERE snapshot_id IN (
             SELECT id FROM student_report_snapshots
             WHERE student_user_id = ANY($1::bigint[])
           )`,
          [userIds],
        );
        await cleanupClient.query(
          `DELETE FROM student_report_snapshots
           WHERE student_user_id = ANY($1::bigint[])`,
          [userIds],
        );
        await cleanupClient.query(
          'DELETE FROM student_score_audits WHERE gradebook_id = $1',
          [gradebookId],
        );
        await cleanupClient.query(
          'DELETE FROM gradebook_workflow_audits WHERE gradebook_id = $1',
          [gradebookId],
        );
        await cleanupClient.query('COMMIT');
      } catch (error) {
        await cleanupClient.query('ROLLBACK');
        throw error;
      } finally {
        cleanupClient.release();
      }
      await postgresPool.query(
        'DELETE FROM student_scores WHERE gradebook_id = $1',
        [gradebookId],
      );
      await postgresPool.query(
        'DELETE FROM gradebook_change_requests WHERE gradebook_id = $1',
        [gradebookId],
      );
      await postgresPool.query('DELETE FROM gradebooks WHERE id = $1', [
        gradebookId,
      ]);
    }
    if (configurationId) {
      await postgresPool.query(
        'DELETE FROM assessment_configurations WHERE id = $1',
        [configurationId],
      );
    }
    if (classroomId) {
      await postgresPool.query(
        'DELETE FROM student_enrollments WHERE classroom_id = $1',
        [classroomId],
      );
    }
    if (teachingAssignmentId) {
      await postgresPool.query(
        'DELETE FROM teaching_assignments WHERE id = $1',
        [teachingAssignmentId],
      );
    }
    if (classroomId) {
      await postgresPool.query('DELETE FROM classrooms WHERE id = $1', [
        classroomId,
      ]);
    }
    if (curriculumId) {
      await postgresPool.query(
        'DELETE FROM curriculum_subjects WHERE id = $1',
        [curriculumId],
      );
    }
    if (subjectId) {
      await postgresPool.query('DELETE FROM subjects WHERE id = $1', [
        subjectId,
      ]);
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
