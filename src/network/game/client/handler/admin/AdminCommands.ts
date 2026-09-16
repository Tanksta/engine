import type Player from '#/engine/entity/Player.js';
import VarBitType from '#/cache/config/VarBitType.js';
import VarPlayerType from '#/cache/config/VarPlayerType.js';
import { handleViewBankCommand } from '#/network/game/client/handler/admin/ViewBankCommand.js';

const BANK_PIN_STATUS_SET = 1;
const BANK_PIN_STATUS_NONE = 0;
const PIN_PATTERN = /^\d{4}$/;

function setBankPinVarbit(player: Player, name: string, value: number): boolean {
    const varbit = VarBitType.getByName(name);
    if (!varbit) {
        player.messageGame(`Missing varbit: ${name}`);
        return false;
    }

    player.setVarBit(varbit.id, value);
    return true;
}

function setBankPinVarp(player: Player, name: string, value: number): boolean {
    const varp = VarPlayerType.getByName(name);
    if (!varp) {
        player.messageGame(`Missing varp: ${name}`);
        return false;
    }

    player.setVar(varp.id, value);
    return true;
}

function clearBankPinPenalty(player: Player): boolean {
    return setBankPinVarbit(player, 'bankpin_fail_count', 0) && setBankPinVarbit(player, 'bankpin_penalty_stage', 0) && setBankPinVarp(player, 'bankpin_lockout', 0);
}

function handleSetPinCommand(player: Player, rawArgs: string): boolean {
    const args = rawArgs.trim().split(/\s+/);
    if (args.length !== 2 || !PIN_PATTERN.test(args[0]) || !PIN_PATTERN.test(args[1])) {
        player.messageGame('Usage: ::setpin <pin> <confirm>');
        return false;
    }

    if (args[0] !== args[1]) {
        player.messageGame('Mismatch. Try again.');
        return false;
    }

    const pin = Number.parseInt(args[0], 10);
    if (
        !setBankPinVarbit(player, 'bankpin_true', pin) ||
        !setBankPinVarbit(player, 'bankpin_next', 0) ||
        !setBankPinVarbit(player, 'bankpin_status', BANK_PIN_STATUS_SET) ||
        !setBankPinVarbit(player, 'bankpin_unlocked', 1) ||
        !clearBankPinPenalty(player)
    ) {
        return false;
    }

    player.messageGame('Pin created successfully!');
    return true;
}

function handleResetPinCommand(player: Player, rawArgs: string): boolean {
    if (rawArgs.trim().length !== 0) {
        player.messageGame('Usage: ::resetpin');
        return false;
    }

    if (
        !setBankPinVarbit(player, 'bankpin_true', 0) ||
        !setBankPinVarbit(player, 'bankpin_next', 0) ||
        !setBankPinVarbit(player, 'bankpin_status', BANK_PIN_STATUS_NONE) ||
        !setBankPinVarbit(player, 'bankpin_unlocked', 0) ||
        !clearBankPinPenalty(player)
    ) {
        return false;
    }

    player.messageGame('Pin reset successfully!');
    return true;
}

const ADMIN_COMMANDS = {
    resetpin: handleResetPinCommand,
    setpin: handleSetPinCommand,
    viewbank: handleViewBankCommand
} satisfies Record<string, (player: Player, rawArgs: string) => boolean>;

export type AdminCommand = keyof typeof ADMIN_COMMANDS;

export function isAdminCommand(command: string): command is AdminCommand {
    return command in ADMIN_COMMANDS;
}

export function handleAdminCommand(command: AdminCommand, player: Player, rawArgs: string): boolean {
    return ADMIN_COMMANDS[command](player, rawArgs);
}
