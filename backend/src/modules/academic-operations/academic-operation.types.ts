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

export type CsvRow = Record<string, string>;

export type ImportValidationError = {
  row: number;
  message: string;
};

export type AcademicImportJob = {
  id: number;
  import_type: AcademicImportType;
  status: AcademicImportStatus;
  idempotency_key: string;
  template_version: string;
  original_file_name: string;
  file_sha256: string;
  total_rows: number;
  valid_rows: number;
  invalid_rows: number;
  preview_rows: CsvRow[];
  validation_errors: ImportValidationError[];
  result_summary: Record<string, unknown>;
  error_message: string | null;
  created_by_user_id: number;
  committed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type ImportJobListQuery = {
  page: number;
  limit: number;
  type?: AcademicImportType;
  status?: AcademicImportStatus;
};

export type ImportPreviewInput = {
  type: AcademicImportType;
  idempotencyKey: string;
  originalFileName: string;
  fileSha256: string;
  rows: CsvRow[];
};

export type ReportFilters = {
  academic_year_id?: number;
  semester_id?: number;
  classroom_id?: number;
  subject_id?: number;
};

