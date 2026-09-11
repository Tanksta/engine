import { withinDistanceSw } from './Coord.js';
import { PREFERRED_NPCS, PREFERRED_VIEW_DISTANCE } from './BuildArea.js';
import { NpcInfoProt } from './Protocol.js';
import { npcUpdateSize, writeNpcUpdate } from './RenderBlocks.js';
import type { NpcInfoRequest, NpcState, PlayerState } from './State.js';
import UpdatePacket from './UpdatePacket.js';
import type ZoneMap from './ZoneMap.js';

const BITS_ADD = 14 + 1 + 13 + 1 + 5 + 5;
const BITS_RUN = 1 + 2 + 3 + 3 + 1;
const BITS_WALK = 1 + 2 + 3 + 1;
const BITS_EXTEND = 1 + 2;
const BODY_SIZE_LIMIT = 4997;

export type NpcInfoContext = {
    readonly request: NpcInfoRequest;
    readonly npcs: (NpcState | null)[];
    readonly zoneMap: ZoneMap;
    readonly player: PlayerState;
};

export default class NpcInfoWriter {
    private readonly buf = new UpdatePacket();
    private readonly updates = new UpdatePacket();

    encode(context: NpcInfoContext): Uint8Array {
        const build = context.player.build;
        if (context.request.rebuild || context.request.dx > PREFERRED_VIEW_DISTANCE || context.request.dz > PREFERRED_VIEW_DISTANCE) {
            build.rebuildNpcs();
        }

        this.buf.reset();
        this.updates.reset();
        this.buf.bits();
        const bytes = this.writeVisibleNpcs(context, context.request.pos);
        this.writeNewNpcs(context, bytes);
        this.finish();
        return this.buf.toUint8Array();
    }

    private writeVisibleNpcs(context: NpcInfoContext, bytesSoFar: number): number {
        let bytes = bytesSoFar;
        const build = context.player.build;
        this.buf.pBit(8, build.npcs.size);
        for (const nid of build.npcs.snapshot()) {
            const other = context.npcs[nid];
            if (!other || this.shouldRemove(context.player, other)) {
                this.remove(build.npcs, nid);
                if (other) {
                    other.observers = Math.max(0, other.observers - 1);
                }
                continue;
            }
            const len = npcUpdateSize(other, other.masks);
            if (other.runDir !== -1) {
                this.run(other, len > 0 && this.fits(bytes + 1, BITS_RUN, len));
            } else if (other.walkDir !== -1) {
                this.walk(other, len > 0 && this.fits(bytes + 1, BITS_WALK, len));
            } else if (len > 0 && this.fits(bytes + 1, BITS_EXTEND, len)) {
                this.extend(other);
            } else {
                this.buf.pBit(1, 0);
            }
            bytes += len + 1;
        }
        return bytes;
    }

    private writeNewNpcs(context: NpcInfoContext, bytesSoFar: number): void {
        let bytes = bytesSoFar;
        const build = context.player.build;
        for (const nid of build.nearbyNpcs({ npcs: context.npcs, zoneMap: context.zoneMap, observer: context.player })) {
            if (build.npcs.size >= PREFERRED_NPCS) {
                return;
            }
            const other = context.npcs[nid];
            if (!other) {
                continue;
            }
            const masks = this.lowDefinitionMask(other);
            const len = npcUpdateSize(other, masks);
            if (!this.fits(bytes + 1, BITS_ADD, len)) {
                return;
            }
            this.buf.pBit(14, nid);
            this.buf.pBit(1, other.jump ? 1 : 0);
            this.buf.pBit(13, other.type);
            this.buf.pBit(1, 1);
            this.buf.pBit(5, other.coord.z - context.player.coord.z);
            this.buf.pBit(5, other.coord.x - context.player.coord.x);
            writeNpcUpdate(this.updates, other, masks);
            build.npcs.add(nid);
            other.observers++;
            bytes += len + 1;
        }
    }

    private lowDefinitionMask(npc: NpcState): number {
        let masks = npc.masks | NpcInfoProt.FACE_COORD;
        if (npc.faceEntity !== -1) {
            masks |= NpcInfoProt.FACE_ENTITY;
        }
        return masks;
    }

    private shouldRemove(observer: PlayerState, npc: NpcState): boolean {
        return npc.nid === -1 || npc.tele || npc.coord.level !== observer.coord.level || !withinDistanceSw(observer.coord, npc.coord, PREFERRED_VIEW_DISTANCE) || !npc.active;
    }

    private run(npc: NpcState, extend: boolean): void {
        this.buf.pBit(1, 1);
        this.buf.pBit(2, 2);
        this.buf.pBit(3, npc.walkDir);
        this.buf.pBit(3, npc.runDir);
        this.writeOptionalExtend(npc, extend);
    }

    private walk(npc: NpcState, extend: boolean): void {
        this.buf.pBit(1, 1);
        this.buf.pBit(2, 1);
        this.buf.pBit(3, npc.walkDir);
        this.writeOptionalExtend(npc, extend);
    }

    private extend(npc: NpcState): void {
        this.buf.pBit(1, 1);
        this.buf.pBit(2, 0);
        writeNpcUpdate(this.updates, npc, npc.masks);
    }

    private writeOptionalExtend(npc: NpcState, extend: boolean): void {
        this.buf.pBit(1, extend ? 1 : 0);
        if (extend) {
            writeNpcUpdate(this.updates, npc, npc.masks);
        }
    }

    private remove(ids: { delete(id: number): void }, nid: number): void {
        this.buf.pBit(1, 1);
        this.buf.pBit(2, 3);
        ids.delete(nid);
    }

    private finish(): void {
        if (this.updates.pos > 0) {
            this.buf.pBit(14, 16383);
            this.buf.bytes();
            this.buf.append(this.updates.toUint8Array());
        } else {
            this.buf.bytes();
        }
    }

    private fits(bytes: number, bitsToAdd: number, bytesToAdd: number): boolean {
        return (((this.buf.bitPos + bitsToAdd + 7) >>> 3) + bytes + bytesToAdd) <= BODY_SIZE_LIMIT;
    }
}
