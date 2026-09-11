import Packet from '#/io/Packet.js';
import ServerGameMessageEncoder from '#/network/game/server/ServerGameMessageEncoder.js';
import ServerGameProt from '#/network/game/server/ServerGameProt.js';
import IfSetObject from '#/network/game/server/model/IfSetObject.js';

export default class IfSetObjectEncoder extends ServerGameMessageEncoder<IfSetObject> {
    prot = ServerGameProt.IF_SETOBJECT;

    encode(buf: Packet, message: IfSetObject): void {
        buf.p2_alt2(message.obj);
        buf.ip2_alt2(message.scale);
        buf.ip2_alt2(message.component);
    }
}
