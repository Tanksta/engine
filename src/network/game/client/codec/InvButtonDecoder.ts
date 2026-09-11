import Packet from '#/io/Packet.js';
import ClientGameMessageDecoder from '#/network/game/client/ClientGameMessageDecoder.js';
import ClientGameProt from '#/network/game/client/ClientGameProt.js';
import InvButton from '#/network/game/client/model/InvButton.js';

export default class InvButtonDecoder extends ClientGameMessageDecoder<InvButton> {
    constructor(
        readonly prot: ClientGameProt,
        readonly op: number
    ) {
        super();
    }

    decode(buf: Packet) {
        if (this.prot === ClientGameProt.INV_BUTTON1) {
            const com = buf.g2();
            const obj = buf.ig2();
            const slot = buf.g2_alt1();
            return new InvButton(this.op, obj, slot, com);
        }

        if (this.prot === ClientGameProt.INV_BUTTON2) {
            const com = buf.g2();
            const slot = buf.ig2_alt2();
            const obj = buf.ig2();
            return new InvButton(this.op, obj, slot, com);
        }

        if (this.prot === ClientGameProt.INV_BUTTON3) {
            const obj = buf.g2_alt1();
            const slot = buf.g2();
            const com = buf.g2();
            return new InvButton(this.op, obj, slot, com);
        }

        if (this.prot === ClientGameProt.INV_BUTTON4) {
            const slot = buf.g2_alt1();
            const obj = buf.ig2();
            const com = buf.g2();
            return new InvButton(this.op, obj, slot, com);
        }

        const obj = buf.g2();
        const slot = buf.g2_alt1();
        const com = buf.ig2_alt2();
        return new InvButton(this.op, obj, slot, com);
    }
}
