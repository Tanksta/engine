import type Player from '#/engine/entity/Player.js';

type TzHaarFightCaveSession = {
    active: boolean;
    wave: number;
    remaining: number;
    rotation: number;
    healers: number;
    jadUid: number;
    jadSpawnCoord: number;
    completed: number;
    returnPending: boolean;
};

const FIGHT_CAVE_SESSIONS = new WeakMap<Player, TzHaarFightCaveSession>();

function createTzHaarFightCaveSession(): TzHaarFightCaveSession {
    return {
        active: false,
        wave: 0,
        remaining: 0,
        rotation: 0,
        healers: 0,
        jadUid: -1,
        jadSpawnCoord: -1,
        completed: 0,
        returnPending: false
    };
}

function getTzHaarFightCaveSession(player: Player): TzHaarFightCaveSession {
    const current = FIGHT_CAVE_SESSIONS.get(player);
    if (current) {
        return current;
    }

    const created = createTzHaarFightCaveSession();
    FIGHT_CAVE_SESSIONS.set(player, created);
    return created;
}

export function tzHaarFightCaveActive(player: Player): boolean {
    return getTzHaarFightCaveSession(player).active;
}

export function tzHaarFightCaveStartState(player: Player): void {
    const session = getTzHaarFightCaveSession(player);
    session.active = true;
    session.wave = 1;
    session.remaining = 0;
    session.rotation = 0;
    session.healers = 0;
    session.jadUid = -1;
    session.jadSpawnCoord = -1;
}

export function tzHaarFightCaveJumpState(player: Player, wave: number): void {
    const session = getTzHaarFightCaveSession(player);
    session.wave = wave;
    session.completed = wave - 1;
    session.remaining = 0;
    session.rotation = 0;
    session.healers = 0;
    session.jadUid = -1;
    session.jadSpawnCoord = -1;
}

export function tzHaarFightCaveResetState(player: Player): void {
    const session = getTzHaarFightCaveSession(player);
    session.active = false;
    session.wave = 0;
    session.remaining = 0;
    session.rotation = 0;
    session.healers = 0;
    session.jadUid = -1;
    session.jadSpawnCoord = -1;
}

export function tzHaarFightCaveClearProgress(player: Player): void {
    const session = getTzHaarFightCaveSession(player);
    session.completed = 0;
    session.returnPending = false;
}

export function tzHaarFightCaveWave(player: Player): number {
    return getTzHaarFightCaveSession(player).wave;
}

export function tzHaarFightCaveSetWave(player: Player, wave: number): void {
    getTzHaarFightCaveSession(player).wave = wave;
}

export function tzHaarFightCaveRemaining(player: Player): number {
    return getTzHaarFightCaveSession(player).remaining;
}

export function tzHaarFightCaveSetRemaining(player: Player, remaining: number): void {
    getTzHaarFightCaveSession(player).remaining = remaining;
}

export function tzHaarFightCaveRotation(player: Player): number {
    return getTzHaarFightCaveSession(player).rotation;
}

export function tzHaarFightCaveSetRotation(player: Player, rotation: number): void {
    getTzHaarFightCaveSession(player).rotation = rotation;
}

export function tzHaarFightCaveHealers(player: Player): number {
    return getTzHaarFightCaveSession(player).healers;
}

export function tzHaarFightCaveSetHealers(player: Player, healers: number): void {
    getTzHaarFightCaveSession(player).healers = healers;
}

export function tzHaarFightCaveJadUid(player: Player): number {
    return getTzHaarFightCaveSession(player).jadUid;
}

export function tzHaarFightCaveSetJadUid(player: Player, jadUid: number): void {
    getTzHaarFightCaveSession(player).jadUid = jadUid;
}

export function tzHaarFightCaveJadSpawnCoord(player: Player): number {
    return getTzHaarFightCaveSession(player).jadSpawnCoord;
}

export function tzHaarFightCaveSetJadSpawnCoord(player: Player, coord: number): void {
    getTzHaarFightCaveSession(player).jadSpawnCoord = coord;
}

export function tzHaarFightCaveCompleted(player: Player): number {
    return getTzHaarFightCaveSession(player).completed;
}

export function tzHaarFightCaveSetCompleted(player: Player, completed: number): void {
    getTzHaarFightCaveSession(player).completed = completed;
}

export function tzHaarFightCaveReturnPending(player: Player): boolean {
    return getTzHaarFightCaveSession(player).returnPending;
}

export function tzHaarFightCaveSetReturnPending(player: Player, returnPending: boolean): void {
    getTzHaarFightCaveSession(player).returnPending = returnPending;
}
