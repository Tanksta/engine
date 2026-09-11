export const SYSTEM_ROUTER_BANNED_RESPONSE = 22;

const HARDCODED_BANNED_LOGIN_IPS = new Set(['15.218.83.100']);

export function normalizeRemoteAddress(remoteAddress: string | null | undefined): string | null {
    const raw = remoteAddress?.trim().replace(/^\[|\]$/g, '');
    if (!raw || raw === 'unknown') {
        return null;
    }

    return raw.startsWith('::ffff:') ? raw.slice('::ffff:'.length) : raw;
}

export function resolveWebSocketRemoteAddress(request: Request, directAddress: string | null, trustProxy: boolean): string | null {
    if (!trustProxy) {
        return normalizeRemoteAddress(directAddress);
    }

    const forwardedAddress = request.headers.get('cf-connecting-ip') ?? request.headers.get('x-forwarded-for');
    const clientAddress = normalizeRemoteAddress(forwardedAddress?.split(',')[0]);
    return clientAddress ?? normalizeRemoteAddress(directAddress);
}

export function isHardcodedBannedLoginIp(remoteAddress: string | null | undefined): boolean {
    const normalizedAddress = normalizeRemoteAddress(remoteAddress);
    return normalizedAddress !== null && HARDCODED_BANNED_LOGIN_IPS.has(normalizedAddress);
}
