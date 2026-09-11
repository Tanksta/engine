import fs from 'fs';
import fsp from 'fs/promises';

import bcrypt from 'bcrypt';
import { sql } from 'kysely';
import { WebSocket, WebSocketServer } from 'ws';


import { db, describeDatabaseError, isTransientDatabaseError, toDbDate } from '#/db/query.js';
import Player from '#/engine/entity/Player.js';
import { PlayerLoading } from '#/engine/entity/PlayerLoading.js';
import { PlayerStatEnabled } from '#/engine/entity/PlayerStat.js';
import Packet from '#/io/Packet.js';
import Environment from '#/util/Environment.js';
import { toSafeName } from '#/util/JString.js';
import { printError, printInfo, printWarning } from '#/util/Logger.js';
import { startManagementWeb } from '#/web.js';
import InvType from '#/cache/config/InvType.js';
import VarPlayerType from '#/cache/config/VarPlayerType.js';
import { isHardcodedBannedLoginIp, normalizeRemoteAddress, SYSTEM_ROUTER_BANNED_RESPONSE } from './HardcodedLoginBans.js';

const betaHiscoresByProfile = new Map<string, boolean>();

type HiscoreTableName = 'hiscore' | 'beta_hiscore';
type HiscoreLargeTableName = 'hiscore_large' | 'beta_hiscore_large';

type PendingLogoutDbUpdate = {
    username: string;
    profile: string;
    nodeId: number;
    raw: Buffer;
    attempts: number;
    nextAttempt: number;
};

const LOGOUT_DB_RETRY_MS = 15000;
const LOGOUT_DB_RETRY_MAX_MS = 120000;

function isBetaHiscoresEnabled(profile: string): boolean {
    return betaHiscoresByProfile.get(profile) ?? false;
}

type HiscoreRow = {
    account_id: number;
    profile: string;
    type: number;
    level: number;
    value: number;
    date: string;
};

async function upsertHiscoreRows(table: HiscoreTableName | HiscoreLargeTableName, rows: HiscoreRow[]) {
    let query = db.insertInto(table).values(rows);

    if (Environment.DB_BACKEND === 'sqlite') {
        query = query.onConflict(oc =>
            oc.columns(['profile', 'type', 'account_id']).doUpdateSet(eb => ({
                level: eb.ref('excluded.level'),
                value: eb.ref('excluded.value'),
                date: eb.ref('excluded.date')
            }))
        );
    } else {
        query = query.onDuplicateKeyUpdate({
            level: sql`values(level)`,
            value: sql`values(value)`,
            date: sql`values(date)`
        });
    }

    await query.execute();
}

async function updateHiscores(account: { id: number, staffmodlevel: number, banned_until: Date | string | null } | undefined, player: Player, profile: string) {
    if (!account)
        return;

    if (account.banned_until !== null && new Date(account.banned_until) >= new Date()) {
        return;
    }

    const betaHiscoresEnabled = isBetaHiscoresEnabled(profile);
    const hiscoreTable: HiscoreTableName = betaHiscoresEnabled ? 'beta_hiscore' : 'hiscore';
    const hiscoreLargeTable: HiscoreLargeTableName = betaHiscoresEnabled ? 'beta_hiscore_large' : 'hiscore_large';

    let totalXp = 0;
    let totalLevel = 0;
    for (let i = 0; i < player.stats.length; i++) {
        if (!PlayerStatEnabled[i]) {
            continue;
        }

        totalXp += player.stats[i];
        totalLevel += player.baseLevels[i];
    }

    const now = toDbDate(new Date());

    const existingTotal = await db.selectFrom(hiscoreLargeTable).select(['type', 'value']).where('account_id', '=', account.id).where('type', '=', 0).where('profile', '=', profile).executeTakeFirst();
    if (!existingTotal || existingTotal.value !== totalXp) {
        await upsertHiscoreRows(hiscoreLargeTable, [{
            account_id: account.id,
            profile,
            type: 0,
            level: totalLevel,
            value: totalXp,
            date: now
        }]);
    }

    // fetch all existing entries in one round trip instead of one select per stat
    const existingStats = await db.selectFrom(hiscoreTable).select(['type', 'value']).where('account_id', '=', account.id).where('profile', '=', profile).execute();
    const existingByType = new Map(existingStats.map(row => [row.type, row.value]));

    // only write rows that are new or changed so unchanged entries keep their date
    const rows: HiscoreRow[] = [];
    for (let stat = 0; stat < player.stats.length; stat++) {
        if (!PlayerStatEnabled[stat] || player.baseLevels[stat] < 15) {
            continue;
        }

        const hiscoreType = stat + 1;
        if (existingByType.get(hiscoreType) !== player.stats[stat]) {
            rows.push({
                account_id: account.id,
                profile,
                type: hiscoreType,
                level: player.baseLevels[stat],
                value: player.stats[stat],
                date: now
            });
        }
    }

    if (rows.length > 0) {
        await upsertHiscoreRows(hiscoreTable, rows);
    }
}

