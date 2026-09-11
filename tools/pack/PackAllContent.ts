import fs from 'fs';
import { parentPort } from 'worker_threads';

import FileStream from '#/io/FileStream.js';
import Packet from '#/io/Packet.js';
import Environment from '#/util/Environment.js';

import { ModelPack, revalidatePack } from '#tools/pack/PackFile.js';
import { removeGeneratedContentPackIntermediates } from '#tools/pack/ContentPackFiles.js';
import { packClientWordenc } from '#tools/pack/chat/pack.js';
import { packConfigs } from '#tools/pack/config/PackShared.js';
import { packClientGraphics } from '#tools/pack/graphics/pack.js';
import { packClientInterface } from '#tools/pack/interface/PackClient.js';
import { packMaps } from '#tools/pack/map/Pack.js';
import { packClientMidi } from '#tools/pack/midi/pack.js';
import { packClientSound } from '#tools/pack/sound/pack.js';
import { packClientMedia } from '#tools/pack/sprite/media.js';
import { packClientTexture } from '#tools/pack/sprite/textures.js';
import { packClientTitle } from '#tools/pack/sprite/title.js';
import { runServerCompiler } from '#tools/pack/Compiler.js';
import { packClientVersionList } from '#tools/pack/versionlist/pack.js';
import { clearFsCache } from '#tools/pack/FsCache.js';
import { stampServerScriptCompilerVersion } from '#tools/pack/ScriptPackVersion.js';
import { packOnDemand } from '#tools/pack/PackOnDemand.js';

// Import and call only while holding the pack lock; pack ledgers initialize on import.
export async function packAllContent(modelFlags: number[]) {
    fs.rmSync('data/pack/server/build', { force: true });
    if (parentPort) {
        parentPort.postMessage({
            type: 'dev_progress',
            broadcast: 'Packing changes'
        });
    }

    clearFsCache();
    revalidatePack();

    for (let i = 0; i < ModelPack.max; i++) {
        modelFlags[i] = 0;
    }

    // todo: better build conditions to do minimal rebuilds and only build a new client cache if necessary
    const cache = new FileStream('data/pack', true);

    try {
        await packConfigs(cache, modelFlags);
        packClientInterface(cache, modelFlags);

        // relies on reading configs/interfaces for compile-time context
        runServerCompiler();
        stampServerScriptCompilerVersion();

        await packClientTitle(cache);
        await packClientMedia(cache);
        await packClientTexture(cache);
        packClientWordenc(cache);
        packClientSound(cache);

        packClientGraphics(cache, modelFlags);

        packClientMidi(cache);

        packMaps(cache, modelFlags);

        packClientVersionList(cache, modelFlags); // relies on additional flags set during packMaps

        packOnDemand('data/pack');
        removeGeneratedContentPackIntermediates(`${Environment.BUILD_SRC_DIR}/pack`);

        const build = Packet.alloc(0);
        build.p4(Date.now() / 1000);
        build.save('data/pack/server/build');
    } finally {
        cache.close();
    }

    if (parentPort) {
        parentPort.postMessage({
            type: 'dev_progress',
            text: 'Reloading with changes'
        });
    }
}
