import type { Post } from './post';

export type ImportStatus = 'pending' | 'imported' | 'converted' | 'skipped' | 'error';

export type ImportedContentListItem = {
  id: number;
  source_site: string;
  source_url: string;
  title: string;
  slug: string;
  excerpt: string | null;
  category_name: string | null;
  detected_published_at: string | null;
  images_json: string | null;
  attachments_json: string | null;
  import_status: ImportStatus;
  status: ImportStatus;
  imported_post_id: number | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
};

export type ImportedContentDetail = ImportedContentListItem & {
  content_html: string | null;
  content_text: string | null;
};

export type ImportedContentQuery = {
  page?: number;
  limit?: number;
  q?: string;
  status?: ImportStatus | 'all';
  category?: string;
};

export type ConvertImportedContentResponse = {
  importedContent: ImportedContentDetail | null;
  post: Post;
};
