import type { DatabaseResult, DatabaseRow } from '../../database/postgres.js';
import { databasePool } from '../../database/postgres.js';
import type { StudentProfile, TeacherProfile, UpdateMyProfileInput, UpsertStudentProfileInput, UpsertTeacherProfileInput } from './profile.types.js';

type TeacherRow = DatabaseRow & TeacherProfile;
type StudentRow = DatabaseRow & StudentProfile;

function mapTeacher(row: TeacherRow): TeacherProfile {
  return { ...row, id: Number(row.id), user_id: Number(row.user_id) };
}

function mapStudent(row: StudentRow): StudentProfile {
  return { ...row, id: Number(row.id), user_id: Number(row.user_id) };
}

export async function findTeacherProfileByUserId(userId: number) {
  const [rows] = await databasePool.query<TeacherRow[]>('SELECT * FROM teacher_profiles WHERE user_id = ? LIMIT 1', [userId]);
  return rows[0] ? mapTeacher(rows[0]) : null;
}

export async function findStudentProfileByUserId(userId: number) {
  const [rows] = await databasePool.query<StudentRow[]>('SELECT * FROM student_profiles WHERE user_id = ? LIMIT 1', [userId]);
  return rows[0] ? mapStudent(rows[0]) : null;
}

export async function listTeacherProfiles() {
  const [rows] = await databasePool.query<TeacherRow[]>('SELECT * FROM teacher_profiles ORDER BY full_name ASC, id DESC');
  return rows.map(mapTeacher);
}

export async function listStudentProfiles() {
  const [rows] = await databasePool.query<StudentRow[]>('SELECT * FROM student_profiles ORDER BY full_name ASC, id DESC');
  return rows.map(mapStudent);
}

export async function upsertTeacherProfile(input: UpsertTeacherProfileInput) {
  await databasePool.query(
    `
      INSERT INTO teacher_profiles (user_id, teacher_code, full_name, department, phone, avatar_url, bio)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT (user_id) DO UPDATE SET
        teacher_code = EXCLUDED.teacher_code,
        full_name = EXCLUDED.full_name,
        department = EXCLUDED.department,
        phone = EXCLUDED.phone,
        avatar_url = EXCLUDED.avatar_url,
        bio = EXCLUDED.bio
    `,
    [input.user_id, input.teacher_code ?? null, input.full_name, input.department ?? null, input.phone ?? null, input.avatar_url ?? null, input.bio ?? null],
  );
  return findTeacherProfileByUserId(input.user_id);
}

export async function upsertStudentProfile(input: UpsertStudentProfileInput) {
  await databasePool.query(
    `
    INSERT INTO student_profiles (user_id, student_code, full_name, class_name, date_of_birth, phone, parent_phone, avatar_url)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT (user_id) DO UPDATE SET
        student_code = EXCLUDED.student_code,
        full_name = EXCLUDED.full_name,
        class_name = EXCLUDED.class_name,
        date_of_birth = EXCLUDED.date_of_birth,
        phone = EXCLUDED.phone,
        parent_phone = EXCLUDED.parent_phone,
        avatar_url = EXCLUDED.avatar_url
    `,
    [input.user_id, input.student_code ?? null, input.full_name, input.class_name ?? null, input.date_of_birth ?? null, input.phone ?? null, input.parent_phone ?? null, input.avatar_url ?? null],
  );
  return findStudentProfileByUserId(input.user_id);
}

export async function updateTeacherProfileById(id: number, input: Partial<UpsertTeacherProfileInput>) {
  await databasePool.query(
    `
      UPDATE teacher_profiles
      SET teacher_code = COALESCE(?, teacher_code),
          full_name = COALESCE(?, full_name),
          department = ?,
          phone = ?,
          avatar_url = ?,
          bio = ?
      WHERE id = ?
    `,
    [input.teacher_code ?? null, input.full_name ?? null, input.department ?? null, input.phone ?? null, input.avatar_url ?? null, input.bio ?? null, id],
  );
  const [rows] = await databasePool.query<TeacherRow[]>('SELECT * FROM teacher_profiles WHERE id = ? LIMIT 1', [id]);
  return rows[0] ? mapTeacher(rows[0]) : null;
}

export async function updateStudentProfileById(id: number, input: Partial<UpsertStudentProfileInput>) {
  await databasePool.query(
    `
      UPDATE student_profiles
      SET student_code = COALESCE(?, student_code),
          full_name = COALESCE(?, full_name),
          class_name = ?,
          date_of_birth = COALESCE(?, date_of_birth),
          phone = ?,
          parent_phone = ?,
          avatar_url = ?
      WHERE id = ?
    `,
    [input.student_code ?? null, input.full_name ?? null, input.class_name ?? null, input.date_of_birth ?? null, input.phone ?? null, input.parent_phone ?? null, input.avatar_url ?? null, id],
  );
  const [rows] = await databasePool.query<StudentRow[]>('SELECT * FROM student_profiles WHERE id = ? LIMIT 1', [id]);
  return rows[0] ? mapStudent(rows[0]) : null;
}

export async function updateMyTeacherProfile(userId: number, input: UpdateMyProfileInput) {
  await databasePool.query('UPDATE teacher_profiles SET phone = ?, avatar_url = ?, bio = ? WHERE user_id = ?', [input.phone ?? null, input.avatar_url ?? null, input.bio ?? null, userId]);
  return findTeacherProfileByUserId(userId);
}

export async function updateMyStudentProfile(userId: number, input: UpdateMyProfileInput) {
  await databasePool.query('UPDATE student_profiles SET phone = ?, parent_phone = ?, avatar_url = ? WHERE user_id = ?', [input.phone ?? null, input.parent_phone ?? null, input.avatar_url ?? null, userId]);
  return findStudentProfileByUserId(userId);
}


