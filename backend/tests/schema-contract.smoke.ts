import assert from 'node:assert/strict';
import { closeDatabasePool, postgresPool } from '../src/database/postgres.js';

const expectedColumns: Record<string, string[]> = {
  academic_years: [
    'id',
    'name',
    'start_date',
    'end_date',
    'status',
    'is_locked',
    'created_at',
    'updated_at',
  ],
  semesters: [
    'id',
    'academic_year_id',
    'name',
    'code',
    'start_date',
    'end_date',
    'status',
    'is_locked',
    'created_at',
    'updated_at',
  ],
  auth_refresh_sessions: [
    'id',
    'user_id',
    'token_hash',
    'expires_at',
    'revoked_at',
    'last_used_at',
    'created_at',
  ],
  student_profiles: [
    'id',
    'user_id',
    'student_code',
    'full_name',
    'class_name',
    'date_of_birth',
    'phone',
    'parent_name',
    'parent_phone',
    'permanent_address',
    'avatar_url',
    'created_at',
    'updated_at',
  ],
  notifications: [
    'id',
    'title',
    'message',
    'type',
    'target_role',
    'classroom_id',
    'created_by_user_id',
    'related_url',
    'created_at',
  ],
  user_notifications: ['id', 'notification_id', 'user_id', 'read_at', 'created_at'],
  school_shifts: [
    'id',
    'code',
    'name',
    'sort_order',
    'is_active',
    'created_at',
    'updated_at',
  ],
  bell_periods: [
    'id',
    'shift_id',
    'period_index',
    'starts_at',
    'ends_at',
    'sort_order',
    'created_at',
    'updated_at',
  ],
  timetables: [
    'id',
    'classroom_id',
    'school_year',
    'semester',
    'academic_year_id',
    'semester_id',
    'title',
    'status',
    'version_number',
    'is_active',
    'published_at',
    'published_by_user_id',
    'created_by_user_id',
    'created_at',
    'updated_at',
  ],
  timetable_items: [
    'id',
    'timetable_id',
    'day_of_week',
    'lesson_index',
    'subject_id',
    'teaching_assignment_id',
    'teacher_user_id',
    'shift_id',
    'subject_name',
    'teacher_name',
    'room',
    'note',
    'created_at',
  ],
  subjects: [
    'id',
    'code',
    'name',
    'subject_group',
    'description',
    'is_active',
    'created_at',
    'updated_at',
  ],
  curriculum_subjects: [
    'id',
    'academic_year_id',
    'subject_id',
    'grade_level',
    'periods_per_week',
    'is_required',
    'is_active',
    'created_at',
    'updated_at',
  ],
  student_enrollments: [
    'id',
    'student_user_id',
    'classroom_id',
    'academic_year_id',
    'status',
    'enrolled_at',
    'ended_at',
    'previous_enrollment_id',
    'note',
    'created_by_user_id',
    'created_at',
    'updated_at',
  ],
  teaching_assignments: [
    'id',
    'teacher_user_id',
    'classroom_id',
    'subject_id',
    'semester_id',
    'role',
    'status',
    'assigned_at',
    'ended_at',
    'note',
    'created_by_user_id',
    'created_at',
    'updated_at',
  ],
  assessment_configurations: [
    'id',
    'subject_id',
    'semester_id',
    'grade_level',
    'version',
    'title',
    'score_scale',
    'decimal_places',
    'rounding_mode',
    'status',
    'created_by_user_id',
    'activated_at',
    'created_at',
    'updated_at',
  ],
  assessment_categories: [
    'id',
    'configuration_id',
    'code',
    'name',
    'weight_percent',
    'coefficient',
    'max_entries',
    'score_scale',
    'sort_order',
    'created_at',
    'updated_at',
  ],
  events: [
    'id',
    'title',
    'slug',
    'description',
    'category',
    'location',
    'cover_image_url',
    'start_time',
    'end_time',
    'all_day',
    'status',
    'is_public',
    'created_by',
    'created_at',
    'updated_at',
  ],
};

async function run() {
  try {
    const result = await postgresPool.query<{
      table_name: string;
      column_name: string;
    }>(
      `
        SELECT table_name, column_name
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = ANY($1::text[])
      `,
      [Object.keys(expectedColumns)],
    );

    const columnsByTable = new Map<string, Set<string>>();
    for (const row of result.rows) {
      const columns = columnsByTable.get(row.table_name) ?? new Set<string>();
      columns.add(row.column_name);
      columnsByTable.set(row.table_name, columns);
    }

    for (const [tableName, columns] of Object.entries(expectedColumns)) {
      const actual = columnsByTable.get(tableName);
      assert.ok(actual, `Missing canonical table: ${tableName}`);
      for (const column of columns) {
        assert.ok(actual.has(column), `Missing ${tableName}.${column}`);
      }
    }

    for (const legacyColumn of ['class_name', 'file_url', 'data_json', 'created_by']) {
      assert.equal(
        columnsByTable.get('timetables')?.has(legacyColumn) ?? false,
        false,
        `Legacy timetable column must not be present: ${legacyColumn}`,
      );
    }

    for (const legacyColumn of ['user_id', 'read_at']) {
      assert.equal(
        columnsByTable.get('notifications')?.has(legacyColumn) ?? false,
        false,
        `Legacy notification column must not be present: ${legacyColumn}`,
      );
    }

    console.log('Canonical schema contract smoke test passed.');
  } finally {
    await closeDatabasePool();
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
