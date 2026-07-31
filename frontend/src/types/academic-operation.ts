export type AcademicImportType =
  | 'enrollments'
  | 'assignments'
  | 'attendance'
  | 'grades';

export type AcademicImportStatus =
  | 'preview_ready'
  | 'committing'
  | 'completed'
  | 'failed';

export type ImportValidationError = {
  row: number;
  message: string;
};

export type AcademicImportJob = {
  id: number;
  import_type: AcademicImportType;
  status: AcademicImportStatus;
  idempotency_key: string;
  original_file_name: string;
  total_rows: number;
  valid_rows: number;
  invalid_rows: number;
  preview_rows: Array<Record<string, string>>;
  validation_errors: ImportValidationError[];
  result_summary: Record<string, unknown>;
  error_message: string | null;
  committed_at: string | null;
  created_at: string;
};

export type AcademicReportSummary = {
  classroom_count: number;
  active_student_count: number;
  attendance_session_count: number;
  gradebook_count: number;
};

