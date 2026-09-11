import VarPlayerType from '#/cache/config/VarPlayerType.js';
import type Player from '#/engine/entity/Player.js';

const PROFANITY_UNCENSORED_VAR = 'player_profanity_uncensored';

function getSetting(player: Player, name: string): number {
    const varp = VarPlayerType.getByName(name);
    return varp ? Number(player.getVar(varp.id)) || 0 : 0;
}

export function isProfanityFilterEnabled(player: Player): boolean {
    return getSetting(player, PROFANITY_UNCENSORED_VAR) !== 1;
}
