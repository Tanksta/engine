import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { basename, join, relative } from 'node:path';

export type NamingSource = 'existing-content-name' | 'server-reference-name' | 'generated-cache-name';
export type Confidence = 'high' | 'medium';

export type PathCandidate = {
    confidence: Confidence;
    namingSource: NamingSource;
    relativePath: string;
};

export type PathIndex = {
    byHash: ReadonlyMap<string, readonly PathCandidate[]>;
    byName: ReadonlyMap<string, readonly PathCandidate[]>;
};

export type TargetPathChoice = {
    confidence: Confidence;
    namingSource: NamingSource;
    relativePath: string;
};

export type TargetPathRequest = {
    extension: string;
    fallbackDirectory: string;
    index: PathIndex;
    name: string;
    sourceHash: string;
};

const NAMING_SOURCE_RANK: Record<NamingSource, number> = {
    'existing-content-name': 0,
    'server-reference-name': 1,
    'generated-cache-name': 2
};
const ILLEGAL_FILENAME_CHARS = new Set(['<', '>', ':', '"', '/', '\\', '|', '?', '*']);

function sha256(bytes: Buffer): string {
    return createHash('sha256').update(bytes).digest('hex');
}

function toPortablePath(path: string): string {
    return path.replaceAll('\\', '/');
}

function isGeneratedRevisionPath(path: string): boolean {
    return toPortablePath(path).split('/').includes('_revision');
}

function pathCandidateRank(candidate: PathCandidate): number {
    const generatedPathPenalty = isGeneratedRevisionPath(candidate.relativePath) ? 10 : 0;
    return NAMING_SOURCE_RANK[candidate.namingSource] + generatedPathPenalty;
}

function comparePathCandidates(left: PathCandidate, right: PathCandidate): number {
    return pathCandidateRank(left) - pathCandidateRank(right) || left.relativePath.length - right.relativePath.length || left.relativePath.localeCompare(right.relativePath);
}

function walkFiles(root: string, extension: string, prefix = ''): string[] {
    const files: string[] = [];

    for (const entry of readdirSync(join(root, prefix), { withFileTypes: true })) {
        const relativePath = prefix.length === 0 ? entry.name : join(prefix, entry.name);
        const fullPath = join(root, relativePath);

        if (entry.isDirectory()) {
            files.push(...walkFiles(root, extension, relativePath));
        } else if (entry.isFile() && relativePath.endsWith(extension)) {
            files.push(toPortablePath(relative(root, fullPath)));
        } else if (!entry.isDirectory() && !entry.isFile()) {
            const stats = statSync(fullPath);
            if (stats.isFile() && relativePath.endsWith(extension)) {
                files.push(toPortablePath(relative(root, fullPath)));
            }
        }
    }

    return files;
}

export function indexFilesByBasename(root: string, extension: string, namingSource: NamingSource = 'existing-content-name', confidence: Confidence = 'high'): PathIndex {
    const byHash = new Map<string, PathCandidate[]>();
    const byName = new Map<string, PathCandidate[]>();

    for (const path of walkFiles(root, extension)) {
        const key = basename(path, extension);
        const candidate = {
            confidence,
            namingSource,
            relativePath: path
        };

        const nameBucket = byName.get(key);
        if (nameBucket) {
            nameBucket.push(candidate);
        } else {
            byName.set(key, [candidate]);
        }

        const hash = sha256(readFileSync(join(root, path)));
        const hashBucket = byHash.get(hash);
        if (hashBucket) {
            hashBucket.push(candidate);
        } else {
            byHash.set(hash, [candidate]);
        }
    }

    for (const bucket of [...byHash.values(), ...byName.values()]) {
        bucket.sort(comparePathCandidates);
    }

    return { byHash, byName };
}

function mergeBucket(index: Map<string, PathCandidate[]>, key: string, candidates: readonly PathCandidate[]): void {
    const bucket = index.get(key);
    if (bucket) {
        bucket.push(...candidates);
    } else {
        index.set(key, [...candidates]);
    }
}

export function mergePathIndexes(...indexes: readonly PathIndex[]): PathIndex {
    const byHash = new Map<string, PathCandidate[]>();
    const byName = new Map<string, PathCandidate[]>();
    for (const index of indexes) {
        for (const [key, candidates] of index.byHash) {
            mergeBucket(byHash, key, candidates);
        }
        for (const [key, candidates] of index.byName) {
            mergeBucket(byName, key, candidates);
        }
    }

    for (const bucket of [...byHash.values(), ...byName.values()]) {
        bucket.sort(comparePathCandidates);
    }

    return { byHash, byName };
}

export function safeFileStem(name: string): string {
    const replaced = Array.from(name, char => {
        const code = char.charCodeAt(0);
        return code <= 0x1f || ILLEGAL_FILENAME_CHARS.has(char) ? '_' : char;
    }).join('').trim();
    return replaced.length === 0 ? 'unnamed' : replaced;
}

export function chooseTargetPath(request: TargetPathRequest): TargetPathChoice {
    const stem = safeFileStem(request.name);
    const identicalBytes = request.index.byHash.get(request.sourceHash);

    if (identicalBytes && identicalBytes.length > 0) {
        const choice = identicalBytes[0];
        return {
            confidence: choice.confidence,
            namingSource: choice.namingSource,
            relativePath: choice.relativePath
        };
    }

    const namedPath = request.index.byName.get(stem);

    if (namedPath && namedPath.length > 0) {
        const choice = namedPath[0];
        return {
            confidence: choice.confidence,
            namingSource: choice.namingSource,
            relativePath: choice.relativePath
        };
    }

    return {
        confidence: 'medium',
        namingSource: 'generated-cache-name',
        relativePath: toPortablePath(join(request.fallbackDirectory, `${stem}${request.extension}`))
    };
}
