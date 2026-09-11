import Packet from '#/io/Packet.js';
import ClientGameMessageDecoder from '#/network/game/client/ClientGameMessageDecoder.js';
import ClientGameProt from '#/network/game/client/ClientGameProt.js';
import OpNpcU from '#/network/game/client/model/OpNpcU.js';

export default class OpNpcUDecoder extends ClientGameMessageDecoder<OpNpcU> {
    prot = ClientGameProt.OPNPCU;

    decode(buf: Packet) {
        const useSlot = buf.ig2_alt2();
        const useObj = buf.ig2_alt2();
        const npcSlot = buf.ig2();
        const useCom = buf.ig2_alt2();

        return new OpNpcU(npcSlot, useObj, useSlot, useCom);
    }
}
