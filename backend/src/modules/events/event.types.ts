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
  start_time: Date;
  end_time: Date | null;
  all_day: boolean;
  status: EventStatus;
  is_public: boolean;
  created_by: number | null;
  creator_name: string | null;
  created_at: Date;
  updated_at: Date;
};

export type EventInput = {
  title: string;
  slug?: string;
  description?: string | null;
  category?: string | null;
  location?: string | null;
  cover_image_url?: string | null;
  start_time: Date;
  end_time?: Date | null;
  all_day?: boolean;
  status?: EventStatus;
  is_public?: boolean;
};

export type UpdateEventInput = Partial<EventInput>;

export type ListEventsQuery = {
  page: number;
  limit: number;
  q?: string;
  status?: EventStatus;
  scope: EventScope;
};
