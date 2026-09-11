import bcrypt from 'bcrypt';
import { randomUUID } from 'node:crypto';

import { db, toDbDate } from '#/db/query.js';
import Environment from '#/util/Environment.js';
import { toDisplayName, toSafeName } from '#/util/JString.js';

type DiscordTokenResponse = {
    access_token: string;
    token_type: string;
    expires_in: number;
    refresh_token?: string;
    scope: string;
};

type DiscordUser = {
    id: string;
    username: string;
    global_name?: string | null;
    avatar?: string | null;
    email?: string | null;
};

type PendingDiscordState = {
    createdAt: number;
};

type PendingDiscordSignup = {
    createdAt: number;
    user: DiscordUser;
};

const DISCORD_STATE_TTL_MS = 10 * 60 * 1000;
const SIGNUP_COOKIE_NAME = 'lc_discord_signup';

const pendingDiscordStates = new Map<string, PendingDiscordState>();
const pendingDiscordSignups = new Map<string, PendingDiscordSignup>();

function cleanupExpiredDiscordState() {
    const now = Date.now();

    for (const [state, entry] of pendingDiscordStates.entries()) {
        if (now - entry.createdAt > DISCORD_STATE_TTL_MS) {
            pendingDiscordStates.delete(state);
        }
    }

    for (const [sessionId, entry] of pendingDiscordSignups.entries()) {
        if (now - entry.createdAt > DISCORD_STATE_TTL_MS) {
            pendingDiscordSignups.delete(sessionId);
        }
    }
}

function hasDiscordOauthConfig() {
    return Boolean(
        Environment.DISCORD_CLIENT_ID &&
        Environment.DISCORD_CLIENT_SECRET &&
        Environment.DISCORD_REDIRECT_URI
    );
}

function htmlEscape(value: string | null | undefined) {
    return (value ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');
}

function parseCookies(req: Request) {
    const header = req.headers.get('cookie');
    const cookies = new Map<string, string>();

    if (!header) {
        return cookies;
    }

    for (const pair of header.split(';')) {
        const index = pair.indexOf('=');
        if (index === -1) {
            continue;
        }

        const key = pair.slice(0, index).trim();
        const value = pair.slice(index + 1).trim();
        cookies.set(key, decodeURIComponent(value));
    }

    return cookies;
}

function redirect(location: string, headers?: Headers) {
    const responseHeaders = headers ?? new Headers();
    responseHeaders.set('Location', location);
    responseHeaders.set('Cache-Control', 'no-store');
    return new Response(null, { status: 302, headers: responseHeaders });
}

function createAccountPageResponse(body: string, headers?: Headers) {
    const responseHeaders = headers ?? new Headers();
    responseHeaders.set('Content-Type', 'text/html; charset=utf-8');
    responseHeaders.set('Cache-Control', 'no-store');
    return new Response(body, { headers: responseHeaders });
}

function normalizeUsername(raw: string) {
    const safeName = toSafeName(raw);

    if (safeName === 'invalid_name' || safeName.length < 1) {
        return null;
    }

    return toDisplayName(safeName);
}

async function usernameExists(normalizedUsername: string) {
    const accounts = await db.selectFrom('account').select('username').execute();
    const requestedSafeName = toSafeName(normalizedUsername);

    return accounts.some(account => toSafeName(account.username) === requestedSafeName);
}

function getDiscordSignup(req: Request) {
    cleanupExpiredDiscordState();

    const cookies = parseCookies(req);
    const sessionId = cookies.get(SIGNUP_COOKIE_NAME);
    if (!sessionId) {
        return { sessionId: null, signup: null };
    }

    const signup = pendingDiscordSignups.get(sessionId) ?? null;
    return { sessionId, signup };
}

function buildDiscordAuthorizeUrl() {
    const url = new URL('https://discord.com/oauth2/authorize');
    const state = randomUUID();
    pendingDiscordStates.set(state, { createdAt: Date.now() });

    url.searchParams.set('client_id', Environment.DISCORD_CLIENT_ID);
    url.searchParams.set('redirect_uri', Environment.DISCORD_REDIRECT_URI);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('scope', 'identify email');
    url.searchParams.set('state', state);

    return url.toString();
}

async function exchangeDiscordCode(code: string) {
    const body = new URLSearchParams({
        client_id: Environment.DISCORD_CLIENT_ID,
        client_secret: Environment.DISCORD_CLIENT_SECRET,
        grant_type: 'authorization_code',
        code,
        redirect_uri: Environment.DISCORD_REDIRECT_URI
    });

    const tokenResponse = await fetch('https://discord.com/api/oauth2/token', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        body
    });

    if (!tokenResponse.ok) {
        throw new Error(`Discord token exchange failed with status ${tokenResponse.status}`);
    }

    const token = await tokenResponse.json() as DiscordTokenResponse;

    const userResponse = await fetch('https://discord.com/api/users/@me', {
        headers: {
            Authorization: `${token.token_type} ${token.access_token}`
        }
    });

    if (!userResponse.ok) {
        throw new Error(`Discord user lookup failed with status ${userResponse.status}`);
    }

    return await userResponse.json() as DiscordUser;
}

