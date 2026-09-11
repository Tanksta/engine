import fs from 'fs';
import path from 'path';

import { SCRIPT_COMPILER_VERSION } from '#/engine/script/ScriptCompilerVersion.js';

const SCRIPT_DAT_HEADER_BYTES = 8;
const SCRIPT_COMPILER_VERSION_OFFSET = 4;

function scriptDatPath(rootDir: string): string {
    return path.join(rootDir, 'server', 'script.dat');
}

export function readServerScriptCompilerVersion(rootDir: string = 'data/pack'): number {
    const header = Buffer.alloc(SCRIPT_DAT_HEADER_BYTES);
    const fd = fs.openSync(scriptDatPath(rootDir), 'r');

    try {
        const bytesRead = fs.readSync(fd, header, 0, header.length, 0);
        if (bytesRead !== header.length) {
            throw new Error(`Invalid script.dat header: expected ${header.length} bytes, read ${bytesRead}`);
        }

        return header.readInt32BE(SCRIPT_COMPILER_VERSION_OFFSET);
    } finally {
        fs.closeSync(fd);
    }
}

export function stampServerScriptCompilerVersion(rootDir: string = 'data/pack'): void {
    const version = Buffer.alloc(4);
    version.writeInt32BE(SCRIPT_COMPILER_VERSION, 0);

    const fd = fs.openSync(scriptDatPath(rootDir), 'r+');
    try {
        const stats = fs.fstatSync(fd);
        if (stats.size < SCRIPT_DAT_HEADER_BYTES) {
            throw new Error(`Invalid script.dat header: expected at least ${SCRIPT_DAT_HEADER_BYTES} bytes, found ${stats.size}`);
        }

        fs.writeSync(fd, version, 0, version.length, SCRIPT_COMPILER_VERSION_OFFSET);
    } finally {
        fs.closeSync(fd);
    }
}
