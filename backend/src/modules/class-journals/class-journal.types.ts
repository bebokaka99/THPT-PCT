export type ClassJournalStatus = 'draft' | 'completed' | 'cancelled';

export type ClassJournal = {
  id: number;
  timetable_item_id: number;
  classroom_id: number;
  classroom_name: string;
  subject_id: number;
  subject_name: string;
  semester_id: number;
  semester_name: string;
  journal_date: string;
  effective_day_of_week: number;
  effective_shift_id: number;
  effective_shift_name: string;
  effective_lesson_index: number;
  effective_teacher_user_id: number;
  effective_teacher_name: string;
  attendance_session_id: number | null;
  lesson_content: string | null;
  class_comment: string | null;
  progress_note: string | null;
  homework: string | null;
  status: ClassJournalStatus;
  created_by_user_id: number;
  created_by_name: string;
  updated_by_user_id: number | null;
  updated_by_name: string | null;
  created_at: string;
  updated_at: string;
};

export type ClassJournalInput = {
  timetable_item_id: number;
  journal_date: string;
  attendance_session_id?: number | null;
  lesson_content?: string | null;
  class_comment?: string | null;
  progress_note?: string | null;
  homework?: string | null;
  status: ClassJournalStatus;
  correction_reason?: string | null;
};

export type ClassJournalListQuery = {
  page: number;
  limit: number;
  classroom_id?: number;
  semester_id?: number;
  from?: string;
  to?: string;
  status?: ClassJournalStatus;
};
