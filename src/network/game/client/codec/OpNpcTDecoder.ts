import Packet from '#/io/Packet.js';
import ClientGameMessageDecoder from '#/network/game/client/ClientGameMessageDecoder.js';
import ClientGameProt from '#/network/game/client/ClientGameProt.js';
import OpNpcT from '#/network/game/client/model/OpNpcT.js';

export default class OpNpcTDecoder extends ClientGameMessageDecoder<OpNpcT> {
    prot = ClientGameProt.OPNPCT;

    decode(buf: Packet) {
        const npcSlot = buf.ig2_alt2();
        const spellCom = buf.ig2_alt2();

        return new OpNpcT(npcSlot, spellCom);
    }
}
