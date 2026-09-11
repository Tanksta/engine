import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';

import Environment from '#/util/Environment.js';

const dir = join(Environment.BUILD_SRC_DIR, 'synth/_rev349');
const files = readdirSync(dir);

for (const file of files) {
    try {
        if (file.endsWith('.wav.wav')) {
            unlinkSync(join(dir, file));
            continue;
        }

        if (file.endsWith('.wav')) {
            continue;
        }

        const sourcePath = join(dir, file);
        if (!existsSync(`${sourcePath}.wav`)) {
            execFileSync('java', ['-cp', 'data/pack/rs2client.jar', 'jagex2.client.SoundSynth', sourcePath], { stdio: 'inherit' });
        }
    } catch (error) {
        console.error(file);
        if (error instanceof Error) {
            console.error(error.message);
        } else {
            throw error;
        }
    }
}
