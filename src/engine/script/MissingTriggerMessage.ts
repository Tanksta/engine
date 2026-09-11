type MissingTriggerRecipient = {
    readonly staffModLevel: number;
    messageGame(message: string): void;
};

const ADMIN_STAFF_MOD_LEVEL = 4;
const NOTHING_INTERESTING_HAPPENS = 'Nothing interesting happens.';

export function sendMissingTriggerMessage(player: MissingTriggerRecipient, message: string, diagnosticEnabled: boolean): void {
    player.messageGame(diagnosticEnabled && player.staffModLevel >= ADMIN_STAFF_MOD_LEVEL ? message : NOTHING_INTERESTING_HAPPENS);
}
