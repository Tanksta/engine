import Packet from '#/io/Packet.js';
import ServerGameMessageEncoder from '#/network/game/server/ServerGameMessageEncoder.js';
import ServerGameProt from '#/network/game/server/ServerGameProt.js';
import IfOpenMainSide from '#/network/game/server/model/IfOpenMainSide.js';

export default class IfOpenMainSideEncoder extends ServerGameMessageEncoder<IfOpenMainSide> {
    prot = ServerGameProt.IF_OPENMAIN_SIDE;

    encode(buf: Packet, message: IfOpenMainSide): void {
        buf.ip2(message.main);
        buf.ip2_alt2(message.side);
    }
}
