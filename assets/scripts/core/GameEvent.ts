export enum GameEvent {
    GAME_INIT = 'GAME_INIT',
    /** 选关点了某一关（载荷：关卡序号）。GameEntry 收到后才真正建关 */
    LEVEL_SELECTED = 'LEVEL_SELECTED',
    /** 开场演完（挡板滑开 + 开头视频播完），玩家真正可以动手；BGM 与常驻音也从这一下起 */
    GAME_START = 'GAME_START',
    LEVEL_BUILT = 'LEVEL_BUILT',
    POOL_BUILT = 'POOL_BUILT',
    PIECE_PICK = 'PIECE_PICK',
    PIECE_DRAG = 'PIECE_DRAG',
    PIECE_SNAP_SUCCESS = 'PIECE_SNAP_SUCCESS',
    PIECE_SNAP_FAIL = 'PIECE_SNAP_FAIL',
    PIECE_REPAIRED = 'PIECE_REPAIRED',
    REPAIR_FAILED = 'REPAIR_FAILED',
    PIECE_SHOWN = 'PIECE_SHOWN',
    /** 预填那格的补演（碎片飞进来 + 揭晓）演完。`RepairSystem` 凭它把这一格算进进度 */
    PREFILL_DONE = 'PREFILL_DONE',
    /** 胶带揭晓里一条胶带开始擦出的那一瞬。只有配了 TapeWipe 的槽位会抛 */
    TAPE_STRIP = 'TAPE_STRIP',
    REPAIR_PROGRESS = 'REPAIR_PROGRESS',
    LEVEL_COMPLETE = 'LEVEL_COMPLETE',
    END_SHOW = 'END_SHOW',
    END_DROP = 'END_DROP',
    GAME_OVER = 'GAME_OVER',
    AUTO_PLAY = 'AUTO_PLAY',
    GUIDE_HIDE = 'GUIDE_HIDE',
    GUIDE_HOLD = 'GUIDE_HOLD',
    GUIDE_RESUME = 'GUIDE_RESUME',
    CTA_SHOW = 'CTA_SHOW',
    CTA_CLICK = 'CTA_CLICK',
    ORIENTATION_CHANGED = 'ORIENTATION_CHANGED',
    AUDIO_MUTE = 'AUDIO_MUTE',
}
