import { Database } from 'bun:sqlite';
import { Kysely, MysqlDialect } from 'kysely';
import type { Dialect, LogEvent } from 'kysely';
import { createPool } from 'mysql2';

import { DB } from '#/db/types.js';
import { BunSqliteDialect } from './dialect/BunSqliteDialect.js';
import Environment from '#/util/Environment.js';

let dialect: Dialect;

const TRANSIENT_DATABASE_ERROR_CODES = new Set([
    'PROTOCOL_CONNECTION_LOST',
    'PROTOCOL_ENQUEUE_AFTER_FATAL_ERROR',
    'PROTOCOL_PACKETS_OUT_OF_ORDER',
    'ETIMEDOUT',
    'ECONNRESET',
    'ECONNREFUSED',
    'EPIPE',
    'ENOTFOUND',
    'ER_CON_COUNT_ERROR',
    'ER_LOCK_DEADLOCK',
    'ER_LOCK_WAIT_TIMEOUT'
]);

type DatabaseErrorLike = {
    code?: unknown;
    errno?: unknown;
    fatal?: unknown;
    message?: unknown;
    syscall?: unknown;
};

function getDatabaseErrorLike(err: unknown): DatabaseErrorLike {
    if (typeof err === 'object' && err !== null) {
        return err as DatabaseErrorLike;
    }

    return {};
}

export function isTransientDatabaseError(err: unknown): boolean {
    const error = getDatabaseErrorLike(err);
    const code = typeof error.code === 'string' ? error.code : '';
    if (TRANSIENT_DATABASE_ERROR_CODES.has(code)) {
        return true;
    }

    const message = typeof error.message === 'string' ? error.message : '';
    return /connection lost|server closed the connection|connect ETIMEDOUT/i.test(message);
}

export function describeDatabaseError(err: unknown): string {
    const error = getDatabaseErrorLike(err);
    const code = typeof error.code === 'string' ? error.code : 'UNKNOWN';
    const message = typeof error.message === 'string' ? error.message : String(err);

    return `${code}: ${message}`;
}

if (Environment.DB_BACKEND === 'sqlite') {
    const database = new Database('db.sqlite');
    database.run(`
        CREATE TABLE IF NOT EXISTS "npc_killcount" (
            "account_id" INTEGER NOT NULL,
            "profile" TEXT NOT NULL DEFAULT 'main',
            "npc_type" INTEGER NOT NULL,
            "npc_name" TEXT NOT NULL,
            "kills" INTEGER NOT NULL DEFAULT 0,
            "last_kill" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY ("account_id", "profile", "npc_type")
        )
    `);
    database.run('CREATE INDEX IF NOT EXISTS "npc_killcount_npc_type_idx" ON "npc_killcount"("npc_type")');

    dialect = new BunSqliteDialect({
        database
    });
} else {
    dialect = new MysqlDialect({
        pool: async () =>
            createPool({
                database: Environment.DB_NAME,
                host: Environment.DB_HOST,
                port: Environment.DB_PORT,
                user: Environment.DB_USER,
                password: Environment.DB_PASS,
                timezone: 'Z',
                // the DB may be remote (high RTT): allow slow handshakes and keep
                // connections warm instead of constantly re-dialing
                connectTimeout: 30000,
                enableKeepAlive: true,
                keepAliveInitialDelay: 0,
                waitForConnections: true,
                connectionLimit: 10,
                maxIdle: 10,
                idleTimeout: 300000 // must stay below MySQL wait_timeout (600s)
            })
    });
}

function logVerbose(event: LogEvent) {
    if (event.level === 'query') {
        console.log(event.query.sql);
        console.log(event.query.parameters);
    }
}

export const db = new Kysely<DB>({
    dialect,
    log: Environment.KYSELY_VERBOSE ? logVerbose : []
});

export function toDbDate(date: Date | string | number) {
    if (typeof date === 'string' || typeof date === 'number') {
        date = new Date(date);
    }

    return date.toISOString().slice(0, 19).replace('T', ' ');
}
