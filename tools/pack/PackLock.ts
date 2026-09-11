import { Database, SQLiteError } from 'bun:sqlite';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

import { printInfo } from '#/util/Logger.js';

export async function withPackLock<T>(action: () => Promise<T>, directory = 'data'): Promise<T> {
    mkdirSync(directory, { recursive: true });
    const database = new Database(join(directory, 'pack-build.sqlite'));
    let acquired = false;
    let waiting = false;
    try {
        database.exec('PRAGMA busy_timeout = 0');
        while (!acquired) {
            try {
                // The OS releases this lock even when a build process is killed.
                database.exec('BEGIN IMMEDIATE');
                acquired = true;
            } catch (error) {
                if (!(error instanceof SQLiteError) || error.errno !== 5) {
                    throw error;
                }
                if (!waiting) {
                    printInfo('Waiting for another cache build to finish.');
                    waiting = true;
                }
                await Bun.sleep(100);
            }
        }
        return await action();
    } finally {
        try {
            if (acquired) {
                database.exec('ROLLBACK');
            }
        } finally {
            database.close();
        }
    }
}
