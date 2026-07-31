import type { DatabaseResult, DatabaseRow } from '../../database/postgres.js';
import { databasePool } from '../../database/postgres.js';
import type { Classroom, ClassroomContentStatus, ClassroomDocument, ClassroomDocumentInput, ClassroomMember, ClassroomPost, ClassroomPostInput, ClassroomRole, ListClassroomsQuery, MemberInput, ResolvedClassroomInput } from './classroom.types.js';

type ClassroomRow = DatabaseRow & Classroom;
type MemberRow = DatabaseRow & ClassroomMember;
type PostRow = DatabaseRow & ClassroomPost;
type DocumentRow = DatabaseRow & ClassroomDocument;
type CountRow = DatabaseRow & { total: number };

function mapClassroom(row: ClassroomRow): Classroom {
  return {
    ...row,
    id: Number(row.id),
    academic_year_id:
      row.academic_year_id === null ? null : Number(row.academic_year_id),
    grade_level: row.grade_level === null ? null : Number(row.grade_level),
    homeroom_teacher_user_id: row.homeroom_teacher_user_id === null ? null : Number(row.homeroom_teacher_user_id),
    is_active: Boolean(row.is_active),
    member_count: Number(row.member_count ?? 0),
    student_count: Number(row.student_count ?? 0),
    teacher_count: Number(row.teacher_count ?? 0),
  };
}

const classroomSelect = `
  SELECT c.*,
    (
      SELECT COUNT(*)
      FROM classroom_members member
      WHERE member.classroom_id = c.id AND member.role = 'teacher'
    ) + (
      SELECT COUNT(*)
      FROM student_enrollments enrollment
      WHERE enrollment.classroom_id = c.id AND enrollment.status = 'active'
    ) AS member_count,
    (
      SELECT COUNT(*)
      FROM student_enrollments enrollment
      WHERE enrollment.classroom_id = c.id AND enrollment.status = 'active'
    ) AS student_count,
    (
      SELECT COUNT(*)
      FROM classroom_members member
      WHERE member.classroom_id = c.id AND member.role = 'teacher'
    ) AS teacher_count
  FROM classrooms c
`;

