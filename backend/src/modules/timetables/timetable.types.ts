export type TimetableStatus = 'draft' | 'published' | 'archived';

export type BellPeriod = {
  id?: number;
  shift_id?: number;
  period_index: number;
  starts_at: string;
  ends_at: string;
  sort_order: number;
};

export type SchoolShift = {
  id: number;
  code: string;
  name: string;
  sort_order: number;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
  periods: BellPeriod[];
};

export type SchoolShiftInput = {
  code: string;
  name: string;
  sort_order?: number;
  is_active?: boolean;
  periods: BellPeriod[];
};

export type TimetableItem = {
  id?: number;
  timetable_id?: number;
  shift_id: number;
  shift_code?: string;
  shift_name?: string;
  subject_id?: number | null;
  teaching_assignment_id?: number | null;
  teacher_user_id?: number | null;
  day_of_week: number;
  lesson_index: number;
  subject_name: string;
  teacher_name: string | null;
  room: string | null;
  note: string | null;
  created_at?: Date;
};

export type Timetable = {
  id: number;
  classroom_id: number;
  school_year: string;
  semester: string | null;
  academic_year_id: number | null;
  semester_id: number | null;
  title: string;
  status: TimetableStatus;
  version_number: number;
  is_active: boolean;
  published_at: Date | null;
  published_by_user_id: number | null;
  created_by_user_id: number | null;
  created_at: Date;
  updated_at: Date;
  items: TimetableItem[];
};

export type TimetableInput = {
  school_year?: string;
  semester?: string | null;
  academic_year_id?: number;
  semester_id?: number | null;
  title: string;
  status?: TimetableStatus;
  is_active?: boolean;
  items: TimetableItem[];
};

export type ResolvedTimetableInput = Omit<
  TimetableInput,
  'school_year' | 'academic_year_id'
> & {
  school_year: string;
  academic_year_id: number;
};

export type TimetableConflictType = 'teacher' | 'classroom' | 'room';

export type TimetableConflict = {
  type: TimetableConflictType;
  day_of_week: number;
  shift_id: number;
  shift_name: string;
  lesson_index: number;
  teacher_name: string | null;
  room: string | null;
  conflicting_classroom_id: number;
  conflicting_classroom_name: string;
  message: string;
};

export type PersonalTeachingTimetableItem = TimetableItem & {
  classroom_id: number;
  classroom_name: string;
  school_year: string;
  semester: string | null;
  timetable_title: string;
};
