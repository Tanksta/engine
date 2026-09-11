import Packet from '#/io/Packet.js';
import ServerGameMessageEncoder from '#/network/game/server/ServerGameMessageEncoder.js';
import ServerGameProt from '#/network/game/server/ServerGameProt.js';
import IfSetHide from '#/network/game/server/model/IfSetHide.js';

export default class IfSetHideEncoder extends ServerGameMessageEncoder<IfSetHide> {
    prot = ServerGameProt.IF_SETHIDE;

    encode(buf: Packet, message: IfSetHide): void {
        buf.p1_alt2(message.hidden ? 1 : 0);
        buf.p2(message.component);
    }
}
