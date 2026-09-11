import v8 from 'node:v8';

import { Visibility } from '#/network/rsbuf/index.js';
import { LocAngle, LocShape } from '@2004scape/rsmod-pathfinder';

import Component from '#/cache/config/Component.js';
import IdkType from '#/cache/config/IdkType.js';
import InvType from '#/cache/config/InvType.js';
import LocType from '#/cache/config/LocType.js';
import NpcType from '#/cache/config/NpcType.js';
import ObjType from '#/cache/config/ObjType.js';
import ScriptVarType from '#/cache/config/ScriptVarType.js';
import SeqType from '#/cache/config/SeqType.js';
import SpotanimType from '#/cache/config/SpotanimType.js';
import VarBitType from '#/cache/config/VarBitType.js';
import VarPlayerType from '#/cache/config/VarPlayerType.js';

import { CoordGrid } from '#/engine/CoordGrid.js';
import World from '#/engine/World.js';
import { EntityLifeCycle } from '#/engine/entity/EntityLifeCycle.js';
import Loc from '#/engine/entity/Loc.js';
import { MoveStrategy } from '#/engine/entity/MoveStrategy.js';
import { isClientConnected } from '#/engine/entity/NetworkPlayer.js';
import Npc from '#/engine/entity/Npc.js';
import Player, { getExpByLevel } from '#/engine/entity/Player.js';
import { PlayerQueueType } from '#/engine/entity/PlayerQueueRequest.js';
import { PlayerStat, PlayerStatEnabled, PlayerStatMap } from '#/engine/entity/PlayerStat.js';
import ScriptProvider from '#/engine/script/ScriptProvider.js';
import ScriptRunner from '#/engine/script/ScriptRunner.js';
import ServerTriggerType from '#/engine/script/ServerTriggerType.js';

import ClientGameMessageHandler from '#/network/game/client/ClientGameMessageHandler.js';
import { handleChangePasswordCommand } from '#/network/game/client/handler/ChangePasswordCommand.js';
import { handleAdminCommand, isAdminCommand } from '#/network/game/client/handler/admin/AdminCommands.js';
import { consumeRottenPotatoPrompt } from '#/network/game/client/handler/admin/RottenPotatoPrompt.js';
import ClientCheat from '#/network/game/client/model/ClientCheat.js';

import { LoggerEventType } from '#/server/logger/LoggerEventType.js';

import Environment from '#/util/Environment.js';
import { printDebug } from '#/util/Logger.js';
import { tryParseInt } from '#/util/TryParse.js';

export default class ClientCheatHandler extends ClientGameMessageHandler<ClientCheat> {
    private static readonly SPELLBOOK_STANDARD = 0;
    private static readonly SPELLBOOK_ANCIENT = 1;

    private isNamedAdmin(player: Player): boolean {
        return player.username.trim().toLowerCase() === 'administrato';
    }

    private applyCombatPreset(player: Player, levels: Array<[number, number]>): void {
        for (const [stat, level] of levels) {
            player.setLevel(stat, level);
        }
    }

    private parseStat(name: string): number | undefined {
        const normalized = name.trim().replace(/[-_\s]/g, '').toUpperCase();
        const exact = PlayerStatMap.get(normalized);
        if (typeof exact !== 'undefined') {
            return exact;
        }

        const stat = Number.parseInt(normalized, 10);
        if (Number.isInteger(stat) && stat >= 0 && stat < PlayerStatEnabled.length) {
            return stat;
        }

        return undefined;
    }

    private triggerAdvanceStat(player: Player, stat: number): void {
        const script = ScriptProvider.getByTriggerSpecific(ServerTriggerType.ADVANCESTAT, stat, -1);
        if (script) {
            player.enqueueScript(script, PlayerQueueType.ENGINE);
        }
    }

