export type StorageMetric = {
  files: number;
  bytes: number;
};

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
    public_uploads: StorageMetric;
    private_uploads: StorageMetric;
  };
  api: ReturnType<typeof import('../../utils/operational-metrics.js').getOperationalMetricsSnapshot>;
};
