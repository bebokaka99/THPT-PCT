export type SearchType = 'all' | 'posts' | 'documents';

export type SearchQuery = {
  q: string;
  type: SearchType;
  page: number;
  limit: number;
};

export type SearchPostResult = {
  id: number;
  title: string;
  slug: string;
  excerpt: string | null;
  cover_image_url: string | null;
  published_at: Date | null;
  created_at: Date;
  category_id: number | null;
};

export type SearchDocumentResult = {
  id: number;
  title: string;
  slug: string;
  description: string | null;
  document_url: string;
  category: string | null;
  published_at: Date | null;
  created_at: Date;
};

export type SearchGroup<T> = {
  data: T[];
  total: number;
};

export type SearchResponse = {
  query: string;
  type: SearchType;
  posts?: SearchGroup<SearchPostResult>;
  documents?: SearchGroup<SearchDocumentResult>;
};
