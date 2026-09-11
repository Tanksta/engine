import { fine } from './Coord.js';
import { NpcInfoProt, PlayerInfoProt } from './Protocol.js';
import type { NpcState, PlayerState } from './State.js';
import UpdatePacket from './UpdatePacket.js';

function playerPayloadMask(player: PlayerState, masks: number): number {
    let value = masks;
    if (player.say === null) {
        value &= ~PlayerInfoProt.SAY;
    }
    if (player.chat === null) {
        value &= ~PlayerInfoProt.CHAT;
    }
    if (player.exactMove === null) {
        value &= ~PlayerInfoProt.EXACT_MOVE;
    }
    return value;
}

function npcPayloadMask(npc: NpcState, masks: number): number {
    return npc.say === null ? masks & ~NpcInfoProt.SAY : masks;
}

function playerHeaderLength(masks: number): number {
    return masks > 0xff ? 2 : 1;
}

function writePlayerHeader(buf: UpdatePacket, masks: number): void {
    if (masks > 0xff) {
        buf.p1((masks & 0xff) | PlayerInfoProt.BIG);
        buf.p1(masks >>> 8);
    } else {
        buf.p1(masks);
    }
}

function writePlayerFaceCoord(buf: UpdatePacket, player: PlayerState): void {
    if (player.faceX !== -1) {
        buf.p2(player.faceX);
        buf.p2_alt1(player.faceZ);
    } else if (player.orientationX !== -1) {
        buf.p2(player.orientationX);
        buf.p2_alt1(player.orientationZ);
    } else {
        buf.p2(fine(player.coord.x, 1));
        buf.p2_alt1(fine(player.coord.z, 1));
    }
}

function writeNpcFaceCoord(buf: UpdatePacket, npc: NpcState): void {
    if (npc.faceX !== -1) {
        buf.p2_alt1(npc.faceX);
        buf.p2(npc.faceZ);
    } else if (npc.orientationX !== -1) {
        buf.p2_alt1(npc.orientationX);
        buf.p2(npc.orientationZ);
    } else {
        buf.p2_alt1(fine(npc.coord.x, 1));
        buf.p2(fine(npc.coord.z, 1));
    }
}

export function playerUpdateSize(player: PlayerState, masks: number): number {
    const value = playerPayloadMask(player, masks);
    if (value === 0) {
        return 0;
    }
    let size = playerHeaderLength(value);
    if ((value & PlayerInfoProt.APPEARANCE) !== 0) size += 1 + player.appearance.length;
    if ((value & PlayerInfoProt.SPOT_ANIM) !== 0) size += 6;
    if ((value & PlayerInfoProt.ANIM) !== 0) size += 3;
    if ((value & PlayerInfoProt.FACE_COORD) !== 0) size += 4;
    if ((value & PlayerInfoProt.EXACT_MOVE) !== 0) size += 9;
    if ((value & PlayerInfoProt.SAY) !== 0) size += 1 + (player.say?.length ?? 0);
    if ((value & PlayerInfoProt.FACE_ENTITY) !== 0) size += 2;
    if ((value & PlayerInfoProt.DAMAGE) !== 0) size += 4;
    if ((value & PlayerInfoProt.CHAT) !== 0) size += 4 + (player.chat?.bytes.length ?? 0);
    if ((value & PlayerInfoProt.DAMAGE2) !== 0) size += 4;
    return size;
}

export function npcUpdateSize(npc: NpcState, masks: number): number {
    const value = npcPayloadMask(npc, masks);
    if (value === 0) {
        return 0;
    }
    let size = 1;
    if ((value & NpcInfoProt.SAY) !== 0) size += 1 + (npc.say?.length ?? 0);
    if ((value & NpcInfoProt.FACE_COORD) !== 0) size += 4;
    if ((value & NpcInfoProt.DAMAGE) !== 0) size += 4;
    if ((value & NpcInfoProt.DAMAGE2) !== 0) size += 4;
    if ((value & NpcInfoProt.SPOT_ANIM) !== 0) size += 6;
    if ((value & NpcInfoProt.CHANGE_TYPE) !== 0) size += 2;
    if ((value & NpcInfoProt.FACE_ENTITY) !== 0) size += 2;
    if ((value & NpcInfoProt.ANIM) !== 0) size += 3;
    return size;
}

