import { PlayerInfoProt } from '#/network/rsbuf/index.js';

import Player from '#/engine/entity/Player.js';
import Packet from '#/io/Packet.js';
import ClientGameMessageHandler from '#/network/game/client/ClientGameMessageHandler.js';
import { consumeRottenPotatoPrompt } from '#/network/game/client/handler/admin/RottenPotatoPrompt.js';
import MessagePublic from '#/network/game/client/model/MessagePublic.js';
import WordPack from '#/wordenc/WordPack.js';

export default class MessagePublicHandler extends ClientGameMessageHandler<MessagePublic> {
    private chatRights(player: Player): number {
        let staff = player.staffModLevel;
        if (staff < 0) {
            staff = 0;
        } else if (staff > 3) {
            staff = 3;
        }

        return staff;
    }

    handle(message: MessagePublic, player: Player): boolean {
        const { colour, effect, input } = message;

        if (player.socialProtect || colour < 0 || colour > 11 || effect < 0 || effect > 5 || input.length > 100) {
            return false;
        }

        if (player.muted_until !== null && player.muted_until > new Date()) {
            // todo: do we still log their attempt to chat?
            return false;
        }

        const buf: Packet = Packet.alloc(0);
        buf.pdata(input, 0, input.length);
        buf.pos = 0;
        const unpack: string = WordPack.unpack(buf, input.length);
        buf.release();

        if (consumeRottenPotatoPrompt(player, unpack)) {
            return true;
        }

        player.chatColour = colour;
        player.chatEffect = effect;
        player.chatRights = this.chatRights(player);
        player.chatRawMessage = unpack;
        player.logMessage = unpack;

        const out: Packet = Packet.alloc(0);
        WordPack.pack(out, unpack);
        player.chatMessage = new Uint8Array(out.pos);
        out.pos = 0;
        out.gdata(player.chatMessage, 0, player.chatMessage.length);
        out.release();
        player.masks |= PlayerInfoProt.CHAT;

        player.socialProtect = true;
        return true;
    }
}
