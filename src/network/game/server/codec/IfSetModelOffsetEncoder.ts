import Packet from '#/io/Packet.js';
import ServerGameMessageEncoder from '#/network/game/server/ServerGameMessageEncoder.js';
import ServerGameProt from '#/network/game/server/ServerGameProt.js';
import IfSetModelOffset from '#/network/game/server/model/IfSetModelOffset.js';

export default class IfSetModelOffsetEncoder extends ServerGameMessageEncoder<IfSetModelOffset> {
    prot = ServerGameProt.IF_SETMODELOFFSET;

    encode(buf: Packet, message: IfSetModelOffset): void {
        buf.ip2(message.x);
        buf.ip2_alt2(message.y);
        buf.p2(message.component);
    }
}
