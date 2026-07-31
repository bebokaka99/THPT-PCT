import type { DatabaseResult, DatabaseRow } from '../../database/postgres.js';
import { databasePool } from '../../database/postgres.js';
import type { TeachingPlan, TeachingPlanInput, TeachingPlanListQuery, TeachingPlanOptions, TeachingPlanStatus, TeachingPlanSummary, TeachingPlanUpdateInput } from './teaching-plan.types.js';

type PlanRow = DatabaseRow & TeachingPlan;
type CountRow = DatabaseRow & { total: number };

const selectSql = `
  SELECT plan.*, teacher.full_name AS teacher_name,
    classroom.name AS classroom_name, subject.name AS subject_name,
    academic_year.name AS academic_year_name, semester.name AS semester_name,
    reviewer.full_name AS reviewer_name
  FROM teaching_plans plan
  JOIN users teacher ON teacher.id = plan.teacher_user_id
  JOIN classrooms classroom ON classroom.id = plan.classroom_id
  JOIN subjects subject ON subject.id = plan.subject_id
  JOIN academic_years academic_year ON academic_year.id = plan.academic_year_id
  JOIN semesters semester ON semester.id = plan.semester_id
  LEFT JOIN users reviewer ON reviewer.id = plan.reviewer_user_id
`;

function iso(value: unknown) {
  return value ? (value instanceof Date ? value.toISOString() : String(value)) : null;
}

function mapPlan(row: PlanRow): TeachingPlan {
  return {
    ...row,
    id: Number(row.id), teaching_assignment_id: Number(row.teaching_assignment_id),
    teacher_user_id: Number(row.teacher_user_id), classroom_id: Number(row.classroom_id),
    subject_id: Number(row.subject_id), academic_year_id: Number(row.academic_year_id),
    semester_id: Number(row.semester_id), version_number: Number(row.version_number),
    week_number: row.week_number === null ? null : Number(row.week_number),
    timetable_item_id: row.timetable_item_id === null ? null : Number(row.timetable_item_id),
    assignment_id: row.assignment_id === null ? null : Number(row.assignment_id),
    media_file_id: row.media_file_id === null ? null : Number(row.media_file_id),
    reviewer_user_id: row.reviewer_user_id === null ? null : Number(row.reviewer_user_id),
    created_by_user_id: Number(row.created_by_user_id),
    submitted_at: iso(row.submitted_at), reviewed_at: iso(row.reviewed_at), archived_at: iso(row.archived_at),
    created_at: iso(row.created_at) as string, updated_at: iso(row.updated_at) as string,
  };
}

function buildWhere(query: TeachingPlanListQuery) {
  const where: string[] = [];
  const params: Array<string | number> = [];
  if (query.q) {
    where.push('(plan.title ILIKE ? OR plan.objectives ILIKE ? OR plan.content ILIKE ? OR subject.name ILIKE ? OR classroom.name ILIKE ?)');
    const term = `%${query.q}%`; params.push(term, term, term, term, term);
  }
  if (query.status) { where.push('plan.status = ?'); params.push(query.status); }
  if (query.teacher_user_id) { where.push('plan.teacher_user_id = ?'); params.push(query.teacher_user_id); }
  if (query.classroom_id) { where.push('plan.classroom_id = ?'); params.push(query.classroom_id); }
  if (query.subject_id) { where.push('plan.subject_id = ?'); params.push(query.subject_id); }
  if (query.semester_id) { where.push('plan.semester_id = ?'); params.push(query.semester_id); }
  return { whereSql: where.length ? `WHERE ${where.join(' AND ')}` : '', params };
}

export async function findTeachingPlans(query: TeachingPlanListQuery) {
  const { whereSql, params } = buildWhere(query);
  const offset = (query.page - 1) * query.limit;
  const [rows] = await databasePool.query<PlanRow[]>(`${selectSql} ${whereSql} ORDER BY plan.updated_at DESC, plan.id DESC LIMIT ? OFFSET ?`, [...params, query.limit, offset]);
  const [countRows] = await databasePool.query<CountRow[]>(`SELECT COUNT(*) AS total FROM teaching_plans plan JOIN subjects subject ON subject.id = plan.subject_id JOIN classrooms classroom ON classroom.id = plan.classroom_id ${whereSql}`, params);
  return { data: rows.map(mapPlan), total: Number(countRows[0]?.total ?? 0) };
}

