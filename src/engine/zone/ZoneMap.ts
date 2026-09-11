import { CoordGrid } from '#/engine/CoordGrid.js';
import InstanceZone from '#/engine/zone/InstanceZone.js';
import Zone from '#/engine/zone/Zone.js';
import ZoneGrid from '#/engine/zone/ZoneGrid.js';

export default class ZoneMap {
    static zoneIndex(x: number, z: number, level: number): number {
        const zoneX = (x >> 3) & 0x7ff;
        const zoneZ = (z >> 3) & 0x7ff;
        return level * 0x400000 + zoneZ * 0x800 + zoneX;
    }

    static unpackIndex(index: number): CoordGrid {
        const level: number = Math.floor(index / 0x400000);
        const zone = index - level * 0x400000;
        const x: number = (zone & 0x7ff) << 3;
        const z: number = (Math.floor(zone / 0x800) & 0x7ff) << 3;
        return { x, z, level };
    }

    private readonly zones: Map<number, Zone>;
    private readonly grids: Map<number, ZoneGrid>;

    constructor() {
        this.zones = new Map();
        this.grids = new Map();
    }

    zone(x: number, z: number, level: number): Zone {
        const zoneIndex: number = ZoneMap.zoneIndex(x, z, level);
        let zone: Zone | undefined = this.zones.get(zoneIndex);
        if (typeof zone == 'undefined') {
            zone = new Zone(zoneIndex);
            this.zones.set(zoneIndex, zone);
        }
        return zone;
    }

    zoneByIndex(index: number): Zone {
        let zone: Zone | undefined = this.zones.get(index);
        if (typeof zone == 'undefined') {
            zone = new Zone(index);
            this.zones.set(index, zone);
        }
        return zone;
    }

    getZoneIfExists(x: number, z: number, level: number): Zone | null {
        return this.zones.get(ZoneMap.zoneIndex(x, z, level)) ?? null;
    }

    hasZone(x: number, z: number, level: number): boolean {
        return this.zones.has(ZoneMap.zoneIndex(x, z, level));
    }

    createInstanceZone(index: number): InstanceZone {
        const existing = this.zones.get(index);
        if (existing) {
            if (existing instanceof InstanceZone) {
                return existing;
            }
            throw new Error(`Zone ${index} already exists and is not an InstanceZone.`);
        }

        const zone = new InstanceZone(index);
        this.zones.set(index, zone);
        return zone;
    }

    removeZone(index: number): boolean {
        return this.zones.delete(index);
    }

    grid(level: number): ZoneGrid {
        let grid: ZoneGrid | undefined = this.grids.get(level);
        if (typeof grid == 'undefined') {
            grid = new ZoneGrid();
            this.grids.set(level, grid);
        }
        return grid;
    }

    zoneCount(): number {
        return this.zones.size;
    }

    locCount(): number {
        let total: number = 0;
        for (const zone of this.zones.values()) {
            total += zone.totalLocs;
        }
        return total;
    }

    objCount(): number {
        let total: number = 0;
        for (const zone of this.zones.values()) {
            total += zone.totalObjs;
        }
        return total;
    }
}