export async function findClassrooms(query: ListClassroomsQuery, scope?: { userId: number; role?: ClassroomRole }) {
  const where: string[] = [];
  const params: Array<string | number | boolean> = [];

  if (query.q) {
    where.push('(c.name ILIKE ? OR c.school_year ILIKE ? OR c.description ILIKE ?)');
    const keyword = `%${query.q}%`;
    params.push(keyword, keyword, keyword);
  }
  if (query.school_year) {
    where.push('c.school_year = ?');
    params.push(query.school_year);
  }
  if (query.is_active !== undefined) {
    where.push('c.is_active = ?');
    params.push(query.is_active);
  }
  if (scope) {
    if (scope.role === 'teacher') {
      where.push(`(
        c.homeroom_teacher_user_id = ?
        OR EXISTS (
          SELECT 1
          FROM classroom_members scoped_member
          WHERE scoped_member.classroom_id = c.id
            AND scoped_member.user_id = ?
            AND scoped_member.role = 'teacher'
        )
      )`);
      params.push(scope.userId, scope.userId);
    } else {
      where.push(`EXISTS (
        SELECT 1
        FROM student_enrollments scoped_enrollment
        WHERE scoped_enrollment.classroom_id = c.id
          AND scoped_enrollment.student_user_id = ?
          AND scoped_enrollment.status = 'active'
      )`);
      params.push(scope.userId);
    }
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const offset = (query.page - 1) * query.limit;
  const [rows] = await databasePool.query<ClassroomRow[]>(
    `
      ${classroomSelect}
      ${whereSql}
      ORDER BY c.school_year DESC, c.name ASC
      LIMIT ? OFFSET ?
    `,
    [...params, query.limit, offset],
  );
  const [countRows] = await databasePool.query<CountRow[]>(
    `SELECT COUNT(*) AS total FROM classrooms c ${whereSql}`,
    params,
  );
  return { classrooms: rows.map(mapClassroom), total: Number(countRows[0]?.total ?? 0) };
}

export async function findClassroomById(id: number) {
  const [rows] = await databasePool.query<ClassroomRow[]>(`${classroomSelect} WHERE c.id = ? LIMIT 1`, [id]);
  return rows[0] ? mapClassroom(rows[0]) : null;
}

export async function isClassroomMember(classroomId: number, userId: number) {
  const [rows] = await databasePool.query<DatabaseRow[]>(
    `
      SELECT id
      FROM classroom_members
      WHERE classroom_id = ? AND user_id = ? AND role = 'teacher'
      UNION ALL
      SELECT id
      FROM student_enrollments
      WHERE classroom_id = ?
        AND student_user_id = ?
        AND status = 'active'
      LIMIT 1
    `,
    [classroomId, userId, classroomId, userId],
  );
  const classroom = await findClassroomById(classroomId);
  return rows.length > 0 || classroom?.homeroom_teacher_user_id === userId;
}

export async function createClassroomRecord(input: ResolvedClassroomInput) {
  const [result] = await databasePool.query<DatabaseResult>(
    `
      INSERT INTO classrooms (
        name, school_year, academic_year_id, grade_level,
        homeroom_teacher_user_id, description, is_active
      )
      VALUES (?, ?, ?, ?, ?, ?, ?)
      RETURNING id
    `,
    [
      input.name,
      input.school_year,
      input.academic_year_id,
      input.grade_level ?? null,
      input.homeroom_teacher_user_id ?? null,
      input.description ?? null,
      input.is_active ?? true,
    ],
  );
  return findClassroomById(result.insertId);
}

export async function updateClassroomRecord(id: number, input: ResolvedClassroomInput) {
  await databasePool.query(
    `
      UPDATE classrooms
      SET name = ?, school_year = ?, academic_year_id = ?, grade_level = ?,
        homeroom_teacher_user_id = ?, description = ?, is_active = ?
      WHERE id = ?
    `,
    [
      input.name,
      input.school_year,
      input.academic_year_id,
      input.grade_level ?? null,
      input.homeroom_teacher_user_id ?? null,
      input.description ?? null,
      input.is_active ?? true,
      id,
    ],
  );
  return findClassroomById(id);
}

export async function deleteClassroomRecord(id: number) {
  const [result] = await databasePool.query<DatabaseResult>('DELETE FROM classrooms WHERE id = ?', [id]);
  return result.affectedRows > 0;
}

export async function classroomHasEnrollmentHistory(id: number) {
  const [rows] = await databasePool.query<Array<{ exists: boolean }>>(
    `
      SELECT EXISTS (
        SELECT 1 FROM student_enrollments WHERE classroom_id = ?
      ) AS exists
    `,
    [id],
  );
  return Boolean(rows[0]?.exists);
}

export async function classroomHasTeachingAssignmentHistory(id: number) {
  const [rows] = await databasePool.query<Array<{ exists: boolean }>>(
    `SELECT EXISTS (
      SELECT 1 FROM teaching_assignments WHERE classroom_id = ?
    ) AS exists`,
    [id],
  );
  return Boolean(rows[0]?.exists);
}

export async function listMembers(classroomId: number) {
  const [rows] = await databasePool.query<MemberRow[]>(
    `
      SELECT
        cm.id,
        cm.classroom_id,
        cm.user_id,
        cm.role::text AS role,
        u.full_name,
        u.email,
        'membership' AS membership_source,
        NULL::text AS enrollment_status,
        cm.created_at
      FROM classroom_members cm
      JOIN users u ON u.id = cm.user_id
      WHERE cm.classroom_id = ? AND cm.role = 'teacher'
      UNION ALL
      SELECT
        enrollment.id,
        enrollment.classroom_id,
        enrollment.student_user_id AS user_id,
        'student' AS role,
        student.full_name,
        student.email,
        'enrollment' AS membership_source,
        enrollment.status::text AS enrollment_status,
        enrollment.created_at
      FROM student_enrollments enrollment
      JOIN users student ON student.id = enrollment.student_user_id
      WHERE enrollment.classroom_id = ? AND enrollment.status = 'active'
      ORDER BY role ASC, full_name ASC
    `,
    [classroomId, classroomId],
  );
  return rows.map((row) => ({ ...row, id: Number(row.id), classroom_id: Number(row.classroom_id), user_id: Number(row.user_id) }));
}

export async function addMember(classroomId: number, input: MemberInput) {
  await databasePool.query(
    'INSERT INTO classroom_members (classroom_id, user_id, role) VALUES (?, ?, ?) ON CONFLICT (classroom_id, user_id, role) DO NOTHING',
    [classroomId, input.user_id, input.role],
  );
  return listMembers(classroomId);
}

export async function removeTeacherMember(classroomId: number, memberId: number) {
  const [result] = await databasePool.query<DatabaseResult>(
    `
      DELETE FROM classroom_members
      WHERE classroom_id = ? AND id = ? AND role = 'teacher'
    `,
    [classroomId, memberId],
  );
  return result.affectedRows > 0;
}

export async function listClassroomPosts(classroomId: number, userId: number, userRoles: string[]) {
  const isAdmin = userRoles.includes('admin');
  const isStudent = userRoles.includes('student') && !userRoles.includes('teacher') && !isAdmin;
  const where = ['cp.classroom_id = ?'];
  const params: Array<string | number> = [classroomId];
  if (isStudent) where.push("cp.status = 'published'");
  else if (!isAdmin) {
    where.push("(cp.status = 'published' OR cp.author_user_id = ?)");
    params.push(userId);
  }
  const [rows] = await databasePool.query<PostRow[]>(
    `
      SELECT cp.*, u.full_name AS author_name
      FROM classroom_posts cp
      JOIN users u ON u.id = cp.author_user_id
      WHERE ${where.join(' AND ')}
      ORDER BY cp.published_at DESC, cp.created_at DESC
    `,
    params,
  );
  return rows.map((row) => ({ ...row, id: Number(row.id), classroom_id: Number(row.classroom_id), author_user_id: Number(row.author_user_id) }));
}

export async function createClassroomPostRecord(classroomId: number, authorUserId: number, input: ClassroomPostInput) {
  const publishedAt = input.status === 'published' ? new Date() : null;
  const [result] = await databasePool.query<DatabaseResult>(
    'INSERT INTO classroom_posts (classroom_id, author_user_id, title, content, status, published_at) VALUES (?, ?, ?, ?, ?, ?) RETURNING id',
    [classroomId, authorUserId, input.title, input.content ?? '', input.status ?? 'draft', publishedAt],
  );
  return findClassroomPostById(result.insertId);
}

export async function findClassroomPostById(id: number) {
  const [rows] = await databasePool.query<PostRow[]>('SELECT * FROM classroom_posts WHERE id = ? LIMIT 1', [id]);
  return rows[0] ? { ...rows[0], id: Number(rows[0].id), classroom_id: Number(rows[0].classroom_id), author_user_id: Number(rows[0].author_user_id) } : null;
}

export async function updateClassroomPostRecord(id: number, input: ClassroomPostInput) {
  if (input.status === 'published') {
    await databasePool.query(
      'UPDATE classroom_posts SET title = ?, content = ?, status = ?, published_at = COALESCE(published_at, NOW()) WHERE id = ?',
      [input.title, input.content ?? '', input.status, id],
    );
  } else {
    await databasePool.query(
      'UPDATE classroom_posts SET title = ?, content = ?, status = ?, published_at = published_at WHERE id = ?',
      [input.title, input.content ?? '', input.status ?? 'draft', id],
    );
  }
  return findClassroomPostById(id);
}

export async function updateClassroomPostStatusRecord(id: number, status: ClassroomContentStatus) {
  if (status === 'published') {
    await databasePool.query(
      'UPDATE classroom_posts SET status = ?, published_at = COALESCE(published_at, NOW()) WHERE id = ?',
      [status, id],
    );
  } else {
    await databasePool.query(
      'UPDATE classroom_posts SET status = ?, published_at = published_at WHERE id = ?',
      [status, id],
    );
  }
  return findClassroomPostById(id);
}

export async function deleteClassroomPostRecord(id: number) {
  const [result] = await databasePool.query<DatabaseResult>('DELETE FROM classroom_posts WHERE id = ?', [id]);
  return result.affectedRows > 0;
}

export async function listClassroomDocuments(classroomId: number, userId: number, userRoles: string[]) {
  const isAdmin = userRoles.includes('admin');
  const isStudent = userRoles.includes('student') && !userRoles.includes('teacher') && !isAdmin;
  const where = ['cd.classroom_id = ?'];
  const params: Array<string | number> = [classroomId];
  if (isStudent) where.push("cd.status = 'published'");
  else if (!isAdmin) {
    where.push("(cd.status = 'published' OR cd.author_user_id = ?)");
    params.push(userId);
  }
  const [rows] = await databasePool.query<DocumentRow[]>(
    `
      SELECT cd.*, u.full_name AS author_name
      FROM classroom_documents cd
      JOIN users u ON u.id = cd.author_user_id
      WHERE ${where.join(' AND ')}
      ORDER BY cd.published_at DESC, cd.created_at DESC
    `,
    params,
  );
  return rows.map((row) => ({ ...row, id: Number(row.id), classroom_id: Number(row.classroom_id), author_user_id: Number(row.author_user_id) }));
}

export async function createClassroomDocumentRecord(classroomId: number, authorUserId: number, input: ClassroomDocumentInput) {
  const publishedAt = input.status === 'published' ? new Date() : null;
  const [result] = await databasePool.query<DatabaseResult>(
    'INSERT INTO classroom_documents (classroom_id, author_user_id, title, description, file_url, status, published_at) VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING id',
    [classroomId, authorUserId, input.title, input.description ?? null, input.file_url, input.status ?? 'draft', publishedAt],
  );
  return findClassroomDocumentById(result.insertId);
}

export async function findClassroomDocumentById(id: number) {
  const [rows] = await databasePool.query<DocumentRow[]>('SELECT * FROM classroom_documents WHERE id = ? LIMIT 1', [id]);
  return rows[0] ? { ...rows[0], id: Number(rows[0].id), classroom_id: Number(rows[0].classroom_id), author_user_id: Number(rows[0].author_user_id) } : null;
}

export async function updateClassroomDocumentRecord(id: number, input: ClassroomDocumentInput) {
  if (input.status === 'published') {
    await databasePool.query(
      'UPDATE classroom_documents SET title = ?, description = ?, file_url = ?, status = ?, published_at = COALESCE(published_at, NOW()) WHERE id = ?',
      [input.title, input.description ?? null, input.file_url, input.status, id],
    );
  } else {
    await databasePool.query(
      'UPDATE classroom_documents SET title = ?, description = ?, file_url = ?, status = ?, published_at = published_at WHERE id = ?',
      [input.title, input.description ?? null, input.file_url, input.status ?? 'draft', id],
    );
  }
  return findClassroomDocumentById(id);
}

export async function updateClassroomDocumentStatusRecord(id: number, status: ClassroomContentStatus) {
  if (status === 'published') {
    await databasePool.query(
      'UPDATE classroom_documents SET status = ?, published_at = COALESCE(published_at, NOW()) WHERE id = ?',
      [status, id],
    );
  } else {
    await databasePool.query(
      'UPDATE classroom_documents SET status = ?, published_at = published_at WHERE id = ?',
      [status, id],
    );
  }
  return findClassroomDocumentById(id);
}

export async function deleteClassroomDocumentRecord(id: number) {
  const [result] = await databasePool.query<DatabaseResult>('DELETE FROM classroom_documents WHERE id = ?', [id]);
  return result.affectedRows > 0;
}