export default class LoginServer {
    private server: WebSocketServer;
    private loginRequests: Set<string> = new Set();
    private loginAddressRequests: Set<string> = new Set();
    private pendingLogoutDbUpdates: Map<string, PendingLogoutDbUpdate> = new Map();
    private logoutDbRetryTimer: ReturnType<typeof setTimeout> | null = null;
    private processingLogoutDbRetries: boolean = false;

    private sendJson(s: WebSocket, value: Record<string, unknown>): void {
        if (s.readyState === WebSocket.OPEN) {
            try {
                s.send(JSON.stringify(value));
            } catch (err) {
                this.logHandledDatabaseError('Failed to send login server response', err);
            }
        }
    }

    rejectLoginForSafety(s: WebSocket, replyTo: number): void {
        // Send opcode 7 ('Please try again') if something has gone wrong
        // during login attempt, which may be resolved by simply retrying.
        this.sendJson(s, {
            replyTo,
            response: 7
        });
    }

    private acknowledgeLogout(s: WebSocket, replyTo: number, success: boolean): void {
        this.sendJson(s, {
            replyTo,
            response: success ? 0 : 1
        });
    }

    private logHandledDatabaseError(context: string, err: unknown): void {
        const description = describeDatabaseError(err);
        if (isTransientDatabaseError(err)) {
            printWarning(`${context}: ${description}`);
            return;
        }

        if (err instanceof Error) {
            printError(err);
        } else {
            printError(`${context}: ${description}`);
        }
    }

    private getLogoutUpdateKey(update: PendingLogoutDbUpdate): string {
        return `${update.profile}:${update.username}`;
    }

    private queueLogoutDbUpdate(update: PendingLogoutDbUpdate, err: unknown): void {
        const key = this.getLogoutUpdateKey(update);
        const previous = this.pendingLogoutDbUpdates.get(key);
        const attempts = (previous?.attempts ?? update.attempts) + 1;
        const delay = Math.min(LOGOUT_DB_RETRY_MAX_MS, LOGOUT_DB_RETRY_MS * attempts);

        this.pendingLogoutDbUpdates.set(key, {
            ...update,
            attempts,
            nextAttempt: Date.now() + delay
        });

        this.logHandledDatabaseError(`Queued logout DB retry for ${update.username}`, err);
        this.scheduleLogoutDbRetry();
    }

    private scheduleLogoutDbRetry(): void {
        if (this.logoutDbRetryTimer !== null) {
            return;
        }

        this.logoutDbRetryTimer = setTimeout(() => {
            this.logoutDbRetryTimer = null;
            void this.processQueuedLogoutDbUpdates();
        }, LOGOUT_DB_RETRY_MS);
    }

