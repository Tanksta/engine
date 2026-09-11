import fs from 'node:fs';
import path from 'node:path';

import InvType from '#/cache/config/InvType.js';
import type Player from '#/engine/entity/Player.js';
import { Inventory } from '#/engine/Inventory.js';
import World from '#/engine/World.js';

type ViewedBankSession = {
    readonly owner: Player;
    readonly savePath: string | null;
};

const viewedBankOwners = new WeakMap<Player, ViewedBankSession>();

function getOwnInventory(player: Player, inv: number): Inventory | null {
    if (inv === -1) {
        return null;
    }

    const invType = InvType.get(inv);
    if (!invType) {
        return null;
    }

    if (invType.scope === InvType.SCOPE_SHARED) {
        return World.getInventory(inv);
    }

    let container = player.invs.get(inv);
    if (!container) {
        container = Inventory.fromType(inv);
        player.invs.set(inv, container);
    }

    return container;
}

export function setViewedBankOwner(viewer: Player, owner: Player, savePath: string | null = null): void {
    viewedBankOwners.set(viewer, { owner, savePath });
}

export function clearViewedBankOwner(viewer: Player): void {
    const session = viewedBankOwners.get(viewer);
    viewedBankOwners.delete(viewer);

    if (!session) {
        return;
    }

    const bank = getOwnInventory(session.owner, InvType.getId('bank'));
    compactInventory(bank);

    const liveOwner = World.getPlayerByUsername(session.owner.username);
    if (liveOwner && liveOwner !== session.owner) {
        copyInventoryContents(bank, getOwnInventory(liveOwner, InvType.getId('bank')));
        return;
    }

    if (!liveOwner && session.savePath) {
        fs.mkdirSync(path.dirname(session.savePath), { recursive: true });
        fs.writeFileSync(session.savePath, session.owner.save());
    }
}

export function getViewedBankInventory(viewer: Player, inv: number): Inventory | null | undefined {
    if (inv !== InvType.getId('bank')) {
        return undefined;
    }

    const session = viewedBankOwners.get(viewer);
    if (!session) {
        return undefined;
    }

    return getOwnInventory(session.owner, inv);
}

function compactInventory(inventory: Inventory | null): void {
    if (!inventory) {
        return;
    }

    let writeSlot = 0;
    for (let readSlot = 0; readSlot < inventory.capacity; readSlot++) {
        const item = inventory.get(readSlot);
        if (!item) {
            continue;
        }

        if (readSlot !== writeSlot) {
            inventory.set(writeSlot, item);
            inventory.delete(readSlot);
        }

        writeSlot++;
    }
}

function copyInventoryContents(from: Inventory | null, to: Inventory | null): void {
    if (!from || !to) {
        return;
    }

    for (let slot = 0; slot < to.capacity; slot++) {
        const item = slot < from.capacity ? from.get(slot) : null;
        to.set(slot, item ? { id: item.id, count: item.count } : null);
    }
}
