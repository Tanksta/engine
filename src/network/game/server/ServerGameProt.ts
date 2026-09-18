export default class ServerGameProt {
    // interfaces
    static readonly IF_OPENCHAT = new ServerGameProt(118, 2);
    static readonly IF_OPENMAIN_SIDE = new ServerGameProt(62, 4);
    static readonly IF_CLOSE = new ServerGameProt(253, 0);
    static readonly IF_SETTAB = new ServerGameProt(49, 3);
    static readonly IF_SETTAB_ACTIVE = new ServerGameProt(125, 1);
    static readonly IF_OPENMAIN = new ServerGameProt(14, 2);
    static readonly IF_OPENSIDE = new ServerGameProt(71, 2);
    static readonly IF_OPENOVERLAY = new ServerGameProt(60, 2);

    // updating interfaces
    static readonly IF_SETCOLOUR = new ServerGameProt(46, 4);
    static readonly IF_SETHIDE = new ServerGameProt(136, 3);
    static readonly IF_SETOBJECT = new ServerGameProt(106, 6);
    static readonly IF_SETMODEL = new ServerGameProt(84, 4);
    static readonly IF_SETMODELOFFSET = new ServerGameProt(23, 6);
    static readonly IF_SETANIM = new ServerGameProt(1, 4);
    static readonly IF_SETPLAYERHEAD = new ServerGameProt(30, 2);
    static readonly IF_SETTEXT = new ServerGameProt(223, -2);
    static readonly IF_SETNPCHEAD = new ServerGameProt(53, 4);
    static readonly IF_SETPOSITION = new ServerGameProt(64, 6);
    static readonly IF_SETSCROLLPOS = new ServerGameProt(35, 4);

    // tutorial area
    static readonly TUT_FLASH = new ServerGameProt(129, 1);
    static readonly TUT_OPEN = new ServerGameProt(144, 2);

    // inventory
    static readonly UPDATE_INV_STOP_TRANSMIT = new ServerGameProt(66, 2);
    static readonly UPDATE_INV_FULL = new ServerGameProt(206, -2);
    static readonly UPDATE_INV_PARTIAL = new ServerGameProt(89, -2);

    // camera control
    static readonly CAM_LOOKAT = new ServerGameProt(96, 6);
    static readonly CAM_SHAKE = new ServerGameProt(86, 4);
    static readonly CAM_MOVETO = new ServerGameProt(181, 6);
    static readonly CAM_RESET = new ServerGameProt(137, 0);

    // entity updates
    static readonly NPC_INFO = new ServerGameProt(172, -2);
    static readonly PLAYER_INFO = new ServerGameProt(37, -2);

    // social
    static readonly FRIENDLIST_LOADED = new ServerGameProt(25, 1);
    static readonly MESSAGE_GAME = new ServerGameProt(242, -1);
    static readonly UPDATE_IGNORELIST = new ServerGameProt(58, -2);
    static readonly CHAT_FILTER_SETTINGS = new ServerGameProt(148, 3);
    static readonly MESSAGE_PRIVATE = new ServerGameProt(176, -1);
    static readonly UPDATE_FRIENDLIST = new ServerGameProt(197, 9);

    // misc
    static readonly UNSET_MAP_FLAG = new ServerGameProt(52, 0);
    static readonly UPDATE_RUNWEIGHT = new ServerGameProt(179, 2);
    static readonly HINT_ARROW = new ServerGameProt(153, 6);
    static readonly UPDATE_REBOOT_TIMER = new ServerGameProt(190, 2);
    static readonly UPDATE_STAT = new ServerGameProt(128, 6);
    static readonly UPDATE_RUNENERGY = new ServerGameProt(165, 1);
    static readonly RESET_ANIMS = new ServerGameProt(168, 0);
    static readonly UPDATE_PID = new ServerGameProt(251, 3);
    static readonly LAST_LOGIN_INFO = new ServerGameProt(205, 23);
    static readonly LOGOUT = new ServerGameProt(5, 0);
    static readonly P_COUNTDIALOG = new ServerGameProt(114, 0);
    static readonly P_STRINGDIALOG = new ServerGameProt(124, 0);
    static readonly SET_MULTIWAY = new ServerGameProt(100, 1);
    static readonly SET_PLAYER_OP = new ServerGameProt(216, -1);
    static readonly MINIMAP_TOGGLE = new ServerGameProt(219, 1);

    // maps
    static readonly REBUILD_NORMAL = new ServerGameProt(152, 4);
    static readonly REBUILD_REGION = new ServerGameProt(20, -2);

    // vars
    static readonly VARP_SMALL = new ServerGameProt(150, 3);
    static readonly VARP_LARGE = new ServerGameProt(32, 6);
    static readonly RESET_CLIENT_VARCACHE = new ServerGameProt(192, 0);

    // audio
    static readonly SYNTH_SOUND = new ServerGameProt(104, 5);
    static readonly MIDI_SONG = new ServerGameProt(229, 2);
    static readonly MIDI_JINGLE = new ServerGameProt(22, 5);

    // zones
    static readonly UPDATE_ZONE_PARTIAL_FOLLOWS = new ServerGameProt(243, 2);
    static readonly UPDATE_ZONE_FULL_FOLLOWS = new ServerGameProt(241, 2);
    static readonly UPDATE_ZONE_PARTIAL_ENCLOSED = new ServerGameProt(16, -2);

    constructor(
        readonly id: number,
        readonly length: number
    ) {}
}
