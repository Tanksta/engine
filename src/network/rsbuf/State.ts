import BuildArea from './BuildArea.js';
import type { Coord } from './Coord.js';
import { coordFrom } from './Coord.js';
import { Visibility } from './Protocol.js';
import type { Visibility as VisibilityValue } from './Protocol.js';

export const PLAYER_LIMIT = 2048;
export const NPC_LIMIT = 16384;

export type ChatState = {
    readonly bytes: Uint8Array;
    readonly color: number;
    readonly effect: number;
    readonly ignored: number;
};

export type ExactMoveState = {
    readonly startX: number;
    readonly startZ: number;
    readonly endX: number;
    readonly endZ: number;
    readonly begin: number;
    readonly finish: number;
    readonly direction: number;
};

export type PlayerState = {
    coord: Coord;
    origin: Coord;
    pid: number;
    tele: boolean;
    jump: boolean;
    runDir: number;
    walkDir: number;
    visibility: VisibilityValue;
    active: boolean;
    build: BuildArea;
    masks: number;
    appearance: Uint8Array;
    lastAppearance: number;
    faceEntity: number;
    faceX: number;
    faceZ: number;
    orientationX: number;
    orientationZ: number;
    damageTaken: number;
    damageType: number;
    damageTaken2: number;
    damageType2: number;
    currentHitpoints: number;
    baseHitpoints: number;
    animId: number;
    animDelay: number;
    say: string | null;
    chat: ChatState | null;
    graphicId: number;
    graphicHeight: number;
    graphicDelay: number;
    exactMove: ExactMoveState | null;
};

export type NpcState = {
    coord: Coord;
    nid: number;
    type: number;
    tele: boolean;
    jump: boolean;
    runDir: number;
    walkDir: number;
    active: boolean;
    masks: number;
    faceEntity: number;
    faceX: number;
    faceZ: number;
    orientationX: number;
    orientationZ: number;
    damageTaken: number;
    damageType: number;
    damageTaken2: number;
    damageType2: number;
    currentHitpoints: number;
    baseHitpoints: number;
    animId: number;
    animDelay: number;
    say: string | null;
    graphicId: number;
    graphicHeight: number;
    graphicDelay: number;
    observers: number;
};

export type PlayerInfoRequest = {
    readonly pos: number;
    readonly pid: number;
    readonly dx: number;
    readonly dz: number;
    readonly rebuild: boolean;
};

export type NpcInfoRequest = PlayerInfoRequest;

const EMPTY_COORD = coordFrom(0, 0, 0);

export function createPlayer(pid: number): PlayerState {
    return {
        coord: EMPTY_COORD,
        origin: EMPTY_COORD,
        pid,
        tele: false,
        jump: false,
        runDir: -1,
        walkDir: -1,
        visibility: Visibility.DEFAULT,
        active: false,
        build: new BuildArea(),
        masks: 0,
        appearance: new Uint8Array(),
        lastAppearance: -1,
        faceEntity: -1,
        faceX: -1,
        faceZ: -1,
        orientationX: -1,
        orientationZ: -1,
        damageTaken: -1,
        damageType: -1,
        damageTaken2: -1,
        damageType2: -1,
        currentHitpoints: -1,
        baseHitpoints: -1,
        animId: -1,
        animDelay: -1,
        say: null,
        chat: null,
        graphicId: -1,
        graphicHeight: -1,
        graphicDelay: -1,
        exactMove: null
    };
}

export function createNpc(nid: number, type: number): NpcState {
    return {
        coord: EMPTY_COORD,
        nid,
        type,
        tele: false,
        jump: false,
        runDir: -1,
        walkDir: -1,
        active: false,
        masks: 0,
        faceEntity: -1,
        faceX: -1,
        faceZ: -1,
        orientationX: -1,
        orientationZ: -1,
        damageTaken: -1,
        damageType: -1,
        damageTaken2: -1,
        damageType2: -1,
        currentHitpoints: -1,
        baseHitpoints: -1,
        animId: -1,
        animDelay: -1,
        say: null,
        graphicId: -1,
        graphicHeight: -1,
        graphicDelay: -1,
        observers: 0
    };
}
