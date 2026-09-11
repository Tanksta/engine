import fs from 'fs';
import path from 'path';

import ejs from 'ejs';
import { register } from 'prom-client';

import { CrcBuffer, CrcBuffer32 } from '#/cache/CrcTable.js';
import World from '#/engine/World.js';
import { resolveWebSocketRemoteAddress } from '#/server/login/HardcodedLoginBans.js';
import { LoggerEventType } from '#/server/logger/LoggerEventType.js';
import NullClientSocket from '#/server/NullClientSocket.js';
import WSClientSocket from '#/server/ws/WSClientSocket.js';
import Environment from '#/util/Environment.js';
import OnDemand from '#/engine/OnDemand.js';
import { tryParseInt } from '#/util/TryParse.js';
import { handleCreateAccountRoute } from '#/web/CreateAccount.js';
import { handleMapEditorRoute } from '#/web/MapEditorRoutes.js';

const MIME_TYPES = new Map<string, string>();
MIME_TYPES.set('.js', 'application/javascript');
MIME_TYPES.set('.mjs', 'application/javascript');
MIME_TYPES.set('.css', 'text/css');
MIME_TYPES.set('.html', 'text/html');
MIME_TYPES.set('.wasm', 'application/wasm');
MIME_TYPES.set('.sf2', 'application/octet-stream');
MIME_TYPES.set('.png', 'image/png');

export type WebSocketData = {
    client: WSClientSocket,
    origin: string,
    remoteAddress: string | null
};

export type WebSocketRoutes = {
    '/': Response
};

const NO_CACHE_HEADERS = {
    'Cache-Control': 'no-store, no-cache, must-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0'
};

const PACK_DIR = new URL('../data/pack/', import.meta.url);

function responseFromBuffer(data: Uint8Array | Buffer, contentType = 'application/octet-stream') {
    return new Response(Buffer.from(data), {
        headers: {
            'Content-Type': contentType,
            ...NO_CACHE_HEADERS
        }
    });
}

function responseFromFile(file: string | URL, contentType = 'application/octet-stream') {
    return new Response(Bun.file(file), {
        headers: {
            'Content-Type': contentType,
            ...NO_CACHE_HEADERS
        }
    });
}

function notFoundResponse(): Response {
    return new Response(null, {
        status: 404,
        headers: NO_CACHE_HEADERS
    });
}

export function responseFromCache(file: number, fallbackPath: string) {
    const data = OnDemand.cache.read(0, file);
    if (data) {
        return responseFromBuffer(data);
    }

    const fallbackFile = new URL(fallbackPath, PACK_DIR);
    if (fs.existsSync(fallbackFile)) {
        return responseFromFile(fallbackFile);
    }

    return notFoundResponse();
}

