export type AcademicCalendarEntryType =
  | 'test'
  | 'exam'
  | 'make_up'
  | 'no_school'
  | 'deadline';

export type AcademicCalendarEntryStatus =
  | 'draft'
  | 'proposed'
  | 'published'
  | 'archived';

export type AcademicCalendarEntry = {
  id: number;
  academic_year_id: number;
  academic_year_name: string;
  semester_id: number | null;
  semester_name: string | null;
  entry_type: AcademicCalendarEntryType;
  title: string;
  description: string | null;
  classroom_id: number | null;
  classroom_name: string | null;
  subject_id: number | null;
  subject_name: string | null;
  teaching_assignment_id: number | null;
  teacher_user_id: number | null;
  teacher_name: string | null;
  starts_at: string;
  ends_at: string;
  all_day: boolean;
  room: string | null;
  status: AcademicCalendarEntryStatus;
  revision: number;
  created_by_user_id: number | null;
  published_by_user_id: number | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
};

export type AcademicCalendarInput = {
  academic_year_id?: number;
  semester_id?: number | null;
  teaching_assignment_id?: number | null;
  entry_type: AcademicCalendarEntryType;
  title: string;
  description?: string | null;
  starts_at: string;
  ends_at: string;
  all_day: boolean;
  room?: string | null;
};

export type AcademicCalendarResolvedInput = AcademicCalendarInput & {
  academic_year_id: number;
  semester_id: number | null;
  classroom_id: number | null;
  subject_id: number | null;
  teaching_assignment_id: number | null;
  teacher_user_id: number | null;
};

export type AcademicCalendarUpdateInput = Partial<AcademicCalendarInput>;

export type AcademicCalendarListQuery = {
  page: number;
  limit: number;
  q?: string;
  entry_type?: AcademicCalendarEntryType;
  status?: AcademicCalendarEntryStatus;
  classroom_id?: number;
  subject_id?: number;
  academic_year_id?: number;
  semester_id?: number;
  from?: string;
  to?: string;
  student_id?: number;
};

export type AcademicCalendarConflict = {
  source: 'academic_calendar' | 'timetable';
  resource: 'classroom' | 'teacher' | 'room';
  conflicting_id: number;
  title: string;
  starts_at: string;
  ends_at: string;
  message: string;
};

export type AcademicCalendarScope =
  | { role: 'admin' }
  | { role: 'teacher'; userId: number }
  | { role: 'student'; userId: number }
  | { role: 'guardian'; userId: number; studentId: number };

export type AcademicCalendarAudit = {
  id: number;
  entry_id: number;
  actor_user_id: number | null;
  actor_name: string | null;
  action: 'create' | 'update' | 'publish' | 'archive';
  revision: number;
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown>;
  created_at: string;
};
