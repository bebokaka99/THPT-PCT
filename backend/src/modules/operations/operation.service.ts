import { readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { env } from '../../config/env.js';
import { postgresPool } from '../../database/postgres.js';
import { HttpError } from '../../utils/http-error.js';
import { getOperationalMetricsSnapshot } from '../../utils/operational-metrics.js';
import { checkReadiness } from '../health/health.service.js';
import type { OperationalHealth, StorageMetric } from './operation.types.js';

async function directoryMetric(directory: string): Promise<StorageMetric> {
  const result: StorageMetric = { files: 0, bytes: 0 };

  async function walk(current: string) {
    let entries;
    try {
      entries = await readdir(current, { withFileTypes: true });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return;
      throw error;
    }

    await Promise.all(entries.map(async (entry) => {
      const entryPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        await walk(entryPath);
      } else if (entry.isFile()) {
        const metadata = await stat(entryPath);
        result.files += 1;
        result.bytes += metadata.size;
      }
    }));
  }

  await walk(directory);
  return result;
}

export async function getOperationalHealth(): Promise<OperationalHealth> {
  const [readiness, publicUploads, privateUploads] = await Promise.all([
    checkReadiness(),
    directoryMetric(path.resolve(process.cwd(), 'uploads')),
    directoryMetric(path.resolve(process.cwd(), 'private-uploads')),
  ]);
  const api = getOperationalMetricsSnapshot();
  const memory = process.memoryUsage();
  const poolUtilization = env.database.poolMax > 0
    ? (postgresPool.totalCount / env.database.poolMax) * 100
    : 0;
  const recentErrorCutoff = Date.now() - 5 * 60 * 1_000;
  const hasRecentServerError = api.recent_errors.some(
    (error) => Date.parse(error.occurred_at) >= recentErrorCutoff,
  );
  const degraded = !readiness.ready || postgresPool.waitingCount > 0 || hasRecentServerError;

  return {
    status: degraded ? 'degraded' : 'ok',
    generated_at: new Date().toISOString(),
    environment: env.appEnv,
    process: {
      node_version: process.version,
      uptime_seconds: Math.floor(process.uptime()),
      memory: {
        rss_bytes: memory.rss,
        heap_used_bytes: memory.heapUsed,
        heap_total_bytes: memory.heapTotal,
      },
    },
    database: {
      status: readiness.database.status,
      latency_ms: readiness.database.latency_ms,
      pool: {
        max: env.database.poolMax,
        total: postgresPool.totalCount,
        idle: postgresPool.idleCount,
        waiting: postgresPool.waitingCount,
        utilization_percent: Number(poolUtilization.toFixed(2)),
      },
    },
    storage: {
      public_uploads: publicUploads,
      private_uploads: privateUploads,
    },
    api,
  };
}

export function triggerSyntheticFailure() {
  if (!env.operations.syntheticFailureEnabled) {
    throw new HttpError(403, 'Synthetic operational failure is disabled');
  }

  throw new HttpError(503, 'Synthetic operational failure', {
    code: 'SYNTHETIC_OPERATIONAL_FAILURE',
  });
}
