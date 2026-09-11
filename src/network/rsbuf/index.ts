import { sameZone } from './Coord.js';
import { cleanupNpcState, cleanupPlayerState } from './Cleanup.js';
import NpcInfoWriter from './NpcInfoWriter.js';
import PlayerInfoWriter from './PlayerInfoWriter.js';
export { NpcInfoProt, NpcUpdate, PlayerInfoProt, PlayerUpdate, Visibility } from './Protocol.js';
export type { Visibility as VisibilityValue } from './Protocol.js';
import { createNpc, createPlayer, NPC_LIMIT, PLAYER_LIMIT } from './State.js';
import type { NpcInfoRequest, NpcState, PlayerInfoRequest, PlayerState } from './State.js';
import type { NpcCompute, PlayerCompute } from './StateUpdate.js';
import { updateNpcState, updatePlayerState } from './StateUpdate.js';
import ZoneMap from './ZoneMap.js';

const players: (PlayerState | null)[] = new Array<PlayerState | null>(PLAYER_LIMIT).fill(null);
const npcs: (NpcState | null)[] = new Array<NpcState | null>(NPC_LIMIT).fill(null);
const playerGrid = new Map<number, number[]>();
const zoneMap = new ZoneMap();
const playerInfoWriter = new PlayerInfoWriter();
const npcInfoWriter = new NpcInfoWriter();

function validPlayerId(pid: number): boolean {
    return pid >= 0 && pid < PLAYER_LIMIT;
}

function validNpcId(nid: number): boolean {
    return nid >= 0 && nid < NPC_LIMIT;
}

export function addPlayer(pid: number): void {
    if (!validPlayerId(pid)) {
        return;
    }
    players[pid] = createPlayer(pid);
}

export function removePlayer(pid: number): void {
    if (!validPlayerId(pid)) {
        return;
    }
    const player = players[pid];
    if (!player) {
        return;
    }
    zoneMap.removePlayer(player.coord, pid);
    for (const nid of player.build.npcs.snapshot()) {
        const npc = npcs[nid];
        if (npc) {
            npc.observers = Math.max(0, npc.observers - 1);
        }
    }
    player.build.cleanup();
    players[pid] = null;
}

export function hasPlayer(pid: number, other: number): boolean {
    if (!validPlayerId(pid)) {
        return false;
    }
    return players[pid]?.build.players.has(other) ?? false;
}

export function cleanupPlayerBuildArea(pid: number): void {
    if (!validPlayerId(pid)) {
        return;
    }
    players[pid]?.build.cleanup();
}

export function computePlayer(input: PlayerCompute): void {
    if (!validPlayerId(input.pid)) {
        return;
    }
    const player = players[input.pid];
    if (!player) {
        return;
    }
    const previousCoord = player.coord;
    updatePlayerState(player, input);
    if (!sameZone(previousCoord, player.coord)) {
        zoneMap.movePlayer(input.pid, previousCoord, player.coord);
    }
    const cell = playerGrid.get(player.coord.packed);
    if (cell) {
        cell.push(input.pid);
    } else {
        playerGrid.set(player.coord.packed, [input.pid]);
    }
}

export function playerInfo(request: PlayerInfoRequest): Uint8Array {
    if (!validPlayerId(request.pid)) {
        return new Uint8Array();
    }
    const player = players[request.pid];
    if (!player) {
        return new Uint8Array();
    }
    return playerInfoWriter.encode({ request, players, playerGrid, zoneMap, player });
}

export function addNpc(nid: number, type: number): void {
    if (!validNpcId(nid) || type === -1) {
        return;
    }
    npcs[nid] = createNpc(nid, type);
}

export function removeNpc(nid: number): void {
    if (!validNpcId(nid)) {
        return;
    }
    const npc = npcs[nid];
    if (npc) {
        zoneMap.removeNpc(npc.coord, nid);
    }
    npcs[nid] = null;
}

export function hasNpc(pid: number, nid: number): boolean {
    if (!validPlayerId(pid)) {
        return false;
    }
    return players[pid]?.build.npcs.has(nid) ?? false;
}

export function getNpcObservers(nid: number): number {
    if (!validNpcId(nid)) {
        return 0;
    }
    return npcs[nid]?.observers ?? 0;
}

export function computeNpc(input: NpcCompute): void {
    if (!validNpcId(input.nid) || input.type === -1) {
        return;
    }
    const npc = npcs[input.nid];
    if (!npc) {
        return;
    }
    const previousCoord = npc.coord;
    updateNpcState(npc, input);
    if (!sameZone(previousCoord, npc.coord)) {
        zoneMap.moveNpc(input.nid, previousCoord, npc.coord);
    }
}

export function npcInfo(request: NpcInfoRequest): Uint8Array {
    if (!validPlayerId(request.pid)) {
        return new Uint8Array();
    }
    const player = players[request.pid];
    if (!player) {
        return new Uint8Array();
    }
    return npcInfoWriter.encode({ request, npcs, zoneMap, player });
}

export function cleanup(): void {
    playerGrid.clear();
    for (const player of players) {
        if (player) {
            cleanupPlayerState(player);
        }
    }
    for (const npc of npcs) {
        if (npc) {
            cleanupNpcState(npc);
        }
    }
}
