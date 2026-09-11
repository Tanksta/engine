import fs from 'node:fs';
import path from 'node:path';

import InvType from '#/cache/config/InvType.js';
import { setViewedBankOwner } from '#/engine/AdminBankView.js';
import type Player from '#/engine/entity/Player.js';
import { PlayerLoading } from '#/engine/entity/PlayerLoading.js';
import ScriptProvider from '#/engine/script/ScriptProvider.js';
import ScriptRunner from '#/engine/script/ScriptRunner.js';
import World from '#/engine/World.js';
import Packet from '#/io/Packet.js';
import Environment from '#/util/Environment.js';
import { fromBase37, toBase37 } from '#/util/JString.js';

type ViewedBankOwner = {
    readonly player: Player;
    readonly savePath: string | null;
};

function getPlayerSavePath(username: string): string {
    const safeName = fromBase37(toBase37(username));
    return path.join('data', 'players', Environment.NODE_PROFILE, `${safeName}.sav`);
}

function loadOfflineBankOwner(targetName: string): ViewedBankOwner | null {
    const savePath = getPlayerSavePath(targetName);
    if (!fs.existsSync(savePath)) {
        return null;
    }

    const raw = fs.readFileSync(savePath);
    const player = PlayerLoading.load(targetName, new Packet(raw), null);
    return { player, savePath };
}

function findViewedBankOwner(targetName: string): ViewedBankOwner | null {
    const online = World.getPlayerByUsername(targetName);
    if (online) {
        return { player: online, savePath: getPlayerSavePath(online.username) };
    }

    return loadOfflineBankOwner(targetName);
}

export function handleViewBankCommand(player: Player, rawArgs: string): boolean {
    const targetName = rawArgs.trim();
    if (targetName.length === 0) {
        player.messageGame('Usage: ::viewbank <player>');
        return false;
    }

    let target: ViewedBankOwner | null = null;
    try {
        target = findViewedBankOwner(targetName);
    } catch (err) {
        if (err instanceof Error) {
            player.messageGame(`Could not load ${targetName}'s bank.`);
            return false;
        }
        throw err;
    }

    if (!target) {
        player.messageGame(`${targetName} is not logged in and has no local save.`);
        return false;
    }

    const bankInv = InvType.getId('bank');
    const openBank = ScriptProvider.getByName('[label,openbank_unlocked]');
    if (bankInv === -1 || !openBank) {
        player.messageGame('Bank viewing is unavailable right now.');
        return false;
    }

    player.closeModal(false);
    target.player.getInventory(bankInv);
    setViewedBankOwner(player, target.player, target.savePath);
    player.executeScript(ScriptRunner.init(openBank, player, null, []), true);
    player.messageGame(`Viewing ${target.player.username}'s bank.`);
    return true;
}
