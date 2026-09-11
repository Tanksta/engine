import Packet from '#/io/Packet.js';

import ClientGameMessageDecoder from '#/network/game/client/ClientGameMessageDecoder.js';
import ClientGameProt from '#/network/game/client/ClientGameProt.js';
import EventCameraPosition from '#/network/game/client/model/EventCameraPosition.js';

export default class EventCameraPositionDecoder extends ClientGameMessageDecoder<EventCameraPosition> {
    prot = ClientGameProt.EVENT_CAMERA_POSITION;

    decode(buf: Packet) {
        const pitch = buf.ig2_alt2();
        const yaw = buf.ig2();

        return new EventCameraPosition(pitch, yaw);
    }
}
