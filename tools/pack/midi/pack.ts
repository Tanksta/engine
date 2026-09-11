import fs from 'fs';
import path from 'path';

import { compressGz } from '#/io/GZip.js';
import Environment from '#/util/Environment.js';
import FileStream from '#/io/FileStream.js';
import { getArtifactManifestPath, getArtifactSourceStamp, loadArtifactManifest, openArtifactStore, saveArtifactManifest } from '#tools/pack/ArtifactCache.js';
import { didFileSetChange } from '#tools/pack/FsCache.js';
import { MidiPack, shouldBuild, shouldBuildFile } from '#tools/pack/PackFile.js';
import { listFilesExt } from '#tools/pack/Parse.js';

function writeSkippedMidiReport(names: readonly string[]): void {
    if (names.length === 0) {
        return;
    }

    fs.mkdirSync('reports/revision-migration', { recursive: true });
    fs.writeFileSync(
        'reports/revision-migration/midi-leftover-assets.json',
        `${JSON.stringify(
            {
                generatedAt: new Date().toISOString(),
                revision: Environment.ENGINE_REVISION,
                count: names.length,
                names
            },
            null,
            2
        )}\n`
    );
}

function compressMidi(name: string, data: Uint8Array): Uint8Array {
    if (!data.length) {
        return new Uint8Array();
    }

    const compressed = compressGz(data);
    if (compressed === null) {
        throw new Error(`Failed to compress midi ${name}`);
    }

    return compressed;
}

export function packClientMidi(cache: FileStream) {
    const midis = [...listFilesExt(`${Environment.BUILD_SRC_DIR}/jingles`, '.mid'), ...listFilesExt(`${Environment.BUILD_SRC_DIR}/songs`, '.mid')];
    const skipped: string[] = [];
    const artifactName = 'midi';
    const toolChanged = didFileSetChange('data/pack/.stamps/midi-tools.txt', [import.meta.filename]);
    const rebuildMidiArchive = shouldBuildFile(`${Environment.BUILD_SRC_DIR}/pack/midi.pack`, 'data/pack/main_file_cache.idx3');
    const needsMidiHydration = rebuildMidiArchive || cache.count(3) === 0;
    const needsMidiPackWork =
        rebuildMidiArchive ||
        shouldBuild(`${Environment.BUILD_SRC_DIR}/jingles`, '.mid', getArtifactManifestPath(artifactName)) ||
        shouldBuild(`${Environment.BUILD_SRC_DIR}/songs`, '.mid', getArtifactManifestPath(artifactName)) ||
        toolChanged;
    const artifactStore = openArtifactStore(artifactName, rebuildMidiArchive);
    const artifactManifest = loadArtifactManifest(artifactName, rebuildMidiArchive);
    let artifactManifestDirty = false;

    if (rebuildMidiArchive) {
        cache.clearArchive(3);
    }

    if (!needsMidiPackWork && !needsMidiHydration) {
        writeSkippedMidiReport(skipped);
        return;
    }

    for (const file of midis) {
        const basename = path.basename(file);
        const name = basename.substring(0, basename.lastIndexOf('.'));
        const id = MidiPack.getByName(name);
        if (id === -1) {
            skipped.push(file);
            continue;
        }

        const sourceStamp = getArtifactSourceStamp(file);
        const needsRebuild = needsMidiPackWork && (toolChanged || artifactManifest[name] !== sourceStamp || !artifactStore.has(name));
        let packedData: Uint8Array | null = null;

        if (needsRebuild) {
            packedData = compressMidi(name, fs.readFileSync(file));
            artifactStore.write(name, packedData);
            artifactManifest[name] = sourceStamp;
            artifactManifestDirty = true;
        }

        if (needsRebuild || needsMidiHydration) {
            packedData ??= artifactStore.read(name);
            if (packedData !== null) {
                cache.write(3, id, packedData, 1);
            } else {
                packedData = compressMidi(name, fs.readFileSync(file));
                artifactStore.write(name, packedData);
                artifactManifest[name] = sourceStamp;
                artifactManifestDirty = true;
                cache.write(3, id, packedData, 1);
            }
        }
    }

    if (artifactManifestDirty) {
        saveArtifactManifest(artifactName, artifactManifest);
    }
    artifactStore.save();

    writeSkippedMidiReport(skipped);
}