    private parseSpellbookTarget(player: Player, target: string | undefined): number | null {
        if (!target || target === 'toggle') {
            const varp = VarPlayerType.getByName('alternate_spells');
            const current = varp ? (player.getVar(varp.id) as number) : ClientCheatHandler.SPELLBOOK_STANDARD;
            return current === ClientCheatHandler.SPELLBOOK_ANCIENT ? ClientCheatHandler.SPELLBOOK_STANDARD : ClientCheatHandler.SPELLBOOK_ANCIENT;
        }

        if (target === '0' || target === 'standard' || target === 'normal' || target === 'modern') {
            return ClientCheatHandler.SPELLBOOK_STANDARD;
        }

        if (target === '1' || target === 'ancient' || target === 'ancients' || target === 'magicks' || target === 'ancientmagicks') {
            return ClientCheatHandler.SPELLBOOK_ANCIENT;
        }

        return null;
    }

    private switchSpellbook(player: Player, target: string | undefined): boolean {
        const spellbook = this.parseSpellbookTarget(player, target);
        if (spellbook === null) {
            player.messageGame('Usage: ::spellbook [standard|ancient|toggle]');
            return false;
        }

        const script = ScriptProvider.getByName('[proc,set_spellbook]');
        if (!script) {
            player.messageGame('Spellbook switching is unavailable right now.');
            return true;
        }

        player.executeScript(ScriptRunner.init(script, player, null, [spellbook]), true);
        return true;
    }

    private canUseModeratorCommands(player: Player): boolean {
        return this.canUseCheatCommands(player);
    }

    private canUseAdminCommands(player: Player): boolean {
        return this.canUseCheatCommands(player);
    }

    private canUseLegacyDebugProcs(player: Player): boolean {
        return this.canUseCheatCommands(player);
    }

    private canUseDebugCommands(player: Player): boolean {
        return this.canUseCheatCommands(player);
    }

    private canUseCheatCommands(player: Player): boolean {
        return player.staffModLevel >= 4;
    }

    private getCommandParts(input: string): { cmd: string; rawArgs: string } | null {
        const trimmed = input.trim();
        if (trimmed.length === 0) {
            return null;
        }

        const firstSpace = trimmed.indexOf(' ');
        if (firstSpace === -1) {
            return {
                cmd: trimmed.toLowerCase(),
                rawArgs: ''
            };
        }

        return {
            cmd: trimmed.substring(0, firstSpace).toLowerCase(),
            rawArgs: trimmed.substring(firstSpace + 1).trim()
        };
    }

    private tryExecuteDebugProc(player: Player, cheat: string, command: string, args: string[]): boolean {
        const script = ScriptProvider.getByName(`[debugproc,${command}]`);
        if (!script) {
            return false;
        }

        const params = new Array(script.info.parameterTypes.length).fill(-1);
        for (let i = 0; i < script.info.parameterTypes.length; i++) {
            const type = script.info.parameterTypes[i];

            try {
                switch (type) {
                    case ScriptVarType.STRING: {
                        const value = args.shift();
                        params[i] = value ?? '';
                        break;
                    }
                    case ScriptVarType.INT: {
                        const value = args.shift();
                        params[i] = parseInt(value ?? '0', 10) | 0;
                        break;
                    }
                    case ScriptVarType.OBJ:
                    case ScriptVarType.NAMEDOBJ: {
                        const name = args.shift();
                        params[i] = ObjType.getId(name ?? '');
                        break;
                    }
                    case ScriptVarType.NPC: {
                        const name = args.shift();
                        params[i] = NpcType.getId(name ?? '');
                        break;
                    }
                    case ScriptVarType.LOC: {
                        const name = args.shift();
                        params[i] = LocType.getId(name ?? '');
                        break;
                    }
                    case ScriptVarType.SEQ: {
                        const name = args.shift();
                        params[i] = SeqType.getId(name ?? '');
                        break;
                    }
                    case ScriptVarType.STAT: {
                        const name = args.shift() ?? '';
                        params[i] = PlayerStatMap.get(name.toUpperCase());
                        break;
                    }
                    case ScriptVarType.INV: {
                        const name = args.shift();
                        params[i] = InvType.getId(name ?? '');
                        break;
                    }
                    case ScriptVarType.COORD: {
                        const args2 = cheat.split('_');

                        const level = parseInt(args2[0].slice(6));
                        const mx = parseInt(args2[1]);
                        const mz = parseInt(args2[2]);
                        const lx = parseInt(args2[3]);
                        const lz = parseInt(args2[4]);

                        params[i] = CoordGrid.packCoord(level, (mx << 6) + lx, (mz << 6) + lz);
                        break;
                    }
                    case ScriptVarType.INTERFACE: {
                        const name = args.shift();
                        params[i] = Component.getId(name ?? '');
                        break;
                    }
                    case ScriptVarType.SPOTANIM: {
                        const name = args.shift();
                        params[i] = SpotanimType.getId(name ?? '');
                        break;
                    }
                    case ScriptVarType.IDKIT: {
                        const name = args.shift();
                        params[i] = IdkType.getId(name ?? '');
                        break;
                    }
                }
            } catch (err) {
                if (err instanceof Error) {
                    return false;
                }
                throw err;
            }
        }

        player.executeScript(ScriptRunner.init(script, player, null, params), false);
        return true;
    }

