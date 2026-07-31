import { loadDashboardOverview } from './dashboard.repository.js';
import type { DashboardOverview } from './dashboard.types.js';

const CACHE_TTL_MS = 30_000;
let cachedOverview: DashboardOverview | null = null;
let cachedAt = 0;

export async function getDashboardOverview() {
  if (cachedOverview && Date.now() - cachedAt < CACHE_TTL_MS) {
    return cachedOverview;
  }

  const overview = await loadDashboardOverview();
  cachedOverview = overview;
  cachedAt = Date.now();
  return overview;
}
