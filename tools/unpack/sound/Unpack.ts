import { join } from 'node:path';

import Jagfile from '#/io/Jagfile.js';
import Packet from '#/io/Packet.js';
import Environment from '#/util/Environment.js';
import FileStream from '#/io/FileStream.js';
import { copyMatchedSynths, SynthIdentityError, type SynthRecord } from '#tools/unpack/assets/SynthIdentity.js';
import { indexFilesByBasename } from '#tools/unpack/assets/TargetPaths.js';

export class Wave {
    static unpack(buf: Packet, contentRoot: string = Environment.BUILD_SRC_DIR) {
        const records: SynthRecord[] = [];
        const ids = new Set<number>();
        let terminated = false;
        while (buf.available > 0) {
            const id = buf.g2();
            if (id === 65535) {
                terminated = true;
                break;
            }
            if (ids.has(id)) {
                throw new SynthIdentityError(id, 'duplicate native ID');
            }
            ids.add(id);

            const start = buf.pos;
            new Wave().unpack(buf);
            const end = buf.pos;
            records.push({ nativeId: id, data: Buffer.from(buf.data.subarray(start, end)), sourcePath: `sounds.dat#${id}` });
        }
        if (!terminated || buf.available !== 0) {
            throw new Error('Invalid sounds.dat terminator');
        }
        const root = join(contentRoot, 'synth');
        return copyMatchedSynths(records, [{ root, label: 'content', index: indexFilesByBasename(root, '.synth') }], 'unpacked sounds.dat');
    }

    tones: Tone[] = [];
    loopBegin = 0;
    loopEnd = 0;

    unpack(buf: Packet) {
        for (let tone = 0; tone < 10; tone++) {
            if (buf.g1() != 0) {
                buf.pos--;

                this.tones[tone] = new Tone();
                this.tones[tone].unpack(buf);
            }
        }

        this.loopBegin = buf.g2();
        this.loopEnd = buf.g2();
    }
}

class Tone {
    frequencyBase: Envelope | null = null;
    amplitudeBase: Envelope | null = null;
    frequencyModRate: Envelope | null = null;
    frequencyModRange: Envelope | null = null;
    amplitudeModRate: Envelope | null = null;
    amplitudeModRange: Envelope | null = null;
    release: Envelope | null = null;
    attack: Envelope | null = null;
    harmonicVolume: number[] = [];
    harmonicSemitone: number[] = [];
    harmonicDelay: number[] = [];
    reverbDelay = 0;
    reverbVolume = 0;
    length = 0;
    start = 0;
    filter: Filter | null = null;
    filterRange: Envelope | null = null;

    unpack(buf: Packet) {
        this.frequencyBase = new Envelope();
        this.frequencyBase.unpack(buf);

        this.amplitudeBase = new Envelope();
        this.amplitudeBase.unpack(buf);

        if (buf.g1() != 0) {
            buf.pos--;

            this.frequencyModRate = new Envelope();
            this.frequencyModRate.unpack(buf);

            this.frequencyModRange = new Envelope();
            this.frequencyModRange.unpack(buf);
        }

        if (buf.g1() != 0) {
            buf.pos--;

            this.amplitudeModRate = new Envelope();
            this.amplitudeModRate.unpack(buf);

            this.amplitudeModRange = new Envelope();
            this.amplitudeModRange.unpack(buf);
        }

        if (buf.g1() != 0) {
            buf.pos--;

            this.release = new Envelope();
            this.release.unpack(buf);

            this.attack = new Envelope();
            this.attack.unpack(buf);
        }

        for (let i = 0; i < 10; i++) {
            const volume = buf.gsmarts();
            if (volume === 0) {
                break;
            }

            this.harmonicVolume[i] = volume;
            this.harmonicSemitone[i] = buf.gsmart();
            this.harmonicDelay[i] = buf.gsmarts();
        }

        this.reverbDelay = buf.gsmarts();
        this.reverbVolume = buf.gsmarts();
        this.length = buf.g2();
        this.start = buf.g2();

        this.filter = new Filter();
        this.filterRange = new Envelope();
        this.filter.unpack(buf, this.filterRange);
    }
}

class Envelope {
    form = 0;
    start = 0;
    end = 0;
    length = 0;
    shapeDelta: number[] = [];
    shapePeak: number[] = [];

    unpack(buf: Packet) {
        this.form = buf.g1();
        this.start = buf.g4s();
        this.end = buf.g4s();

        this.unpackShape(buf);
    }

    unpackShape(buf: Packet) {
        this.length = buf.g1();
        this.shapeDelta = new Array(this.length);
        this.shapePeak = new Array(this.length);
        for (let i = 0; i < this.length; i++) {
            this.shapeDelta[i] = buf.g2();
            this.shapePeak[i] = buf.g2();
        }
    }
}

class Filter {
    unity: number = 0.0;
    unity16: number = 0;
    pairs: Int32Array = new Int32Array(2);
    frequencies: Int32Array[][] = new Array(2);
    ranges: Int32Array[][] = new Array(2);
    unities: Int32Array = new Int32Array(2);

    unpack(buf: Packet, envelope: Envelope) {
        const count = buf.g1();
        this.pairs[0] = count >> 4;
        this.pairs[1] = count & 0xf;

        if (count !== 0) {
            this.unities[0] = buf.g2();
            this.unities[1] = buf.g2();

            const migration = buf.g1();

            for (let direction = 0; direction < 2; direction++) {
                if (!this.frequencies[direction]) {
                    this.frequencies[direction] = new Array(2);
                    this.frequencies[direction][0] = new Int32Array(4);
                    this.frequencies[direction][1] = new Int32Array(4);
                }

                if (!this.ranges[direction]) {
                    this.ranges[direction] = new Array(2);
                    this.ranges[direction][0] = new Int32Array(4);
                    this.ranges[direction][1] = new Int32Array(4);
                }

                for (let pair = 0; pair < this.pairs[direction]; pair++) {
                    this.frequencies[direction][0][pair] = buf.g2();
                    this.ranges[direction][0][pair] = buf.g2();
                }
            }

            for (let direction = 0; direction < 2; direction++) {
                for (let pair = 0; pair < this.pairs[direction]; pair++) {
                    if ((migration & ((1 << (direction * 4)) << pair)) !== 0) {
                        this.frequencies[direction][1][pair] = buf.g2();
                        this.ranges[direction][1][pair] = buf.g2();
                    } else {
                        this.frequencies[direction][1][pair] = this.frequencies[direction][0][pair];
                        this.ranges[direction][1][pair] = this.ranges[direction][0][pair];
                    }
                }
            }

            if (migration !== 0 || this.unities[1] !== this.unities[0]) {
                envelope.unpackShape(buf);
            }
        } else {
            this.unities[0] = this.unities[1] = 0;
        }
    }
}

if (import.meta.main) {
    const cache = new FileStream('data/unpack');
    try {
        const archive = cache.read(0, 8);
        if (!archive) {
            throw new Error('missing sound archive');
        }
        const soundsData = new Jagfile(new Packet(archive)).read('sounds.dat');
        if (!soundsData) {
            throw new Error('missing sounds.dat');
        }
        Wave.unpack(soundsData);
    } finally {
        cache.dat.close();
        for (const index of cache.idx) {
            index.close();
        }
    }
}
