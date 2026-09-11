import fs from 'fs';
import pathUtil from 'path';

const dirCache: Map<string, string[]> = new Map();
const existsCache: Map<string, boolean> = new Map();
const statsCache: Map<string, fs.Stats> = new Map();
const textCache: Map<string, string> = new Map();
const binaryCache: Map<string, Buffer> = new Map();

export function stableMtimeMs(mtimeMs: number): number {
    return Math.trunc(mtimeMs);
}

export function clearFsCache() {
    dirCache.clear();
    existsCache.clear();
    statsCache.clear();
    textCache.clear();
    binaryCache.clear();
}

export function fileExists(filePath: string): boolean {
    const cached = existsCache.get(filePath);
    if (typeof cached !== 'undefined') {
        return cached;
    }

    const exists = fs.existsSync(filePath);
    existsCache.set(filePath, exists);
    return exists;
}

export function fileStats(filePath: string): fs.Stats {
    const cached = statsCache.get(filePath);
    if (typeof cached !== 'undefined') {
        return cached;
    }

    const exists = fs.statSync(filePath);
    statsCache.set(filePath, exists);
    return exists;
}

export function listDir(path: string): string[] {
    if (path.endsWith('/')) {
        path = path.substring(0, path.length - 1);
    }

    let files: string[] | undefined = dirCache.get(path);

    if (typeof files === 'undefined') {
        if (!fs.existsSync(path)) {
            return [];
        }

        const entries = fs.readdirSync(path, { withFileTypes: true });

        files = [];
        for (const entry of entries) {
            if (entry.isDirectory()) {
                files.push(`${entry.name}/`);
            } else {
                files.push(entry.name);
            }
        }

        dirCache.set(path, files);
    }

    const all: string[] = [];
    for (let i = 0; i < files.length; i++) {
        all.push(`${path}/${files[i]}`);

        if (files[i].endsWith('/')) {
            all.push(...listDir(`${path}/${files[i]}`));
        }
    }

    return all;
}

export function listFiles(path: string, out: string[] = []) {
    const files = listDir(path);

    for (const file of files) {
        out.push(file);
    }

    return out;
}

export function readTextFile(filePath: string, encoding: BufferEncoding = 'utf8'): string {
    const key = `${encoding}:${filePath}`;
    const cached = textCache.get(key);
    if (typeof cached !== 'undefined') {
        return cached;
    }

    const text = fs.readFileSync(filePath, encoding);
    textCache.set(key, text);
    return text;
}

export function readBinaryFile(filePath: string): Buffer {
    const cached = binaryCache.get(filePath);
    if (typeof cached !== 'undefined') {
        return cached;
    }

    const data = fs.readFileSync(filePath);
    binaryCache.set(filePath, data);
    return data;
}

function ensureParentDir(filePath: string): void {
    const dir = pathUtil.resolve(pathUtil.dirname(filePath));
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
}

function equalsBytes(left: Uint8Array, right: Uint8Array): boolean {
    if (left.length !== right.length) {
        return false;
    }

    for (let i = 0; i < left.length; i++) {
        if (left[i] !== right[i]) {
            return false;
        }
    }

    return true;
}

export function writeFileIfChanged(filePath: string, data: string | Uint8Array, encoding: BufferEncoding = 'utf8'): boolean {
    if (typeof data === 'string') {
        if (fileExists(filePath) && readTextFile(filePath, encoding) === data) {
            return false;
        }

        ensureParentDir(filePath);
        fs.writeFileSync(filePath, data, encoding);
        textCache.set(`${encoding}:${filePath}`, data);
        binaryCache.delete(filePath);
        existsCache.set(filePath, true);
        statsCache.delete(filePath);
        return true;
    }

    if (fileExists(filePath) && equalsBytes(readBinaryFile(filePath), data)) {
        return false;
    }

    ensureParentDir(filePath);
    const next = Buffer.from(data);
    fs.writeFileSync(filePath, next);
    binaryCache.set(filePath, next);
    textCache.delete(`utf8:${filePath}`);
    textCache.delete(`ascii:${filePath}`);
    existsCache.set(filePath, true);
    statsCache.delete(filePath);
    return true;
}

export function didFileSetChange(stampPath: string, files: readonly string[]): boolean {
    const state = files.map(file => `${file}=${fileExists(file) ? stableMtimeMs(fileStats(file).mtimeMs) : 0}`).join('\n');

    if (fileExists(stampPath) && readTextFile(stampPath) === state) {
        return false;
    }

    writeFileIfChanged(stampPath, state);
    return true;
}
