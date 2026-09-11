import type { CoordGrid } from '#/engine/CoordGrid.js';
import type Npc from '#/engine/entity/Npc.js';
import type Player from '#/engine/entity/Player.js';
import type ScriptState from '#/engine/script/ScriptState.js';

export const TZHAAR_FIGHTCAVE_MAPSQUARES = [
    { x: 37, z: 77 },
    { x: 37, z: 78 },
    { x: 37, z: 79 },
    { x: 38, z: 77 }
] as const;

export const MONKEY_MADNESS_FINAL_BATTLE_MAPSQUARES = [
    { x: 42, z: 143 }
] as const;

export const TZHAAR_FIGHTCAVE_EXIT: CoordGrid = {
    level: 0,
    x: (38 << 6) + 6,
    z: (80 << 6) + 48
};

export const MONKEY_MADNESS_FINAL_BATTLE_EXIT: CoordGrid = {
    level: 0,
    x: (43 << 6) + 13,
    z: (43 << 6) + 19
};

type TzHaarFightCaveViewCoord = {
    instance: number;
    level: number;
    x: number;
    z: number;
    tileXOffset: number;
    tileZOffset: number;
    fineXOffset: number;
    fineZOffset: number;
};

export function isTzHaarFightCaveMapsquare(x: number, z: number): boolean {
    const mx = x >> 6;
    const mz = z >> 6;
    return TZHAAR_FIGHTCAVE_MAPSQUARES.some(square => square.x === mx && square.z === mz);
}

export function isMonkeyMadnessFinalBattleMapsquare(x: number, z: number): boolean {
    const mx = x >> 6;
    const mz = z >> 6;
    return MONKEY_MADNESS_FINAL_BATTLE_MAPSQUARES.some(square => square.x === mx && square.z === mz);
}

export function isInstancedMapsquare(x: number, z: number): boolean {
    return isTzHaarFightCaveMapsquare(x, z) || isMonkeyMadnessFinalBattleMapsquare(x, z);
}

export function tzHaarFightCaveInstanceBase(level: number): number {
    return level - (level % 4);
}

export function tzHaarFightCaveInstanceId(slot: number): number {
    // Keep instance planes within a byte-friendly range while still separating concurrent runs.
    return (slot % 63) + 1;
}

export function tzHaarFightCaveInstanceBaseFromSlot(slot: number): number {
    return tzHaarFightCaveInstanceId(slot) * 4;
}

export function tzHaarFightCaveInstanceIdForCoord(level: number, x: number, z: number): number {
    if (level < 4 || !isInstancedMapsquare(x, z)) {
        return 0;
    }

    return Math.floor(level / 4);
}

export function resolveTzHaarFightCaveView(level: number, x: number, z: number): TzHaarFightCaveViewCoord {
    const instance = tzHaarFightCaveInstanceIdForCoord(level, x, z);
    if (instance <= 0) {
        return {
            instance: 0,
            level,
            x,
            z,
            tileXOffset: 0,
            tileZOffset: 0,
            fineXOffset: 0,
            fineZOffset: 0
        };
    }

    // Keep each solo Fight Cave run in its own virtual 128x128 tile viewport bucket.
    const grid = instance - 1;
    const tileXOffset = ((grid % 8) + 1) * 128;
    const tileZOffset = (Math.floor(grid / 8) + 1) * 128;

    return {
        instance,
        level: level % 4,
        x: x + tileXOffset,
        z: z + tileZOffset,
        tileXOffset,
        tileZOffset,
        fineXOffset: tileXOffset * 2,
        fineZOffset: tileZOffset * 2
    };
}

export function forEachTzHaarFightCaveMapsquare(callback: (x: number, z: number) => void): void {
    for (const square of TZHAAR_FIGHTCAVE_MAPSQUARES) {
        callback(square.x, square.z);
    }
}

export function forEachInstancedMapsquareForCoord(x: number, z: number, callback: (x: number, z: number) => void): void {
    const mx = x >> 6;
    const mz = z >> 6;
    const group =
        TZHAAR_FIGHTCAVE_MAPSQUARES.some(square => square.x === mx && square.z === mz) ?
            TZHAAR_FIGHTCAVE_MAPSQUARES :
            MONKEY_MADNESS_FINAL_BATTLE_MAPSQUARES.some(square => square.x === mx && square.z === mz) ?
                MONKEY_MADNESS_FINAL_BATTLE_MAPSQUARES :
                [];

    for (const square of group) {
        callback(square.x, square.z);
    }
}

function inInstancedFightCave(entity: Player | Npc | null): entity is Player | Npc {
    return !!entity && entity.level >= 4 && isInstancedMapsquare(entity.x, entity.z);
}

export function resolveTzHaarFightCaveCoord(state: ScriptState, coord: CoordGrid): CoordGrid {
    if (!isInstancedMapsquare(coord.x, coord.z)) {
        return coord;
    }

    const entity =
        (inInstancedFightCave(state._activeNpc) ? state._activeNpc : null) ??
        (inInstancedFightCave(state._activeNpc2) ? state._activeNpc2 : null) ??
        (inInstancedFightCave(state._activePlayer) ? state._activePlayer : null) ??
        (inInstancedFightCave(state._activePlayer2) ? state._activePlayer2 : null);

    if (!entity) {
        return coord;
    }

    return {
        level: tzHaarFightCaveInstanceBase(entity.level) + coord.level,
        x: coord.x,
        z: coord.z
    };
}

export function resolveTzHaarFightCaveSaveCoord(x: number, z: number, level: number): CoordGrid {
    if (level >= 4 && isTzHaarFightCaveMapsquare(x, z)) {
        return TZHAAR_FIGHTCAVE_EXIT;
    }

    if (level >= 4 && isMonkeyMadnessFinalBattleMapsquare(x, z)) {
        return MONKEY_MADNESS_FINAL_BATTLE_EXIT;
    }

    return { level, x, z };
}
