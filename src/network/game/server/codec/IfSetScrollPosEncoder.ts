import Packet from '#/io/Packet.js';
import ServerGameMessageEncoder from '#/network/game/server/ServerGameMessageEncoder.js';
import ServerGameProt from '#/network/game/server/ServerGameProt.js';
import IfSetScrollPos from '#/network/game/server/model/IfSetScrollPos.js';

export default class IfSetScrollPosEncoder extends ServerGameMessageEncoder<IfSetScrollPos> {
    prot = ServerGameProt.IF_SETSCROLLPOS;

    encode(buf: Packet, message: IfSetScrollPos): void {
        buf.ip2(message.y);
        buf.p2_alt2(message.component);
    }
}
