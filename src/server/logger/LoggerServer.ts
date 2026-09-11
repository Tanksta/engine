import { sql } from 'kysely';
import { WebSocket, WebSocketServer } from 'ws';

import { db, toDbDate } from '#/db/query.js';
import { NpcKillCountEvent } from '#/engine/entity/tracking/NpcKillCount.js';
import { SessionLog } from '#/engine/entity/tracking/SessionLog.js';
import { WealthTransactionEvent } from '#/engine/entity/tracking/WealthEvent.js';
import Environment from '#/util/Environment.js';
import { printInfo } from '#/util/Logger.js';

export default class LoggerServer {
    private server: WebSocketServer;

    constructor() {
        this.server = new WebSocketServer({ port: Environment.LOGGER_PORT, host: '0.0.0.0' }, () => {
            printInfo(`Logger server listening on port ${Environment.LOGGER_PORT}`);
        });

        this.server.on('connection', (socket: WebSocket) => {
            socket.on('message', async (data: Buffer) => {
                try {
                    const msg = JSON.parse(data.toString());
                    const { type } = msg;

                    switch (type) {
                        case 'session_log': {
                            const { logs } = msg;

                            const schemaLogs = logs.map((x: SessionLog) => ({
                                session_uuid: x.session_uuid,
                                timestamp: toDbDate(x.timestamp),
                                coord: x.coord,
                                event: x.event,
                                event_type: x.event_type
                            }));

                            await db.insertInto('session_log').values(schemaLogs).execute();
                            break;
                        }
                        case 'wealth_event': {
                            const { events } = msg;

                            const schemaEvents = events.map((x: WealthTransactionEvent) => ({
                                session_uuid: x.session_uuid,
                                timestamp: toDbDate(x.timestamp),
                                coord: x.coord,
                                event_type: x.event_type,

                                account_items: JSON.stringify(x.account_items),
                                account_value: x.account_value,

                                recipient_session: x.recipient_session,
                                recipient_items: x.recipient_items ? JSON.stringify(x.recipient_items) : null,
                                recipient_value: x.recipient_value
                            }));

                            await db.insertInto('session_wealth').values(schemaEvents).execute();
                            break;
                        }
                        case 'report': {
                            const { session_uuid, timestamp, coord, offender, reason } = msg;

                            await db
                                .insertInto('report')
                                .values({
                                    session_uuid,
                                    timestamp: toDbDate(timestamp),
                                    coord,
                                    offender,
                                    reason
                                })
                                .execute();

                            break;
                        }
                        case 'input_track': {
                            const { session_uuid, timestamp, buf } = msg;

                            await db
                                .insertInto('input_report')
                                .values({
                                    session_uuid,
                                    timestamp: toDbDate(timestamp),
                                    data: Buffer.from(buf, 'base64')
                                })
                                .execute();
                            break;
                        }
                        case 'npc_killcount': {
                            const { events } = msg;

                            const schemaEvents = events.map((x: NpcKillCountEvent) => ({
                                account_id: x.account_id,
                                profile: x.profile,
                                npc_type: x.npc_type,
                                npc_name: x.npc_name,
                                kills: x.kills,
                                last_kill: toDbDate(x.last_kill)
                            }));

                            if (schemaEvents.length > 0) {
                                let query = db.insertInto('npc_killcount').values(schemaEvents);

                                if (Environment.DB_BACKEND === 'sqlite') {
                                    query = query.onConflict(oc =>
                                        oc.columns(['account_id', 'profile', 'npc_type']).doUpdateSet(eb => ({
                                            npc_name: eb.ref('excluded.npc_name'),
                                            kills: sql<number>`npc_killcount.kills + excluded.kills`,
                                            last_kill: eb.ref('excluded.last_kill')
                                        }))
                                    );
                                } else {
                                    query = query.onDuplicateKeyUpdate({
                                        npc_name: sql`values(npc_name)`,
                                        kills: sql<number>`npc_killcount.kills + values(kills)`,
                                        last_kill: sql`values(last_kill)`
                                    });
                                }

                                await query.execute();
                            }
                            break;
                        }
                    }
                } catch (err) {
                    console.error(err);
                }
            });

            socket.on('close', () => {});
            socket.on('error', () => {});
        });
    }
}
