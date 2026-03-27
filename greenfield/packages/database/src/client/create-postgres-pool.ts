import { Pool } from 'pg';

export type PostgresSslMode = 'disable' | 'require';

export interface PostgresPoolOptions {
  applicationName: string;
  connectionString: string;
  connectionTimeoutMs: number;
  idleTimeoutMs: number;
  maxConnections: number;
  sslMode: PostgresSslMode;
  statementTimeoutMs: number;
}

export type PostgresPool = Pool;

export function createPostgresPool(options: PostgresPoolOptions): PostgresPool {
  return new Pool({
    application_name: options.applicationName,
    connectionString: options.connectionString,
    connectionTimeoutMillis: options.connectionTimeoutMs,
    idleTimeoutMillis: options.idleTimeoutMs,
    max: options.maxConnections,
    ssl:
      options.sslMode === 'require'
        ? {
            rejectUnauthorized: true,
          }
        : false,
    statement_timeout: options.statementTimeoutMs,
  });
}
