import Packet from '#/io/Packet.js';
import ServerGameMessageEncoder from '#/network/game/server/ServerGameMessageEncoder.js';
import ServerGameProt from '#/network/game/server/ServerGameProt.js';
import PStringDialog from '#/network/game/server/model/PStringDialog.js';

export default class PStringDialogEncoder extends ServerGameMessageEncoder<PStringDialog> {
    prot = ServerGameProt.P_STRINGDIALOG;

    encode(_: Packet, __: PStringDialog): void {
    }

    test(_: PStringDialog): number {
        return 0;
    }
}
