import fs from 'fs';

import FileStream from '#/io/FileStream.js';
import Jagfile from '#/io/Jagfile.js';
import Packet from '#/io/Packet.js';
import Environment from '#/util/Environment.js';
import { packInterface } from '#tools/pack/interface/PackShared.js';
import { shouldBuild, shouldBuildFile, shouldBuildFileAny } from '#tools/pack/PackFile.js';

export function shouldRebuildInterfacePack(): boolean {
    return (
        shouldBuild(`${Environment.BUILD_SRC_DIR}/scripts`, '.constant', 'data/pack/client/interface') ||
        shouldBuild(`${Environment.BUILD_SRC_DIR}/scripts`, '.if', 'data/pack/client/interface') ||
        shouldBuildFile(`${Environment.BUILD_SRC_DIR}/pack/interface.pack`, 'data/pack/client/interface') ||
        shouldBuildFile(`${Environment.BUILD_SRC_DIR}/pack/obj.pack`, 'data/pack/client/interface') ||
        shouldBuildFile(`${Environment.BUILD_SRC_DIR}/pack/varp.pack`, 'data/pack/client/interface') ||
        shouldBuildFile(`${Environment.BUILD_SRC_DIR}/pack/varbit.pack`, 'data/pack/client/interface') ||
        shouldBuildFile(`${Environment.BUILD_SRC_DIR}/pack/seq.pack`, 'data/pack/client/interface') ||
        shouldBuildFile(`${Environment.BUILD_SRC_DIR}/pack/model.pack`, 'data/pack/client/interface') ||
        shouldBuildFileAny('tools/pack/interface', 'data/pack/client/interface') ||
        shouldBuildFile('tools/pack/Parse.ts', 'data/pack/client/interface')
    );
}

export function packClientInterface(cache: FileStream, modelFlags: number[]): boolean {
    const rebuild = shouldRebuildInterfacePack();

    if (!rebuild && fs.existsSync('data/pack/client/interface')) {
        cache.write(0, 3, fs.readFileSync('data/pack/client/interface'));
        return false;
    }

    const jag = Jagfile.new(true);
    const { client, server } = packInterface(modelFlags);

    try {
        if (Environment.BUILD_VERIFY && !Packet.checkcrc(client.data, 0, client.pos, -2036455518)) {
            throw new Error('.if checksum mismatch!\nYou can disable this safety check by setting BUILD_VERIFY=false');
        }

        jag.write('data', client);
        jag.save('data/pack/client/interface');

        server.save('data/pack/server/interface.dat');
    } finally {
        client.release();
        server.release();
    }

    cache.write(0, 3, fs.readFileSync('data/pack/client/interface'));
    return true;
}
