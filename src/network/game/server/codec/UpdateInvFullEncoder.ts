import Component from '#/cache/config/Component.js';
import Packet from '#/io/Packet.js';
import ServerGameMessageEncoder from '#/network/game/server/ServerGameMessageEncoder.js';
import ServerGameProt from '#/network/game/server/ServerGameProt.js';
import UpdateInvFull from '#/network/game/server/model/UpdateInvFull.js';

export default class UpdateInvFullEncoder extends ServerGameMessageEncoder<UpdateInvFull> {
    prot = ServerGameProt.UPDATE_INV_FULL;

    encode(buf: Packet, message: UpdateInvFull): void {
        const { component, inv } = message;

        const comType = Component.get(component);
        const size = Math.min(inv.capacity, comType.width * comType.height);

        // todo: size should be the index of the last non-empty slot
        buf.p2(component);
        buf.p2(size);
        for (let slot = 0; slot < size; slot++) {
            const obj = inv.get(slot);

            if (obj) {
                if (obj.count >= 255) {
                    buf.p1_alt1(255);
                    buf.ip4(obj.count);
                } else {
                    buf.p1_alt1(obj.count);
                }

                buf.ip2(obj.id + 1);
            } else {
                buf.p1_alt1(0);
                buf.ip2(0);
            }
        }
    }

    test(message: UpdateInvFull): number {
        const { component, inv } = message;

        const comType = Component.get(component);
        const size = Math.min(inv.capacity, comType.width * comType.height);

        let length: number = 0;
        length += 4;
        for (let slot = 0; slot < size; slot++) {
            const obj = inv.get(slot);
            if (obj) {
                length += 2;

                if (obj.count >= 255) {
                    length += 5;
                } else {
                    length += 1;
                }
            } else {
                length += 3;
            }
        }
        return length;
    }
}
