import { checkDatabaseConnection } from '../../database/postgres.js';
import type { ReadinessResult } from './health.types.js';

const DEFAULT_READINESS_TIMEOUT_MS = 3_000;

export async function checkReadiness(
  probe: () => Promise<void> = checkDatabaseConnection,
  timeoutMs = DEFAULT_READINESS_TIMEOUT_MS,
): Promise<ReadinessResult> {
  const startedAt = process.hrtime.bigint();
  let timeout: NodeJS.Timeout | undefined;

  try {
    await Promise.race([
      probe(),
      new Promise<never>((_resolve, reject) => {
        timeout = setTimeout(() => reject(new Error('Readiness probe timed out')), timeoutMs);
        timeout.unref();
      }),
    ]);

    return {
      ready: true,
      database: {
        status: 'connected',
        latency_ms: elapsedMilliseconds(startedAt),
      },
    };
  } catch {
    return {
      ready: false,
      database: {
        status: 'disconnected',
        latency_ms: elapsedMilliseconds(startedAt),
      },
    };
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

function elapsedMilliseconds(startedAt: bigint) {
  return Number((Number(process.hrtime.bigint() - startedAt) / 1_000_000).toFixed(2));
}
