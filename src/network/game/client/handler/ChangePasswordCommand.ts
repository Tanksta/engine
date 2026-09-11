import bcrypt from 'bcrypt';

import VarPlayerType from '#/cache/config/VarPlayerType.js';
import { db } from '#/db/query.js';
import type Player from '#/engine/entity/Player.js';
import { printDebug } from '#/util/Logger.js';

const BANK_PIN_VALUE_VARP = 'bank_pin_value';
const BANK_PIN_UNLOCKED_VARP = 'bank_pin_unlocked';
const PASSWORD_MIN_LENGTH = 4;
const PASSWORD_MAX_LENGTH = 20;

export const CHANGE_PASSWORD_MESSAGES = {
    usage: 'Usage: ::changepass <currentpass> <newpass> <confirmnewpass>',
    confirmationMismatch: 'New password and confirmation password are not the same, try again.',
    invalidCurrentPassword: 'Current password entered was invalid, try again.',
    bankPinRequired: 'Enter your Bank PIN first, then use ::changepass again.',
    invalidNewPasswordLength: 'New password must be between 4 and 20 characters.',
    changed: 'Your password has been changed.',
    unavailable: 'Unable to change password right now, try again later.'
} as const;

export type ChangePasswordAccount = {
    readonly id: number;
    readonly password: string;
};

export type ChangePasswordRequest = {
    readonly currentPassword: string;
    readonly newPassword: string;
};

export type ChangePasswordDependencies = {
    readonly findAccountByUsername: (username: string) => Promise<ChangePasswordAccount | null>;
    readonly updatePasswordHash: (accountId: number, passwordHash: string) => Promise<void>;
    readonly comparePassword: (candidate: string, storedHash: string) => Promise<boolean>;
    readonly hashPassword: (password: string) => Promise<string>;
    readonly logFailure: (message: string) => void;
};

const defaultDependencies: ChangePasswordDependencies = {
    findAccountByUsername: async (username: string): Promise<ChangePasswordAccount | null> => {
        const account = await db.selectFrom('account').select(['id', 'password']).where('username', '=', username).executeTakeFirst();
        return account ?? null;
    },
    updatePasswordHash: async (accountId: number, passwordHash: string): Promise<void> => {
        await db.updateTable('account').set({ password: passwordHash }).where('id', '=', accountId).executeTakeFirst();
    },
    comparePassword: async (candidate: string, storedHash: string): Promise<boolean> => bcrypt.compare(candidate, storedHash),
    hashPassword: async (password: string): Promise<string> => bcrypt.hash(password, 10),
    logFailure: (message: string): void => {
        printDebug(message);
    }
};

function getNumericVar(player: Player, name: string): number {
    const varp = VarPlayerType.getByName(name);
    if (!varp) {
        return 0;
    }

    const value = Number(player.getVar(varp.id));
    return Number.isFinite(value) ? value : 0;
}

function bankPinNeedsEntry(player: Player): boolean {
    return getNumericVar(player, BANK_PIN_VALUE_VARP) > 0 && getNumericVar(player, BANK_PIN_UNLOCKED_VARP) !== 1;
}

function parseChangePasswordRequest(rawArgs: string): ChangePasswordRequest | null {
    const trimmed = rawArgs.trim();
    if (trimmed.length === 0) {
        return null;
    }

    const args = trimmed.split(/\s+/);
    if (args.length !== 3) {
        return null;
    }

    const [currentPassword, newPassword, confirmNewPassword] = args;
    if (newPassword !== confirmNewPassword) {
        return null;
    }

    return {
        currentPassword,
        newPassword
    };
}

function isValidNewPassword(password: string): boolean {
    return password.length >= PASSWORD_MIN_LENGTH && password.length <= PASSWORD_MAX_LENGTH;
}

export async function changePasswordForPlayer(player: Player, request: ChangePasswordRequest, dependencies: ChangePasswordDependencies): Promise<void> {
    const account = await dependencies.findAccountByUsername(player.username);
    const currentPasswordMatches = account ? await dependencies.comparePassword(request.currentPassword.toLowerCase(), account.password) : false;
    if (!account || !currentPasswordMatches) {
        player.messageGame(CHANGE_PASSWORD_MESSAGES.invalidCurrentPassword);
        return;
    }

    const passwordHash = await dependencies.hashPassword(request.newPassword.toLowerCase());
    await dependencies.updatePasswordHash(account.id, passwordHash);
    player.messageGame(CHANGE_PASSWORD_MESSAGES.changed);
}

export function handleChangePasswordCommand(player: Player, rawArgs: string, dependencies: ChangePasswordDependencies = defaultDependencies): boolean {
    const args = rawArgs.trim().split(/\s+/);
    if (args.length === 3 && args[1] !== args[2]) {
        player.messageGame(CHANGE_PASSWORD_MESSAGES.confirmationMismatch);
        return true;
    }

    const request = parseChangePasswordRequest(rawArgs);
    if (!request) {
        player.messageGame(CHANGE_PASSWORD_MESSAGES.usage);
        return false;
    }

    if (!isValidNewPassword(request.newPassword)) {
        player.messageGame(CHANGE_PASSWORD_MESSAGES.invalidNewPasswordLength);
        return true;
    }

    if (bankPinNeedsEntry(player)) {
        player.messageGame(CHANGE_PASSWORD_MESSAGES.bankPinRequired);
        return true;
    }

    void changePasswordForPlayer(player, request, dependencies).catch((err: unknown): void => {
        if (err instanceof Error) {
            dependencies.logFailure(`Password change failed for ${player.username}: ${err.name}`);
        } else {
            dependencies.logFailure(`Password change failed for ${player.username}: non-Error rejection`);
        }
        player.messageGame(CHANGE_PASSWORD_MESSAGES.unavailable);
    });

    return true;
}
