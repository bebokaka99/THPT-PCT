export type DocumentStatus = 'draft' | 'published' | 'archived';
export type DocumentListStatus = DocumentStatus | 'deleted';

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
  published_at: Date | null;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
};

export type CreateDocumentInput = {
  title: string;
  slug?: string;
  description?: string | null;
  category?: string | null;
  document_url: string;
  file_type?: string | null;
  file_size?: number;
  status?: DocumentStatus;
};

export type UpdateDocumentInput = Partial<CreateDocumentInput>;

export type ListDocumentsQuery = {
  page: number;
  limit: number;
  q?: string;
  category?: string;
  status?: DocumentListStatus;
};
