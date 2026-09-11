import Packet from '#/io/Packet.js';
import ServerGameZoneProt from '#/network/game/server/ServerGameZoneProt.js';
import ServerGameZoneMessageEncoder from '#/network/game/server/ServerGameZoneMessageEncoder.js';
import ObjReveal from '#/network/game/server/model/ObjReveal.js';

export default class ObjRevealEncoder extends ServerGameZoneMessageEncoder<ObjReveal> {
    prot = ServerGameZoneProt.OBJ_REVEAL;

    encode(buf: Packet, message: ObjReveal): void {
        buf.p2(message.receiverId);
        buf.ip2_alt2(message.obj);
        buf.p2_alt2(Math.min(message.count, 65535));
        buf.p1_alt3(message.coord);
    }
}
