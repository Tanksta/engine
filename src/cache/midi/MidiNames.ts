import { PackFile } from '#tools/pack/PackFileBase.js';

// Runtime music lookup must not initialize the packer's writable ledgers.
export const MidiNames = new PackFile('midi');
