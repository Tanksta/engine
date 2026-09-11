export type NpcKillCountEvent = {
    account_id: number;
    profile: string;
    npc_type: number;
    npc_name: string;
    kills: number;
    last_kill: number;
};
