import Packet from '#/io/Packet.js';
import ServerGameMessageEncoder from '#/network/game/server/ServerGameMessageEncoder.js';
import ServerGameProt from '#/network/game/server/ServerGameProt.js';
import MessagePrivate from '#/network/game/server/model/MessagePrivate.js';
import WordPack from '#/wordenc/WordPack.js';

export default class MessagePrivateEncoder extends ServerGameMessageEncoder<MessagePrivate> {
    prot = ServerGameProt.MESSAGE_PRIVATE;

    encode(buf: Packet, message: MessagePrivate): void {
        buf.p8(message.from);
        buf.p4(message.messageId);
        buf.p1(message.staffModLevel & 0xff);
        WordPack.pack(buf, message.msg);
    }

    test(message: MessagePrivate): number {
        return 8 + 4 + 1 + 1 + message.msg.length;
    }
}
