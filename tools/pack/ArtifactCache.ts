import { unzipSync, zipSync } from 'fflate';

import { fileExists, fileStats, readBinaryFile, readTextFile, stableMtimeMs, writeFileIfChanged } from '#tools/pack/FsCache.js';

export type ArtifactManifest = Record<string, string>;

function artifactPath(name: string, suffix: string): string {
    return `data/pack/.cache/${name}${suffix}`;
}

function equalsData(left: Uint8Array, right: Uint8Array): boolean {
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

function parseArtifactManifest(json: string): ArtifactManifest {
    const parsed: unknown = JSON.parse(json);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        return {};
    }

    const manifest: ArtifactManifest = {};
    for (const [key, value] of Object.entries(parsed)) {
        if (typeof value === 'string') {
            manifest[key] = value;
        }
    }

    return manifest;
}

export class ArtifactStore {
    private entries: Record<string, Uint8Array> = {};
    private dirty = false;
    private readonly zipPath: string;

    constructor(name: string, recreate = false) {
        this.zipPath = artifactPath(name, '.zip');

        if (!recreate && fileExists(this.zipPath)) {
            this.entries = unzipSync(readBinaryFile(this.zipPath));
        }
    }

    has(key: string): boolean {
        return typeof this.entries[key] !== 'undefined';
    }

    read(key: string): Uint8Array | null {
        return this.entries[key] ?? null;
    }

    write(key: string, data: Uint8Array): boolean {
        const next = new Uint8Array(data);
        const current = this.entries[key];
        if (current && equalsData(current, next)) {
            return false;
        }

        this.entries[key] = next;
        this.dirty = true;
        return true;
    }

    save(): boolean {
        if (!this.dirty && fileExists(this.zipPath)) {
            return false;
        }

        writeFileIfChanged(this.zipPath, zipSync(this.entries, { level: 0 }));
        this.dirty = false;
        return true;
    }
}

export function getArtifactManifestPath(name: string): string {
    return artifactPath(name, '.manifest.json');
}

export function openArtifactStore(name: string, recreate = false): ArtifactStore {
    return new ArtifactStore(name, recreate);
}

export function loadArtifactManifest(name: string, recreate = false): ArtifactManifest {
    if (recreate) {
        return {};
    }

    const manifestPath = getArtifactManifestPath(name);
    if (!fileExists(manifestPath)) {
        return {};
    }

    try {
        return parseArtifactManifest(readTextFile(manifestPath));
    } catch (err) {
        if (err instanceof SyntaxError) {
            return {};
        }
        throw err;
    }
}

export function saveArtifactManifest(name: string, manifest: ArtifactManifest): void {
    writeFileIfChanged(getArtifactManifestPath(name), JSON.stringify(manifest));
}

export function getArtifactSourceStamp(filePath: string): string {
    if (!fileExists(filePath)) {
        return '0';
    }

    const stats = fileStats(filePath);
    return `${stats.size}:${stableMtimeMs(stats.mtimeMs)}`;
}