    private async processQueuedLogoutDbUpdates(): Promise<void> {
        if (this.processingLogoutDbRetries) {
            return;
        }

        this.processingLogoutDbRetries = true;
        const now = Date.now();

        try {
            for (const [key, update] of this.pendingLogoutDbUpdates) {
                if (update.nextAttempt > now) {
                    continue;
                }

                try {
                    await this.applyLogoutDbUpdate(update);
                    this.pendingLogoutDbUpdates.delete(key);
                    printInfo(`Recovered queued logout DB update for ${update.username}`);
                } catch (err) {
                    this.queueLogoutDbUpdate(update, err);
                }
            }
        } finally {
            this.processingLogoutDbRetries = false;
            if (this.pendingLogoutDbUpdates.size > 0) {
                this.scheduleLogoutDbRetry();
            }
        }
    }

    private async findAccount(username: string, profile: string) {
        return db.selectFrom('account')
            .leftJoin('account_login', join => join
                .onRef('account_id', '=', 'id')
                .on('profile', '=', profile)
            )
            .where('username', '=', username)
            .selectAll()
            .executeTakeFirst();
    }

    private async applyLogoutDbUpdate(update: PendingLogoutDbUpdate): Promise<void> {
        const account = await this.findAccount(update.username, update.profile);

        if (account?.account_id) {
            await db
                .updateTable('account_login')
                .set({
                    logged_in: 0,
                    login_time: null,
                    ip: null,
                    logged_out: update.nodeId,
                    logout_time: toDbDate(new Date())
                })
                .where('account_id', '=', account.id)
                .where('profile', '=', update.profile)
                .executeTakeFirst();
        }

        const player = PlayerLoading.load(update.username, new Packet(update.raw), null);
        await updateHiscores(account, player, update.profile);
    }

    async wouldResetSaveFile(newSaveBytes: Buffer, profile: string, username: string) {
        // check whether `save`, if saved to disk, would have reset `username`'s progress.
        // it does this by checking whether the player's tick count has gone backwards.
        if (!fs.existsSync(`data/players/${profile}/${username}.sav`)) {
            // No existing save - no problem.
            return false;
        }
        const existingSaveRaw = await fsp.readFile(`data/players/${profile}/${username}.sav`);
        const existingSave = PlayerLoading.load('tmp', new Packet(existingSaveRaw), null);
        const newSave = PlayerLoading.load('tmp', new Packet(newSaveBytes), null);
        if (existingSave.playtime > newSave.playtime) {
            // Int32, 1 per tick logged in. Should wrap only after insane amount of years.
            return true;
        }
        return false;
    }

