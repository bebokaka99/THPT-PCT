export type AssignmentStatus = 'draft' | 'published' | 'closed';
export type AssignmentSubmissionStatus =
  | 'not_started'
  | 'submitted'
  | 'late'
  | 'returned'
  | 'graded'
  | 'withdrawn';

export type AssignmentAttachmentInput = {
  media_file_id?: number | null;
  file_url: string;
  original_name?: string | null;
  mime_type?: string | null;
  size?: number | null;
  sort_order: number;
};

export type AssignmentInput = {
  teaching_assignment_id: number;
  title: string;
  description?: string | null;
  due_at: string;
  allow_late: boolean;
  max_score?: number | null;
  guardian_can_view_feedback?: boolean;
  attachments?: AssignmentAttachmentInput[];
};

export type AssignmentUpdateInput = {
  title?: string;
  description?: string | null;
  due_at?: string;
  allow_late?: boolean;
  max_score?: number | null;
  guardian_can_view_feedback?: boolean;
  attachments?: AssignmentAttachmentInput[];
};

export type AssignmentListQuery = {
  page: number;
  limit: number;
  q?: string;
  classroom_id?: number;
  subject_id?: number;
  semester_id?: number;
  status?: AssignmentStatus;
};

export type Assignment = {
  id: number;
  classroom_id: number;
  classroom_name: string;
  subject_id: number;
  subject_name: string;
  semester_id: number;
  semester_name: string;
  teaching_assignment_id: number;
  teacher_user_id: number;
  teacher_name: string;
  title: string;
  description: string | null;
  due_at: string;
  allow_late: boolean;
  max_score: number | null;
  guardian_can_view_feedback: boolean;
  status: AssignmentStatus;
  published_at: string | null;
  closed_at: string | null;
  created_by_user_id: number | null;
  created_at: string;
  updated_at: string;
  submission_count: number;
  student_count: number;
  my_submission_status?: AssignmentSubmissionStatus | null;
};

export type AssignmentAttachment = AssignmentAttachmentInput & {
  id: number;
  assignment_id: number;
  created_at: string;
};

export type AssignmentSubmissionFile = {
  id: number;
  submission_id: number;
  media_file_id: number | null;
  file_url: string;
  original_name: string;
  mime_type: string;
  size: number;
  version: number;
  is_active: boolean;
  uploaded_at: string;
  replaced_at: string | null;
  storage_path?: string | null;
};

export type AssignmentSubmission = {
  id: number;
  assignment_id: number;
  student_user_id: number;
  student_name: string;
  student_code: string | null;
  status: AssignmentSubmissionStatus;
  note: string | null;
  first_submitted_at: string;
  last_submitted_at: string;
  current_file: AssignmentSubmissionFile | null;
  content_text: string | null;
  link_url: string | null;
  feedback: string | null;
  score: number | null;
  returned_at: string | null;
  graded_at: string | null;
  reviewed_by_user_id: number | null;
  files?: AssignmentSubmissionFile[];
};

export type AssignmentRosterItem = {
  id: number | null;
  assignment_id: number;
  student_user_id: number;
  student_name: string;
  student_code: string | null;
  status: AssignmentSubmissionStatus;
  note: string | null;
  first_submitted_at: string | null;
  last_submitted_at: string | null;
  current_file: AssignmentSubmissionFile | null;
  content_text: string | null;
  link_url: string | null;
  feedback: string | null;
  score: number | null;
  returned_at: string | null;
  graded_at: string | null;
  reviewed_by_user_id: number | null;
};

export type AssignmentDetail = Assignment & {
  attachments: AssignmentAttachment[];
  my_submission: AssignmentSubmission | null;
};

export type SubmissionInput = {
  note?: string | null;
  content_text?: string | null;
  link_url?: string | null;
};

export type SubmissionReviewInput = {
  action: 'return' | 'grade';
  feedback?: string | null;
  score?: number | null;
};
