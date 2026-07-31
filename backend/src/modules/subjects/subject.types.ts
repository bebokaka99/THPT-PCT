export type SubjectGroup =
  | 'natural_sciences'
  | 'social_sciences'
  | 'languages'
  | 'technology_arts'
  | 'physical_education'
  | 'other';

export type Subject = {
  id: number;
  code: string;
  name: string;
  subject_group: SubjectGroup;
  description: string | null;
  is_active: boolean;
  usage_count: number;
  created_at: Date;
  updated_at: Date;
};

export type SubjectInput = {
  code: string;
  name: string;
  subject_group: SubjectGroup;
  description?: string | null;
  is_active?: boolean;
};

export type UpdateSubjectInput = Partial<Omit<SubjectInput, 'code'>>;

export type ListSubjectsQuery = {
  page: number;
  limit: number;
  q?: string;
  subject_group?: SubjectGroup;
  is_active?: boolean;
};

export type CurriculumSubject = {
  id: number;
  academic_year_id: number;
  academic_year_name: string;
  subject_id: number;
  subject_code: string;
  subject_name: string;
  subject_group: SubjectGroup;
  grade_level: number;
  periods_per_week: number;
  is_required: boolean;
  is_active: boolean;
  subject_is_active: boolean;
  created_at: Date;
  updated_at: Date;
};

export type CurriculumSubjectInput = {
  academic_year_id: number;
  subject_id: number;
  grade_level: number;
  periods_per_week: number;
  is_required?: boolean;
  is_active?: boolean;
};

export type UpdateCurriculumSubjectInput = Partial<
  Pick<
    CurriculumSubjectInput,
    'subject_id' | 'periods_per_week' | 'is_required' | 'is_active'
  >
>;

export type ListCurriculumQuery = {
  academic_year_id?: number;
  grade_level?: number;
  is_active?: boolean;
};

