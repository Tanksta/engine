import fs from 'fs';
import path from 'path';

import Packet from '#/io/Packet.js';

type SpawnKind = 'npc' | 'obj';

type MapSquare = {
    readonly mx: number;
    readonly mz: number;
    readonly name: string;
};

type SpawnRow = {
    readonly kind: SpawnKind;
    readonly mapSquare: string;
    readonly level: number;
    readonly x: number;
    readonly z: number;
    readonly localX: number;
    readonly localZ: number;
    readonly id: number;
    readonly count: number;
    readonly debugname: string;
};

type DecodeSource = {
    readonly prefix: 'n' | 'o';
    readonly kind: SpawnKind;
};

const DECODE_SOURCES: readonly DecodeSource[] = [
    { prefix: 'n', kind: 'npc' },
    { prefix: 'o', kind: 'obj' }
] as const;

const USAGE = 'Usage: bun run tools/map/ReportPackedSpawns.ts <reference_server_map_dir> <current_server_map_dir> <out_dir>';

function parseMapSquare(fileName: string, prefix: string): MapSquare | null {
    const match = new RegExp(`^${prefix}(\\d+)_(\\d+)$`).exec(fileName);
    const mxText = match?.at(1);
    const mzText = match?.at(2);
    if (!mxText || !mzText) {
        return null;
    }

    const mx = Number.parseInt(mxText, 10);
    const mz = Number.parseInt(mzText, 10);
    if (!Number.isInteger(mx) || !Number.isInteger(mz)) {
        return null;
    }

    return { mx, mz, name: `${mx}_${mz}` };
}

function decodePosition(pos: number): { readonly level: number; readonly localX: number; readonly localZ: number } {
    return {
        level: (pos >> 12) & 0x3,
        localX: (pos >> 6) & 0x3f,
        localZ: pos & 0x3f
    };
}

function readLabels(filePath: string): Map<number, string> {
    const labels = new Map<number, string>();
    if (!fs.existsSync(filePath)) {
        return labels;
    }

    for (const line of fs.readFileSync(filePath, 'utf8').replace(/\r/g, '').split('\n')) {
        const equals = line.indexOf('=');
        if (equals < 1 || line.startsWith('//')) {
            continue;
        }

        const id = Number.parseInt(line.slice(0, equals), 10);
        if (Number.isInteger(id)) {
            labels.set(id, line.slice(equals + 1));
        }
    }

    return labels;
}

function decodeFile(filePath: string, mapSquare: MapSquare, source: DecodeSource, labels: Map<number, string>): SpawnRow[] {
    const packet = Packet.load(filePath);
    const rows: SpawnRow[] = [];

    while (packet.available > 0) {
        const pos = packet.g2();
        const { level, localX, localZ } = decodePosition(pos);
        const entries = packet.g1();

        for (let index = 0; index < entries; index++) {
            const id = packet.g2();
            const count = source.kind === 'obj' ? packet.g1() : 1;
            rows.push({
                kind: source.kind,
                mapSquare: mapSquare.name,
                level,
                x: (mapSquare.mx << 6) + localX,
                z: (mapSquare.mz << 6) + localZ,
                localX,
                localZ,
                id,
                count,
                debugname: labels.get(id) ?? ''
            });
        }
    }

    return rows;
}

function decodeDirectory(dir: string, labelsByKind: ReadonlyMap<SpawnKind, Map<number, string>>): SpawnRow[] {
    const rows: SpawnRow[] = [];
    for (const source of DECODE_SOURCES) {
        const labels = labelsByKind.get(source.kind) ?? new Map<number, string>();
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
            if (!entry.isFile()) {
                continue;
            }

            const mapSquare = parseMapSquare(entry.name, source.prefix);
            if (!mapSquare) {
                continue;
            }

            const filePath = path.join(dir, entry.name);
            if (fs.statSync(filePath).size === 0) {
                continue;
            }

            rows.push(...decodeFile(filePath, mapSquare, source, labels));
        }
    }

    return rows.sort(compareRows);
}

function rowKey(row: SpawnRow): string {
    return [row.kind, row.mapSquare, row.level, row.localX, row.localZ, row.id, row.count].join('|');
}

function compareRows(a: SpawnRow, b: SpawnRow): number {
    return a.mapSquare.localeCompare(b.mapSquare) || a.kind.localeCompare(b.kind) || a.level - b.level || a.localX - b.localX || a.localZ - b.localZ || a.id - b.id || a.count - b.count;
}

function renderCsv(rows: readonly SpawnRow[]): string {
    const header = 'kind,mapsquare,level,x,z,local_x,local_z,id,debugname,quantity';
    const body = rows.map(row => [row.kind, row.mapSquare, row.level, row.x, row.z, row.localX, row.localZ, row.id, row.debugname, row.count].join(','));
    return [header, ...body].join('\n') + '\n';
}

function countByKind(rows: readonly SpawnRow[], kind: SpawnKind): number {
    return rows.filter(row => row.kind === kind).length;
}

function main(): void {
    const [referenceDir, currentDir, outDir] = process.argv.slice(2);
    if (!referenceDir || !currentDir || !outDir) {
        console.error(USAGE);
        process.exit(1);
    }

    const labelsByKind = new Map<SpawnKind, Map<number, string>>([
        ['npc', readLabels(path.resolve('..', 'content', 'pack', 'npc.pack'))],
        ['obj', readLabels(path.resolve('..', 'content', 'pack', 'obj.pack'))]
    ]);

    const referenceRows = decodeDirectory(referenceDir, labelsByKind);
    const currentRows = decodeDirectory(currentDir, labelsByKind);
    const currentMapSquares = new Set(currentRows.map(row => row.mapSquare));
    const currentKeys = new Set(currentRows.map(rowKey));
    const missingRows = referenceRows.filter(row => currentMapSquares.has(row.mapSquare) && !currentKeys.has(rowKey(row)));

    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(path.join(outDir, 'packed_spawns_reference.csv'), renderCsv(referenceRows));
    fs.writeFileSync(path.join(outDir, 'packed_spawns_current.csv'), renderCsv(currentRows));
    fs.writeFileSync(path.join(outDir, 'packed_spawns_missing_from_current.csv'), renderCsv(missingRows));
    fs.writeFileSync(
        path.join(outDir, 'packed_spawns_compare.md'),
        [
            '# Packed Spawn Compare',
            '',
            `Reference: \`${referenceDir}\``,
            `Current: \`${currentDir}\``,
            '',
            `- Reference NPC rows: ${countByKind(referenceRows, 'npc')}`,
            `- Reference OBJ rows: ${countByKind(referenceRows, 'obj')}`,
            `- Current NPC rows: ${countByKind(currentRows, 'npc')}`,
            `- Current OBJ rows: ${countByKind(currentRows, 'obj')}`,
            `- Missing NPC rows on current map squares: ${countByKind(missingRows, 'npc')}`,
            `- Missing OBJ rows on current map squares: ${countByKind(missingRows, 'obj')}`,
            ''
        ].join('\n')
    );

    console.log(`reference rows: ${referenceRows.length}`);
    console.log(`current rows: ${currentRows.length}`);
    console.log(`missing rows on current map squares: ${missingRows.length}`);
}

main();
