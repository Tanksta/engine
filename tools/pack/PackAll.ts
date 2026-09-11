import { withPackLock } from '#tools/pack/PackLock.js';

export async function packAll(modelFlags: number[]): Promise<void> {
    await withPackLock(async () => {
        const { packAllContent } = await import('#tools/pack/PackAllContent.js');
        await packAllContent(modelFlags);
    });
}
