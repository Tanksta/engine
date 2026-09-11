import Packet from '#/io/Packet.js';
import ClientGameMessageDecoder from '#/network/game/client/ClientGameMessageDecoder.js';
import ClientGameProt from '#/network/game/client/ClientGameProt.js';
import OpHeldT from '#/network/game/client/model/OpHeldT.js';

export default class OpHeldTDecoder extends ClientGameMessageDecoder<OpHeldT> {
    prot = ClientGameProt.OPHELDT;

    decode(buf: Packet) {
        const slot = buf.ig2();
        const com = buf.ig2();
        const obj = buf.ig2();
        const spellCom = buf.ig2();

        return new OpHeldT(obj, slot, com, spellCom);
    }
}
