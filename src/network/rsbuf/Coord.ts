export type Coord = {
    readonly packed: number;
    readonly x: number;
    readonly level: number;
    readonly z: number;
};

export type LocalCoord = {
    readonly x: number;
    readonly level: number;
    readonly z: number;
};

export function coordFrom(x: number, level: number, z: number): Coord {
    const tileX = x & 0x3fff;
    const tileZ = z & 0x3fff;
    const plane = level & 0x3;
    const packed = (tileZ | (tileX << 14) | (plane << 28)) >>> 0;
    return { packed, x: tileX, level: plane, z: tileZ };
}

export function withinDistanceSw(a: Coord, b: Coord, distance: number): boolean {
    return Math.abs(a.x - b.x) <= distance && Math.abs(a.z - b.z) <= distance;
}

export function sameZone(a: Coord, b: Coord): boolean {
    return (a.x >> 3) === (b.x >> 3) && (a.z >> 3) === (b.z >> 3) && a.level === b.level;
}

export function fine(pos: number, size: number): number {
    return pos * 2 + size;
}

export function zoneIndex(coord: Coord): number {
    return (((coord.x >> 3) & 0x7ff) | (((coord.z >> 3) & 0x7ff) << 11) | ((coord.level & 0x3) << 22)) >>> 0;
}

export function localTeleportCoord(coord: Coord, origin: Coord): LocalCoord {
    const baseX = (((origin.x >> 3) - 6) << 3);
    const baseZ = (((origin.z >> 3) - 6) << 3);
    return { x: coord.x - baseX, level: coord.level, z: coord.z - baseZ };
}
