import fs from 'fs';
import path from 'path';

import FileStream from '#/io/FileStream.js';
import Packet from '#/io/Packet.js';
import Jagfile from '#/io/Jagfile.js';
import { listFilesExt } from '#tools/pack/Parse.js';
import Environment from '#/util/Environment.js';
import { loadOrder } from '#tools/pack/NameMap.js';
import { SynthPack } from '#tools/pack/PackFile.js';
import { printWarning } from '#/util/Logger.js';

class SoundEnvelopeValidator {
    static unpack(buf: Packet) {
        buf.g1();
        buf.g4s();
        buf.g4s();
        this.unpackShape(buf);
    }

    static unpackShape(buf: Packet) {
        const length = buf.g1();
        for (let i = 0; i < length; i++) {
            buf.g2();
            buf.g2();
        }
    }
}

class SoundFilterValidator {
    static unpack(buf: Packet) {
        const count = buf.g1();
        const pairs0 = count >> 4;
        const pairs1 = count & 0xF;

        if (count === 0) {
            return;
        }

        const unity0 = buf.g2();
        const unity1 = buf.g2();
        const migration = buf.g1();

        for (const pairs of [pairs0, pairs1]) {
            for (let pair = 0; pair < pairs; pair++) {
                buf.g2();
                buf.g2();
            }
        }

        for (let direction = 0; direction < 2; direction++) {
            const pairs = direction === 0 ? pairs0 : pairs1;
            for (let pair = 0; pair < pairs; pair++) {
                if ((migration & (1 << (direction * 4) << pair)) !== 0) {
                    buf.g2();
                    buf.g2();
                }
            }
        }

        if (migration !== 0 || unity1 !== unity0) {
            SoundEnvelopeValidator.unpackShape(buf);
        }
    }
}

class SoundToneValidator {
    static unpack(buf: Packet) {
        SoundEnvelopeValidator.unpack(buf);
        SoundEnvelopeValidator.unpack(buf);

        if (buf.g1() !== 0) {
            buf.pos--;
            SoundEnvelopeValidator.unpack(buf);
            SoundEnvelopeValidator.unpack(buf);
        }

        if (buf.g1() !== 0) {
            buf.pos--;
            SoundEnvelopeValidator.unpack(buf);
            SoundEnvelopeValidator.unpack(buf);
        }

        if (buf.g1() !== 0) {
            buf.pos--;
            SoundEnvelopeValidator.unpack(buf);
            SoundEnvelopeValidator.unpack(buf);
        }

        for (let harmonic = 0; harmonic < 10; harmonic++) {
            const volume = buf.gsmarts();
            if (volume === 0) {
                break;
            }

            buf.gsmart();
            buf.gsmarts();
        }

        buf.gsmarts();
        buf.gsmarts();
        buf.g2();
        buf.g2();
        SoundFilterValidator.unpack(buf);
    }
}

function validateSynth(data: Uint8Array): boolean {
    const buf = new Packet(data);
    try {
        for (let tone = 0; tone < 10; tone++) {
            if (buf.g1() !== 0) {
                buf.pos--;
                SoundToneValidator.unpack(buf);
            }
        }

        buf.g2();
        buf.g2();
        return buf.pos === buf.length;
    } catch {
        return false;
    }
}

export function packClientSound(cache: FileStream) {
    const order = loadOrder(`${Environment.BUILD_SRC_DIR}/pack/synth.order`);
    const files = listFilesExt(`${Environment.BUILD_SRC_DIR}/synth`, '.synth');

    const nameToFile = new Map();
    for (const file of files) {
        const name = path.basename(file, path.extname(file));
        const id = SynthPack.getByName(name);
        if (id === -1) {
            continue;
        }

        nameToFile.set(name, file);
    }

    const jag = Jagfile.new();

    const out = Packet.alloc(5);
    for (const id of order) {
        const name = SynthPack.getById(id);
        if (!name) {
            continue;
        }

        const file = nameToFile.get(name);
        if (!file) {
            continue;
        }

        const data = fs.readFileSync(file);
        if (!validateSynth(data)) {
            printWarning(`Skipping malformed synth ${id}=${name} (${file})`);
            continue;
        }

        out.p2(id);
        out.pdata(data, 0, data.length);
    }
    out.p2(-1);

    if (Environment.BUILD_VERIFY && !Packet.checkcrc(out.data, 0, out.pos, -1959875449)) {
        throw new Error('.synth checksum mismatch!\nYou can disable this safety check by setting BUILD_VERIFY=false');
    }

    jag.write('sounds.dat', out);
    jag.save('data/pack/client/sounds');
    out.release();

    cache.write(0, 8, fs.readFileSync('data/pack/client/sounds'));
}
