import Player from '#/engine/entity/Player.js';
import ClientGameMessageHandler from '#/network/game/client/ClientGameMessageHandler.js';
import MapBuildComplete from '#/network/game/client/model/MapBuildComplete.js';

export default class MapBuildCompleteHandler extends ClientGameMessageHandler<MapBuildComplete> {
    handle(_message: MapBuildComplete, player: Player): boolean {
        player.mapBuildPending = false;
        return true;
    }
}
