import Packet from '#/io/Packet.js';
import ClientGameMessageDecoder from '#/network/game/client/ClientGameMessageDecoder.js';
import ClientGameProt from '#/network/game/client/ClientGameProt.js';
import OpLocU from '#/network/game/client/model/OpLocU.js';

export default class OpLocUDecoder extends ClientGameMessageDecoder<OpLocU> {
    prot = ClientGameProt.OPLOCU;

    decode(buf: Packet) {
        const x = buf.ig2_alt2();
        const loc = buf.ig2();
        const z = buf.ig2();
        const useSlot = buf.ig2_alt2();
        const useObj = buf.g2();
        const useCom = buf.g2();

        return new OpLocU(x, z, loc, useObj, useSlot, useCom);
    }
}
