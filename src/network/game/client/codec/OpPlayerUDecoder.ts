import Packet from '#/io/Packet.js';
import ClientGameMessageDecoder from '#/network/game/client/ClientGameMessageDecoder.js';
import ClientGameProt from '#/network/game/client/ClientGameProt.js';
import OpPlayerU from '#/network/game/client/model/OpPlayerU.js';

export default class OpPlayerUDecoder extends ClientGameMessageDecoder<OpPlayerU> {
    prot = ClientGameProt.OPPLAYERU;

    decode(buf: Packet) {
        const useCom = buf.g2();
        const useObj = buf.g2();
        const useSlot = buf.ig2_alt2();
        const playerSlot = buf.ig2_alt2();

        return new OpPlayerU(playerSlot, useObj, useSlot, useCom);
    }
}
