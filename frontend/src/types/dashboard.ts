export type DashboardOverview = {
  generated_at: string;
  users: {
    total: number;
    active: number;
    inactive: number;
    locked: number;
    by_role: {
      admin: number;
      teacher: number;
      student: number;
    };
  };
  classrooms: {
    total: number;
    active: number;
    inactive: number;
  };
  posts: {
    total: number;
    draft: number;
    published: number;
    archived: number;
  };
  documents: {
    total: number;
    draft: number;
    published: number;
    archived: number;
  };
  importer: {
    total: number;
    pending: number;
    converted: number;
    error: number;
    skipped: number;
  };
  media: {
    total: number;
    images: number;
    documents: number;
    original_size: number;
    optimized_size: number;
  };
  events: {
    total: number;
    upcoming: number;
  };
  recent_activity: Array<{
    id: number;
    type: 'post' | 'document' | 'event';
    title: string;
    status: string;
    created_at: string;
    href: string;
  }>;
};
