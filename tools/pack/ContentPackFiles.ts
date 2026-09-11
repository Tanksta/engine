import fs from 'fs';

const CANONICAL_CONTENT_PACK_FILE_NAMES: readonly string[] = [
    'anim.pack',
    'animset.pack',
    'base.pack',
    'flo.pack',
    'idk.pack',
    'interface.order',
    'interface.pack',
    'inv.pack',
    'loc.pack',
    'map.pack',
    'midi.pack',
    'model.pack',
    'npc.pack',
    'obj.pack',
    'seq.pack',
    'spotanim.pack',
    'synth.order',
    'synth.pack',
    'texture.pack',
    'varbit.pack',
    'varp.pack'
];

export const CANONICAL_CONTENT_PACK_FILES: ReadonlySet<string> = new Set(CANONICAL_CONTENT_PACK_FILE_NAMES);

export function isCanonicalContentPackFile(name: string): boolean {
    return CANONICAL_CONTENT_PACK_FILES.has(name);
}

export function removeGeneratedContentPackIntermediates(packDir: string): readonly string[] {
    if (!fs.existsSync(packDir)) {
        return [];
    }

    const removed: string[] = [];
    const entries = fs.readdirSync(packDir, { withFileTypes: true });
    for (const entry of entries) {
        if (!entry.isFile() || !entry.name.endsWith('.pack') || isCanonicalContentPackFile(entry.name)) {
            continue;
        }

        fs.rmSync(`${entry.parentPath}/${entry.name}`);
        removed.push(entry.name);
    }

    return removed;
}
