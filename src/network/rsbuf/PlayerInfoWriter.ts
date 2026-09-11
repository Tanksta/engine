import { localTeleportCoord, withinDistanceSw } from './Coord.js';
import { PREFERRED_PLAYERS } from './BuildArea.js';
import { PlayerInfoProt, Visibility } from './Protocol.js';
import { playerUpdateSize, writePlayerUpdate } from './RenderBlocks.js';
import type { PlayerInfoRequest, PlayerState } from './State.js';
import UpdatePacket from './UpdatePacket.js';
import type ZoneMap from './ZoneMap.js';

const BITS_ADD = 11 + 5 + 1 + 5 + 1;
const BITS_RUN = 1 + 2 + 3 + 3 + 1;
const BITS_WALK = 1 + 2 + 3 + 1;
const BITS_EXTEND = 1 + 2;
const BODY_SIZE_LIMIT = 4997;

export type PlayerInfoContext = {
    readonly request: PlayerInfoRequest;
    readonly players: readonly (PlayerState | null)[];
    readonly playerGrid: ReadonlyMap<number, readonly number[]>;
    readonly zoneMap: ZoneMap;
    readonly player: PlayerState;
};

export default class PlayerInfoWriter {
    private readonly buf = new UpdatePacket();
    private readonly updates = new UpdatePacket();

    encode(context: PlayerInfoContext): Uint8Array {
        const build = context.player.build;
        if (context.request.rebuild || context.request.dx > build.viewDistance || context.request.dz > build.viewDistance) {
            build.rebuildPlayers({ players: context.players, playerGrid: context.playerGrid, zoneMap: context.zoneMap, observer: context.player });
        } else {
            build.resize();
        }

        this.buf.reset();
        this.updates.reset();
        this.buf.bits();
        const localBytes = this.writeLocalPlayer(context.player);
        const visibleBytes = this.writeVisiblePlayers(context, localBytes + context.request.pos);
        this.writeNewPlayers(context, visibleBytes);
        this.finish(11, 2047);
        return this.buf.toUint8Array();
    }

    private writeLocalPlayer(player: PlayerState): number {
        const masks = this.localPlayerMask(player);
        const len = playerUpdateSize(player, masks);
        if (player.tele) {
            const local = localTeleportCoord(player.coord, player.origin);
            this.teleport(player, player, local.x, local.level, local.z, player.jump, len > 0);
        } else if (player.runDir !== -1) {
            this.run(player, player, len > 0);
        } else if (player.walkDir !== -1) {
            this.walk(player, player, len > 0);
        } else if (len > 0) {
            this.extend(player, player);
        } else {
            this.buf.pBit(1, 0);
        }
        return len;
    }

    private localPlayerMask(player: PlayerState): number {
        let masks = player.masks & ~PlayerInfoProt.CHAT;
        if (player.lastAppearance !== -1 && !player.build.hasAppearance(player.pid, player.lastAppearance)) {
            masks |= PlayerInfoProt.APPEARANCE;
        }
        return masks;
    }

    private writeVisiblePlayers(context: PlayerInfoContext, bytesSoFar: number): number {
        let bytes = bytesSoFar;
        const build = context.player.build;
        this.buf.pBit(8, build.players.size);
        for (const pid of build.players.snapshot()) {
            const other = context.players[pid];
            if (!other || this.shouldRemove(context.player, other)) {
                this.remove(build.players, pid);
                continue;
            }
            const masks = context.player.pid === other.pid ? this.localPlayerMask(other) : other.masks;
            const len = playerUpdateSize(other, masks);
            if (other.runDir !== -1) {
                this.run(context.player, other, len > 0 && this.fits(bytes + 2, BITS_RUN, len));
            } else if (other.walkDir !== -1) {
                this.walk(context.player, other, len > 0 && this.fits(bytes + 2, BITS_WALK, len));
            } else if (len > 0 && this.fits(bytes + 2, BITS_EXTEND, len)) {
                this.extend(context.player, other);
            } else {
                this.buf.pBit(1, 0);
            }
            bytes += len + 2;
        }
        return bytes;
    }

