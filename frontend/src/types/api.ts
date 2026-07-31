export type ApiDataResponse<T> = {
  data: T;
};

export type ApiListResponse<T> = {
  data: T[];
};

export type ApiPaginatedResponse<T> = {
  data: T[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

