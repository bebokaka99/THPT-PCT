import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import { Writable } from 'node:stream';
import pino from 'pino';
import { app } from '../src/app.js';
import { closeDatabasePool, postgresPool } from '../src/database/postgres.js';
import { checkReadiness } from '../src/modules/health/health.service.js';
import { LOG_REDACTION } from '../src/utils/logger.js';

type LoginResponse = { accessToken: string };

async function login(baseUrl: string, identifier: string, password: string) {
  const response = await fetch(`${baseUrl}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier, password }),
  });
  assert.equal(response.status, 200);
  return (await response.json()) as LoginResponse;
}

function assertLoggerRedaction() {
  let output = '';
  const destination = new Writable({
    write(chunk, _encoding, callback) {
      output += chunk.toString();
      callback();
    },
  });
  const testLogger = pino({ level: 'info', redact: LOG_REDACTION }, destination);
  testLogger.info({
    email: 'student-private@pct.local',
    authorization: 'Bearer private-token',
    body: { password: 'private-password', phone: '0900000000' },
    user: { full_name: 'Private Student', parent_phone: '0911111111' },
  }, 'redaction-test');

  assert.match(output, /\[REDACTED\]/);
  for (const secret of [
    'student-private@pct.local',
    'private-token',
    'private-password',
    '0900000000',
    'Private Student',
    '0911111111',
  ]) {
    assert.ok(!output.includes(secret), `Log output leaked ${secret}`);
  }
}

async function run() {
  assertLoggerRedaction();
  const failedReadiness = await checkReadiness(async () => {
    throw new Error('synthetic database failure with private detail');
  });
  assert.equal(failedReadiness.ready, false);
  assert.equal(failedReadiness.database.status, 'disconnected');
  assert.ok(!('message' in failedReadiness.database));

  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });

  const studentEmail = `observability-student-${Date.now()}@pct.local`;
  let studentId: number | null = null;

  try {
    const address = server.address() as AddressInfo;
    const baseUrl = `http://127.0.0.1:${address.port}/api`;
    const traceId = `observability-${Date.now()}`;

    const live = await fetch(`${baseUrl}/health/live`, {
      headers: { 'X-Request-Id': traceId },
    });
    assert.equal(live.status, 200);
    assert.equal(live.headers.get('x-request-id'), traceId);
    assert.equal(((await live.json()) as { requestId: string }).requestId, traceId);

    const ready = await fetch(`${baseUrl}/health/ready`);
    assert.equal(ready.status, 200);
    assert.equal(((await ready.json()) as { readiness: string }).readiness, 'ready');

    const legacyDb = await fetch(`${baseUrl}/health/db`);
    assert.equal(legacyDb.status, 200);
    assert.deepEqual(await legacyDb.json(), { status: 'ok', database: 'connected' });

    const deniedAnonymous = await fetch(`${baseUrl}/operations/health`);
    assert.equal(deniedAnonymous.status, 401);

    const admin = await login(baseUrl, 'admin@pct.local', 'admin123');
    const adminHeaders = {
      Authorization: `Bearer ${admin.accessToken}`,
      'Content-Type': 'application/json',
    };
    const createStudent = await fetch(`${baseUrl}/users`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        email: studentEmail,
        full_name: 'Observability Student',
        password: 'Observability1234',
        roles: ['student'],
      }),
    });
    assert.equal(createStudent.status, 201);
    studentId = ((await createStudent.json()) as { data: { id: number } }).data.id;

    const student = await login(baseUrl, studentEmail, 'Observability1234');
    const deniedStudent = await fetch(`${baseUrl}/operations/health`, {
      headers: { Authorization: `Bearer ${student.accessToken}` },
    });
    assert.equal(deniedStudent.status, 403);

    const initialHealth = await fetch(`${baseUrl}/operations/health`, { headers: adminHeaders });
    assert.equal(initialHealth.status, 200);
    const initialData = (await initialHealth.json()) as {
      data: { database: { status: string }; api: { requests: { finished: number } } };
    };
    assert.equal(initialData.data.database.status, 'connected');
    assert.ok(initialData.data.api.requests.finished > 0);

    const syntheticTraceId = `synthetic-${Date.now()}`;
    const synthetic = await fetch(`${baseUrl}/operations/synthetic-failure`, {
      method: 'POST',
      headers: { ...adminHeaders, 'X-Request-Id': syntheticTraceId },
    });
    assert.equal(synthetic.status, 503);
    assert.equal(synthetic.headers.get('x-request-id'), syntheticTraceId);

    const afterFailure = await fetch(`${baseUrl}/operations/health`, { headers: adminHeaders });
    assert.equal(afterFailure.status, 200);
    const afterData = (await afterFailure.json()) as {
      data: {
        status: string;
        api: {
          requests: { status_counts: { '5xx': number } };
          recent_errors: Array<Record<string, unknown>>;
        };
      };
    };
    assert.equal(afterData.data.status, 'degraded');
    assert.ok(afterData.data.api.requests.status_counts['5xx'] >= 1);
    const syntheticError = afterData.data.api.recent_errors.find(
      (error) => error.request_id === syntheticTraceId,
    );
    assert.ok(syntheticError);
    assert.equal(syntheticError.path, '/api/operations/synthetic-failure');
    assert.ok(!('message' in syntheticError));

    console.log('Observability and operations smoke test passed.');
  } finally {
    if (studentId) {
      await postgresPool.query('DELETE FROM users WHERE id = $1', [studentId]);
    }
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
    await closeDatabasePool();
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
