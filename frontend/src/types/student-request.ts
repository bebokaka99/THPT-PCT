export type StudentRequestStatus =
  | 'draft'
  | 'pending'
  | 'in_review'
  | 'approved'
  | 'rejected'
  | 'cancelled';

export type StudentRequestType = {
  id: number;
  code: string;
  name: string;
  description: string | null;
  instructions: string | null;
  reviewer_scope: 'homeroom' | 'admin';
  requires_attachment: boolean;
  sla_days: number;
  form_schema: Record<string, unknown>;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type StudentRequestAttachment = {
  id: number;
  request_id: number;
  original_name: string;
  mime_type: string;
  size_bytes: number;
  created_at: string;
  download_url: string;
};

export type StudentRequest = {
  id: number;
  request_type_id: number;
  request_type_code: string;
  request_type_name: string;
  reviewer_scope: 'homeroom' | 'admin';
  requires_attachment: boolean;
  sla_days: number;
  student_user_id: number;
  student_name: string;
  student_code: string | null;
  title: string;
  content: string;
  form_data: Record<string, unknown>;
  status: StudentRequestStatus;
  revision: number;
  due_at: string | null;
  submitted_at: string | null;
  reviewed_at: string | null;
  reviewed_by_user_id: number | null;
  reviewer_name: string | null;
  decision_reason: string | null;
  created_at: string;
  updated_at: string;
  attachment_count: number;
  attachments?: StudentRequestAttachment[];
};

export type StudentRequestHistory = {
  id: number;
  action: string;
  old_status: StudentRequestStatus | null;
  new_status: StudentRequestStatus;
  reason: string | null;
  actor_name: string | null;
  revision: number;
  created_at: string;
};

export type StudentRequestListResponse = {
  data: StudentRequest[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

export type StudentRequestTypeInput = {
  code: string;
  name: string;
  description?: string | null;
  instructions?: string | null;
  reviewer_scope: 'homeroom' | 'admin';
  requires_attachment: boolean;
  sla_days: number;
  form_schema?: Record<string, unknown>;
  is_active: boolean;
};