    constructor() {
        if (Environment.LOGIN_SERVER && !Environment.EASY_STARTUP) {
            startManagementWeb();
        }

        InvType.load('data/pack');
        VarPlayerType.load('data/pack');

        this.server = new WebSocketServer({ port: Environment.LOGIN_PORT, host: '0.0.0.0' }, () => {
            printInfo(`Login server listening on port ${Environment.LOGIN_PORT}`);
        });

        this.server.on('connection', (s: WebSocket) => {
            s.on('message', async (data: Buffer) => {
                try {
                    const msg = JSON.parse(data.toString());
                    const { type, nodeId, nodeTime, profile } = msg;

                    if (type === 'world_startup') {
                        await db
                            .updateTable('account_login')
                            .set({
                                logged_in: 0,
                                login_time: null,
                                ip: null
                            })
                            .where('logged_in', '=', nodeId)
                            .where('profile', '=', profile)
                            .execute();
                    } else if (type === 'player_login') {
                        const { nodeMembers, replyTo, username, password, uid, socket, remoteAddress, reconnecting, hasSave } = msg;
                        const safeName = toSafeName(username);
                        const remoteIp = normalizeRemoteAddress(remoteAddress);
                        const addressRequestKey = remoteIp === null ? null : `${profile}:${remoteIp}`;
                        
                        if (this.loginRequests.has(safeName)) {
                            s.send(
                                JSON.stringify({
                                    replyTo,
                                    response: 8
                                })
                            );
                            return;
                        }
                        if (addressRequestKey !== null && this.loginAddressRequests.has(addressRequestKey)) {
                            s.send(
                                JSON.stringify({
                                    replyTo,
                                    response: 6
                                })
                            );
                            return;
                        }
                        this.loginRequests.add(safeName);
                        if (addressRequestKey !== null) {
                            this.loginAddressRequests.add(addressRequestKey);
                        }

                        try {
                            if (isHardcodedBannedLoginIp(remoteAddress)) {
                                s.send(
                                    JSON.stringify({
                                        replyTo,
                                        response: SYSTEM_ROUTER_BANNED_RESPONSE
                                    })
                                );
                                return;
                            }

                            const ipBan = remoteIp === null ? null : await db.selectFrom('ipban').selectAll().where('ip', '=', remoteIp).executeTakeFirst();

                            if (ipBan) {
                                s.send(
                                    JSON.stringify({
                                        replyTo,
                                        response: 7
                                    })
                                );
                                return;
                            }

                            let account = await db.selectFrom('account')
                                .leftJoin('account_login', join => join
                                    .onRef('account_id', '=', 'id')
                                    .on('profile', '=', profile)
                                )
                                .where('username', '=', username)
                                .selectAll()
                                .executeTakeFirst();

                            if (!Environment.WEBSITE_REGISTRATION && !account) {
                                // register the user automatically
                                const insertResult = await db
                                    .insertInto('account')
                                    .values({
                                        username,
                                        password: bcrypt.hashSync(password.toLowerCase(), 10),
                                        registration_ip: remoteIp,
                                        registration_date: toDbDate(new Date())
                                    })
                                    .executeTakeFirst();

                                if (typeof insertResult.insertId === 'undefined') {
                                    return;
                                }

                                account = await db.selectFrom('account')
                                    .leftJoin('account_login', join => join
                                        .onRef('account_id', '=', 'id')
                                        .on('profile', '=', profile)
                                    )
                                    .where('username', '=', username)
                                    .selectAll()
                                    .executeTakeFirst();
                            }

                            if (!account || !(await bcrypt.compare(password.toLowerCase(), account.password))) {
                                // invalid username or password
                                s.send(
                                    JSON.stringify({
                                        replyTo,
                                        response: 1
                                    })
                                );
                                return;
                            }

                            if (account.banned_until !== null && new Date(account.banned_until) > new Date()) {
                                // account disabled
                                s.send(
                                    JSON.stringify({
                                        replyTo,
                                        response: 5
                                    })
                                );
                                return;
                            }

                            if (nodeMembers && !account.members) {
                                if (Environment.NODE_AUTO_SUBSCRIBE_MEMBERS) {
                                    // Set members=1 for the account and proceed with login
                                    await db.updateTable('account').where('id', '=', account.id).set('members', 1).executeTakeFirstOrThrow();
                                    account.members = 1;
                                } else {
                                    s.send(
                                        JSON.stringify({
                                            replyTo,
                                            response: 9
                                        })
                                    );
                                    return;
                                }
                            }

                            if (reconnecting && account.logged_in === nodeId) {
                                await db
                                    .insertInto('session')
                                    .values({
                                        uuid: socket,
                                        account_id: account.id,
                                        profile,
                                        world: nodeId,
                                        timestamp: toDbDate(nodeTime),
                                        uid,
                                        ip: remoteIp
                                    })
                                    .execute();

                                await db
                                    .updateTable('account_login')
                                    .set({
                                        ip: remoteIp
                                    })
                                    .where('account_id', '=', account.id)
                                    .where('profile', '=', profile)
                                    .executeTakeFirst();

                                if (!hasSave) {
                                    const save = await fsp.readFile(`data/players/${profile}/${username}.sav`);
                                    if (!save || !PlayerLoading.verify(new Packet(save))) {
                                        // Extreme safety check for savefile existing but having bad data on read:
                                        console.error('on reconnect, account_id %s had invalid save data on disk', account.id);
                                        this.rejectLoginForSafety(s, replyTo);
                                    }
                                    s.send(
                                        JSON.stringify({
                                            replyTo,
                                            response: 2,
                                            account_id: account.id,
                                            staffmodlevel: account.staffmodlevel,
                                            muted_until: account.muted_until,
                                            save: save.toString('base64'),
                                            members: account.members,
                                            messageCount: 0
                                        })
                                    );
                                } else {
                                    s.send(
                                        JSON.stringify({
                                            replyTo,
                                            response: 2,
                                            account_id: account.id,
                                            staffmodlevel: account.staffmodlevel,
                                            muted_until: account.muted_until,
                                            members: account.members,
                                            messageCount: 0
                                        })
                                    );
                                }
                                return;
                            } else if (account.logged_in !== null && account.logged_in !== 0) {
                                // already logged in elsewhere
                                s.send(
                                    JSON.stringify({
                                        replyTo,
                                        response: 3
                                    })
                                );
                                return;
                            } else if (
                                account.staffmodlevel < 2 &&
                                account.logged_out !== 0 &&
                                account.logged_out !== nodeId &&
                                account.logout_time !== null
                            ) {
                                const remaining = new Date(account.logout_time).getTime() - new Date(Date.now() - Environment.NODE_HOP_TIME).getTime();
                                if (remaining > 0) {
                                    // rate limited (hop timer)
                                    s.send(
                                        JSON.stringify({
                                            replyTo,
                                            response: 10,
                                            remaining
                                        })
                                    );
                                    return;
                                }
                            }

                            if (remoteIp !== null) {
                                const activeLoginFromAddress = await db
                                    .selectFrom('account_login')
                                    .select('account_id')
                                    .where('profile', '=', profile)
                                    .where('logged_in', '!=', 0)
                                    .where('ip', '=', remoteIp)
                                    .where('account_id', '!=', account.id)
                                    .executeTakeFirst();

                                if (activeLoginFromAddress) {
                                    s.send(
                                        JSON.stringify({
                                            replyTo,
                                            response: 6
                                        })
                                    );
                                    return;
                                }
                            }

                            await db
                                .insertInto('session')
                                .values({
                                    uuid: socket,
                                    account_id: account.id,
                                    profile,
                                    world: nodeId,
                                    timestamp: toDbDate(nodeTime),
                                    uid,
                                    ip: remoteIp
                                })
                                .execute();

                            if (!fs.existsSync(`data/players/${profile}/${username}.sav`)) {
                                // not an error - never logged in before
                                // ^ Only not an error if the user has never logged in before:
                                if (account.logout_time !== null) {
                                    console.error('on login, account_id %s had no save data on disk!', account.id);
                                    this.rejectLoginForSafety(s, replyTo);
                                    return;
                                } else {
                                    s.send(
                                        JSON.stringify({
                                            replyTo,
                                            response: 4,
                                            account_id: account.id,
                                            staffmodlevel: account.staffmodlevel,
                                            muted_until: account.muted_until,
                                            messageCount: 0
                                        })
                                    );
                                }
                            } else {
                                const save = await fsp.readFile(`data/players/${profile}/${username}.sav`);
                                // Extreme safety check for savefile existing but having bad data on read:
                                if (!save || !PlayerLoading.verify(new Packet(save))) {
                                    console.error('on login, account_id %s had invalid save data on disk!', account.id);
                                    this.rejectLoginForSafety(s, replyTo);
                                    return;
                                }
                                s.send(
                                    JSON.stringify({
                                        replyTo,
                                        response: 0,
                                        account_id: account.id,
                                        staffmodlevel: account.staffmodlevel,
                                        save: save.toString('base64'),
                                        muted_until: account.muted_until,
                                        members: account.members,
                                        messageCount: 0
                                    })
                                );
                            }

                            // Login is valid - update account table
                            if (account.account_id) {
                                await db.updateTable('account_login')
                                    .set({
                                        logged_in: nodeId,
                                        login_time: toDbDate(new Date()),
                                        ip: remoteIp
                                    })
                                    .where('account_id', '=', account.id)
                                    .where('profile', '=', profile)
                                    .executeTakeFirst();
                            } else {
                                await db.insertInto('account_login')
                                    .values({
                                        account_id: account.id,
                                        profile: profile,
                                        logged_in: nodeId,
                                        login_time: toDbDate(new Date()),
                                        ip: remoteIp
                                    })
                                    .executeTakeFirst();
                            }
                        } catch (err) {
                            this.logHandledDatabaseError(`Login DB failure for ${safeName}`, err);
                            this.rejectLoginForSafety(s, replyTo);
                        } finally {
                            this.loginRequests.delete(safeName);
                            if (addressRequestKey !== null) {
                                this.loginAddressRequests.delete(addressRequestKey);
                            }
                        }
                    } else if (type === 'player_logout') {
                        const { replyTo, username, save } = msg;

                        const raw = Buffer.from(save, 'base64');
                        try {
                            if (PlayerLoading.verify(new Packet(raw)) && !(await this.wouldResetSaveFile(raw, profile, username))) {
                                if (!fs.existsSync(`data/players/${profile}`)) {
                                    await fsp.mkdir(`data/players/${profile}`, { recursive: true });
                                }

                                await fsp.writeFile(`data/players/${profile}/${username}.sav`, raw);

                                this.acknowledgeLogout(s, replyTo, true);

                                const update: PendingLogoutDbUpdate = {
                                    username,
                                    profile,
                                    nodeId,
                                    raw: Buffer.from(raw),
                                    attempts: 0,
                                    nextAttempt: Date.now()
                                };

                                void this.applyLogoutDbUpdate(update).catch(err => this.queueLogoutDbUpdate(update, err));
                            } else {
                                console.error(username, 'Invalid save file');
                                this.acknowledgeLogout(s, replyTo, false);
                            }
                        } catch (err) {
                            this.logHandledDatabaseError(`Logout save failure for ${username}`, err);
                            this.acknowledgeLogout(s, replyTo, false);
                        }
                    } else if (type === 'player_autosave') {
                        const { username, save } = msg;

                        const raw = Buffer.from(save, 'base64');
                        if (PlayerLoading.verify(new Packet(raw)) && !(await this.wouldResetSaveFile(raw, profile, username))) {
                            if (!fs.existsSync(`data/players/${profile}`)) {
                                await fsp.mkdir(`data/players/${profile}`, { recursive: true });
                            }

                            await fsp.writeFile(`data/players/${profile}/${username}.sav`, raw);
                        } else {
                            console.error(username, 'Invalid save file');
                        }
                    } else if (type === 'player_force_logout') {
                        const { username } = msg;

                        const account = await db
                            .selectFrom('account')
                            .leftJoin('account_login', join => join
                                .onRef('account_id', '=', 'id')
                                .on('profile', '=', profile)
                            )
                            .where('username', '=', username)
                            .selectAll()
                            .executeTakeFirst();

                        if (account?.account_id) {
                            await db
                                .updateTable('account_login')
                                .set({
                                    logged_in: 0,
                                    login_time: null,
                                    ip: null
                                })
                                .where('account_id', '=', account.id)
                                .where('profile', '=', profile)
                                .executeTakeFirst();
                        }
                        
                    } else if (type === 'player_ban') {
                        const { _staff, username, until } = msg;

                        // todo: audit log

                        await db
                            .updateTable('account')
                            .set({
                                banned_until: toDbDate(until)
                            })
                            .where('username', '=', username)
                            .executeTakeFirst();
                    } else if (type === 'player_mute') {
                        const { _staff, username, until } = msg;

                        // todo: audit log

                        await db
                            .updateTable('account')
                            .set({
                                muted_until: toDbDate(until)
                            })
                            .where('username', '=', username)
                            .executeTakeFirst();
                    } else if (type === 'beta_hiscore_mode') {
                        betaHiscoresByProfile.set(profile, Boolean(msg.enabled));
                        printInfo(`Beta highscores ${isBetaHiscoresEnabled(profile) ? 'enabled' : 'disabled'} for profile ${profile}`);
                    }
                } catch (err) {
                    console.error(err);
                }
            });

            s.on('close', () => {});
            s.on('error', () => {});
        });
    }
}
