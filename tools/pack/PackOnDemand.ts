import fs from 'node:fs';
import { join } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { zipSync } from 'fflate';

import FileStream from '#/io/FileStream.js';

export function packOnDemand(directory: string): void {
    const cache = new FileStream(directory, false, true);
    try {
        const entries: Record<string, Uint8Array> = {};
        for (let archive = 1; archive <= 4; archive++) {
            for (let file = 0; file < cache.count(archive); file++) {
                const index = cache.idx[archive];
                index.pos = file * 6;
                const header = index.gPacket(6);
                const size = header.g3();
                const sector = header.g3();
                if (size === 0 && sector === 0) {
                    continue;
                }
                const data = cache.read(archive, file);
                if (!data || data.length <= 2 || data[0] !== 0x1f || data[1] !== 0x8b) {
                    throw new Error(`Invalid on-demand cache entry archive=${archive} file=${file}`);
                }
                try {
                    gunzipSync(data.subarray(0, -2));
                } catch (error) {
                    throw new Error(`Invalid on-demand cache entry archive=${archive} file=${file}`, { cause: error });
                }
                entries[`${archive}.${file}`] = data;
            }
        }
        fs.writeFileSync(join(directory, 'ondemand.zip'), zipSync(entries, { level: 0 }));
    } finally {
        cache.close();
    }
}