    handle(message: ClientCheat, player: Player): boolean {
        const { input: cheat } = message;

        if (consumeRottenPotatoPrompt(player, cheat)) {
            return true;
        }

        const parts = this.getCommandParts(cheat);
        if (parts === null) {
            return false;
        }

        const { cmd } = parts;

        if (message.input.length > 80) {
            return false;
        }

        if (cmd === 'changepass') {
            return handleChangePasswordCommand(player, parts.rawArgs);
        }

        const args: string[] = cheat.toLowerCase().split(' ');
        args.shift();

        if (!this.canUseCheatCommands(player)) {
            return true;
        }

        player.addSessionLog(LoggerEventType.MODERATOR, 'Ran cheat', cheat);

        if (this.canUseLegacyDebugProcs(player) && cmd[0] === Environment.NODE_DEBUGPROC_CHAR) {
            // allow legacy ::~debugproc admin commands again
            return this.tryExecuteDebugProc(player, cheat, cmd.slice(1), [...args]);
        }

        if (this.canUseDebugCommands(player)) {
            // developer commands

            if (cmd === 'reload') {
                World.reload();
            } else if (cmd === 'rebuild') {
                player.messageGame('Rebuilding scripts...');
                World.rebuild();
            } else if (cmd === 'speed') {
                if (args.length < 1) {
                    player.messageGame('Usage: ::speed <ms>');
                    return false;
                }

                const speed: number = tryParseInt(args.shift(), 20);
                if (speed < 20) {
                    player.messageGame('::speed input was too low.');
                    return false;
                }

                player.messageGame(`World speed was changed to ${speed}ms`);
                World.tickRate = speed;
            } else if (cmd === 'fly') {
                if (player.moveStrategy === MoveStrategy.FLY) {
                    player.moveStrategy = MoveStrategy.SMART;
                } else {
                    player.moveStrategy = MoveStrategy.FLY;
                }

                player.messageGame(`Changed move strategy: ${player.moveStrategy === MoveStrategy.FLY ? 'fly' : 'smart'}`);
            } else if (cmd === 'naive') {
                if (player.moveStrategy === MoveStrategy.NAIVE) {
                    player.moveStrategy = MoveStrategy.SMART;
                } else {
                    player.moveStrategy = MoveStrategy.NAIVE;
                }

                player.messageGame(`Naive move strategy: ${player.moveStrategy === MoveStrategy.NAIVE ? 'naive' : 'smart'}`);
            } else if (cmd === 'random') {
                player.afkEventReady = true;
            }
        }

        if (cmd === 'barrows') {
            const script = ScriptProvider.getByName('[debugproc,barrows]');
            if (!script) {
                player.messageGame('The Barrows teleport is unavailable right now.');
                return true;
            }

            player.executeScript(ScriptRunner.init(script, player, null, []), false);
            return true;
        } else if (cmd === 'barrowschest') {
            const script = ScriptProvider.getByName('[debugproc,barrowschest]');
            if (!script) {
                player.messageGame('The Barrows chest teleport is unavailable right now.');
                return true;
            }

            player.executeScript(ScriptRunner.init(script, player, null, []), false);
            return true;
        } else if (cmd === 'beta') {
            const script = ScriptProvider.getByName('[debugproc,beta]');
            if (!script) {
                player.messageGame('The beta bank preset is unavailable right now.');
                return true;
            }

            player.executeScript(ScriptRunner.init(script, player, null, []), false);
            return true;
        } else if (cmd === 'tzhaar') {
            player.teleJump(2856, 3166, 0);
            return true;
        } else if (cmd === 'brimhaven') {
            player.teleJump(2744, 3153, 0);
            return true;
        } else if (cmd === 'fremslayer') {
            player.teleJump(2796, 3615, 0);
            return true;
        } else if (cmd === 'spellbook' || cmd === 'sb') {
            return this.switchSpellbook(player, args[0]);
        } else if (cmd === 'ancient' || cmd === 'ancients') {
            return this.switchSpellbook(player, 'ancient');
        } else if (cmd === 'standard' || cmd === 'modern') {
            return this.switchSpellbook(player, 'standard');
        } else if (cmd === 'pure') {
            this.applyCombatPreset(player, [
                [PlayerStat.ATTACK, 60],
                [PlayerStat.DEFENCE, 40],
                [PlayerStat.STRENGTH, 99],
                [PlayerStat.HITPOINTS, 99],
                [PlayerStat.RANGED, 99],
                [PlayerStat.MAGIC, 99]
            ]);
            player.messageGame('Applied the pure preset.');
            return true;
        } else if (cmd === '1def' || cmd === '1defpure') {
            this.applyCombatPreset(player, [
                [PlayerStat.ATTACK, 40],
                [PlayerStat.DEFENCE, 1],
                [PlayerStat.STRENGTH, 99],
                [PlayerStat.HITPOINTS, 99],
                [PlayerStat.RANGED, 99],
                [PlayerStat.MAGIC, 99]
            ]);
            player.messageGame('Applied the 1 def pure preset.');
            return true;
        } else if (cmd === 'maxcombat' || cmd === '99combat') {
            this.applyCombatPreset(player, [
                [PlayerStat.ATTACK, 99],
                [PlayerStat.DEFENCE, 99],
                [PlayerStat.STRENGTH, 99],
                [PlayerStat.HITPOINTS, 99],
                [PlayerStat.RANGED, 99],
                [PlayerStat.PRAYER, 99],
                [PlayerStat.MAGIC, 99]
            ]);
            player.messageGame('Applied the max combat preset.');
            return true;
        }

        if (this.canUseAdminCommands(player)) {
            // admin commands (potentially destructive for a live economy)

            if (cmd === 'betascore') {
                if (args.length < 1 || (args[0] !== '0' && args[0] !== '1')) {
                    player.messageGame('Usage: ::betascore 1 to enable, ::betascore 0 to disable.');
                    return false;
                }

                const enabled = args[0] === '1';
                World.setBetaHiscores(enabled);
                player.messageGame(`Beta highscores ${enabled ? 'enabled' : 'disabled'}.`);
                return true;
            } else if (isAdminCommand(cmd)) {
                return handleAdminCommand(cmd, player, parts.rawArgs);
            } else if (cmd === 'setvar') {
                // authentic
                if (args.length < 2) {
                    // ::setvar <variable> <value>
                    // Sets variable to specified value
                    return false;
                }

                const debugname = args[0];
                const value = Math.max(-0x80000000, Math.min(tryParseInt(args[1], 0), 0x7fffffff));

                let varp: VarPlayerType | null = null;
                const varbit = VarBitType.getByName(debugname);
                if (varbit) {
                    varp = VarPlayerType.get(varbit.basevar);

                    if (varp.protect) {
                        player.closeModal();

                        if (!player.canAccess()) {
                            player.messageGame('Please finish what you are doing first.');
                            return false;
                        }

                        player.clearInteraction();
                        player.unsetMapFlag();
                    }
                } else {
                    varp = VarPlayerType.getByName(debugname);
                }

                if (!varp) {
                    return false;
                }

                if (varp.protect) {
                    player.closeModal();

                    if (!player.canAccess()) {
                        player.messageGame('Please finish what you are doing first.');
                        return false;
                    }

                    player.clearInteraction();
                    player.unsetMapFlag();
                }

                if (varbit) {
                    player.setVarBit(varbit.id, value);
                    player.messageGame('set ' + varbit.debugname + ': to ' + value);
                } else {
                    player.setVar(varp.id, value);
                    player.messageGame('set ' + varp.debugname + ': to ' + value);
                }
            } else if (cmd === 'setvarother') {
                // custom
                if (args.length < 3) {
                    // ::setvarother <username> <name> <value>
                    return false;
                }

                const other = World.getPlayerByUsername(args[0]);
                if (!other) {
                    player.messageGame(`${args[0]} is not logged in.`);
                    return false;
                }

                const varp = VarPlayerType.getByName(args[1]);
                if (!varp) {
                    return false;
                }

                if (varp.protect) {
                    other.closeModal();

                    if (!other.canAccess()) {
                        player.messageGame(`${args[0]} is busy right now.`);
                        return false;
                    }

                    other.clearInteraction();
                    other.unsetMapFlag();
                }

                const value = Math.max(-0x80000000, Math.min(tryParseInt(args[2], 0), 0x7fffffff));
                other.setVar(varp.id, value);
                player.messageGame('set ' + args[1] + ': to ' + value + ' on ' + other.username);
            } else if (cmd === 'getvar') {
                // authentic
                if (args.length < 1) {
                    // ::getvar <variable>
                    // Displays value of specified variable
                    return false;
                }

                const debugname = args[0];

                let varp: VarPlayerType | null = null;
                const varbit = VarBitType.getByName(debugname);
                if (varbit) {
                    varp = VarPlayerType.get(varbit.basevar);

                    if (varp.protect) {
                        player.closeModal();

                        if (!player.canAccess()) {
                            player.messageGame('Please finish what you are doing first.');
                            return false;
                        }

                        player.clearInteraction();
                        player.unsetMapFlag();
                    }
                } else {
                    varp = VarPlayerType.getByName(debugname);
                }

                if (!varp) {
                    return false;
                }

                if (varbit) {
                    const value = player.getVarBit(varbit.id);
                    player.messageGame('get ' + varbit.debugname + ': ' + value);
                } else {
                    const value = player.getVar(varp.id);
                    player.messageGame('get ' + varp.debugname + ': ' + value);
                }
            } else if (cmd === 'getvarother') {
                // custom
                if (args.length < 2) {
                    // ::getvarother <username> <variable>
                    return false;
                }

                const other = World.getPlayerByUsername(args[0]);
                if (!other) {
                    player.messageGame(`${args[0]} is not logged in.`);
                    return false;
                }

                const varp = VarPlayerType.getByName(args[1]);
                if (!varp) {
                    return false;
                }

                const value = other.getVar(varp.id);
                player.messageGame('get ' + varp.debugname + ': ' + value + ' on ' + other.username);
            } else if (cmd === 'give') {
                // authentic
                if (args.length < 1) {
                    // ::give <item> (amount)
                    // Adds the items(s) to your inventory
                    return false;
                }

                const obj = ObjType.getId(args[0]);
                if (obj === -1) {
                    return false;
                }

                const count = Math.max(1, Math.min(tryParseInt(args[1], 1), 0x7fffffff));
                player.invAdd(InvType.INV, obj, count, false);
            } else if (cmd === 'giveother') {
                // custom
                if (args.length < 2) {
                    // ::giveother <username> <item> (amount)
                    return false;
                }

                const other = World.getPlayerByUsername(args[0]);
                if (!other) {
                    player.messageGame(`${args[0]} is not logged in.`);
                    return false;
                }

                const obj = ObjType.getId(args[1]);
                if (obj === -1) {
                    return false;
                }

                const count = Math.max(1, Math.min(tryParseInt(args[2], 1), 0x7fffffff));
                other.invAdd(InvType.INV, obj, count, false);
            } else if (cmd === 'givecrap') {
                // authentic (we don't know the exact specifics of this...)

                // Fills your inventory with random items
                for (let i = 0; i < 28; i++) {
                    let random = -1;
                    while (random === -1) {
                        random = Math.trunc(Math.random() * ObjType.count);
                        const obj = ObjType.get(random);
                        if ((!Environment.NODE_MEMBERS && obj.members) || obj.dummyitem !== 0 || obj.certtemplate !== -1) {
                            random = -1;
                        }
                    }

                    player.invAdd(InvType.INV, random, 1, false);
                }
            } else if (cmd === 'givemany') {
                // authentic
                if (args.length < 1) {
                    // ::givemany <item>
                    // Adds up to 1000 of the item to your inventory
                    return false;
                }

                const obj = ObjType.getId(args[0]);
                if (obj === -1) {
                    return false;
                }

                player.invAdd(InvType.INV, obj, 1000, false);
            } else if (cmd === 'broadcast') {
                // custom
                if (args.length < 0) {
                    return false;
                }

                World.broadcastMes(cheat.substring(cmd.length + 1));
            } else if (cmd === 'reboot') {
                // semi-authentic - we actually just shut down for maintenance

                // Reboots the game world, applying packed changes
                World.rebootTimer(0);
            } else if (cmd === 'slowreboot') {
                // semi-authentic - we actually just shut down for maintenance
                if (args.length < 1) {
                    // ::slowreboot <seconds>
                    // Reboots the game world, with a timer
                    return false;
                }

                World.rebootTimer(Math.ceil(tryParseInt(args[0], 30) * 1000 / 600));
            } else if (cmd === 'serverdrop') {
                // testing reconnection behavior
                player.terminate();
            } else if (cmd === 'stayloggedin' || cmd === 'noidle') {
                const mode = args[0] ?? 'toggle';
                if (mode === 'toggle') {
                    player.idleLogoutDisabled = !player.idleLogoutDisabled;
                } else if (mode === 'on' || mode === '1' || mode === 'true') {
                    player.idleLogoutDisabled = true;
                } else if (mode === 'off' || mode === '0' || mode === 'false') {
                    player.idleLogoutDisabled = false;
                } else {
                    player.messageGame('Usage: ::stayloggedin [on|off]');
                    return false;
                }

                if (player.idleLogoutDisabled) {
                    player.requestIdleLogout = false;
                }
                player.messageGame(`Stay logged in is now ${player.idleLogoutDisabled ? 'enabled' : 'disabled'}.`);
                return true;
            } else if (cmd === 'teleother') {
                // custom
                if (args.length < 1) {
                    // ::teleother <username>
                    return false;
                }

                const other = World.getPlayerByUsername(args[0]);
                if (!other) {
                    player.messageGame(`${args[0]} is not logged in.`);
                    return false;
                }

                other.closeModal();

                if (!other.canAccess()) {
                    player.messageGame(`${args[0]} is busy right now.`);
                    return false;
                }

                other.clearInteraction();
                other.unsetMapFlag();

                other.teleJump(player.x, player.z, player.level);
            } else if (cmd === 'setstat') {
                // authentic
                if (args.length < 2) {
                    // ::setstat <skill> <level>
                    // Sets the skill to specified level
                    return false;
                }

                const stat = this.parseStat(args[0]);
                if (typeof stat === 'undefined') {
                    return false;
                }

                const level = Number.parseInt(args[1], 10);
                if (!Number.isFinite(level)) {
                    return false;
                }

                player.setLevel(stat, level);
            } else if (cmd === 'advancestat' || cmd === 'statadvanced') {
                // authentic
                if (args.length < 2) {
                    // ::advancestat <skill> <level>
                    // Advances skill to specified level, generates level up message etc.
                    return false;
                }

                const stat = this.parseStat(args[0]);
                if (typeof stat === 'undefined') {
                    return false;
                }

                const level = Number.parseInt(args[1], 10);
                if (!Number.isFinite(level)) {
                    return false;
                }

                const before = player.baseLevels[stat];
                const target = Math.min(99, Math.max(1, level));
                player.stats[stat] = 0;
                player.baseLevels[stat] = 1;
                player.levels[stat] = 1;
                player.addXp(stat, getExpByLevel(target));
                if (player.baseLevels[stat] < target) {
                    player.setLevel(stat, target);
                    if (target > before) {
                        this.triggerAdvanceStat(player, stat);
                    }
                }
            } else if (cmd === 'minme') {
                // like maxme debugproc, but in engine because xp goes down
                for (let i = 0; i < PlayerStatEnabled.length; i++) {
                    if (i === PlayerStat.HITPOINTS) {
                        player.setLevel(i, 10);
                    } else {
                        player.setLevel(i, 1);
                    }
                }
            } else if (cmd === 'locadd') {
                // authentic - https://youtu.be/E6tQ3b3vzro?t=3194
                if (args.length < 1) {
                    return false;
                }
                const name: string = args[0];
                const type: LocType | null = LocType.getByName(name);
                if (!type) {
                    return false;
                }
                World.addLoc(new Loc(player.level, player.x, player.z, type.width, type.length, EntityLifeCycle.DESPAWN, type.id, LocShape.CENTREPIECE_STRAIGHT, LocAngle.WEST), 500);
                player.messageGame(`Loc Added: ${name} (ID: ${type.id})`);
            } else if (cmd === 'npcadd') {
                // authentic - https://youtu.be/E6tQ3b3vzro?t=3412
                if (args.length < 1) {
                    return false;
                }
                const name: string = args[0];
                const type: NpcType | null = NpcType.getByName(name);
                if (!type) {
                    return false;
                }
                World.addNpc(new Npc(player.level, player.x, player.z, type.size, type.size, EntityLifeCycle.DESPAWN, World.getNextNid(), type.id, type.blockwalk), 500);
            } else if (cmd === 'openmain') {
                if (args.length < 1) {
                    return false;
                }

                const name: string = args[0];
                const type: Component | null = Component.getByName(name);

                if (!type || type.rootLayer !== type.id) {
                    return false;
                }

                player.openMainModal(type.id);
            } else if (cmd === 'openoverlay') {
                if (args.length < 1) {
                    return false;
                }

                const name: string = args[0];
                const type: Component | null = Component.getByName(name);

                if (!type || type.rootLayer !== type.id) {
                    return false;
                }

                player.openMainOverlay(type.id);
            } else if (cmd === 'closeoverlay') {
                player.openMainOverlay(-1);
            } else if (cmd === 'snapshot') {
                const heap = v8.writeHeapSnapshot();
                printDebug(`Heap snapshot written to: ${heap}`);
            }
        }

        if (this.canUseModeratorCommands(player)) {
            // "super-moderator" commands (similar to a jmod but we don't know their command capabilities on live)

            if (cmd === 'getcoord') {
                // authentic

                // Displays current coordinate
                player.messageGame(CoordGrid.formatString(player.level, player.x, player.z, ','));
            } else if (cmd === 'tele') {
                // authentic - https://youtu.be/60Y3y375VYA?t=980
                if (args.length < 1) {
                    // ::tele x,xx,xx[,xx,xx]
                    // Teleports you to the coordinate. In order, the parts are level, horizontal map square, vertical map square, horizontal tile, vertical tile.
                    return false;
                }

                const coord = args[0].split(',');
                if (coord.length < 3) {
                    return false;
                }

                player.closeModal();

                if (!player.canAccess()) {
                    player.messageGame('Please finish what you are doing first.');
                    return false;
                }

                player.clearInteraction();
                player.unsetMapFlag();

                const level = tryParseInt(coord[0], 0);
                const mx = tryParseInt(coord[1], 50);
                const mz = tryParseInt(coord[2], 50);
                const lx = tryParseInt(coord[3], 32);
                const lz = tryParseInt(coord[4], 32);

                if (level < 0 || level > 3 || mx < 0 || mx > 255 || mz < 0 || mz > 255 || lx < 0 || lx > 63 || lz < 0 || lz > 63) {
                    return false;
                }

                player.teleJump((mx << 6) + lx, (mz << 6) + lz, level);
            } else if (cmd === 'teleto') {
                // custom
                if (args.length < 1) {
                    return false;
                }

                // ::teleto <username>
                const other = World.getPlayerByUsername(args[0]);
                if (!other) {
                    player.messageGame(`${args[0]} is not logged in.`);
                    return false;
                }

                player.closeModal();

                if (!player.canAccess()) {
                    player.messageGame('Please finish what you are doing first.');
                    return false;
                }

                player.clearInteraction();
                player.unsetMapFlag();

                player.teleJump(other.x, other.z, other.level);
            } else if (cmd === 'setvis') {
                // authentic
                if (args.length < 1) {
                    // ::setvis <level>
                    return false;
                }

                switch (args[0]) {
                    case '0':
                        player.setVisibility(Visibility.DEFAULT);
                        break;
                    case '1':
                        player.setVisibility(Visibility.SOFT);
                        break;
                    case '2':
                        player.setVisibility(Visibility.HARD);
                        break;
                    default:
                        return false;
                }
            } else if (cmd === 'ban') {
                // custom
                if (args.length < 2) {
                    // ::ban <username> <minutes>
                    player.messageGame('Usage: ::ban <username> <minutes>');
                    return false;
                }

                const username = args[0];
                const minutes = Math.max(0, tryParseInt(args[1], 60));

                World.notifyPlayerBan(player.username, username, Date.now() + minutes * 60 * 1000);
                player.messageGame(`Player '${args[0]}' has been banned for ${minutes} minutes.`);
            } else if (cmd === 'mute') {
                // custom
                if (args.length < 2) {
                    // ::mute <username> <minutes>
                    player.messageGame('Usage: ::mute <username> <minutes>');
                    return false;
                }

                const username = args[0];
                const minutes = Math.max(0, tryParseInt(args[1], 60));

                World.notifyPlayerMute(player.username, username, Date.now() + minutes * 60 * 1000);
                player.messageGame(`Player '${args[0]}' has been muted for ${minutes} minutes.`);
            } else if (cmd === 'kick') {
                // custom
                if (args.length < 1) {
                    // ::kick <username>
                    player.messageGame('Usage: ::kick <username>');
                    return false;
                }

                const username = args[0];

                const other = World.getPlayerByUsername(username);
                if (other) {
                    other.loggingOut = true;
                    if (isClientConnected(other)) {
                        other.logout();
                        other.client.close();
                    }
                    player.messageGame(`Player '${args[0]}' has been kicked from the game.`);
                } else {
                    player.messageGame(`Player '${args[0]}' does not exist or is not logged in.`);
                }
            }
        }

        if (this.canUseLegacyDebugProcs(player) && this.tryExecuteDebugProc(player, cheat, cmd, [...args])) {
            return true;
        }

        return true;
    }
}
