import type { Coord } from './Coord.js';
import { coordFrom, withinDistanceSw } from './Coord.js';
import type { NpcState, PlayerState } from './State.js';
import type ZoneMap from './ZoneMap.js';

const INTERVAL = 10;
export const PREFERRED_PLAYERS = 250;
export const PREFERRED_NPCS = 255;
export const PREFERRED_VIEW_DISTANCE = 15;

export class OrderedIdSet {
    private readonly ids: number[] = [];
    private readonly present = new Set<number>();

    get size(): number {
        return this.ids.length;
    }

    has(id: number): boolean {
        return this.present.has(id);
    }

    add(id: number): void {
        if (this.present.has(id)) {
            return;
        }
        this.present.add(id);
        this.ids.push(id);
    }

    delete(id: number): void {
        if (!this.present.delete(id)) {
            return;
        }
        const index = this.ids.indexOf(id);
        if (index !== -1) {
            this.ids.splice(index, 1);
        }
    }

    clear(): void {
        this.present.clear();
        this.ids.length = 0;
    }

    snapshot(): number[] {
        return [...this.ids];
    }
}

export type PlayerSearchContext = {
    readonly players: readonly (PlayerState | null)[];
    readonly playerGrid: ReadonlyMap<number, readonly number[]>;
    readonly zoneMap: ZoneMap;
    readonly observer: PlayerState;
};

export type NpcSearchContext = {
    readonly npcs: readonly (NpcState | null)[];
    readonly zoneMap: ZoneMap;
    readonly observer: PlayerState;
};

export default class BuildArea {
    readonly players = new OrderedIdSet();
    readonly npcs = new OrderedIdSet();
    private readonly appearances = new Uint32Array(2048);
    private forceViewDistance = false;
    private lastResize = 0;
    viewDistance = PREFERRED_VIEW_DISTANCE;

    cleanup(): void {
        this.players.clear();
        this.npcs.clear();
        this.appearances.fill(0);
    }

    resize(): void {
        if (this.forceViewDistance) {
            return;
        }
        if (this.players.size >= PREFERRED_PLAYERS) {
            this.viewDistance = Math.max(1, this.viewDistance - 1);
            this.lastResize = 0;
            return;
        }
        this.lastResize++;
        if (this.lastResize >= INTERVAL) {
            if (this.viewDistance < PREFERRED_VIEW_DISTANCE) {
                this.viewDistance++;
            } else {
                this.lastResize = 0;
            }
        }
    }

    rebuildNpcs(): void {
        this.npcs.clear();
    }

    rebuildPlayers(context: PlayerSearchContext): void {
        this.players.clear();
        this.lastResize = 0;
        this.viewDistance = PREFERRED_VIEW_DISTANCE;

        let count = 0;
        for (const _pid of this.nearbyPlayersNearest(context)) {
            count++;
            if (count >= PREFERRED_PLAYERS) {
                this.viewDistance--;
                return;
            }
        }
    }

    hasAppearance(pid: number, tick: number): boolean {
        return this.appearances[pid] === tick;
    }

    saveAppearance(pid: number, tick: number): void {
        this.appearances[pid] = tick;
    }

    nearbyPlayers(context: PlayerSearchContext): number[] {
        return this.viewDistance < PREFERRED_VIEW_DISTANCE ? this.nearbyPlayersNearest(context) : this.nearbyPlayersByZone(context);
    }

    nearbyNpcs(context: NpcSearchContext): number[] {
        const nearby: number[] = [];
        this.visitZones(context.observer.coord, PREFERRED_VIEW_DISTANCE, coord => {
            const zone = context.zoneMap.find(coord);
            if (!zone) {
                return false;
            }
            for (const nid of zone.npcs) {
                if (nearby.length + this.npcs.size >= PREFERRED_NPCS) {
                    return true;
                }
                if (this.canAddNpc(context, nid)) {
                    nearby.push(nid);
                }
            }
            return false;
        });
        return nearby;
    }

    private nearbyPlayersByZone(context: PlayerSearchContext): number[] {
        const nearby: number[] = [];
        this.visitZones(context.observer.coord, this.viewDistance, coord => {
            const zone = context.zoneMap.find(coord);
            if (!zone) {
                return false;
            }
            for (const pid of zone.players) {
                if (nearby.length + this.players.size >= PREFERRED_PLAYERS) {
                    return true;
                }
                if (this.canAddPlayer(context, pid)) {
                    nearby.push(pid);
                }
            }
            return false;
        });
        return nearby;
    }

    private nearbyPlayersNearest(context: PlayerSearchContext): number[] {
        const radius = this.viewDistance * 2;
        const min = -(radius >> 1);
        const max = radius >> 1;
        const length = radius ** 2;
        const nearby: number[] = [];
        let dx = 0;
        let dz = 0;
        let stepX = 0;
        let stepZ = -1;

        for (let step = 1; step <= length; step++) {
            if (nearby.length + this.players.size >= PREFERRED_PLAYERS) {
                return nearby;
            }
            if (min < dx && dx <= max && min < dz && dz <= max) {
                const coord = coordFrom(context.observer.coord.x + dx, context.observer.coord.level, context.observer.coord.z + dz);
                for (const pid of context.playerGrid.get(coord.packed) ?? []) {
                    if (this.canAddPlayer(context, pid)) {
                        nearby.push(pid);
                    }
                }
            }
            if (dx === dz || (dx < 0 && dx === -dz) || (dx > 0 && dx === 1 - dz)) {
                const nextStepX = -stepZ;
                stepZ = stepX;
                stepX = nextStepX;
            }
            dx += stepX;
            dz += stepZ;
        }
        return nearby;
    }

    private visitZones(origin: Coord, distance: number, visit: (coord: Coord) => boolean): void {
        const startX = Math.max(0, origin.x - distance) >> 3;
        const startZ = Math.max(0, origin.z - distance) >> 3;
        const endX = (origin.x + distance) >> 3;
        const endZ = (origin.z + distance) >> 3;
        for (let zx = startX; zx <= endX; zx++) {
            for (let zz = startZ; zz <= endZ; zz++) {
                if (visit(coordFrom(zx << 3, origin.level, zz << 3))) {
                    return;
                }
            }
        }
    }

    private canAddPlayer(context: PlayerSearchContext, pid: number): boolean {
        const other = context.players[pid];
        return other !== null && !this.players.has(pid) && other.pid !== context.observer.pid && other.active && other.coord.level === context.observer.coord.level && withinDistanceSw(other.coord, context.observer.coord, this.viewDistance);
    }

    private canAddNpc(context: NpcSearchContext, nid: number): boolean {
        const other = context.npcs[nid];
        return other !== null && !this.npcs.has(nid) && other.active && other.coord.level === context.observer.coord.level && withinDistanceSw(other.coord, context.observer.coord, PREFERRED_VIEW_DISTANCE);
    }
}
