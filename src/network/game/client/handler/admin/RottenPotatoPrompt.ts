import VarPlayerType from '#/cache/config/VarPlayerType.js';
import type Player from '#/engine/entity/Player.js';
import World from '#/engine/World.js';
import { handleViewBankCommand } from '#/network/game/client/handler/admin/ViewBankCommand.js';

const PROMPT_VARP = 'rotten_potato_prompt';

const RottenPotatoPrompt = {
    None: 0,
    TeleportToPlayer: 9001,
    ViewBank: 9002
} as const;

type RottenPotatoPrompt = typeof RottenPotatoPrompt[keyof typeof RottenPotatoPrompt];

function getPrompt(player: Player): RottenPotatoPrompt {
    const varp = VarPlayerType.getByName(PROMPT_VARP);
    if (!varp) {
        return RottenPotatoPrompt.None;
    }

    const value = Number(player.getVar(varp.id));
    if (value === RottenPotatoPrompt.TeleportToPlayer || value === RottenPotatoPrompt.ViewBank) {
        return value;
    }

    return RottenPotatoPrompt.None;
}

function clearPrompt(player: Player): void {
    const varp = VarPlayerType.getByName(PROMPT_VARP);
    if (varp) {
        player.setVar(varp.id, RottenPotatoPrompt.None);
    }
}

function teleportToPlayer(player: Player, targetName: string): void {
    const target = World.getPlayerByUsername(targetName);
    if (!target) {
        player.messageGame(`${targetName} is not logged in.`);
        return;
    }

    player.closeModal();

    if (!player.canAccess()) {
        player.messageGame('Please finish what you are doing first.');
        return;
    }

    player.clearInteraction();
    player.unsetMapFlag();
    player.teleJump(target.x, target.z, target.level);
}

export function consumeRottenPotatoPrompt(player: Player, rawInput: string): boolean {
    const prompt = getPrompt(player);
    if (prompt === RottenPotatoPrompt.None) {
        return false;
    }

    clearPrompt(player);

    if (player.staffModLevel < 4) {
        player.messageGame('You do not have permission to use that.');
        return true;
    }

    const targetName = rawInput.trim();
    if (targetName.length === 0) {
        player.messageGame('No player name entered.');
        return true;
    }

    if (prompt === RottenPotatoPrompt.TeleportToPlayer) {
        teleportToPlayer(player, targetName);
        return true;
    }

    if (prompt === RottenPotatoPrompt.ViewBank) {
        handleViewBankCommand(player, targetName);
        return true;
    }

    return true;
}
