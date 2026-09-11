import Packet from '#/io/Packet.js';
import ServerGameMessageEncoder from '#/network/game/server/ServerGameMessageEncoder.js';
import ServerGameProt from '#/network/game/server/ServerGameProt.js';
import RebuildRegion, { packRegionTemplate } from '#/network/game/server/model/RebuildRegion.js';

export default class RebuildRegionEncoder extends ServerGameMessageEncoder<RebuildRegion> {
    prot = ServerGameProt.REBUILD_REGION;

    encode(buf: Packet, message: RebuildRegion): void {
        const templateByZone = new Map<number, number>();
        for (const template of message.templates) {
            const key = (template.level << 22) | ((template.zoneX & 0x7ff) << 11) | (template.zoneZ & 0x7ff);
            templateByZone.set(key, packRegionTemplate(template));
        }

        buf.bitStart();

        for (let level = 0; level < 4; level++) {
            for (let zoneX = message.zoneX - 6; zoneX <= message.zoneX + 6; zoneX++) {
                for (let zoneZ = message.zoneZ - 6; zoneZ <= message.zoneZ + 6; zoneZ++) {
                    const key = (level << 22) | ((zoneX & 0x7ff) << 11) | (zoneZ & 0x7ff);
                    const packed = templateByZone.get(key);

                    if (packed === undefined) {
                        buf.pBit(1, 0);
                    } else {
                        buf.pBit(1, 1);
                        buf.pBit(26, packed);
                    }
                }
            }
        }

        buf.bitEnd();
        buf.ip2_alt2(message.zoneX);
        buf.p2(message.zoneZ);
    }
}
