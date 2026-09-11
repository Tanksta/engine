export function shouldKeepTransmittedPackImmutable(transmitted: boolean): boolean {
    return transmitted;
}

export function findMissingPackNames(names: readonly string[], knownNames: ReadonlySet<string>): string[] {
    const missing: string[] = [];

    for (const name of names) {
        if (!knownNames.has(name) && !name.startsWith('cert_')) {
            missing.push(name);
        }
    }

    return missing;
}
