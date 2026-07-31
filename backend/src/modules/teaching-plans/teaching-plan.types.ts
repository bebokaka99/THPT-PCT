export type TeachingPlanStatus = 'draft' | 'submitted' | 'approved' | 'rejected' | 'archived';

export type TeachingPlan = {
  id: number;
  teaching_assignment_id: number;
  teacher_user_id: number;
  teacher_name: string;
  classroom_id: number;
  classroom_name: string;
  subject_id: number;
  subject_name: string;
  academic_year_id: number;
  academic_year_name: string;
  semester_id: number;
  semester_name: string;
  title: string;
  objectives: string | null;
  content: string | null;
  resources: string | null;
  week_number: number | null;
  timetable_item_id: number | null;
  assignment_id: number | null;
  media_file_id: number | null;
  status: TeachingPlanStatus;
  version_number: number;
  reviewer_user_id: number | null;
  reviewer_name: string | null;
  review_comment: string | null;
  submitted_at: string | null;
  reviewed_at: string | null;
  archived_at: string | null;
  created_by_user_id: number;
  created_at: string;
  updated_at: string;
};

export type TeachingPlanInput = {
  teaching_assignment_id: number;
  title: string;
  objectives?: string | null;
  content?: string | null;
  resources?: string | null;
  week_number?: number | null;
  timetable_item_id?: number | null;
  assignment_id?: number | null;
  media_file_id?: number | null;
};

export type TeachingPlanUpdateInput = Partial<Omit<TeachingPlanInput, 'teaching_assignment_id'>>;

export type TeachingPlanListQuery = {
  page: number;
  limit: number;
  q?: string;
  status?: TeachingPlanStatus;
  teacher_user_id?: number;
  classroom_id?: number;
  subject_id?: number;
  semester_id?: number;
};

export type TeachingPlanReviewInput = {
  comment?: string | null;
};

export type TeachingPlanOptions = {
  assignments: Array<{
    id: number;
    classroom_name: string;
    subject_name: string;
    semester_name: string;
    academic_year_name: string;
  }>;
};

export type TeachingPlanSummary = Array<{
  subject_group: string;
  total: number;
  draft: number;
  submitted: number;
  approved: number;
  rejected: number;
}>;
