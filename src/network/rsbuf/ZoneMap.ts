import type { Coord } from './Coord.js';
import { sameZone, zoneIndex } from './Coord.js';

type Zone = {
    readonly players: Set<number>;
    readonly npcs: Set<number>;
};

function createZone(): Zone {
    return { players: new Set<number>(), npcs: new Set<number>() };
}

export default class ZoneMap {
    private readonly zones = new Map<number, Zone>();

    find(coord: Coord): Zone | null {
        return this.zones.get(zoneIndex(coord)) ?? null;
    }

    get(coord: Coord): Zone {
        const index = zoneIndex(coord);
        let zone = this.zones.get(index);
        if (!zone) {
            zone = createZone();
            this.zones.set(index, zone);
        }
        return zone;
    }

    movePlayer(pid: number, from: Coord, to: Coord): void {
        if (sameZone(from, to)) {
            return;
        }
        this.find(from)?.players.delete(pid);
        this.get(to).players.add(pid);
    }

    removePlayer(coord: Coord, pid: number): void {
        this.find(coord)?.players.delete(pid);
    }

    moveNpc(nid: number, from: Coord, to: Coord): void {
        if (sameZone(from, to)) {
            return;
        }
        this.find(from)?.npcs.delete(nid);
        this.get(to).npcs.add(nid);
    }

    removeNpc(coord: Coord, nid: number): void {
        this.find(coord)?.npcs.delete(nid);
    }
}