function buildDiscordAvatarUrl(user: DiscordUser) {
    if (!user.avatar) {
        return null;
    }

    return `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=128`;
}

function renderCreateAccountPage(params: {
    error?: string | null,
    success?: { username: string } | null,
    discordUser?: DiscordUser | null,
    formUsername?: string | null
}) {
    const error = params.error ? `<p class="notice error">${htmlEscape(params.error)}</p>` : '';
    const success = params.success ? `<p class="notice success">Account created for <strong>${htmlEscape(params.success.username)}</strong>. You can log in from the game client with that username and your chosen password.</p>` : '';
    const discordConfigured = hasDiscordOauthConfig();
    const discordUser = params.discordUser ?? null;
    const discordAvatar = discordUser ? buildDiscordAvatarUrl(discordUser) : null;
    const defaultUsername = params.formUsername ?? (discordUser ? normalizeUsername(discordUser.global_name || discordUser.username) ?? '' : '');

    const discordCard = discordUser ? `
        <section class="discord-card">
            ${discordAvatar ? `<img src="${htmlEscape(discordAvatar)}" alt="Discord avatar" class="discord-avatar">` : ''}
            <div>
                <h2>Discord Connected</h2>
                <p>${htmlEscape(discordUser.global_name || discordUser.username)}</p>
                ${discordUser.email ? `<p class="muted">${htmlEscape(discordUser.email)}</p>` : ''}
            </div>
        </section>
    ` : `
        <section class="discord-card">
            <div>
                <h2>Discord Signup</h2>
                <p class="muted">Use Discord to verify identity first, then choose your in-game username and password.</p>
            </div>
        </section>
    `;

    const discordAction = discordConfigured
        ? `<a class="discord-button" href="/create-account/discord/start">${discordUser ? 'Reconnect Discord' : 'Continue with Discord'}</a>`
        : '<div class="discord-disabled">Discord signup is not configured yet. Add the Discord OAuth env vars to enable it.</div>';

    return `<!doctype html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Create Account</title>
    <style>
        :root {
            --bg: #11151d;
            --panel: #1a2230;
            --panel-edge: #2a364b;
            --text: #eef3fb;
            --muted: #a7b3c8;
            --accent: #5865f2;
            --accent-strong: #4752c4;
            --success: #1d6b3b;
            --error: #7c2d2d;
            --field: #0f141c;
        }
        * { box-sizing: border-box; }
        body {
            margin: 0;
            min-height: 100vh;
            font-family: Georgia, "Times New Roman", serif;
            background:
                radial-gradient(circle at top, rgba(88, 101, 242, 0.16), transparent 30%),
                linear-gradient(180deg, #0a0d12 0%, var(--bg) 100%);
            color: var(--text);
            display: grid;
            place-items: center;
            padding: 24px;
        }
        main {
            width: min(900px, 100%);
            display: grid;
            grid-template-columns: 1.15fr 0.85fr;
            gap: 24px;
        }
        section, form {
            background: rgba(26, 34, 48, 0.95);
            border: 1px solid var(--panel-edge);
            border-radius: 18px;
            box-shadow: 0 18px 50px rgba(0, 0, 0, 0.35);
        }
        .hero {
            padding: 28px;
        }
        .hero h1 {
            font-size: clamp(2rem, 5vw, 3.2rem);
            line-height: 0.95;
            margin: 0 0 14px;
            letter-spacing: 0.02em;
        }
        .hero p, .muted {
            color: var(--muted);
        }
        .panel {
            padding: 24px;
        }
        .notice {
            border-radius: 12px;
            padding: 12px 14px;
            margin: 0 0 16px;
        }
        .success { background: rgba(29, 107, 59, 0.2); border: 1px solid rgba(79, 200, 120, 0.35); }
        .error { background: rgba(124, 45, 45, 0.24); border: 1px solid rgba(220, 95, 95, 0.35); }
        .discord-card {
            display: flex;
            gap: 14px;
            align-items: center;
            padding: 16px;
            background: rgba(15, 20, 28, 0.75);
            border-radius: 14px;
            border: 1px solid rgba(167, 179, 200, 0.14);
            margin-bottom: 16px;
        }
        .discord-card h2 {
            margin: 0 0 6px;
            font-size: 1.05rem;
        }
        .discord-card p {
            margin: 0;
        }
        .discord-avatar {
            width: 56px;
            height: 56px;
            border-radius: 50%;
            border: 2px solid rgba(255, 255, 255, 0.12);
        }
        .discord-button, button {
            appearance: none;
            border: 0;
            border-radius: 12px;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            text-decoration: none;
            font: inherit;
            font-weight: 700;
            cursor: pointer;
            transition: transform 120ms ease, background 120ms ease;
        }
        .discord-button {
            width: 100%;
            min-height: 48px;
            background: var(--accent);
            color: white;
        }
        .discord-button:hover, button:hover {
            transform: translateY(-1px);
        }
        .discord-button:hover {
            background: var(--accent-strong);
        }
        .discord-disabled {
            border-radius: 12px;
            padding: 12px 14px;
            background: rgba(255, 255, 255, 0.04);
            color: var(--muted);
        }
        form {
            display: grid;
            gap: 14px;
            padding: 24px;
        }
        h2 {
            margin: 0 0 4px;
        }
        label {
            display: grid;
            gap: 8px;
            font-size: 0.95rem;
        }
        input {
            width: 100%;
            min-height: 46px;
            border-radius: 12px;
            border: 1px solid rgba(167, 179, 200, 0.16);
            background: var(--field);
            color: var(--text);
            padding: 0 14px;
            font: inherit;
        }
        button {
            min-height: 48px;
            background: #d6b35b;
            color: #231a05;
        }
        .fine-print {
            font-size: 0.9rem;
            color: var(--muted);
            margin: 0;
        }
        @media (max-width: 760px) {
            main {
                grid-template-columns: 1fr;
            }
        }
    </style>
</head>
<body>
    <main>
        <section class="hero">
            <p class="muted">Lost City Account Portal</p>
            <h1>Create your account.</h1>
            <p>Make a normal game account here, or start with Discord first. Discord signup follows the same OAuth code flow pattern used by the reference package you linked, adapted for this Bun server instead of React.</p>
        </section>
        <div class="panel">
            ${error}
            ${success}
            ${discordCard}
            ${discordAction}
            <form method="POST" action="/create-account">
                <h2>Game Credentials</h2>
                <label>
                    Username
                    <input name="username" maxlength="12" value="${htmlEscape(defaultUsername)}" required>
                </label>
                <label>
                    Password
                    <input name="password" type="password" maxlength="20" required>
                </label>
                <label>
                    Confirm Password
                    <input name="confirm_password" type="password" maxlength="20" required>
                </label>
                <button type="submit">Create Account</button>
                <p class="fine-print">Use the username exactly as shown when you log in from the game client.</p>
            </form>
        </div>
    </main>
</body>
</html>`;
}

