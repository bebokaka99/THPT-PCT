import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const DEFAULTS = {
  baseUrl: 'http://127.0.0.1:4000/api',
  concurrency: 5,
  requests: 60,
  timeoutMs: 10_000,
  maxP95Ms: 750,
  maxErrorRatePercent: 1,
};

function parseArgs(argv) {
  const result = {};
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (!value.startsWith('--')) continue;
    const key = value.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith('--')) result[key] = true;
    else {
      result[key] = next;
      index += 1;
    }
  }
  return result;
}

function positiveInteger(value, fallback, name) {
  const parsed = value === undefined ? fallback : Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) throw new Error(`${name} must be a positive integer`);
  return parsed;
}

function nonNegativeInteger(value, fallback, name) {
  const parsed = value === undefined ? fallback : Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) throw new Error(`${name} must be a non-negative integer`);
  return parsed;
}

function numberValue(value, fallback, name) {
  const parsed = value === undefined ? fallback : Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) throw new Error(`${name} must be a non-negative number`);
  return parsed;
}

function endpoint(pathname) {
  return new URL(
    `${config.baseUrl.replace(/\/$/, '')}/${pathname.replace(/^\//, '')}`,
  ).toString();
}

function percentile(values, ratio) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.ceil(sorted.length * ratio) - 1);
  return Number(sorted[Math.max(0, index)].toFixed(2));
}

function summarize(results, expectedStatuses) {
  const latencies = results.map((result) => result.durationMs);
  const statusCounts = {};
  let unexpected = 0;
  results.forEach((result) => {
    const key = String(result.status);
    statusCounts[key] = (statusCounts[key] ?? 0) + 1;
    if (!expectedStatuses.includes(result.status)) unexpected += 1;
  });
  return {
    requests: results.length,
    unexpected,
    error_rate_percent: results.length ? Number((unexpected / results.length * 100).toFixed(2)) : 0,
    status_counts: statusCounts,
    latency_ms: {
      p50: percentile(latencies, 0.5),
      p95: percentile(latencies, 0.95),
      p99: percentile(latencies, 0.99),
      max: percentile(latencies, 1),
    },
  };
}

async function request(pathname, options = {}) {
  const startedAt = process.hrtime.bigint();
  try {
    const response = await fetch(endpoint(pathname), {
      ...options,
      signal: AbortSignal.timeout(config.timeoutMs),
    });
    const rawBody = await response.text();
    let body = null;
    try { body = rawBody ? JSON.parse(rawBody) : null; } catch { /* body is not needed for metrics */ }
    return {
      status: response.status,
      durationMs: Number((Number(process.hrtime.bigint() - startedAt) / 1_000_000).toFixed(2)),
      body,
      requestId: response.headers.get('x-request-id'),
    };
  } catch (error) {
    return {
      status: 0,
      durationMs: Number((Number(process.hrtime.bigint() - startedAt) / 1_000_000).toFixed(2)),
      body: null,
      requestId: null,
      error: error instanceof Error ? error.name : 'RequestError',
    };
  }
}

async function runScenario(name, count, worker, expectedStatuses) {
  const results = [];
  let cursor = 0;
  async function runWorker() {
    while (true) {
      const index = cursor++;
      if (index >= count) return;
      results[index] = await worker(index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(config.concurrency, count) }, runWorker));
  const summary = summarize(results, expectedStatuses);
  console.log(`${name}: ${summary.requests} requests, p95 ${summary.latency_ms.p95} ms, errors ${summary.error_rate_percent}%`);
  return { name, ...summary };
}

function jsonHeaders(token) {
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}

async function login(identifier, password) {
  const response = await request('/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier, password }),
  });
  if (response.status !== 200 || typeof response.body?.accessToken !== 'string') {
    throw new Error(`Load-test login failed with HTTP ${response.status}`);
  }
  return { token: response.body.accessToken, user: response.body.user };
}

