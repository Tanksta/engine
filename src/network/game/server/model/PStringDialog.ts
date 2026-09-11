import ServerGameMessage from '#/network/game/server/ServerGameMessage.js';

export default class PStringDialog extends ServerGameMessage {
    constructor(
        readonly header: string
    ) {
        super();
    }
}
