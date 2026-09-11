import fs from 'fs';
import { parentPort } from 'worker_threads';

import { LoginClient } from '#/server/login/LoginClient.js';
import Environment from '#/util/Environment.js';
import { toSafeName } from '#/util/JString.js';

import { type GenericLoginThreadResponse } from './index.d.js';
import { trackLoginAttempts, trackLoginTime } from './LoginMetrics.js';

const client = new LoginClient(Environment.NODE_ID);

if (!parentPort) throw new Error('This file must be run as a worker thread.');

export function configuredStaffModLevel(username: string): number {
    if (!Environment.NODE_PRODUCTION) {
        return 4;
    }

    if (!Environment.NODE_STAFF) {
        return 0;
    }

    const safeUsername = toSafeName(username);
    const names = Environment.NODE_STAFF
        .split(/[,\s]+/)
        .map(name => name.trim())
        .filter(name => name.length > 0);

    return names.some(name => toSafeName(name) === safeUsername) ? 4 : 0;
}

parentPort.on('message', async msg => {
    try {
        if (!parentPort) throw new Error('This file must be run as a worker thread.');
        await handleRequests(parentPort, msg);
    } catch (err) {
        console.error(err);
    }
});

client.onMessage((opcode, data) => {
    parentPort!.postMessage({ opcode, data });
});

type ParentPort = {
    postMessage: (msg: GenericLoginThreadResponse) => void;
};

async function handleRequests(parentPort: ParentPort, msg: any) {
    const { type } = msg;

    switch (type) {
        case 'world_startup': {
            if (Environment.LOGIN_SERVER) {
                await client.worldStartup();
            }
            break;
        }
        case 'player_login': {
            const { socket, remoteAddress, username, password, uid, lowMemory, reconnecting, hasSave } = msg;

            if (Environment.LOGIN_SERVER) {
                trackLoginAttempts.inc();
                const stopTimer = trackLoginTime.startTimer();
                const response = await client.playerLogin(username, password, uid, socket, remoteAddress, reconnecting, hasSave);
                response.staffmodlevel = Math.max(response.staffmodlevel ?? 0, configuredStaffModLevel(username));

                parentPort.postMessage({
                    type: 'player_login',
                    socket,
                    username,
                    lowMemory,
                    reconnecting,
                    ...response
                });
                stopTimer();
            } else {
                const staffmodlevel = configuredStaffModLevel(username);

                const profile = Environment.NODE_PROFILE;
                if (!fs.existsSync(`data/players/${profile}`)) {
                    fs.mkdirSync(`data/players/${profile}`, { recursive: true });
                }

                if (!fs.existsSync(`data/players/${profile}/${username}.sav`)) {
                    parentPort.postMessage({
                        type: 'player_login',
                        socket,
                        username,
                        lowMemory,
                        reconnecting,
                        reply: 4,
                        staffmodlevel,
                        save: null,
                        account_id: 1,
                        members: Environment.NODE_MEMBERS
                    });
                } else {
                    parentPort.postMessage({
                        type: 'player_login',
                        socket,
                        username,
                        lowMemory,
                        reconnecting,
                        reply: 0,
                        staffmodlevel,
                        save: fs.readFileSync(`data/players/${profile}/${username}.sav`),
                        account_id: 1,
                        members: Environment.NODE_MEMBERS
                    });
                }
            }
            break;
        }
        case 'player_logout': {
            const { username, save } = msg;

            if (Environment.LOGIN_SERVER) {
                const success = await client.playerLogout(username, save);

                parentPort.postMessage({
                    type: 'player_logout',
                    username,
                    success
                });
            } else {
                const profile = Environment.NODE_PROFILE;
                if (!fs.existsSync(`data/players/${profile}`)) {
                    fs.mkdirSync(`data/players/${profile}`, { recursive: true });
                }

                fs.writeFileSync(`data/players/${profile}/${username}.sav`, save);

                parentPort.postMessage({
                    type: 'player_logout',
                    username,
                    success: true
                });
            }
            break;
        }
        case 'player_autosave': {
            const { username, save } = msg;

            if (Environment.LOGIN_SERVER) {
                await client.playerAutosave(username, save);
            } else {
                const profile = Environment.NODE_PROFILE;
                if (!fs.existsSync(`data/players/${profile}`)) {
                    fs.mkdirSync(`data/players/${profile}`, { recursive: true });
                }

                fs.writeFileSync(`data/players/${profile}/${username}.sav`, save);
            }
            break;
        }
        case 'player_force_logout': {
            if (Environment.LOGIN_SERVER) {
                const { username } = msg;
                await client.playerForceLogout(username);
            }
            break;
        }
        case 'player_ban': {
            if (Environment.LOGIN_SERVER) {
                // todo: wait for confirmation? resend?
                const { staff, username, until } = msg;
                await client.playerBan(staff, username, until);
            }
            break;
        }
        case 'player_mute': {
            if (Environment.LOGIN_SERVER) {
                // todo: wait for confirmation? resend?
                const { staff, username, until } = msg;
                await client.playerMute(staff, username, until);
            }
            break;
        }
        case 'beta_hiscore_mode': {
            if (Environment.LOGIN_SERVER) {
                const { enabled } = msg;
                await client.setBetaHiscores(Boolean(enabled));
            }
            break;
        }
        case 'world_heartbeat': {
            break;
        }
        default:
            console.error('Unknown message type: ' + msg.type);
            break;
    }
}