async function handleCreateAccountGet(req: Request) {
    const url = new URL(req.url);
    const { signup } = getDiscordSignup(req);

    return createAccountPageResponse(renderCreateAccountPage({
        error: url.searchParams.get('error'),
        success: url.searchParams.get('success') ? { username: url.searchParams.get('success')! } : null,
        discordUser: signup?.user ?? null
    }));
}

async function handleCreateAccountPost(req: Request) {
    if (!Environment.WEBSITE_REGISTRATION) {
        return createAccountPageResponse(renderCreateAccountPage({
            error: 'Website registration is disabled on this server.'
        }));
    }

    const form = await req.formData();
    const rawUsername = String(form.get('username') ?? '');
    const password = String(form.get('password') ?? '');
    const confirmPassword = String(form.get('confirm_password') ?? '');
    const { sessionId } = getDiscordSignup(req);

    const normalizedUsername = normalizeUsername(rawUsername);
    if (!normalizedUsername) {
        return createAccountPageResponse(renderCreateAccountPage({
            error: 'Choose a username with letters or numbers only.',
            formUsername: rawUsername
        }));
    }

    if (password.length < 4 || password.length > 20) {
        return createAccountPageResponse(renderCreateAccountPage({
            error: 'Password must be between 4 and 20 characters.',
            formUsername: normalizedUsername
        }));
    }

    if (password !== confirmPassword) {
        return createAccountPageResponse(renderCreateAccountPage({
            error: 'Passwords do not match.',
            formUsername: normalizedUsername
        }));
    }

    if (await usernameExists(normalizedUsername)) {
        return createAccountPageResponse(renderCreateAccountPage({
            error: 'That username is already taken.',
            formUsername: normalizedUsername
        }));
    }

    const remoteAddress = req.headers.get('cf-connecting-ip') || req.headers.get('x-forwarded-for') || null;

    await db.insertInto('account')
        .values({
            username: normalizedUsername,
            password: bcrypt.hashSync(password.toLowerCase(), 10),
            registration_ip: remoteAddress ? remoteAddress.split(',')[0].trim() : null,
            registration_date: toDbDate(new Date())
        })
        .executeTakeFirstOrThrow();

    const headers = new Headers();
    if (sessionId) {
        pendingDiscordSignups.delete(sessionId);
        headers.append('Set-Cookie', `${SIGNUP_COOKIE_NAME}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax`);
    }

    return createAccountPageResponse(renderCreateAccountPage({
        success: { username: normalizedUsername }
    }), headers);
}

