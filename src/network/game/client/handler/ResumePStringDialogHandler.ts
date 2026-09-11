import Player from '#/engine/entity/Player.js';
import ClientGameMessageHandler from '#/network/game/client/ClientGameMessageHandler.js';
import { consumeRottenPotatoPrompt } from '#/network/game/client/handler/admin/RottenPotatoPrompt.js';
import ResumePStringDialog from '#/network/game/client/model/ResumePStringDialog.js';

export default class ResumePStringDialogHandler extends ClientGameMessageHandler<ResumePStringDialog> {
    handle(message: ResumePStringDialog, player: Player): boolean {
        return consumeRottenPotatoPrompt(player, message.input);
    }
}
