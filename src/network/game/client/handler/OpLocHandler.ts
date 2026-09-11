import LocType from '#/cache/config/LocType.js';
import { CoordGrid } from '#/engine/CoordGrid.js';
import Loc from '#/engine/entity/Loc.js';
import { Interaction } from '#/engine/entity/Interaction.js';
import { NetworkPlayer } from '#/engine/entity/NetworkPlayer.js';
import ServerTriggerType from '#/engine/script/ServerTriggerType.js';
import World from '#/engine/World.js';
import ClientGameMessageHandler from '#/network/game/client/ClientGameMessageHandler.js';
import OpLoc from '#/network/game/client/model/OpLoc.js';
import UnsetMapFlag from '#/network/game/server/model/UnsetMapFlag.js';

export function resolveLocTypeForPlayer(player: NetworkPlayer, loc: Loc): LocType | null {
    const type = LocType.get(loc.type);
    if (!type) {
        return null;
    }

    const resolvedId = type.getMultiLocId(id => player.getVarBit(id), id => player.getVar(id) as number);
    if (resolvedId === -1) {
        return null;
    }

    if (resolvedId !== type.id) {
        return LocType.get(resolvedId) ?? null;
    }

    return type;
}

export function findRequestedLoc(player: NetworkPlayer, x: number, z: number, level: number, requestedId: number): { loc: Loc; type: LocType } | null {
    const exact = World.getLoc(x, z, level, requestedId);
    if (exact) {
        const resolved = resolveLocTypeForPlayer(player, exact);
        return resolved ? { loc: exact, type: resolved } : null;
    }

    const coord = CoordGrid.packZoneCoord(x, z);
    const zone = World.gameMap.getZone(x, z, level);
    for (const loc of zone.getLocsSafe(coord)) {
        const resolved = resolveLocTypeForPlayer(player, loc);
        if (resolved && resolved.id === requestedId) {
            return { loc, type: resolved };
        }
    }

    const zoneX = x >> 3;
    const zoneZ = z >> 3;
    for (let searchZoneX = zoneX - 1; searchZoneX <= zoneX + 1; searchZoneX++) {
        for (let searchZoneZ = zoneZ - 1; searchZoneZ <= zoneZ + 1; searchZoneZ++) {
            const searchX = searchZoneX << 3;
            const searchZ = searchZoneZ << 3;
            const searchZone = World.gameMap.getZone(searchX, searchZ, level);
            for (const loc of searchZone.getAllLocsUnsafe()) {
                const resolved = resolveLocTypeForPlayer(player, loc);
                if (!resolved || resolved.id !== requestedId) {
                    continue;
                }

                let width = resolved.width;
                let length = resolved.length;
                if ((loc.angle & 0x1) === 1) {
                    width = resolved.length;
                    length = resolved.width;
                }

                if (x >= loc.x && x < loc.x + width && z >= loc.z && z < loc.z + length) {
                    return { loc, type: resolved };
                }
            }
        }
    }

    return null;
}

export default class OpLocHandler extends ClientGameMessageHandler<OpLoc> {
    handle(message: OpLoc, player: NetworkPlayer): boolean {
        const { x, z, loc: locId } = message;

        if (player.delayed) {
            // normal: cannot interact while delayed
            player.write(new UnsetMapFlag());
            return false;
        }

        const absLeftX = player.originX - 52;
        const absRightX = player.originX + 52;
        const absTopZ = player.originZ + 52;
        const absBottomZ = player.originZ - 52;
        if (x < absLeftX || x > absRightX || z < absBottomZ || z > absTopZ) {
            // bad client: tile is not visible on client
            player.write(new UnsetMapFlag());
            return false;
        }

        const match = findRequestedLoc(player, x, z, player.level, locId);
        if (!match) {
            // bad client or lag: loc does not exist
            player.write(new UnsetMapFlag());
            return false;
        }

        const { loc, type: locType } = match;
        if (!locType.op || locType.op[message.op - 1] === null || locType.op[message.op - 1] === 'hidden') {
            // bad client: not a valid loc option
            player.write(new UnsetMapFlag());
            return false;
        }

        const trigger: ServerTriggerType = ServerTriggerType.APLOC1 + (message.op - 1);
        player.clearPendingAction();
        player.setInteraction(Interaction.ENGINE, loc, trigger);
        player.targetSubject.type = locType.id;
        player.opcalled = true;
        return true;
    }
}