async function runUploadScenario(token) {
  const uploadedIds = [];
  const result = await runScenario('media-upload', config.writeRequests, async (index) => {
    const form = new FormData();
    form.set('file', new Blob([PNG_1X1], { type: 'image/png' }), `load-test-${Date.now()}-${index}.png`);
    const response = await request('/media/upload', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    });
    if (response.status === 201 && Number.isInteger(response.body?.data?.id)) {
      uploadedIds.push(response.body.data.id);
    }
    return response;
  }, [201]);

  let cleanupFailures = 0;
  for (const id of uploadedIds) {
    const response = await request(`/media/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (response.status !== 204) cleanupFailures += 1;
  }
  return { ...result, uploaded: uploadedIds.length, cleanup_failures: cleanupFailures };
}

async function runGradebookScenario(token) {
  if (!config.gradebookId || !config.gradebookEntries) {
    return { name: 'gradebook-save', skipped: true, reason: 'LOAD_TEST_GRADEBOOK_ID and LOAD_TEST_GRADEBOOK_ENTRIES are required' };
  }
  let entries;
  try { entries = JSON.parse(config.gradebookEntries); }
  catch { throw new Error('LOAD_TEST_GRADEBOOK_ENTRIES must be valid JSON'); }

  const result = await runScenario('gradebook-save', config.writeRequests, async () => request(
    `/gradebooks/${config.gradebookId}/scores`,
    {
      method: 'PUT',
      headers: jsonHeaders(token),
      body: JSON.stringify({ entries, reason: 'staging load test' }),
    },
  ), [200, 409]);
  return { ...result, note: 'HTTP 409 is expected optimistic-lock conflict for concurrent writes to one fixture entry' };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const authIdentifier = process.env.LOAD_TEST_IDENTIFIER?.trim();
  const authPassword = process.env.LOAD_TEST_PASSWORD;
  const tokenInfo = authIdentifier && authPassword ? await login(authIdentifier, authPassword) : null;
  const headers = tokenInfo ? { Authorization: `Bearer ${tokenInfo.token}` } : undefined;
  const publicRoutes = [
    '/health/live',
    '/health/ready',
    '/categories?limit=20',
    '/posts?status=published&page=1&limit=10',
    '/documents?status=published&page=1&limit=10',
    '/search?q=truong&type=all&page=1&limit=10',
  ];
  const authRoutes = (process.env.LOAD_TEST_AUTH_ROUTES ?? '').split(',').map((value) => value.trim()).filter(Boolean);
  const routes = [...publicRoutes, ...(headers ? ['/auth/me', ...authRoutes] : [])];
  const scenarios = [];

  scenarios.push(await runScenario(
    'read-mix',
    config.requests,
    (index) => request(routes[index % routes.length], headers ? { headers } : {}),
    [200],
  ));

  const loginRequests = nonNegativeInteger(process.env.LOAD_TEST_LOGIN_REQUESTS, 0, 'LOAD_TEST_LOGIN_REQUESTS');
  if (loginRequests > 0) {
    if (!authIdentifier || !authPassword) throw new Error('Login load test requires LOAD_TEST_IDENTIFIER and LOAD_TEST_PASSWORD');
    scenarios.push(await runScenario('login', loginRequests, () => request('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: authIdentifier, password: authPassword }),
    }), [200]));
  }

  if (config.allowWrites) {
    if (!tokenInfo) throw new Error('Write load test requires LOAD_TEST_IDENTIFIER and LOAD_TEST_PASSWORD');
    scenarios.push(await runUploadScenario(tokenInfo.token));
    scenarios.push(await runGradebookScenario(tokenInfo.token));
  }

  const failedScenarios = scenarios.filter((scenario) => !scenario.skipped && (
    scenario.latency_ms.p95 > config.maxP95Ms
    || scenario.error_rate_percent > config.maxErrorRatePercent
    || (scenario.cleanup_failures ?? 0) > 0
  ));
  const report = {
    generated_at: new Date().toISOString(),
    base_url: config.baseUrl,
    concurrency: config.concurrency,
    requests: config.requests,
    writes_enabled: config.allowWrites,
    target: { p95_ms: config.maxP95Ms, max_error_rate_percent: config.maxErrorRatePercent },
    scenarios,
    passed: failedScenarios.length === 0,
  };
  const reportPath = args.output || process.env.LOAD_TEST_REPORT_PATH;
  if (reportPath) {
    const absolutePath = path.resolve(reportPath);
    await mkdir(path.dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, `${JSON.stringify(report, null, 2)}\n`, { mode: 0o600 });
    console.log(`Report: ${absolutePath}`);
  }
  if (!report.passed) throw new Error('Load test target was not met; inspect the report before tuning infrastructure.');
  console.log('Load test passed.');
}

const args = parseArgs(process.argv.slice(2));
const config = {
  baseUrl: String(args['base-url'] || process.env.LOAD_TEST_BASE_URL || DEFAULTS.baseUrl),
  concurrency: positiveInteger(args.concurrency || process.env.LOAD_TEST_CONCURRENCY, DEFAULTS.concurrency, 'concurrency'),
  requests: positiveInteger(args.requests || process.env.LOAD_TEST_REQUESTS, DEFAULTS.requests, 'requests'),
  timeoutMs: positiveInteger(args.timeout || process.env.LOAD_TEST_TIMEOUT_MS, DEFAULTS.timeoutMs, 'timeout'),
  maxP95Ms: numberValue(args['max-p95'] || process.env.LOAD_TEST_MAX_P95_MS, DEFAULTS.maxP95Ms, 'max-p95'),
  maxErrorRatePercent: numberValue(args['max-error-rate'] || process.env.LOAD_TEST_MAX_ERROR_RATE_PERCENT, DEFAULTS.maxErrorRatePercent, 'max-error-rate'),
  allowWrites: String(args.writes || process.env.LOAD_TEST_ALLOW_WRITES || 'false').toLowerCase() === 'true',
  writeRequests: positiveInteger(args['write-requests'] || process.env.LOAD_TEST_WRITE_REQUESTS, 5, 'write-requests'),
  gradebookId: args['gradebook-id'] || process.env.LOAD_TEST_GRADEBOOK_ID,
  gradebookEntries: args['gradebook-entries'] || process.env.LOAD_TEST_GRADEBOOK_ENTRIES,
};

const PNG_1X1 = Uint8Array.from(Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64',
));

main().catch((error) => {
  console.error(`Load test failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
