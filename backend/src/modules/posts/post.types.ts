export type PostStatus = 'draft' | 'published' | 'archived';
export type PostListStatus = PostStatus | 'deleted';

export type PostImage = {
  id?: number;
  post_id?: number;
  image_url: string;
  alt_text?: string | null;
  caption?: string | null;
  sort_order?: number;
  created_at?: Date;
  updated_at?: Date;
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
  published_at: Date | null;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
  post_images?: PostImage[];
};

export type CreatePostInput = {
  title: string;
  slug?: string;
  excerpt?: string | null;
  content?: string | null;
  cover_image_url?: string | null;
  category_id?: number | null;
  status?: PostStatus;
  post_images?: PostImage[];
};

export type UpdatePostInput = Partial<CreatePostInput>;

export type ListPostsQuery = {
  page: number;
  limit: number;
  categorySlug?: string;
  q?: string;
  status?: PostListStatus;
};

export type PaginatedPosts = {
  data: Post[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};
