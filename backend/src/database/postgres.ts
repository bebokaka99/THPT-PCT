import { Pool, type PoolClient, types } from 'pg';
import { env } from '../config/env.js';

types.setTypeParser(20, (value) => Number(value));

export type DatabaseRow = Record<string, unknown>;

export interface DatabaseResult {
  affectedRows: number;
  insertId: number;
}

type QueryParams = unknown[];

function expandBulkValues(sql: string, params: QueryParams) {
  if (params.length !== 1 || !Array.isArray(params[0])) {
    return { sql, params };
  }

  const bulkRows = params[0];
  if (!bulkRows.every((row) => Array.isArray(row))) {
    return { sql, params };
  }

  const valuesMarker = /VALUES\s+\?/i;
  if (!valuesMarker.test(sql)) {
    return { sql, params };
  }

  const rows = bulkRows as unknown[][];
  const placeholders = rows
    .map((row) => `(${row.map(() => '?').join(', ')})`)
    .join(', ');

  return {
    sql: sql.replace(valuesMarker, `VALUES ${placeholders}`),
    params: rows.flat(),
  };
}

function replacePlaceholders(sql: string) {
  let parameterIndex = 0;
  let result = '';
  let quote: "'" | '"' | null = null;

  for (let index = 0; index < sql.length; index += 1) {
    const character = sql[index];
    const nextCharacter = sql[index + 1];

    if (quote) {
      result += character;

      if (character === quote && nextCharacter === quote) {
        result += nextCharacter;
        index += 1;
      } else if (character === quote) {
        quote = null;
      }

      continue;
    }

    if (character === "'" || character === '"') {
      quote = character;
      result += character;
      continue;
    }

    if (character === '?') {
      parameterIndex += 1;
      result += `$${parameterIndex}`;
      continue;
    }

    result += character;
  }

  return result;
}

function prepareQuery(sql: string, params: QueryParams = []) {
  const expanded = expandBulkValues(sql, params);
  return {
    text: replacePlaceholders(expanded.sql),
    values: expanded.params,
  };
}

function isRowQuery(sql: string) {
  return /^\s*(SELECT|WITH|SHOW|EXPLAIN)\b/i.test(sql);
}

function toDatabaseResult(rowCount: number | null, rows: DatabaseRow[]) {
  return {
    affectedRows: rowCount ?? 0,
    insertId: Number(rows[0]?.id ?? 0),
  } satisfies DatabaseResult;
}

export class DatabaseConnection {
  constructor(private readonly client: PoolClient) {}

  async query<T = DatabaseRow[]>(
    sql: string,
    params: QueryParams = [],
  ): Promise<[T]> {
    const prepared = prepareQuery(sql, params);
    const result = await this.client.query(prepared.text, prepared.values);

    if (isRowQuery(sql)) {
      return [result.rows as T];
    }

    return [toDatabaseResult(result.rowCount, result.rows) as T];
  }

  beginTransaction() {
    return this.client.query('BEGIN');
  }

  commit() {
    return this.client.query('COMMIT');
  }

  rollback() {
    return this.client.query('ROLLBACK');
  }

  release() {
    this.client.release();
  }
}

class DatabasePool {
  constructor(private readonly pool: Pool) {}

  async query<T = DatabaseRow[]>(
    sql: string,
    params: QueryParams = [],
  ): Promise<[T]> {
    const prepared = prepareQuery(sql, params);
    const result = await this.pool.query(prepared.text, prepared.values);

    if (isRowQuery(sql)) {
      return [result.rows as T];
    }

    return [toDatabaseResult(result.rowCount, result.rows) as T];
  }

  async getConnection() {
    return new DatabaseConnection(await this.pool.connect());
  }
}

const pool = new Pool({
  connectionString: env.database.url,
  host: env.database.url ? undefined : env.database.host,
  port: env.database.url ? undefined : env.database.port,
  user: env.database.url ? undefined : env.database.user,
  password: env.database.url ? undefined : env.database.password,
  database: env.database.url ? undefined : env.database.name,
  ssl: env.database.ssl
    ? { rejectUnauthorized: env.database.sslRejectUnauthorized }
    : undefined,
  max: env.database.poolMax,
  connectionTimeoutMillis: env.database.connectionTimeoutMs,
  idleTimeoutMillis: env.database.idleTimeoutMs,
  maxUses: env.database.maxUses || undefined,
});

export const databasePool = new DatabasePool(pool);
export const postgresPool = pool;

export async function checkDatabaseConnection() {
  await pool.query('SELECT 1');
}

export async function closeDatabasePool() {
  await pool.end();
}
