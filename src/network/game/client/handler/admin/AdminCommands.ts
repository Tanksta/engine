import type Player from '#/engine/entity/Player.js';
import { handleViewBankCommand } from '#/network/game/client/handler/admin/ViewBankCommand.js';

const ADMIN_COMMANDS = {
    viewbank: handleViewBankCommand
} satisfies Record<string, (player: Player, rawArgs: string) => boolean>;

export type AdminCommand = keyof typeof ADMIN_COMMANDS;

export function isAdminCommand(command: string): command is AdminCommand {
    return command in ADMIN_COMMANDS;
}

export function handleAdminCommand(command: AdminCommand, player: Player, rawArgs: string): boolean {
    return ADMIN_COMMANDS[command](player, rawArgs);
}
