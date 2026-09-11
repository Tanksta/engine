import Packet from '#/io/Packet.js';
import ClientGameMessageDecoder from '#/network/game/client/ClientGameMessageDecoder.js';
import ClientGameProt from '#/network/game/client/ClientGameProt.js';
import OpHeldU from '#/network/game/client/model/OpHeldU.js';

export default class OpHeldUDecoder extends ClientGameMessageDecoder<OpHeldU> {
    prot = ClientGameProt.OPHELDU;

    decode(buf: Packet) {
        const slot = buf.ig2();
        const useSlot = buf.g2_alt1();
        const useObj = buf.g2_alt1();
        const useCom = buf.ig2();
        const com = buf.ig2_alt2();
        const obj = buf.g2();

        return new OpHeldU(obj, slot, com, useObj, useSlot, useCom);
    }
}
