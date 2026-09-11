import fs from 'fs';
import path from 'path';

import ejs from 'ejs';

import Environment from '#/util/Environment.js';

const NO_CACHE_HEADERS = {
    'Cache-Control': 'no-store, no-cache, must-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0'
};

const DATA_DIR = path.resolve('data');
const CONTENT_DIR = path.resolve(Environment.BUILD_SRC_DIR);

function contentType(filePath: string): string {
    switch (path.extname(filePath)) {
        case '.css':
            return 'text/css';
        case '.html':
            return 'text/html';
        case '.js':
        case '.mjs':
            return 'application/javascript';
        case '.png':
            return 'image/png';
        case '.sf2':
            return 'application/octet-stream';
        case '.wasm':
            return 'application/wasm';
        default:
            return 'application/octet-stream';
    }
}

function notFoundResponse(): Response {
    return new Response(null, {
        status: 404,
        headers: NO_CACHE_HEADERS
    });
}

function responseFromFile(file: string, type = 'application/octet-stream'): Response {
    return new Response(Bun.file(file), {
        headers: {
            'Content-Type': type,
            ...NO_CACHE_HEADERS
        }
    });
}

function resolvePathUnderRoot(root: string, name: string): string | null {
    let decodedName: string;
    try {
        decodedName = decodeURIComponent(name);
    } catch (err) {
        if (err instanceof URIError) {
            return null;
        }
        throw err;
    }

    const target = path.resolve(root, decodedName);
    const relative = path.relative(root, target);
    if (relative.startsWith('..') || path.isAbsolute(relative)) {
        return null;
    }

    return target;
}

async function handleContentRoute(req: Request, url: URL): Promise<Response> {
    const filePath = resolvePathUnderRoot(CONTENT_DIR, url.pathname.substring('/content/'.length));
    if (!filePath) {
        return new Response(null, { status: 400, headers: NO_CACHE_HEADERS });
    }

    if (req.method === 'PUT') {
        await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
        await fs.promises.writeFile(filePath, new Uint8Array(await req.arrayBuffer()));
        return new Response(null, { status: 204, headers: NO_CACHE_HEADERS });
    }

    if (req.method !== 'GET') {
        return new Response(null, { status: 405, headers: NO_CACHE_HEADERS });
    }

    return fs.existsSync(filePath) ? responseFromFile(filePath, contentType(filePath)) : notFoundResponse();
}

function handleDataRoute(url: URL): Response {
    const filePath = resolvePathUnderRoot(DATA_DIR, url.pathname.substring('/data/'.length));
    if (!filePath) {
        return new Response(null, { status: 400, headers: NO_CACHE_HEADERS });
    }

    return fs.existsSync(filePath) ? responseFromFile(filePath, contentType(filePath)) : notFoundResponse();
}

export async function handleMapEditorRoute(req: Request, url: URL): Promise<Response | null> {
    if (!Environment.NODE_DEBUG) {
        return null;
    }

    if (url.pathname === '/worldmap.jag') {
        const filePath = 'data/pack/mapview/worldmap.jag';
        return fs.existsSync(filePath) ? responseFromFile(filePath) : notFoundResponse();
    }

    if (url.pathname === '/maped') {
        return new Response(await ejs.renderFile('view/maped.ejs'), {
            headers: {
                'Content-Type': 'text/html',
                ...NO_CACHE_HEADERS
            }
        });
    }

    if (url.pathname.startsWith('/content/')) {
        return handleContentRoute(req, url);
    }

    if (url.pathname.startsWith('/data/')) {
        return handleDataRoute(url);
    }

    return null;
}