export async function findTeachingPlanById(id: number) {
  const [rows] = await databasePool.query<PlanRow[]>(`${selectSql} WHERE plan.id = ? LIMIT 1`, [id]);
  return rows[0] ? mapPlan(rows[0]) : null;
}

export async function findTeachingPlanByAssignmentId(assignmentId: number) {
  const [rows] = await databasePool.query<PlanRow[]>(`${selectSql} WHERE plan.teaching_assignment_id = ? LIMIT 1`, [assignmentId]);
  return rows[0] ? mapPlan(rows[0]) : null;
}

export async function findTeachingPlanOptions(teacherUserId?: number): Promise<TeachingPlanOptions> {
  const where = teacherUserId ? 'WHERE assignment.teacher_user_id = ? AND assignment.status = \'active\'' : "WHERE assignment.status = 'active'";
  const params = teacherUserId ? [teacherUserId] : [];
  const [rows] = await databasePool.query<Array<DatabaseRow & { id: number; classroom_name: string; subject_name: string; semester_name: string; academic_year_name: string }>>(
    `SELECT assignment.id, classroom.name AS classroom_name, subject.name AS subject_name,
       semester.name AS semester_name, academic_year.name AS academic_year_name
     FROM teaching_assignments assignment
     JOIN classrooms classroom ON classroom.id = assignment.classroom_id
     JOIN subjects subject ON subject.id = assignment.subject_id
     JOIN semesters semester ON semester.id = assignment.semester_id
     JOIN academic_years academic_year ON academic_year.id = classroom.academic_year_id
     ${where} ORDER BY academic_year.start_date DESC, classroom.name, subject.name`, params,
  );
  return { assignments: rows.map((row) => ({ ...row, id: Number(row.id) })) };
}