async function handleDiscordStart() {
    if (!hasDiscordOauthConfig()) {
        return redirect('/create-account?error=Discord+signup+is+not+configured.');
    }

    return redirect(buildDiscordAuthorizeUrl());
}

async function handleDiscordCallback(req: Request) {
    if (!hasDiscordOauthConfig()) {
        return redirect('/create-account?error=Discord+signup+is+not+configured.');
    }

    cleanupExpiredDiscordState();

    const url = new URL(req.url);
    const state = url.searchParams.get('state');
    const code = url.searchParams.get('code');
    const error = url.searchParams.get('error');

    if (error) {
        return redirect('/create-account?error=Discord+authorization+was+cancelled.');
    }

    if (!state || !pendingDiscordStates.has(state) || !code) {
        return redirect('/create-account?error=Discord+authorization+failed.');
    }

    pendingDiscordStates.delete(state);

    try {
        const user = await exchangeDiscordCode(code);
        const sessionId = randomUUID();
        pendingDiscordSignups.set(sessionId, {
            createdAt: Date.now(),
            user
        });

        const headers = new Headers();
        headers.append('Set-Cookie', `${SIGNUP_COOKIE_NAME}=${encodeURIComponent(sessionId)}; Path=/; Max-Age=600; HttpOnly; SameSite=Lax`);
        return redirect('/create-account', headers);
    } catch {
        return redirect('/create-account?error=Discord+authorization+failed.');
    }
}

export async function handleCreateAccountRoute(req: Request) {
    const url = new URL(req.url);

    if (url.pathname === '/create-account') {
        if (req.method === 'POST') {
            return handleCreateAccountPost(req);
        }

        return handleCreateAccountGet(req);
    }

    if (url.pathname === '/create-account/discord/start') {
        return handleDiscordStart();
    }

    if (url.pathname === '/create-account/discord/callback') {
        return handleDiscordCallback(req);
    }

    return null;
}
