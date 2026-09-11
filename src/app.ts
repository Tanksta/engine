import { withPackLock } from '#tools/pack/PackLock.js';
import { printError } from '#/util/Logger.js';

try {
    // Startup must not read a cache while another process is rebuilding it.
    await withPackLock(() => import('#/Start.js'));
} catch (error) {
    printError(error instanceof Error ? error : String(error));
    process.exit(1);
}
