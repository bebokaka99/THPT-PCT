export type SearchType = 'all' | 'posts' | 'documents';

export type SearchPostResult = {
  id: number;
  title: string;
  slug: string;
  excerpt: string | null;
  cover_image_url: string | null;
  published_at: string | null;
  created_at: string;
  category_id: number | null;
};

export type SearchDocumentResult = {
  id: number;
  title: string;
  slug: string;
  description: string | null;
  document_url: string;
  category: string | null;
  published_at: string | null;
  created_at: string;
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

export type SearchSiteQuery = {
  q: string;
  type?: SearchType;
  page?: number;
  limit?: number;
};
