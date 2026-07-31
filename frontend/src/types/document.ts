export type DocumentStatus = 'draft' | 'published' | 'archived';

export type SchoolDocument = {
  id: number;
  title: string;
  slug: string;
  description: string | null;
  category: string | null;
  document_url: string;
  file_type: string | null;
  file_size: number;
  uploaded_by: number | null;
  status: DocumentStatus;
  published_at: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type DocumentListQuery = {
  page?: number;
  limit?: number;
  q?: string;
  category?: string;
  status?: 'all' | DocumentStatus | 'deleted';
};

export type DocumentFormInput = {
  title: string;
  slug?: string;
  description?: string | null;
  category?: string | null;
  document_url: string;
  file_type?: string | null;
  file_size?: number;
  status?: DocumentStatus;
};