export function writePlayerUpdate(buf: UpdatePacket, player: PlayerState, observer: PlayerState, masks: number): void {
    const value = playerPayloadMask(player, masks);
    if (value === 0) {
        return;
    }
    writePlayerHeader(buf, value);
    if ((value & PlayerInfoProt.APPEARANCE) !== 0) {
        buf.p1_alt1(player.appearance.length);
        buf.pdata(player.appearance);
    }
    if ((value & PlayerInfoProt.SPOT_ANIM) !== 0) {
        buf.p2_alt3(player.graphicId);
        buf.p4_alt2((player.graphicHeight << 16) | (player.graphicDelay & 0xffff));
    }
    if ((value & PlayerInfoProt.ANIM) !== 0) {
        buf.p2_alt1(player.animId);
        buf.p1_alt1(player.animDelay);
    }
    if ((value & PlayerInfoProt.FACE_COORD) !== 0) {
        writePlayerFaceCoord(buf, player);
    }
    if ((value & PlayerInfoProt.EXACT_MOVE) !== 0 && player.exactMove) {
        const baseX = (((observer.origin.x >> 3) - 6) << 3);
        const baseZ = (((observer.origin.z >> 3) - 6) << 3);
        buf.p1_alt2(player.exactMove.startX - baseX);
        buf.p1_alt3(player.exactMove.startZ - baseZ);
        buf.p1_alt1(player.exactMove.endX - baseX);
        buf.p1_alt1(player.exactMove.endZ - baseZ);
        buf.p2_alt1(player.exactMove.begin);
        buf.p2_alt2(player.exactMove.finish);
        buf.p1(player.exactMove.direction);
    }
    if ((value & PlayerInfoProt.SAY) !== 0 && player.say !== null) buf.pjstr(player.say);
    if ((value & PlayerInfoProt.FACE_ENTITY) !== 0) buf.p2(player.faceEntity);
    if ((value & PlayerInfoProt.DAMAGE) !== 0) {
        buf.p1(player.damageTaken);
        buf.p1_alt3(player.damageType);
        buf.p1_alt2(player.currentHitpoints);
        buf.p1_alt3(player.baseHitpoints);
    }
    if ((value & PlayerInfoProt.CHAT) !== 0 && player.chat !== null) {
        buf.p2_alt3(((player.chat.color & 0xff) << 8) | (player.chat.effect & 0xff));
        buf.p1(player.chat.ignored);
        buf.p1_alt3(player.chat.bytes.length);
        buf.pdataReverseAdd128(player.chat.bytes);
    }
    if ((value & PlayerInfoProt.DAMAGE2) !== 0) {
        buf.p1_alt3(player.damageTaken2);
        buf.p1_alt1(player.damageType2);
        buf.p1(player.currentHitpoints);
        buf.p1_alt3(player.baseHitpoints);
    }
}

export function writeNpcUpdate(buf: UpdatePacket, npc: NpcState, masks: number): void {
    const value = npcPayloadMask(npc, masks);
    if (value === 0) {
        return;
    }
    buf.p1(value);
    if ((value & NpcInfoProt.SAY) !== 0 && npc.say !== null) buf.pjstr(npc.say);
    if ((value & NpcInfoProt.FACE_COORD) !== 0) writeNpcFaceCoord(buf, npc);
    if ((value & NpcInfoProt.DAMAGE) !== 0) {
        buf.p1_alt2(npc.damageTaken);
        buf.p1_alt2(npc.damageType);
        buf.p1_alt2(npc.currentHitpoints);
        buf.p1_alt1(npc.baseHitpoints);
    }
    if ((value & NpcInfoProt.DAMAGE2) !== 0) {
        buf.p1_alt2(npc.damageTaken2);
        buf.p1_alt1(npc.damageType2);
        buf.p1_alt3(npc.currentHitpoints);
        buf.p1(npc.baseHitpoints);
    }
    if ((value & NpcInfoProt.SPOT_ANIM) !== 0) {
        buf.p2_alt2(npc.graphicId);
        buf.p4_alt2((npc.graphicHeight << 16) | (npc.graphicDelay & 0xffff));
    }
    if ((value & NpcInfoProt.CHANGE_TYPE) !== 0) buf.p2_alt3(npc.type);
    if ((value & NpcInfoProt.FACE_ENTITY) !== 0) buf.p2_alt2(npc.faceEntity);
    if ((value & NpcInfoProt.ANIM) !== 0) {
        buf.p2_alt1(npc.animId);
        buf.p1_alt2(npc.animDelay);
    }
}
