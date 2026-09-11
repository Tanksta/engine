import Packet from '#/io/Packet.js';
import ClientGameMessageDecoder from '#/network/game/client/ClientGameMessageDecoder.js';
import ClientGameProt from '#/network/game/client/ClientGameProt.js';
import OpLocT from '#/network/game/client/model/OpLocT.js';

export default class OpLocTDecoder extends ClientGameMessageDecoder<OpLocT> {
    prot = ClientGameProt.OPLOCT;

    decode(buf: Packet) {
        const x = buf.g2_alt1();
        const z = buf.ig2();
        const loc = buf.ig2();
        const spellCom = buf.g2();

        return new OpLocT(x, z, loc, spellCom);
    }
}
