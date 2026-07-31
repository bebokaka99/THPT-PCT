import type { PostStatus } from '../posts/post.types.js';

export type ImportStatus = 'pending' | 'imported' | 'converted' | 'skipped' | 'error';

export type ImportedContentListQuery = {
  page: number;
  limit: number;
  q?: string;
  status?: ImportStatus;
  category?: string;
};

export type ImportedContentListItem = {
  id: number;
  source_site: string;
  source_url: string;
  title: string;
  slug: string;
  excerpt: string | null;
  category_name: string | null;
  detected_published_at: Date | null;
  images_json: string | null;
  attachments_json: string | null;
  import_status: ImportStatus;
  status: ImportStatus;
  imported_post_id: number | null;
  error_message: string | null;
  created_at: Date;
  updated_at: Date;
};

export type ImportedContentDetail = ImportedContentListItem & {
  content_html: string | null;
  content_text: string | null;
};

export type UpdateImportedContentStatusInput = {
  status: Exclude<ImportStatus, 'error'>;
};

export type ConvertImportedContentInput = {
  category_id?: number | null;
  status?: Extract<PostStatus, 'draft' | 'published'>;
};
