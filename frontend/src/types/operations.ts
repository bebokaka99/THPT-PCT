export type OperationalHealth = {
  status: 'ok' | 'degraded';
  generated_at: string;
  environment: string;
  process: {
    node_version: string;
    uptime_seconds: number;
    memory: {
      rss_bytes: number;
      heap_used_bytes: number;
      heap_total_bytes: number;
    };
  };
  database: {
    status: 'connected' | 'disconnected';
    latency_ms: number;
    pool: {
      max: number;
      total: number;
      idle: number;
      waiting: number;
      utilization_percent: number;
    };
  };
  storage: {
    public_uploads: { files: number; bytes: number };
    private_uploads: { files: number; bytes: number };
  };
  api: {
    started_at: string;
    uptime_seconds: number;
    requests: {
      active: number;
      finished: number;
      aborted: number;
      status_counts: { '2xx': number; '3xx': number; '4xx': number; '5xx': number };
      average_duration_ms: number;
      max_duration_ms: number;
      slow_requests_over_1s: number;
      recent_5m: {
        window_seconds: number;
        count: number;
        status_counts: { '2xx': number; '3xx': number; '4xx': number; '5xx': number };
        average_duration_ms: number;
        p95_duration_ms: number;
      };
    };
    recent_errors: Array<{
      occurred_at: string;
      request_id: string;
      path: string;
      status_code: number;
      error_name: string;
    }>;
  };
};
