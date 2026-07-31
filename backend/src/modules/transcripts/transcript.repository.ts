import type { DatabaseConnection, DatabaseRow } from '../../database/postgres.js';
import { databasePool } from '../../database/postgres.js';
import type {
  StudentTranscript,
  TranscriptAccessScope,
  TranscriptSubject,
} from './transcript.types.js';

type Row = DatabaseRow & Record<string, any>;

export async function findTranscriptPeriod(
  semesterId?: number,
  studentUserId?: number,
) {
  const params: number[] = [];
  let where = '';
  if (semesterId) {
    where = 'WHERE semester.id = ?';
    params.push(semesterId);
  } else if (studentUserId) {
    where = `WHERE EXISTS (
      SELECT 1 FROM gradebooks gradebook
      JOIN student_enrollments enrollment
        ON enrollment.classroom_id = gradebook.classroom_id
      WHERE gradebook.semester_id = semester.id
        AND gradebook.status IN ('approved', 'locked')
        AND enrollment.student_user_id = ?
        AND enrollment.enrolled_at <= semester.end_date
        AND (enrollment.ended_at IS NULL OR enrollment.ended_at >= semester.start_date)
    )`;
    params.push(studentUserId);
  }
  const [rows] = await databasePool.query<Row[]>(
    `SELECT semester.id, semester.name, semester.status, semester.is_locked,
       semester.start_date, semester.end_date,
       academic_year.id AS academic_year_id,
       academic_year.name AS academic_year_name
     FROM semesters semester
     JOIN academic_years academic_year
       ON academic_year.id = semester.academic_year_id
     ${where}
     ORDER BY
       CASE WHEN semester.status = 'active' THEN 0 ELSE 1 END,
       semester.end_date DESC
     LIMIT 1`,
    params,
  );
  return rows[0] ?? null;
}

export async function findTranscriptStudent(
  studentUserId: number,
  semesterId: number,
) {
  const [rows] = await databasePool.query<Row[]>(
    `SELECT student.id, student.full_name, profile.student_code,
       classroom.id AS classroom_id, classroom.name AS classroom_name
     FROM users student
     JOIN student_enrollments enrollment
       ON enrollment.student_user_id = student.id
     JOIN classrooms classroom ON classroom.id = enrollment.classroom_id
     JOIN semesters semester ON semester.id = ?
     LEFT JOIN student_profiles profile ON profile.user_id = student.id
     WHERE student.id = ?
       AND enrollment.enrolled_at <= semester.end_date
       AND (enrollment.ended_at IS NULL OR enrollment.ended_at >= semester.start_date)
     ORDER BY enrollment.created_at DESC
     LIMIT 1`,
    [semesterId, studentUserId],
  );
  return rows[0] ?? null;
}

export async function findPublishedGradebooksForSemester(semesterId: number) {
  const [rows] = await databasePool.query<Row[]>(
    `SELECT gradebook.id, gradebook.classroom_id, gradebook.subject_id,
       gradebook.status, subject.code AS subject_code,
       subject.name AS subject_name, configuration.score_scale
     FROM gradebooks gradebook
     JOIN subjects subject ON subject.id = gradebook.subject_id
     JOIN assessment_configurations configuration
       ON configuration.id = gradebook.assessment_configuration_id
     WHERE gradebook.semester_id = ?
       AND gradebook.status IN ('approved', 'locked')
     ORDER BY subject.name, gradebook.id`,
    [semesterId],
  );
  return rows;
}

export async function findTranscriptSnapshot(
  studentUserId: number,
  semesterId: number,
): Promise<StudentTranscript | null> {
  const [headers] = await databasePool.query<Row[]>(
    `SELECT snapshot.*, semester.status AS period_status,
       semester.is_locked AS period_is_locked
     FROM student_report_snapshots snapshot
     JOIN semesters semester ON semester.id = snapshot.semester_id
     WHERE snapshot.student_user_id = ? AND snapshot.semester_id = ?
     LIMIT 1`,
    [studentUserId, semesterId],
  );
  const snapshot = headers[0];
  if (!snapshot) return null;
  const [subjects] = await databasePool.query<Row[]>(
    `SELECT subject_id, subject_code, subject_name, final_score,
       score_scale, gradebook_status
     FROM student_report_snapshot_subjects
     WHERE snapshot_id = ?
     ORDER BY sort_order, subject_name`,
    [snapshot.id],
  );
  return {
    student: {
      full_name: String(snapshot.student_name),
      student_code: snapshot.student_code ? String(snapshot.student_code) : null,
    },
    classroom: { name: String(snapshot.classroom_name) },
    period: {
      semester_id: Number(snapshot.semester_id),
      semester_name: String(snapshot.semester_name),
      academic_year_name: String(snapshot.academic_year_name),
      is_locked: Boolean(snapshot.period_is_locked),
      status: String(snapshot.period_status),
    },
    subjects: subjects.map((row) => ({
      subject_id: Number(row.subject_id),
      subject_code: String(row.subject_code),
      subject_name: String(row.subject_name),
      final_score: row.final_score === null ? null : Number(row.final_score),
      score_scale: Number(row.score_scale),
      gradebook_status: row.gradebook_status,
    })),
    overall_average:
      snapshot.overall_average === null ? null : Number(snapshot.overall_average),
    completed_subjects: Number(snapshot.completed_subjects),
    total_subjects: Number(snapshot.total_subjects),
    conduct: snapshot.conduct_rating
      ? {
          rating: snapshot.conduct_rating,
          homeroom_comment: snapshot.homeroom_comment
            ? String(snapshot.homeroom_comment)
            : null,
        }
      : null,
    source: 'snapshot',
    generated_at: snapshot.generated_at,
  };
}

