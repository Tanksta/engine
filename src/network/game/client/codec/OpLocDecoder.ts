import Packet from '#/io/Packet.js';
import ClientGameMessageDecoder from '#/network/game/client/ClientGameMessageDecoder.js';
import ClientGameProt from '#/network/game/client/ClientGameProt.js';
import OpLoc from '#/network/game/client/model/OpLoc.js';

export default class OpLocDecoder extends ClientGameMessageDecoder<OpLoc> {
    constructor(
        readonly prot: ClientGameProt,
        readonly op: number
    ) {
        super();
    }

    decode(buf: Packet) {
        if (this.prot === ClientGameProt.OPLOC1) {
            const loc = buf.g2_alt1();
            const z = buf.ig2_alt2();
            const x = buf.ig2_alt2();
            return new OpLoc(this.op, x, z, loc);
        }

        if (this.prot === ClientGameProt.OPLOC2) {
            const loc = buf.g2_alt1();
            const x = buf.ig2_alt2();
            const z = buf.ig2();
            return new OpLoc(this.op, x, z, loc);
        }

        if (this.prot === ClientGameProt.OPLOC3) {
            const loc = buf.ig2_alt2();
            const z = buf.ig2();
            const x = buf.ig2();
            return new OpLoc(this.op, x, z, loc);
        }

        if (this.prot === ClientGameProt.OPLOC4) {
            const x = buf.ig2_alt2();
            const z = buf.g2();
            const loc = buf.ig2_alt2();
            return new OpLoc(this.op, x, z, loc);
        }

        const x = buf.ig2_alt2();
        const loc = buf.ig2_alt2();
        const z = buf.ig2_alt2();
        return new OpLoc(this.op, x, z, loc);
    }
}