export async function insertTeachingPlan(input: TeachingPlanInput, assignment: { teacher_user_id: number; classroom_id: number; subject_id: number; academic_year_id: number; semester_id: number }, actorUserId: number) {
  const connection = await databasePool.getConnection();
  try {
    await connection.beginTransaction();
    const [result] = await connection.query<DatabaseResult>(
      `INSERT INTO teaching_plans (teaching_assignment_id, teacher_user_id, classroom_id, subject_id, academic_year_id, semester_id, title, objectives, content, resources, week_number, timetable_item_id, assignment_id, media_file_id, created_by_user_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
      [input.teaching_assignment_id, assignment.teacher_user_id, assignment.classroom_id, assignment.subject_id, assignment.academic_year_id, assignment.semester_id, input.title, input.objectives ?? null, input.content ?? null, input.resources ?? null, input.week_number ?? null, input.timetable_item_id ?? null, input.assignment_id ?? null, input.media_file_id ?? null, actorUserId],
    );
    const id = result.insertId;
    await connection.query(`INSERT INTO teaching_plan_versions (teaching_plan_id, version_number, title, objectives, content, resources, week_number, timetable_item_id, assignment_id, media_file_id, created_by_user_id) VALUES (?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [id, input.title, input.objectives ?? null, input.content ?? null, input.resources ?? null, input.week_number ?? null, input.timetable_item_id ?? null, input.assignment_id ?? null, input.media_file_id ?? null, actorUserId]);
    await connection.query(`INSERT INTO teaching_plan_audits (teaching_plan_id, actor_user_id, action, old_status, new_status, new_data) VALUES (?, ?, 'create', NULL, 'draft', ?::jsonb)`, [id, actorUserId, JSON.stringify(input)]);
    await connection.commit();
    return findTeachingPlanById(id);
  } catch (error) { await connection.rollback(); throw error; } finally { connection.release(); }
}

export async function updateTeachingPlanRecord(id: number, input: TeachingPlanUpdateInput, currentVersion: number, currentStatus: TeachingPlanStatus, actorUserId: number) {
  const fields: string[] = [];
  const values: Array<string | number | null> = [];
  for (const key of ['title', 'objectives', 'content', 'resources', 'week_number', 'timetable_item_id', 'assignment_id', 'media_file_id'] as const) {
    if (input[key] !== undefined) { fields.push(`${key} = ?`); values.push(input[key] ?? null); }
  }
  const nextVersion = currentVersion + 1;
  fields.push('version_number = ?'); values.push(nextVersion, id);
  const nextTitle = input.title ?? undefined;
  const nextObjectives = input.objectives === undefined ? undefined : input.objectives;
  const nextContent = input.content === undefined ? undefined : input.content;
  const nextResources = input.resources === undefined ? undefined : input.resources;
  const connection = await databasePool.getConnection();
  try {
    await connection.beginTransaction();
    await connection.query(`UPDATE teaching_plans SET ${fields.join(', ')}, status = 'draft', reviewer_user_id = NULL, review_comment = NULL, submitted_at = NULL, reviewed_at = NULL WHERE id = ?`, values);
    const [rows] = await connection.query<PlanRow[]>(`${selectSql} WHERE plan.id = ? LIMIT 1`, [id]);
    const plan = rows[0] ? mapPlan(rows[0]) : null;
    if (!plan) throw new Error('Teaching plan disappeared during update');
    await connection.query(`INSERT INTO teaching_plan_versions (teaching_plan_id, version_number, title, objectives, content, resources, week_number, timetable_item_id, assignment_id, media_file_id, created_by_user_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [id, nextVersion, nextTitle ?? plan.title, nextObjectives === undefined ? plan.objectives : nextObjectives, nextContent === undefined ? plan.content : nextContent, nextResources === undefined ? plan.resources : nextResources, input.week_number === undefined ? plan.week_number : input.week_number, input.timetable_item_id === undefined ? plan.timetable_item_id : input.timetable_item_id, input.assignment_id === undefined ? plan.assignment_id : input.assignment_id, input.media_file_id === undefined ? plan.media_file_id : input.media_file_id, actorUserId]);
    await connection.query(`INSERT INTO teaching_plan_audits (teaching_plan_id, actor_user_id, action, old_status, new_status, new_data) VALUES (?, ?, 'update', ?, 'draft', ?::jsonb)`, [id, actorUserId, currentStatus, JSON.stringify({ ...input, version_number: nextVersion })]);
    await connection.commit();
    return findTeachingPlanById(id);
  } catch (error) { await connection.rollback(); throw error; } finally { connection.release(); }
}

export async function transitionTeachingPlan(id: number, status: TeachingPlanStatus, actorUserId: number, comment?: string | null) {
  const current = await findTeachingPlanById(id);
  if (!current) return null;
  const now = new Date();
  await databasePool.query(
    `UPDATE teaching_plans SET status = ?, reviewer_user_id = ?, review_comment = ?,
      submitted_at = CASE WHEN ? = 'submitted' THEN COALESCE(submitted_at, ?) ELSE submitted_at END,
      reviewed_at = CASE WHEN ? IN ('approved', 'rejected') THEN ? ELSE reviewed_at END,
      archived_at = CASE WHEN ? = 'archived' THEN ? ELSE archived_at END
     WHERE id = ?`,
    [status, ['approved', 'rejected'].includes(status) ? actorUserId : current.reviewer_user_id, comment ?? null, status, now, status, now, status, now, id],
  );
  await databasePool.query(`INSERT INTO teaching_plan_audits (teaching_plan_id, actor_user_id, action, old_status, new_status, reason) VALUES (?, ?, ?, ?, ?, ?)`, [id, actorUserId, status === 'submitted' ? 'submit' : status === 'approved' ? 'approve' : status === 'rejected' ? 'reject' : 'archive', current.status, status, comment ?? null]);
  return findTeachingPlanById(id);
}

export async function deleteTeachingPlanRecord(id: number) {
  const [result] = await databasePool.query<DatabaseResult>(`DELETE FROM teaching_plans WHERE id = ? AND status IN ('draft', 'rejected')`, [id]);
  return result.affectedRows > 0;
}

export async function findTeachingPlanSummary(): Promise<TeachingPlanSummary> {
  const [rows] = await databasePool.query<Array<DatabaseRow & TeachingPlanSummary[number]>>(
    `SELECT subject.subject_group,
      COUNT(*)::integer AS total,
      COUNT(*) FILTER (WHERE plan.status = 'draft')::integer AS draft,
      COUNT(*) FILTER (WHERE plan.status = 'submitted')::integer AS submitted,
      COUNT(*) FILTER (WHERE plan.status = 'approved')::integer AS approved,
      COUNT(*) FILTER (WHERE plan.status = 'rejected')::integer AS rejected
     FROM teaching_plans plan JOIN subjects subject ON subject.id = plan.subject_id
     WHERE plan.status <> 'archived'
     GROUP BY subject.subject_group ORDER BY subject.subject_group`,
  );
  return rows.map((row) => ({ subject_group: row.subject_group, total: Number(row.total), draft: Number(row.draft), submitted: Number(row.submitted), approved: Number(row.approved), rejected: Number(row.rejected) }));
}
