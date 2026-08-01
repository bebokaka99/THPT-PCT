const startedAt = new Date();
const MAX_RECENT_ERRORS = 25;

type StatusBucket = '2xx' | '3xx' | '4xx' | '5xx';

type RecentOperationalError = {
  occurred_at: string;
  request_id: string;
  path: string;
  status_code: number;
  error_name: string;
};

const requestMetrics = {
  active: 0,
  finished: 0,
  aborted: 0,
  totalDurationMs: 0,
  maxDurationMs: 0,
  slowRequests: 0,
  statuses: {
    '2xx': 0,
    '3xx': 0,
    '4xx': 0,
    '5xx': 0,
  } satisfies Record<StatusBucket, number>,
};

const recentErrors: RecentOperationalError[] = [];
const recentRequests: Array<{ occurredAt: number; durationMs: number; statusCode: number }> = [];

function pruneRecentRequests() {
  const cutoff = Date.now() - 5 * 60 * 1_000;
  while (recentRequests[0] && recentRequests[0].occurredAt < cutoff) {
    recentRequests.shift();
  }
}

function statusBucket(statusCode: number): StatusBucket {
  if (statusCode >= 500) return '5xx';
  if (statusCode >= 400) return '4xx';
  if (statusCode >= 300) return '3xx';
  return '2xx';
}

export function beginRequestMeasurement() {
  requestMetrics.active += 1;
  let settled = false;

  function settle() {
    if (settled) return false;
    settled = true;
    requestMetrics.active = Math.max(0, requestMetrics.active - 1);
    return true;
  }

  return {
    finish(statusCode: number, durationMs: number) {
      if (!settle()) return;
      requestMetrics.finished += 1;
      requestMetrics.statuses[statusBucket(statusCode)] += 1;
      requestMetrics.totalDurationMs += durationMs;
      requestMetrics.maxDurationMs = Math.max(requestMetrics.maxDurationMs, durationMs);
      if (durationMs >= 1_000) requestMetrics.slowRequests += 1;
      recentRequests.push({ occurredAt: Date.now(), durationMs, statusCode });
      pruneRecentRequests();
    },
    abort() {
      if (!settle()) return;
      requestMetrics.aborted += 1;
    },
  };
}

export function recordOperationalError(error: RecentOperationalError) {
  recentErrors.unshift(error);
  if (recentErrors.length > MAX_RECENT_ERRORS) recentErrors.length = MAX_RECENT_ERRORS;
}

export function getOperationalMetricsSnapshot() {
  pruneRecentRequests();
  const averageDurationMs = requestMetrics.finished > 0
    ? requestMetrics.totalDurationMs / requestMetrics.finished
    : 0;

  return {
    started_at: startedAt.toISOString(),
    uptime_seconds: Math.floor(process.uptime()),
    requests: {
      active: requestMetrics.active,
      finished: requestMetrics.finished,
      aborted: requestMetrics.aborted,
      status_counts: { ...requestMetrics.statuses },
      average_duration_ms: Number(averageDurationMs.toFixed(2)),
      max_duration_ms: Number(requestMetrics.maxDurationMs.toFixed(2)),
      slow_requests_over_1s: requestMetrics.slowRequests,
      recent_5m: getRecentRequestSnapshot(),
    },
    recent_errors: recentErrors.map((error) => ({ ...error })),
  };
}

function getRecentRequestSnapshot() {
  const durations = recentRequests.map((request) => request.durationMs).sort((a, b) => a - b);
  const totalDurationMs = durations.reduce((total, duration) => total + duration, 0);
  const statusCounts: Record<StatusBucket, number> = {
    '2xx': 0,
    '3xx': 0,
    '4xx': 0,
    '5xx': 0,
  };
  recentRequests.forEach((request) => {
    statusCounts[statusBucket(request.statusCode)] += 1;
  });
  const p95Index = durations.length === 0 ? 0 : Math.min(durations.length - 1, Math.ceil(durations.length * 0.95) - 1);

  return {
    window_seconds: 300,
    count: durations.length,
    status_counts: statusCounts,
    average_duration_ms: durations.length ? Number((totalDurationMs / durations.length).toFixed(2)) : 0,
    p95_duration_ms: durations.length ? Number(durations[p95Index].toFixed(2)) : 0,
  };
}
