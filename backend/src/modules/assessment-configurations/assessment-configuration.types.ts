export type AssessmentConfigurationStatus = 'draft' | 'active' | 'archived';
export type AssessmentRoundingMode = 'half_up' | 'half_even' | 'truncate';

export type AssessmentCategory = {
  id: number;
  configuration_id: number;
  code: string;
  name: string;
  weight_percent: number;
  coefficient: number;
  max_entries: number;
  score_scale: number;
  sort_order: number;
  created_at: Date;
  updated_at: Date;
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
  activated_at: Date | null;
  created_at: Date;
  updated_at: Date;
  categories: AssessmentCategory[];
};

export type AssessmentCategoryInput = {
  code: string;
  name: string;
  weight_percent: number;
  coefficient: number;
  max_entries: number;
  score_scale: number;
  sort_order: number;
};

export type AssessmentConfigurationInput = {
  subject_id: number;
  semester_id: number;
  grade_level: number;
  title: string;
  score_scale: number;
  decimal_places: number;
  rounding_mode: AssessmentRoundingMode;
  categories: AssessmentCategoryInput[];
};

export type AssessmentConfigurationUpdateInput = Partial<
  Pick<
    AssessmentConfigurationInput,
    'title' | 'score_scale' | 'decimal_places' | 'rounding_mode' | 'categories'
  >
>;

export type ListAssessmentConfigurationsQuery = {
  page: number;
  limit: number;
  q?: string;
  subject_id?: number;
  semester_id?: number;
  grade_level?: number;
  status?: AssessmentConfigurationStatus;
};

export type AssessmentScoreGroupInput = {
  category_code: string;
  values: number[];
};

export type AssessmentCalculationInput = {
  scores: AssessmentScoreGroupInput[];
};

export type AssessmentCategoryCalculation = {
  category_code: string;
  category_name: string;
  values: number[];
  average: number;
  normalized_score: number;
  weight_percent: number;
  weighted_score: number;
};

export type AssessmentCalculationResult = {
  configuration_id: number;
  score_scale: number;
  decimal_places: number;
  rounding_mode: AssessmentRoundingMode;
  raw_score: number;
  final_score: number;
  categories: AssessmentCategoryCalculation[];
};
