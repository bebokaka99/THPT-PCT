export type DashboardStatusCounts = {
  total: number;
  active: number;
  inactive: number;
  locked: number;
};

export type DashboardContentCounts = {
  total: number;
  draft: number;
  published: number;
  archived: number;
};

export type DashboardOverview = {
  generated_at: string;
  users: DashboardStatusCounts & {
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
  posts: DashboardContentCounts;
  documents: DashboardContentCounts;
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
