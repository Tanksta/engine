import Packet from '#/io/Packet.js';
import ServerGameMessageEncoder from '#/network/game/server/ServerGameMessageEncoder.js';
import ServerGameProt from '#/network/game/server/ServerGameProt.js';
import UpdatePid from '#/network/game/server/model/UpdatePid.js';

export default class UpdatePidEncoder extends ServerGameMessageEncoder<UpdatePid> {
    prot = ServerGameProt.UPDATE_PID;

    encode(buf: Packet, message: UpdatePid): void {
        buf.ip2_alt2(message.uid);
        buf.p1_alt1(message.members ? 1 : 0);
    }
}
