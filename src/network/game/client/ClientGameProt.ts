export default class ClientGameProt {
    static byId: ClientGameProt[] = [];

    static readonly NO_TIMEOUT = new ClientGameProt(214, 0);

    static readonly IDLE_TIMER = new ClientGameProt(145, 0);
    static readonly EVENT_MOUSE_CLICK = new ClientGameProt(14, 4);
    static readonly EVENT_MOUSE_MOVE = new ClientGameProt(97, -1);
    static readonly EVENT_APPLET_FOCUS = new ClientGameProt(57, 1);
    static readonly EVENT_CAMERA_POSITION = new ClientGameProt(124, 4);

    static readonly ANTICHEAT_OPLOGIC1 = new ClientGameProt(192, 4);
    static readonly ANTICHEAT_OPLOGIC2 = new ClientGameProt(230, 2);
    static readonly ANTICHEAT_OPLOGIC3 = new ClientGameProt(178, 4);
    static readonly ANTICHEAT_OPLOGIC4 = new ClientGameProt(99, 1);
    static readonly ANTICHEAT_OPLOGIC5 = new ClientGameProt(99, 1);
    static readonly ANTICHEAT_OPLOGIC6 = new ClientGameProt(230, 2);
    static readonly ANTICHEAT_OPLOGIC7 = new ClientGameProt(19, 4);
    static readonly ANTICHEAT_OPLOGIC8 = new ClientGameProt(99, 1);
    static readonly ANTICHEAT_OPLOGIC9 = new ClientGameProt(163, 3);

    static readonly ANTICHEAT_CYCLELOGIC1 = new ClientGameProt(149, 3);
    static readonly ANTICHEAT_CYCLELOGIC2 = new ClientGameProt(26, 3);
    static readonly ANTICHEAT_CYCLELOGIC3 = new ClientGameProt(99, 1);
    static readonly ANTICHEAT_CYCLELOGIC4 = new ClientGameProt(99, 1);
    static readonly ANTICHEAT_CYCLELOGIC5 = new ClientGameProt(45, 0);
    static readonly ANTICHEAT_CYCLELOGIC6 = new ClientGameProt(99, 1);
    static readonly ANTICHEAT_CYCLELOGIC7 = new ClientGameProt(15, 0);

    static readonly OPOBJ1 = new ClientGameProt(1, 6);
    static readonly OPOBJ2 = new ClientGameProt(37, 6);
    static readonly OPOBJ3 = new ClientGameProt(115, 6);
    static readonly OPOBJ4 = new ClientGameProt(227, 6);
    static readonly OPOBJ5 = new ClientGameProt(94, 6);
    static readonly OPOBJT = new ClientGameProt(196, 8);
    static readonly OPOBJU = new ClientGameProt(103, 12);

    static readonly OPNPC1 = new ClientGameProt(235, 2);
    static readonly OPNPC2 = new ClientGameProt(100, 2);
    static readonly OPNPC3 = new ClientGameProt(199, 2);
    static readonly OPNPC4 = new ClientGameProt(53, 2);
    static readonly OPNPC5 = new ClientGameProt(98, 2);
    static readonly OPNPCT = new ClientGameProt(184, 4);
    static readonly OPNPCU = new ClientGameProt(250, 8);

    static readonly OPLOC1 = new ClientGameProt(71, 6);
    static readonly OPLOC2 = new ClientGameProt(75, 6);
    static readonly OPLOC3 = new ClientGameProt(201, 6);
    static readonly OPLOC4 = new ClientGameProt(215, 6);
    static readonly OPLOC5 = new ClientGameProt(245, 6);
    static readonly OPLOCT = new ClientGameProt(84, 8);
    static readonly OPLOCU = new ClientGameProt(38, 12);

    static readonly OPPLAYER1 = new ClientGameProt(59, 2);
    static readonly OPPLAYER2 = new ClientGameProt(78, 2);
    static readonly OPPLAYER3 = new ClientGameProt(79, 2);
    static readonly OPPLAYER4 = new ClientGameProt(151, 2);
    static readonly OPPLAYER5 = new ClientGameProt(212, 2);
    static readonly OPPLAYERT = new ClientGameProt(130, 4);
    static readonly OPPLAYERU = new ClientGameProt(55, 8);

    static readonly OPHELD1 = new ClientGameProt(117, 6);
    static readonly OPHELD2 = new ClientGameProt(216, 6);
    static readonly OPHELD3 = new ClientGameProt(209, 6);
    static readonly OPHELD4 = new ClientGameProt(131, 6);
    static readonly OPHELD5 = new ClientGameProt(254, 6);
    static readonly OPHELDT = new ClientGameProt(88, 8);
    static readonly OPHELDU = new ClientGameProt(200, 12);

    static readonly INV_BUTTON1 = new ClientGameProt(171, 6);
    static readonly INV_BUTTON2 = new ClientGameProt(205, 6);
    static readonly INV_BUTTON3 = new ClientGameProt(43, 6);
    static readonly INV_BUTTON4 = new ClientGameProt(93, 6);
    static readonly INV_BUTTON5 = new ClientGameProt(87, 6);

    static readonly IF_BUTTON = new ClientGameProt(27, 2);
    static readonly RESUME_PAUSEBUTTON = new ClientGameProt(36, 2);
    static readonly CLOSE_MODAL = new ClientGameProt(189, 0);
    static readonly RESUME_P_COUNTDIALOG = new ClientGameProt(114, 4);
    static readonly TUT_CLICKSIDE = new ClientGameProt(113, 1);

    static readonly MOVE_OPCLICK = new ClientGameProt(222, -1);
    static readonly REPORT_ABUSE = new ClientGameProt(91, 10); // todo: rename to SEND_SNAPSHOT
    static readonly RESUME_P_STRINGDIALOG = new ClientGameProt(104, 8);
    static readonly MOVE_MINIMAPCLICK = new ClientGameProt(180, -1);
    static readonly INV_BUTTOND = new ClientGameProt(202, 7);
    static readonly IGNORELIST_DEL = new ClientGameProt(135, 8);
    static readonly IGNORELIST_ADD = new ClientGameProt(150, 8);
    static readonly IDK_SAVEDESIGN = new ClientGameProt(29, 13);
    static readonly CHAT_SETMODE = new ClientGameProt(206, 3);
    static readonly MESSAGE_PRIVATE = new ClientGameProt(220, -1);
    static readonly FRIENDLIST_DEL = new ClientGameProt(54, 8);
    static readonly FRIENDLIST_ADD = new ClientGameProt(229, 8);
    static readonly CLIENT_CHEAT = new ClientGameProt(188, -1);
    static readonly MESSAGE_PUBLIC = new ClientGameProt(144, -1);
    static readonly MOVE_GAMECLICK = new ClientGameProt(217, -1);

    static readonly ANTICHEAT_IDLE_22 = new ClientGameProt(22, 3);
    static readonly ANTICHEAT_IDLE_39 = new ClientGameProt(39, 3);
    static readonly ANTICHEAT_IDLE_69 = new ClientGameProt(69, 0);
    static readonly ANTICHEAT_IDLE_137 = new ClientGameProt(137, 0);
    static readonly ANTICHEAT_IDLE_210 = new ClientGameProt(210, 4);
    static readonly ANTICHEAT_IDLE_231 = new ClientGameProt(231, 0);

    constructor(
        readonly id: number,
        readonly length: number
    ) {
        ClientGameProt.byId[id] = this;
    }
}
