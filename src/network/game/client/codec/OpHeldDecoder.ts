import Packet from '#/io/Packet.js';
import ClientGameMessageDecoder from '#/network/game/client/ClientGameMessageDecoder.js';
import ClientGameProt from '#/network/game/client/ClientGameProt.js';
import OpHeld from '#/network/game/client/model/OpHeld.js';

export default class OpHeldDecoder extends ClientGameMessageDecoder<OpHeld> {
    constructor(
        readonly prot: ClientGameProt,
        readonly op: number
    ) {
        super();
    }

    decode(buf: Packet) {
        if (this.prot === ClientGameProt.OPHELD1) {
            const com = buf.ig2();
            const obj = buf.g2_alt1();
            const slot = buf.ig2();
            return new OpHeld(this.op, obj, slot, com);
        }

        if (this.prot === ClientGameProt.OPHELD2) {
            const obj = buf.g2();
            const com = buf.g2_alt1();
            const slot = buf.ig2();
            return new OpHeld(this.op, obj, slot, com);
        }

        if (this.prot === ClientGameProt.OPHELD3) {
            const slot = buf.g2_alt1();
            const obj = buf.g2();
            const com = buf.g2();
            return new OpHeld(this.op, obj, slot, com);
        }

        if (this.prot === ClientGameProt.OPHELD4) {
            const slot = buf.ig2();
            const obj = buf.ig2();
            const com = buf.g2();
            return new OpHeld(this.op, obj, slot, com);
        }

        const obj = buf.g2_alt1();
        const com = buf.g2_alt1();
        const slot = buf.ig2();
        return new OpHeld(this.op, obj, slot, com);
    }
}
