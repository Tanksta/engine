import {
    tzHaarFightCaveActive,
    tzHaarFightCaveClearProgress,
    tzHaarFightCaveCompleted,
    tzHaarFightCaveHealers,
    tzHaarFightCaveJadSpawnCoord,
    tzHaarFightCaveJadUid,
    tzHaarFightCaveJumpState,
    tzHaarFightCaveRemaining,
    tzHaarFightCaveResetState,
    tzHaarFightCaveReturnPending,
    tzHaarFightCaveRotation,
    tzHaarFightCaveSetCompleted,
    tzHaarFightCaveSetHealers,
    tzHaarFightCaveSetJadSpawnCoord,
    tzHaarFightCaveSetJadUid,
    tzHaarFightCaveSetRemaining,
    tzHaarFightCaveSetReturnPending,
    tzHaarFightCaveSetRotation,
    tzHaarFightCaveSetWave,
    tzHaarFightCaveStartState,
    tzHaarFightCaveWave
} from '#/engine/TzHaarFightCaveSession.js';
import { ScriptOpcode } from '#/engine/script/ScriptOpcode.js';
import type { CommandHandlers } from '#/engine/script/ScriptRunner.js';
import { ActivePlayer, checkedHandler } from '#/engine/script/ScriptPointer.js';

const TzHaarOps: CommandHandlers = {
    [ScriptOpcode.TZHAAR_FIGHTCAVE_ACTIVE]: checkedHandler(ActivePlayer, state => {
        state.pushInt(tzHaarFightCaveActive(state.activePlayer) ? 1 : 0);
    }),

    [ScriptOpcode.TZHAAR_FIGHTCAVE_START_STATE]: checkedHandler(ActivePlayer, state => {
        tzHaarFightCaveStartState(state.activePlayer);
    }),

    [ScriptOpcode.TZHAAR_FIGHTCAVE_JUMP_STATE]: checkedHandler(ActivePlayer, state => {
        tzHaarFightCaveJumpState(state.activePlayer, state.popInt());
    }),

    [ScriptOpcode.TZHAAR_FIGHTCAVE_RESET_STATE]: checkedHandler(ActivePlayer, state => {
        tzHaarFightCaveResetState(state.activePlayer);
    }),

    [ScriptOpcode.TZHAAR_FIGHTCAVE_CLEAR_PROGRESS_STATE]: checkedHandler(ActivePlayer, state => {
        tzHaarFightCaveClearProgress(state.activePlayer);
    }),

    [ScriptOpcode.TZHAAR_FIGHTCAVE_WAVE]: checkedHandler(ActivePlayer, state => {
        state.pushInt(tzHaarFightCaveWave(state.activePlayer));
    }),

    [ScriptOpcode.TZHAAR_FIGHTCAVE_SET_WAVE]: checkedHandler(ActivePlayer, state => {
        tzHaarFightCaveSetWave(state.activePlayer, state.popInt());
    }),

    [ScriptOpcode.TZHAAR_FIGHTCAVE_REMAINING]: checkedHandler(ActivePlayer, state => {
        state.pushInt(tzHaarFightCaveRemaining(state.activePlayer));
    }),

    [ScriptOpcode.TZHAAR_FIGHTCAVE_SET_REMAINING]: checkedHandler(ActivePlayer, state => {
        tzHaarFightCaveSetRemaining(state.activePlayer, state.popInt());
    }),

    [ScriptOpcode.TZHAAR_FIGHTCAVE_ROTATION]: checkedHandler(ActivePlayer, state => {
        state.pushInt(tzHaarFightCaveRotation(state.activePlayer));
    }),

    [ScriptOpcode.TZHAAR_FIGHTCAVE_SET_ROTATION]: checkedHandler(ActivePlayer, state => {
        tzHaarFightCaveSetRotation(state.activePlayer, state.popInt());
    }),

    [ScriptOpcode.TZHAAR_FIGHTCAVE_HEALERS]: checkedHandler(ActivePlayer, state => {
        state.pushInt(tzHaarFightCaveHealers(state.activePlayer));
    }),

    [ScriptOpcode.TZHAAR_FIGHTCAVE_SET_HEALERS]: checkedHandler(ActivePlayer, state => {
        tzHaarFightCaveSetHealers(state.activePlayer, state.popInt());
    }),

    [ScriptOpcode.TZHAAR_FIGHTCAVE_JAD_UID]: checkedHandler(ActivePlayer, state => {
        state.pushInt(tzHaarFightCaveJadUid(state.activePlayer));
    }),

    [ScriptOpcode.TZHAAR_FIGHTCAVE_SET_JAD_UID]: checkedHandler(ActivePlayer, state => {
        tzHaarFightCaveSetJadUid(state.activePlayer, state.popInt());
    }),

    [ScriptOpcode.TZHAAR_FIGHTCAVE_JAD_SPAWN_COORD]: checkedHandler(ActivePlayer, state => {
        state.pushInt(tzHaarFightCaveJadSpawnCoord(state.activePlayer));
    }),

    [ScriptOpcode.TZHAAR_FIGHTCAVE_SET_JAD_SPAWN_COORD]: checkedHandler(ActivePlayer, state => {
        tzHaarFightCaveSetJadSpawnCoord(state.activePlayer, state.popInt());
    }),

    [ScriptOpcode.TZHAAR_FIGHTCAVE_COMPLETED]: checkedHandler(ActivePlayer, state => {
        state.pushInt(tzHaarFightCaveCompleted(state.activePlayer));
    }),

    [ScriptOpcode.TZHAAR_FIGHTCAVE_SET_COMPLETED]: checkedHandler(ActivePlayer, state => {
        tzHaarFightCaveSetCompleted(state.activePlayer, state.popInt());
    }),

    [ScriptOpcode.TZHAAR_FIGHTCAVE_RETURN_PENDING]: checkedHandler(ActivePlayer, state => {
        state.pushInt(tzHaarFightCaveReturnPending(state.activePlayer) ? 1 : 0);
    }),

    [ScriptOpcode.TZHAAR_FIGHTCAVE_SET_RETURN_PENDING]: checkedHandler(ActivePlayer, state => {
        tzHaarFightCaveSetReturnPending(state.activePlayer, state.popInt() === 1);
    })
};

export default TzHaarOps;
