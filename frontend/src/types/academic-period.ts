export type AcademicPeriodStatus = 'planned' | 'active' | 'closed';

export type Semester = {
  id: number;
  academic_year_id: number;
  name: string;
  code: string;
  start_date: string;
  end_date: string;
  status: AcademicPeriodStatus;
  is_locked: boolean;
  usage_count: number;
  created_at: string;
  updated_at: string;
};

export type AcademicYear = {
  id: number;
  name: string;
  start_date: string;
  end_date: string;
  status: AcademicPeriodStatus;
  is_locked: boolean;
  usage_count: number;
  created_at: string;
  updated_at: string;
  semesters: Semester[];
};

export type AcademicYearInput = Pick<
  AcademicYear,
  'name' | 'start_date' | 'end_date'
>;

export type SemesterInput = Pick<
  Semester,
  'name' | 'code' | 'start_date' | 'end_date'
>;

export type ActiveAcademicPeriods = {
  academic_year: AcademicYear | null;
  semester: Semester | null;
};

