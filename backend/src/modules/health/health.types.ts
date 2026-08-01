export type ReadinessResult = {
  ready: boolean;
  database: {
    status: 'connected' | 'disconnected';
    latency_ms: number;
  };
};
