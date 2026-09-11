import Packet from '#/io/Packet.js';
import ClientGameMessageDecoder from '#/network/game/client/ClientGameMessageDecoder.js';
import ClientGameProt from '#/network/game/client/ClientGameProt.js';
import OpPlayer from '#/network/game/client/model/OpPlayer.js';

export default class OpPlayerDecoder extends ClientGameMessageDecoder<OpPlayer> {
    constructor(
        readonly prot: ClientGameProt,
        readonly op: number
    ) {
        super();
    }

    decode(buf: Packet) {
        if (this.prot === ClientGameProt.OPPLAYER1) {
            return new OpPlayer(this.op, buf.g2());
        }

        if (this.prot === ClientGameProt.OPPLAYER2 || this.prot === ClientGameProt.OPPLAYER4) {
            return new OpPlayer(this.op, buf.ig2_alt2());
        }

        return new OpPlayer(this.op, buf.ig2());
    }
}
