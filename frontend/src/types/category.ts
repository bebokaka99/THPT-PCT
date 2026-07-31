export type Category = {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type CategoryFormInput = {
  name: string;
  slug?: string;
  description?: string | null;
  sort_order?: number;
  is_active?: boolean;
};