export async function startWeb() {
    Bun.serve<WebSocketData, WebSocketRoutes>({
        port: Environment.WEB_PORT,
        async fetch(req, server) {
            const url = new URL(req.url, `http://${req.headers.get('host')}`);
            const createAccountResponse = await handleCreateAccountRoute(req);
            if (createAccountResponse) {
                return createAccountResponse;
            }

            const mapEditorResponse = await handleMapEditorRoute(req, url);
            if (mapEditorResponse) {
                return mapEditorResponse;
            }

            if (url.pathname === '/') {
                const upgraded = server.upgrade(req, {
                    data: {
                        client: new WSClientSocket(),
                        origin: req.headers.get('origin'),
                        remoteAddress: resolveWebSocketRemoteAddress(req, server.requestIP(req)?.address ?? null, Environment.WEB_TRUST_PROXY)
                    }
                });

                if (upgraded) {
                    return undefined;
                }

                return new Response(null, { status: 404 });
            } else if (url.pathname.startsWith('/crc')) {
                return responseFromBuffer(CrcBuffer.data);
            } else if (url.pathname.startsWith('/title')) {
                return responseFromCache(1, 'client/title');
            } else if (url.pathname.startsWith('/config')) {
                return responseFromCache(2, 'client/config');
            } else if (url.pathname.startsWith('/interface')) {
                return responseFromCache(3, 'client/interface');
            } else if (url.pathname.startsWith('/media')) {
                return responseFromCache(4, 'client/media');
            } else if (url.pathname.startsWith('/versionlist')) {
                return responseFromCache(5, 'client/versionlist');
            } else if (url.pathname.startsWith('/textures')) {
                return responseFromCache(6, 'client/textures');
            } else if (url.pathname.startsWith('/wordenc')) {
                return responseFromCache(7, 'client/wordenc');
            } else if (url.pathname.startsWith('/sounds')) {
                return responseFromCache(8, 'client/sounds');
            } else if (url.pathname.startsWith('/ondemand.zip')) {
                return responseFromFile(new URL('ondemand.zip', PACK_DIR));
            } else if (url.pathname.startsWith('/build')) {
                return responseFromFile(new URL('server/build', PACK_DIR));
            } else if (url.pathname === '/rs2.cgi') {
                const plugin = tryParseInt(url.searchParams.get('plugin'), 0);
                const lowmem = tryParseInt(url.searchParams.get('lowmem'), 0);

                if (Environment.NODE_DEBUG && plugin === 1) {
                    return new Response(await ejs.renderFile('view/java.ejs', {
                        nodeid: Environment.NODE_ID,
                        lowmem,
                        members: Environment.NODE_MEMBERS,
                        portoff: Environment.NODE_PORT - 43594,
                        assetVersion: CrcBuffer32 >>> 0
                    }), {
                        headers: {
                            'Content-Type': 'text/html',
                            ...NO_CACHE_HEADERS
                        }
                    });
                } else {
                    return new Response(await ejs.renderFile('view/client.ejs', {
                        nodeid: Environment.NODE_ID,
                        lowmem,
                        members: Environment.NODE_MEMBERS,
                        assetVersion: CrcBuffer32 >>> 0
                    }), {
                        headers: {
                            'Content-Type': 'text/html',
                            ...NO_CACHE_HEADERS
                        }
                    });
                }
            } else if (fs.existsSync(`public${url.pathname}`)) {
                return responseFromFile(`public${url.pathname}`, MIME_TYPES.get(path.extname(url.pathname ?? '')) ?? 'text/plain');
            } else {
                return new Response(null, { status: 404 });
            }
        },
        websocket: {
            maxPayloadLength: 2000,
            open(ws) {
                if (Environment.WEB_ALLOWED_ORIGIN && ws.data.origin !== Environment.WEB_ALLOWED_ORIGIN) {
                    ws.terminate();
                    return;
                }

                ws.data.client.init(ws, ws.data.remoteAddress ?? ws.remoteAddress);
            },
            message(ws, message: Buffer) {
                try {
                    const { client } = ws.data;
                    if (client.state === -1 || client.remaining <= 0) {
                        client.terminate();
                        return;
                    }

                    client.buffer(message);

                    if (client.state === 0) {
                        World.onClientData(client);
                    } else if (client.state === 2) {
                        if (Environment.NODE_WS_ONDEMAND) {
                            OnDemand.onClientData(client);
                        } else {
                            client.terminate();
                        }
                    }
                } catch (_) {
                    ws.terminate();
                }
            },
            close(ws) {
                const { client } = ws.data;
                client.state = -1;

                if (client.player) {
                    client.player.addSessionLog(LoggerEventType.ENGINE, 'WS socket closed');
                    client.player.client = new NullClientSocket();
                }
            }
        }
    });
}

export async function startManagementWeb() {
    Bun.serve({
        port: Environment.WEB_MANAGEMENT_PORT,
        routes: {
            '/prometheus': new Response(await register.metrics(), {
                headers: {
                    'Content-Type': register.contentType
                }
            })
        },
        fetch() {
            return new Response(null, { status: 404 });
        },
    });
}
