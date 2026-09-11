import Packet from '#/io/Packet.js';
import ServerGameMessageEncoder from '#/network/game/server/ServerGameMessageEncoder.js';
import ServerGameProt from '#/network/game/server/ServerGameProt.js';
import UpdateStat from '#/network/game/server/model/UpdateStat.js';

const SERVER_TO_CLIENT_STAT: readonly number[] = [
    0, 1, 2, 3, 4, 5, 6,
    7, 8, 9, 10, 11, 12,
    13, 14, 15, 16, 17,
    20, 18, 19
];

function serverToClientStat(stat: number): number {
    return SERVER_TO_CLIENT_STAT[stat] ?? stat;
}

export default class UpdateStatEncoder extends ServerGameMessageEncoder<UpdateStat> {
    prot = ServerGameProt.UPDATE_STAT;

    encode(buf: Packet, message: UpdateStat): void {
        buf.p1_alt3(serverToClientStat(message.stat));
        buf.p4_alt3((message.exp / 10) | 0);
        buf.p1(message.level); // not base level
    }
}
