import Packet from '#/io/Packet.js';
import ServerGameMessageEncoder from '#/network/game/server/ServerGameMessageEncoder.js';
import ServerGameProt from '#/network/game/server/ServerGameProt.js';
import LastLoginInfo from '#/network/game/server/model/LastLoginInfo.js';

export default class LastLoginInfoEncoder extends ServerGameMessageEncoder<LastLoginInfo> {
    prot = ServerGameProt.LAST_LOGIN_INFO;

    encode(buf: Packet, message: LastLoginInfo): void {
        const currentDay = Math.floor(Date.now() / 86_400_000) - 11745;
        const recoveryDay = message.daysSinceRecoveryChange >= 200 ? 0 : currentDay - message.daysSinceRecoveryChange;
        const lastLoginDay = message.daysSinceLogin >= 0 ? currentDay - message.daysSinceLogin : 0;

        buf.p2_alt2(currentDay);
        buf.ip2(0);
        buf.ip4(message.lastLoginIp);
        buf.p1(0);
        buf.ip2_alt2(0);
        buf.ip2_alt2(recoveryDay);
        buf.ip2_alt2(0);
        buf.p2(message.unreadMessageCount);
        buf.p2(0);
        buf.ip2_alt2(lastLoginDay);
        buf.ip2(0);
    }
}
