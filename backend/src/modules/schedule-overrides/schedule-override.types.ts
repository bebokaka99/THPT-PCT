export type ScheduleOverrideType =
  | 'substitute'
  | 'reschedule'
  | 'room_change'
  | 'cancelled';

export type ScheduleOverrideStatus =
  | 'draft'
  | 'proposed'
  | 'published'
  | 'archived';

export type ScheduleOverrideInput = {
  timetable_item_id: number;
  override_date: string;
  override_type: ScheduleOverrideType;
  status?: 'draft' | 'proposed';
  substitute_teacher_user_id?: number | null;
  new_day_of_week?: number | null;
  new_shift_id?: number | null;
  new_lesson_index?: number | null;
  room?: string | null;
  reason: string;
};

export type ScheduleOverrideQuery = {
  date?: string;
  status?: ScheduleOverrideStatus;
};

export type ScheduleOverride = {
  id: number;
  classroom_id: number;
  classroom_name: string;
  timetable_id: number;
  timetable_item_id: number;
  override_date: string;
  override_type: ScheduleOverrideType;
  status: ScheduleOverrideStatus;
  substitute_teacher_user_id: number | null;
  substitute_teacher_name: string | null;
  original_day_of_week: number;
  original_shift_id: number;
  original_shift_name: string;
  original_lesson_index: number;
  subject_id: number | null;
  subject_name: string;
  original_teacher_user_id: number | null;
  original_teacher_name: string | null;
  new_day_of_week: number | null;
  new_shift_id: number | null;
  new_shift_name: string | null;
  new_lesson_index: number | null;
  room: string | null;
  reason: string;
  created_by_user_id: number;
  created_by_name: string;
  approved_by_user_id: number | null;
  approved_by_name: string | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
};

export type DailyScheduleItem = {
  id: number;
  timetable_item_id: number;
  classroom_id: number;
  classroom_name: string;
  timetable_id: number;
  override_id: number | null;
  override_type: ScheduleOverrideType | null;
  override_status: ScheduleOverrideStatus | null;
  is_cancelled: boolean;
  day_of_week: number;
  shift_id: number;
  shift_name: string;
  lesson_index: number;
  subject_id: number | null;
  subject_name: string;
  teacher_user_id: number | null;
  teacher_name: string | null;
  room: string | null;
  note: string | null;
  original_day_of_week: number;
  original_shift_id: number;
  original_lesson_index: number;
};
