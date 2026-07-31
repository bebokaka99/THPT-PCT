export type MediaType = 'image' | 'document' | 'other';

export type MediaVariant = {
  url: string;
  width: number;
  height: number;
  size: number;
  mime_type: string;
};

export type MediaVariants = {
  thumbnail?: MediaVariant;
  medium?: MediaVariant;
};

export type MediaFile = {
  id: number;
  original_name: string;
  file_name: string;
  mime_type: string;
  size: number;
  type: MediaType;
  url: string;
  storage_path: string;
  uploaded_by: number | null;
  width: number | null;
  height: number | null;
  optimized_size: number | null;
  variants: MediaVariants;
  created_at: Date;
};

export type CreateMediaInput = {
  original_name: string;
  file_name: string;
  mime_type: string;
  size: number;
  type: MediaType;
  url: string;
  storage_path: string;
  uploaded_by: number | null;
  width?: number | null;
  height?: number | null;
  optimized_size?: number | null;
  variants?: MediaVariants;
};

export type ListMediaQuery = {
  type?: MediaType;
  page: number;
  limit: number;
};
