import fs from 'fs';
import path from 'path';

import { compressGz } from '#/io/GZip.js';
import Environment from '#/util/Environment.js';
import FileStream from '#/io/FileStream.js';
import { getArtifactManifestPath, getArtifactSourceStamp, loadArtifactManifest, openArtifactStore, saveArtifactManifest } from '#tools/pack/ArtifactCache.js';
import { didFileSetChange } from '#tools/pack/FsCache.js';
import { listFilesExt } from '#tools/pack/Parse.js';
import { AnimSetPack, ModelPack, shouldBuild, shouldBuildFile } from '#tools/pack/PackFile.js';
import { printWarning } from '#/util/Logger.js';

type UnresolvedGraphicAsset = {
    readonly kind: 'model' | 'anim';
    readonly name: string;
    readonly path: string;
    readonly reason: string;
};

function writeUnresolvedGraphicAssetReport(assets: readonly UnresolvedGraphicAsset[]): void {
    fs.mkdirSync('reports/revision-migration', { recursive: true });
    fs.writeFileSync(
        'reports/revision-migration/unresolved-graphics-assets.json',
        `${JSON.stringify(
            {
                generatedAt: new Date().toISOString(),
                revision: Environment.ENGINE_REVISION,
                policy: 'Loose graphics files that are not named in the resolved packs are preserved on disk but not packed.',
                count: assets.length,
                assets
            },
            null,
            2
        )}\n`
    );
}

function shouldSkipUnresolvedGraphic(id: number): boolean {
    return id < 0;
}

function compressAsset(kind: 'model' | 'anim', name: string, data: Uint8Array): Uint8Array {
    if (!data.length) {
        return new Uint8Array();
    }

    const compressed = compressGz(data);
    if (compressed === null) {
        throw new Error(`Failed to compress ${kind} ${name}`);
    }

    return compressed;
}

function writeVerified(cache: FileStream, archive: number, id: number, data: Uint8Array) {
    for (let attempt = 0; attempt < 3; attempt++) {
        cache.write(archive, id, data, 1);

        const raw = cache.read(archive, id, false);
        if (!raw || raw.length !== data.length + 2) {
            continue;
        }

        let matches = true;
        for (let i = 0; i < data.length; i++) {
            if (raw[i] !== data[i]) {
                matches = false;
                break;
            }
        }

        if (matches) {
            return;
        }
    }

    throw new Error(`Failed to write verified cache entry archive=${archive} id=${id}`);
}

