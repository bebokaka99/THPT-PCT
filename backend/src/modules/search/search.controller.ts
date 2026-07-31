import type { RequestHandler } from 'express';
import { HttpError } from '../../utils/http-error.js';
import { searchSite } from './search.service.js';
import type { SearchQuery, SearchType } from './search.types.js';

const validSearchTypes = new Set<SearchType>(['all', 'posts', 'documents']);
const maxLimit = 20;

function firstQueryValue(value: unknown) {
  return Array.isArray(value) ? value[0] : value;
}

function parsePositiveInteger(value: unknown, fallback: number, field: string) {
  const rawValue = firstQueryValue(value);

  if (rawValue === undefined || rawValue === null || rawValue === '') {
    return fallback;
  }

  const numberValue = Number(rawValue);

  if (!Number.isInteger(numberValue) || numberValue <= 0) {
    throw new HttpError(400, `${field} must be a positive integer`);
  }

  return numberValue;
}

function parseSearchQuery(query: Record<string, unknown>): SearchQuery {
  const q = String(firstQueryValue(query.q) ?? '').trim();

  if (q.length < 2) {
    throw new HttpError(400, 'q must be at least 2 characters');
  }

  const rawType = firstQueryValue(query.type) ?? 'all';

  if (typeof rawType !== 'string' || !validSearchTypes.has(rawType as SearchType)) {
    throw new HttpError(400, 'type must be all, posts, or documents');
  }

  return {
    q,
    type: rawType as SearchType,
    page: parsePositiveInteger(query.page, 1, 'page'),
    limit: Math.min(parsePositiveInteger(query.limit, 10, 'limit'), maxLimit),
  };
}

export const searchController: RequestHandler = async (req, res, next) => {
  try {
    const query = parseSearchQuery(req.query);
    res.json(await searchSite(query));
  } catch (error) {
    next(error);
  }
};
