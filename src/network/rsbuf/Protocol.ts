export const PlayerInfoProt = {
    ANIM: 0x1,
    FACE_COORD: 0x2,
    BIG: 0x4,
    SAY: 0x8,
    DAMAGE2: 0x10,
    APPEARANCE: 0x20,
    CHAT: 0x40,
    FACE_ENTITY: 0x80,
    SPOT_ANIM: 0x100,
    DAMAGE: 0x200,
    EXACT_MOVE: 0x400
} as const;

export const PlayerUpdate = {
    ANIM: PlayerInfoProt.ANIM,
    APPEARANCE: PlayerInfoProt.APPEARANCE,
    BIG_UPDATE: PlayerInfoProt.BIG,
    CHAT: PlayerInfoProt.CHAT,
    EXACTMOVE: PlayerInfoProt.EXACT_MOVE,
    FACEENTITY: PlayerInfoProt.FACE_ENTITY,
    FACESQUARE: PlayerInfoProt.FACE_COORD,
    HITMARK: PlayerInfoProt.DAMAGE,
    HITMARK2: PlayerInfoProt.DAMAGE2,
    SAY: PlayerInfoProt.SAY,
    SPOTANIM: PlayerInfoProt.SPOT_ANIM
} as const;

export const NpcInfoProt = {
    DAMAGE: 0x1,
    DAMAGE2: 0x2,
    FACE_ENTITY: 0x4,
    ANIM: 0x8,
    CHANGE_TYPE: 0x10,
    FACE_COORD: 0x20,
    SAY: 0x40,
    SPOT_ANIM: 0x80
} as const;

export const NpcUpdate = {
    ANIM: NpcInfoProt.ANIM,
    CHANGETYPE: NpcInfoProt.CHANGE_TYPE,
    FACEENTITY: NpcInfoProt.FACE_ENTITY,
    FACESQUARE: NpcInfoProt.FACE_COORD,
    HITMARK: NpcInfoProt.DAMAGE,
    HITMARK2: NpcInfoProt.DAMAGE2,
    SAY: NpcInfoProt.SAY,
    SPOTANIM: NpcInfoProt.SPOT_ANIM
} as const;

export const Visibility = {
    DEFAULT: 0,
    SOFT: 1,
    HARD: 2
} as const;

export type Visibility = (typeof Visibility)[keyof typeof Visibility];
