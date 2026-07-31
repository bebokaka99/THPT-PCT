export type TimetableItem = {
  id?: number;
  timetable_id?: number;
  subject_id?: number | null;
  teaching_assignment_id?: number | null;
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
  is_active: boolean;
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
