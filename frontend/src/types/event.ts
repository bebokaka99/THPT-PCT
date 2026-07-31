export type EventStatus = 'scheduled' | 'cancelled' | 'completed';
export type EventScope = 'upcoming' | 'past' | 'all';

export type SchoolEvent = {
  id: number;
  title: string;
  slug: string;
  description: string | null;
  category: string | null;
  location: string | null;
  cover_image_url: string | null;
  start_time: string;
  end_time: string | null;
  all_day: boolean;
  status: EventStatus;
  is_public: boolean;
  created_by: number | null;
  creator_name: string | null;
  created_at: string;
  updated_at: string;
};

export type EventListQuery = {
  page?: number;
  limit?: number;
  q?: string;
  status?: EventStatus;
  scope?: EventScope;
};

export type EventFormInput = {
  title: string;
  slug?: string;
  description?: string | null;
  category?: string | null;
  location?: string | null;
  cover_image_url?: string | null;
  start_time: string;
  end_time?: string | null;
  all_day?: boolean;
  status?: EventStatus;
  is_public?: boolean;
};
