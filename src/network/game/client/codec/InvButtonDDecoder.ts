import Packet from '#/io/Packet.js';
import ClientGameMessageDecoder from '#/network/game/client/ClientGameMessageDecoder.js';
import ClientGameProt from '#/network/game/client/ClientGameProt.js';
import InvButtonD from '#/network/game/client/model/InvButtonD.js';

export default class InvButtonDDecoder extends ClientGameMessageDecoder<InvButtonD> {
    prot = ClientGameProt.INV_BUTTOND;

    decode(buf: Packet) {
        const slot = buf.g2();
        const mode = buf.g1_alt2();
        const targetSlot = buf.g2_alt1();
        const com = buf.g2();

        return new InvButtonD(com, slot, targetSlot, mode);
    }
}
