export type AssessmentConfigurationStatus = 'draft' | 'active' | 'archived';
export type AssessmentRoundingMode = 'half_up' | 'half_even' | 'truncate';

export type AssessmentCategory = {
  id?: number;
  configuration_id?: number;
  code: string;
  name: string;
  weight_percent: number;
  coefficient: number;
  max_entries: number;
  score_scale: number;
  sort_order: number;
  created_at?: string;
  updated_at?: string;
};

export type AssessmentConfiguration = {
  id: number;
  subject_id: number;
  subject_code: string;
  subject_name: string;
  semester_id: number;
  semester_name: string;
  semester_code: string;
  academic_year_id: number;
  academic_year_name: string;
  grade_level: number;
  version: number;
  title: string;
  score_scale: number;
  decimal_places: number;
  rounding_mode: AssessmentRoundingMode;
  status: AssessmentConfigurationStatus;
  created_by_user_id: number | null;
  activated_at: string | null;
  created_at: string;
  updated_at: string;
  categories: AssessmentCategory[];
};

export type AssessmentConfigurationInput = {
  subject_id: number;
  semester_id: number;
  grade_level: number;
  title: string;
  score_scale: number;
  decimal_places: number;
  rounding_mode: AssessmentRoundingMode;
  categories: AssessmentCategory[];
};

export type AssessmentConfigurationListQuery = {
  page?: number;
  limit?: number;
  q?: string;
  subject_id?: number;
  semester_id?: number;
  grade_level?: number;
  status?: AssessmentConfigurationStatus;
};

export type AssessmentCalculationResult = {
  configuration_id: number;
  score_scale: number;
  decimal_places: number;
  rounding_mode: AssessmentRoundingMode;
  raw_score: number;
  final_score: number;
  categories: Array<{
    category_code: string;
    category_name: string;
    values: number[];
    average: number;
    normalized_score: number;
    weight_percent: number;
    weighted_score: number;
  }>;
};
