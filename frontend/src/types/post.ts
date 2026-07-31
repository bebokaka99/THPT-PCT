export type PostStatus = 'draft' | 'published' | 'archived';

export type PostImage = {
  id?: number;
  image_url: string;
  alt_text?: string | null;
  caption?: string | null;
  sort_order?: number;
};

export type Post = {
  id: number;
  title: string;
  slug: string;
  excerpt: string | null;
  content: string;
  cover_image_url: string | null;
  category_id: number | null;
  author_id: number | null;
  status: PostStatus;
  published_at: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  post_images?: PostImage[];
};

export type PostListQuery = {
  page?: number;
  limit?: number;
  categorySlug?: string;
  q?: string;
  status?: 'all' | PostStatus | 'deleted';
};

export type PostFormInput = {
  title: string;
  slug?: string;
  excerpt?: string | null;
  content: string;
  cover_image_url?: string | null;
  category_id?: number | null;
  status?: PostStatus;
  post_images?: PostImage[];
};