export async function insertTranscriptSnapshot(
  transcript: StudentTranscript,
  studentUserId: number,
  classroomId: number,
  academicYearId: number,
  generatedByUserId: number | null,
) {
  const connection = await databasePool.getConnection();
  try {
    await connection.beginTransaction();
    const [existing] = await connection.query<Row[]>(
      `SELECT id FROM student_report_snapshots
       WHERE student_user_id = ? AND semester_id = ?`,
      [studentUserId, transcript.period.semester_id],
    );
    if (existing[0]) {
      await connection.commit();
      return Number(existing[0].id);
    }
    const [result] = await connection.query<any>(
      `INSERT INTO student_report_snapshots (
         student_user_id, classroom_id, semester_id, academic_year_id,
         student_name, student_code, classroom_name, semester_name,
         academic_year_name, overall_average, completed_subjects,
         total_subjects, conduct_rating, homeroom_comment,
         generated_by_user_id
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?::conduct_rating, ?, ?)
       RETURNING id`,
      [
        studentUserId,
        classroomId,
        transcript.period.semester_id,
        academicYearId,
        transcript.student.full_name,
        transcript.student.student_code,
        transcript.classroom.name,
        transcript.period.semester_name,
        transcript.period.academic_year_name,
        transcript.overall_average,
        transcript.completed_subjects,
        transcript.total_subjects,
        transcript.conduct?.rating ?? null,
        transcript.conduct?.homeroom_comment ?? null,
        generatedByUserId,
      ],
    );
    const snapshotId = Number(result.insertId);
    for (const [index, subject] of transcript.subjects.entries()) {
      await connection.query(
        `INSERT INTO student_report_snapshot_subjects (
           snapshot_id, subject_id, subject_code, subject_name, final_score,
           score_scale, gradebook_status, sort_order
         ) VALUES (?, ?, ?, ?, ?, ?, ?::gradebook_status, ?)`,
        [
          snapshotId,
          subject.subject_id,
          subject.subject_code,
          subject.subject_name,
          subject.final_score,
          subject.score_scale,
          subject.gradebook_status,
          index,
        ],
      );
    }
    await connection.commit();
    return snapshotId;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function findSemesterStudentIds(semesterId: number) {
  const [rows] = await databasePool.query<Row[]>(
    `SELECT DISTINCT enrollment.student_user_id
     FROM student_enrollments enrollment
     JOIN semesters semester ON semester.academic_year_id = enrollment.academic_year_id
     WHERE semester.id = ?
       AND enrollment.enrolled_at <= semester.end_date
       AND (enrollment.ended_at IS NULL OR enrollment.ended_at >= semester.start_date)
     ORDER BY enrollment.student_user_id`,
    [semesterId],
  );
  return rows.map((row) => Number(row.student_user_id));
}

export async function findSemesterSnapshotStudentIds(semesterId: number) {
  const [rows] = await databasePool.query<Row[]>(
    `SELECT student_user_id
     FROM student_report_snapshots
     WHERE semester_id = ?
     ORDER BY student_user_id`,
    [semesterId],
  );
  return rows.map((row) => Number(row.student_user_id));
}

export async function findTeacherTranscriptScope(
  teacherUserId: number,
  studentUserId: number,
  semesterId: number,
): Promise<TranscriptAccessScope> {
  const student = await findTranscriptStudent(studentUserId, semesterId);
  if (!student) return { allowed: false, subjectIds: [] };
  const [homeroom] = await databasePool.query<Row[]>(
    `SELECT 1 FROM classrooms
     WHERE id = ? AND homeroom_teacher_user_id = ? LIMIT 1`,
    [student.classroom_id, teacherUserId],
  );
  if (homeroom[0]) return { allowed: true, subjectIds: null };
  const [subjects] = await databasePool.query<Row[]>(
    `SELECT DISTINCT subject_id FROM teaching_assignments
     WHERE teacher_user_id = ? AND classroom_id = ? AND semester_id = ?`,
    [teacherUserId, student.classroom_id, semesterId],
  );
  return {
    allowed: subjects.length > 0,
    subjectIds: subjects.map((row) => Number(row.subject_id)),
  };
}

export async function findClassroomStudentIds(
  classroomId: number,
  semesterId: number,
) {
  const [rows] = await databasePool.query<Row[]>(
    `SELECT DISTINCT enrollment.student_user_id
     FROM student_enrollments enrollment
     JOIN semesters semester ON semester.id = ?
     WHERE enrollment.classroom_id = ?
       AND enrollment.enrolled_at <= semester.end_date
       AND (enrollment.ended_at IS NULL OR enrollment.ended_at >= semester.start_date)
     ORDER BY enrollment.student_user_id`,
    [semesterId, classroomId],
  );
  return rows.map((row) => Number(row.student_user_id));
}

export async function findTeacherClassroomSubjectScope(
  teacherUserId: number,
  classroomId: number,
  semesterId: number,
) {
  const [homeroom] = await databasePool.query<Row[]>(
    `SELECT 1 FROM classrooms
     WHERE id = ? AND homeroom_teacher_user_id = ? LIMIT 1`,
    [classroomId, teacherUserId],
  );
  if (homeroom[0]) return { allowed: true, subjectIds: null } as TranscriptAccessScope;
  const [rows] = await databasePool.query<Row[]>(
    `SELECT DISTINCT subject_id FROM teaching_assignments
     WHERE teacher_user_id = ? AND classroom_id = ? AND semester_id = ?`,
    [teacherUserId, classroomId, semesterId],
  );
  return {
    allowed: rows.length > 0,
    subjectIds: rows.map((row) => Number(row.subject_id)),
  } as TranscriptAccessScope;
}
