import fs from 'fs';

import ScriptVarType from '#/cache/config/ScriptVarType.js';
import Environment from '#/util/Environment.js';

export type UnresolvedParamDefault = {
    readonly param: string;
    readonly type: string;
    readonly value: string;
    readonly fallback: string | number;
};

export type UnresolvedEnumValue = {
    readonly enumName: string;
    readonly role: 'default' | 'key' | 'value';
    readonly type: string;
    readonly value: string;
    readonly fallback: string | number;
};

export function getParamDefaultFallback(type: number): string | number {
    return type === ScriptVarType.STRING ? '' : -1;
}

export function writeUnresolvedParamDefaults(entries: readonly UnresolvedParamDefault[]): void {
    if (entries.length === 0) {
        return;
    }

    fs.mkdirSync('reports/revision-migration', { recursive: true });
    fs.writeFileSync(
        'reports/revision-migration/param-unresolved-defaults.json',
        `${JSON.stringify(
            {
                generatedAt: new Date().toISOString(),
                revision: Environment.ENGINE_REVISION,
                count: entries.length,
                defaults: entries
            },
            null,
            2
        )}\n`
    );
}

export function writeUnresolvedEnumValues(entries: readonly UnresolvedEnumValue[]): void {
    if (entries.length === 0) {
        return;
    }

    fs.mkdirSync('reports/revision-migration', { recursive: true });
    fs.writeFileSync(
        'reports/revision-migration/enum-unresolved-values.json',
        `${JSON.stringify(
            {
                generatedAt: new Date().toISOString(),
                revision: Environment.ENGINE_REVISION,
                count: entries.length,
                values: entries
            },
            null,
            2
        )}\n`
    );
}
