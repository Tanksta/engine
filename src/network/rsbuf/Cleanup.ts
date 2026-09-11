import type { NpcState, PlayerState } from './State.js';

export function cleanupPlayerState(player: PlayerState): void {
    player.walkDir = -1;
    player.runDir = -1;
    player.jump = false;
    player.tele = false;
    player.masks = 0;
    player.faceX = -1;
    player.faceZ = -1;
    player.damageTaken = -1;
    player.damageType = -1;
    player.damageTaken2 = -1;
    player.damageType2 = -1;
    player.currentHitpoints = -1;
    player.baseHitpoints = -1;
    player.animId = -1;
    player.animDelay = -1;
    player.say = null;
    player.chat = null;
    player.graphicId = -1;
    player.graphicHeight = -1;
    player.graphicDelay = -1;
    player.exactMove = null;
}

export function cleanupNpcState(npc: NpcState): void {
    npc.walkDir = -1;
    npc.runDir = -1;
    npc.tele = false;
    npc.jump = false;
    npc.masks = 0;
    npc.faceX = -1;
    npc.faceZ = -1;
    npc.damageTaken = -1;
    npc.damageType = -1;
    npc.damageTaken2 = -1;
    npc.damageType2 = -1;
    npc.currentHitpoints = -1;
    npc.baseHitpoints = -1;
    npc.animId = -1;
    npc.animDelay = -1;
    npc.say = null;
    npc.graphicId = -1;
    npc.graphicHeight = -1;
    npc.graphicDelay = -1;
}
