import Packet from '#/io/Packet.js';
import ClientGameMessageDecoder from '#/network/game/client/ClientGameMessageDecoder.js';
import ClientGameProt from '#/network/game/client/ClientGameProt.js';
import MessagePublic from '#/network/game/client/model/MessagePublic.js';

export default class MessagePublicDecoder extends ClientGameMessageDecoder<MessagePublic> {
    prot = ClientGameProt.MESSAGE_PUBLIC;

    decode(buf: Packet, length: number) {
        const color = buf.g1_alt1();
        const effect = buf.g1_alt1();
        const packedLength = length - 2;
        const input = new Uint8Array(packedLength);

        for (let index: number = packedLength - 1; index >= 0; index--) {
            input[index] = (buf.g1() - 128) & 0xff;
        }

        return new MessagePublic(input, color, effect);
    }
}
