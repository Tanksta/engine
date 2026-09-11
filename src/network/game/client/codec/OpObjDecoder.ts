import Packet from '#/io/Packet.js';
import ClientGameMessageDecoder from '#/network/game/client/ClientGameMessageDecoder.js';
import ClientGameProt from '#/network/game/client/ClientGameProt.js';
import OpObj from '#/network/game/client/model/OpObj.js';

export default class OpObjDecoder extends ClientGameMessageDecoder<OpObj> {
    constructor(
        readonly prot: ClientGameProt,
        readonly op: number
    ) {
        super();
    }

    decode(buf: Packet) {
        if (this.prot === ClientGameProt.OPOBJ1) {
            const x = buf.g2_alt1();
            const z = buf.g2();
            const obj = buf.ig2();
            return new OpObj(this.op, x, z, obj);
        }

        if (this.prot === ClientGameProt.OPOBJ2) {
            const x = buf.ig2_alt2();
            const obj = buf.ig2();
            const z = buf.g2_alt1();
            return new OpObj(this.op, x, z, obj);
        }

        if (this.prot === ClientGameProt.OPOBJ3) {
            const obj = buf.g2_alt1();
            const z = buf.ig2();
            const x = buf.g2_alt1();
            return new OpObj(this.op, x, z, obj);
        }

        if (this.prot === ClientGameProt.OPOBJ4) {
            const obj = buf.ig2();
            const x = buf.ig2_alt2();
            const z = buf.g2();
            return new OpObj(this.op, x, z, obj);
        }

        const x = buf.ig2_alt2();
        const z = buf.ig2();
        const obj = buf.ig2();
        return new OpObj(this.op, x, z, obj);
    }
}
