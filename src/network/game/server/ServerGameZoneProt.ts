import ServerGameProt from '#/network/game/server/ServerGameProt.js';

export default class ServerGameZoneProt extends ServerGameProt {
    // zone protocol
    static readonly LOC_MERGE = new ServerGameZoneProt(255, 14); // todo: rename to P_LOCMERGE
    static readonly LOC_ANIM = new ServerGameZoneProt(126, 4);
    static readonly OBJ_DEL = new ServerGameZoneProt(121, 3);
    static readonly OBJ_REVEAL = new ServerGameZoneProt(65, 7);
    static readonly LOC_ADD_CHANGE = new ServerGameZoneProt(198, 4);
    static readonly MAP_PROJANIM = new ServerGameZoneProt(146, 15);
    static readonly LOC_DEL = new ServerGameZoneProt(164, 2);
    static readonly OBJ_COUNT = new ServerGameZoneProt(2, 7);
    static readonly MAP_ANIM = new ServerGameZoneProt(175, 6);
    static readonly OBJ_ADD = new ServerGameZoneProt(250, 5);
}