    private writeNewPlayers(context: PlayerInfoContext, bytesSoFar: number): void {
        let bytes = bytesSoFar;
        const build = context.player.build;
        for (const pid of build.nearbyPlayers({ players: context.players, playerGrid: context.playerGrid, zoneMap: context.zoneMap, observer: context.player })) {
            if (build.players.size >= PREFERRED_PLAYERS) {
                return;
            }
            const other = context.players[pid];
            if (!other || other.visibility === Visibility.HARD) {
                continue;
            }
            const masks = this.lowDefinitionMask(context.player, other);
            const len = playerUpdateSize(other, masks);
            if (!this.fits(bytes + 2, BITS_ADD, len)) {
                return;
            }
            this.buf.pBit(11, pid);
            this.buf.pBit(5, other.coord.z - context.player.coord.z);
            this.buf.pBit(1, 1);
            this.buf.pBit(5, other.coord.x - context.player.coord.x);
            this.buf.pBit(1, other.jump ? 1 : 0);
            writePlayerUpdate(this.updates, other, context.player, masks);
            this.saveAppearanceWhenSent(context.player, other, masks);
            build.players.add(pid);
            bytes += len + 2;
        }
    }

    private lowDefinitionMask(observer: PlayerState, other: PlayerState): number {
        let masks = other.masks;
        if (other.lastAppearance !== -1 && !observer.build.hasAppearance(other.pid, other.lastAppearance)) {
            masks |= PlayerInfoProt.APPEARANCE;
        } else {
            masks &= ~PlayerInfoProt.APPEARANCE;
        }
        if (other.faceEntity !== -1) {
            masks |= PlayerInfoProt.FACE_ENTITY;
        }
        return masks | PlayerInfoProt.FACE_COORD;
    }

    private shouldRemove(observer: PlayerState, other: PlayerState): boolean {
        return other.pid === -1 || other.tele || other.coord.level !== observer.coord.level || !withinDistanceSw(observer.coord, other.coord, observer.build.viewDistance) || !other.active || other.visibility === Visibility.HARD;
    }

    private teleport(observer: PlayerState, other: PlayerState, x: number, level: number, z: number, jump: boolean, extend: boolean): void {
        this.buf.pBit(1, 1);
        this.buf.pBit(2, 3);
        this.buf.pBit(7, x);
        this.buf.pBit(7, z);
        this.buf.pBit(2, level);
        this.buf.pBit(1, jump ? 1 : 0);
        this.writeOptionalExtend(observer, other, extend);
    }

    private run(observer: PlayerState, other: PlayerState, extend: boolean): void {
        this.buf.pBit(1, 1);
        this.buf.pBit(2, 2);
        this.buf.pBit(3, other.walkDir);
        this.buf.pBit(3, other.runDir);
        this.writeOptionalExtend(observer, other, extend);
    }

    private walk(observer: PlayerState, other: PlayerState, extend: boolean): void {
        this.buf.pBit(1, 1);
        this.buf.pBit(2, 1);
        this.buf.pBit(3, other.walkDir);
        this.writeOptionalExtend(observer, other, extend);
    }

    private extend(observer: PlayerState, other: PlayerState): void {
        this.buf.pBit(1, 1);
        this.buf.pBit(2, 0);
        this.highDefinition(observer, other);
    }

    private writeOptionalExtend(observer: PlayerState, other: PlayerState, extend: boolean): void {
        this.buf.pBit(1, extend ? 1 : 0);
        if (extend) {
            this.highDefinition(observer, other);
        }
    }

    private highDefinition(observer: PlayerState, other: PlayerState): void {
        const masks = observer.pid === other.pid ? this.localPlayerMask(other) : other.masks;
        writePlayerUpdate(this.updates, other, observer, masks);
        this.saveAppearanceWhenSent(observer, other, masks);
    }

    private saveAppearanceWhenSent(observer: PlayerState, other: PlayerState, masks: number): void {
        if ((masks & PlayerInfoProt.APPEARANCE) !== 0 && other.lastAppearance !== -1) {
            observer.build.saveAppearance(other.pid, other.lastAppearance);
        }
    }

    private remove(ids: { delete(id: number): void }, pid: number): void {
        this.buf.pBit(1, 1);
        this.buf.pBit(2, 3);
        ids.delete(pid);
    }

    private finish(sentinelWidth: number, sentinel: number): void {
        if (this.updates.pos > 0) {
            this.buf.pBit(sentinelWidth, sentinel);
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
