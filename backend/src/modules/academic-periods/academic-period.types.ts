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
  created_at: Date;
  updated_at: Date;
};

export type AcademicYear = {
  id: number;
  name: string;
  start_date: string;
  end_date: string;
  status: AcademicPeriodStatus;
  is_locked: boolean;
  usage_count: number;
  created_at: Date;
  updated_at: Date;
  semesters: Semester[];
};

export type AcademicYearInput = {
  name: string;
  start_date: string;
  end_date: string;
};

export type UpdateAcademicYearInput = Partial<AcademicYearInput>;

export type SemesterInput = {
  name: string;
  code: string;
  start_date: string;
  end_date: string;
};

export type UpdateSemesterInput = Partial<SemesterInput>;

export type ListAcademicPeriodsQuery = {
  status?: AcademicPeriodStatus;
};

