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
  created_at: string;
  updated_at: string;
};

export type SubjectInput = Pick<
  Subject,
  'code' | 'name' | 'subject_group' | 'description' | 'is_active'
>;

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
  created_at: string;
  updated_at: string;
};

export type CurriculumSubjectInput = {
  academic_year_id: number;
  subject_id: number;
  grade_level: number;
  periods_per_week: number;
  is_required?: boolean;
  is_active?: boolean;
};

