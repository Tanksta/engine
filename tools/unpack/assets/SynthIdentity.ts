import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';

import type { PathCandidate, PathIndex } from './TargetPaths.js';

export type ByteAction = 'unchanged-cache-byte' | 'wrote-cache-byte';

export type TargetRoot = {
    readonly root: string;
    readonly label: string;
    readonly index: PathIndex;
};

export type AssetLedgerRow = {
    readonly action: ByteAction;
    readonly assetId: number;
    readonly assetKind: string;
    readonly byteSource: string;
    readonly chosenName: string;
    readonly confidence: string;
    readonly namingSource: string;
    readonly previousHash: string;
    readonly sourceHash: string;
    readonly sourcePath: string;
    readonly targetPath: string;
    readonly targetRoot: string;
};

function sha256(bytes: Buffer): string {
    return createHash('sha256').update(bytes).digest('hex');
}

function readBufferIfExists(path: string): Buffer | null {
    if (!existsSync(path)) {
        return null;
    }

    return readFileSync(path);
}

function writeBufferIfChanged(path: string, bytes: Buffer): ByteAction {
    const existing = readBufferIfExists(path);
    if (existing && existing.equals(bytes)) {
        return 'unchanged-cache-byte';
    }

    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, bytes);
    return 'wrote-cache-byte';
}

export type SynthRecord = {
    readonly nativeId: number;
    readonly data: Buffer;
    readonly sourcePath: string;
};

export class SynthIdentityError extends Error {
    constructor(
        readonly nativeId: number,
        reason: string
    ) {
        super(`Synth ${nativeId}: ${reason}; a verified byte-to-name match is required, not a logical pack ID`);
        this.name = 'SynthIdentityError';
    }
}

export function copyMatchedSynths(records: readonly SynthRecord[], targets: readonly TargetRoot[], byteSource: string): AssetLedgerRow[] {
    const destinations = new Map<string, string>();
    // Resolve and check the entire batch before any destination can be written.
    const plans = records.flatMap(record =>
        targets.flatMap(target => {
            const sourceHash = sha256(record.data);
            const matches = target.index.byHash.get(sourceHash) ?? [];
            if (matches.length === 0) {
                throw new SynthIdentityError(record.nativeId, 'no byte match');
            }

            const choices = new Map<string, PathCandidate>();
            for (const match of matches) {
                const name = basename(match.relativePath, '.synth');
                if (!choices.has(name)) {
                    choices.set(name, match);
                }
            }

            return Array.from(choices, ([chosenName, choice]) => {
                const targetPath = join(target.root, choice.relativePath);
                const previous = readBufferIfExists(targetPath);
                for (const candidate of target.index.byName.get(chosenName) ?? []) {
                    const existing = readBufferIfExists(join(target.root, candidate.relativePath));
                    if (existing && !existing.equals(record.data)) {
                        throw new SynthIdentityError(record.nativeId, `conflicting named destination ${candidate.relativePath}`);
                    }
                }
                const nameKey = join(target.root, chosenName);
                const plannedHash = destinations.get(nameKey);
                if ((previous && !previous.equals(record.data)) || (plannedHash && plannedHash !== sourceHash)) {
                    throw new SynthIdentityError(record.nativeId, `conflicting destination ${targetPath}`);
                }
                destinations.set(nameKey, sourceHash);

                return { record, target, choice, chosenName, targetPath, previous, sourceHash };
            });
        })
    );

    return plans.map(({ record, target, choice, chosenName, targetPath, previous, sourceHash }) => ({
        action: writeBufferIfChanged(targetPath, record.data),
        assetId: record.nativeId,
        assetKind: 'synth',
        byteSource,
        chosenName,
        confidence: choice.confidence,
        namingSource: choice.namingSource,
        previousHash: previous ? sha256(previous) : '',
        sourceHash,
        sourcePath: record.sourcePath,
        targetPath,
        targetRoot: target.label
    }));
}