export function packClientGraphics(cache: FileStream, modelFlags: number[]) {
    const unresolved: UnresolvedGraphicAsset[] = [];
    const models = listFilesExt(`${Environment.BUILD_SRC_DIR}/models`, '.ob2');
    const toolChanged = didFileSetChange('data/pack/.stamps/graphics-tools.txt', [import.meta.filename]);
    const rebuildModelsArchive = shouldBuildFile(`${Environment.BUILD_SRC_DIR}/pack/model.pack`, 'data/pack/main_file_cache.idx1');
    const needsModelHydration = rebuildModelsArchive || cache.count(1) === 0;
    const needsModelPackWork = rebuildModelsArchive || shouldBuild(`${Environment.BUILD_SRC_DIR}/models`, '.ob2', getArtifactManifestPath('graphics-models')) || toolChanged;
    const modelStore = openArtifactStore('graphics-models', rebuildModelsArchive);
    const modelManifest = loadArtifactManifest('graphics-models', rebuildModelsArchive);
    let modelManifestDirty = false;

    if (rebuildModelsArchive) {
        cache.clearArchive(1);
    }

    const anims = listFilesExt(`${Environment.BUILD_SRC_DIR}/models`, '.anim');
    const rebuildAnimsArchive = shouldBuildFile(`${Environment.BUILD_SRC_DIR}/pack/animset.pack`, 'data/pack/main_file_cache.idx2');
    const needsAnimHydration = rebuildAnimsArchive || cache.count(2) === 0;
    const needsAnimPackWork = rebuildAnimsArchive || shouldBuild(`${Environment.BUILD_SRC_DIR}/models`, '.anim', getArtifactManifestPath('graphics-anims')) || toolChanged;
    const animStore = openArtifactStore('graphics-anims', rebuildAnimsArchive);
    const animManifest = loadArtifactManifest('graphics-anims', rebuildAnimsArchive);
    let animManifestDirty = false;

    if (rebuildAnimsArchive) {
        cache.clearArchive(2);
    }

    if (!needsModelPackWork && !needsModelHydration && !needsAnimPackWork && !needsAnimHydration) {
        writeUnresolvedGraphicAssetReport(unresolved);
        return;
    }

    for (const file of models) {
        const basename = path.basename(file);
        const name = basename.substring(0, basename.lastIndexOf('.'));
        const id = ModelPack.getByName(name);
        if (shouldSkipUnresolvedGraphic(id)) {
            unresolved.push({
                kind: 'model',
                name,
                path: file.replaceAll('\\', '/'),
                reason: 'Model file is not mapped to a resolved model.pack entry.'
            });
            continue;
        }

        const sourceStamp = getArtifactSourceStamp(file);
        const needsRebuild = needsModelPackWork && (toolChanged || modelManifest[name] !== sourceStamp || !modelStore.has(name));
        let packedData: Uint8Array | null = null;

        if (needsRebuild) {
            packedData = compressAsset('model', name, fs.readFileSync(file));
            modelStore.write(name, packedData);
            modelManifest[name] = sourceStamp;
            modelManifestDirty = true;
        }

        if (needsRebuild || needsModelHydration) {
            packedData ??= modelStore.read(name);
            if (packedData !== null) {
                writeVerified(cache, 1, id, packedData);
            } else {
                packedData = compressAsset('model', name, fs.readFileSync(file));
                modelStore.write(name, packedData);
                modelManifest[name] = sourceStamp;
                modelManifestDirty = true;
                writeVerified(cache, 1, id, packedData);
            }
        }
    }

    for (let id = 0; id < ModelPack.max; id++) {
        if (!cache.has(1, id)) {
            if (modelFlags[id] > 0) {
                printWarning(`missing model ${ModelPack.getById(id)} (${id})`);
            } else {
                // printDebug(`missing model ${ModelPack.getById(id)} (${id})`);
            }
        }
    }

    for (const file of anims) {
        const basename = path.basename(file);
        const name = basename.substring(0, basename.lastIndexOf('.'));
        const id = AnimSetPack.getByName(name);
        if (shouldSkipUnresolvedGraphic(id)) {
            unresolved.push({
                kind: 'anim',
                name,
                path: file.replaceAll('\\', '/'),
                reason: 'Animation file is not mapped to a resolved anim.pack entry.'
            });
            continue;
        }

        const sourceStamp = getArtifactSourceStamp(file);
        const needsRebuild = needsAnimPackWork && (toolChanged || animManifest[name] !== sourceStamp || !animStore.has(name));
        let packedData: Uint8Array | null = null;

        if (needsRebuild) {
            packedData = compressAsset('anim', name, fs.readFileSync(file));
            animStore.write(name, packedData);
            animManifest[name] = sourceStamp;
            animManifestDirty = true;
        }

        if (needsRebuild || needsAnimHydration) {
            packedData ??= animStore.read(name);
            if (packedData !== null) {
                writeVerified(cache, 2, id, packedData);
            } else {
                packedData = compressAsset('anim', name, fs.readFileSync(file));
                animStore.write(name, packedData);
                animManifest[name] = sourceStamp;
                animManifestDirty = true;
                writeVerified(cache, 2, id, packedData);
            }
        }
    }

    if (modelManifestDirty) {
        saveArtifactManifest('graphics-models', modelManifest);
    }
    modelStore.save();

    if (animManifestDirty) {
        saveArtifactManifest('graphics-anims', animManifest);
    }
    animStore.save();

    writeUnresolvedGraphicAssetReport(unresolved);
}
