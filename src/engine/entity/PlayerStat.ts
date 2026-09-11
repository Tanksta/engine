export const enum PlayerStat {
    ATTACK,
    DEFENCE,
    STRENGTH,
    HITPOINTS,
    RANGED,
    PRAYER,
    MAGIC,
    COOKING,
    WOODCUTTING,
    FLETCHING,
    FISHING,
    FIREMAKING,
    CRAFTING,
    SMITHING,
    MINING,
    HERBLORE,
    AGILITY,
    THIEVING,
    RUNECRAFT,
    SLAYER,
    FARMING
}

export const PlayerStatMap: Map<string, number> = new Map([
    ['ATTACK', PlayerStat.ATTACK],
    ['DEFENCE', PlayerStat.DEFENCE],
    ['STRENGTH', PlayerStat.STRENGTH],
    ['HITPOINTS', PlayerStat.HITPOINTS],
    ['RANGED', PlayerStat.RANGED],
    ['PRAYER', PlayerStat.PRAYER],
    ['MAGIC', PlayerStat.MAGIC],
    ['COOKING', PlayerStat.COOKING],
    ['WOODCUTTING', PlayerStat.WOODCUTTING],
    ['FLETCHING', PlayerStat.FLETCHING],
    ['FISHING', PlayerStat.FISHING],
    ['FIREMAKING', PlayerStat.FIREMAKING],
    ['CRAFTING', PlayerStat.CRAFTING],
    ['SMITHING', PlayerStat.SMITHING],
    ['MINING', PlayerStat.MINING],
    ['HERBLORE', PlayerStat.HERBLORE],
    ['AGILITY', PlayerStat.AGILITY],
    ['THIEVING', PlayerStat.THIEVING],
    ['RUNECRAFT', PlayerStat.RUNECRAFT],
    ['RUNECRAFTING', PlayerStat.RUNECRAFT],
    ['SLAYER', PlayerStat.SLAYER],
    ['FARMING', PlayerStat.FARMING],
    ['FARM', PlayerStat.FARMING],
]);

export const PlayerStatNameMap: Map<number, string> = new Map();
for (const [key, value] of PlayerStatMap) {
    if (!PlayerStatNameMap.has(value)) {
        PlayerStatNameMap.set(value, key);
    }
}

export const PlayerStatEnabled = [true, true, true, true, true, true, true, true, true, true, true, true, true, true, true, true, true, true, true, true, true];

export const PlayerStatFree = [true, true, true, true, true, true, true, true, true, false, true, true, true, true, true, false, false, false, true, false, false];
