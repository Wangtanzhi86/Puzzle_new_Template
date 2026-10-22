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
    /** 剧情气泡开始播放（载荷：气泡序号 1/2/3）。`BubbleSequence` 发，`AudioManager` 听 */
    BUBBLE_SHOW = 'BUBBLE_SHOW',
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
    /** 上一块修复相关表现开始 / 结束，`DragController` 凭这一对事件锁住下一块的拿起 */
    DRAG_HOLD = 'DRAG_HOLD',
    DRAG_UNLOCK = 'DRAG_UNLOCK',
    /** 引导演到某一遍、当前正指着池里那块碎片（载荷：槽位序号）。RadialSweep 凭它按格播描边 */
    GUIDE_PIECE = 'GUIDE_PIECE',
    CTA_SHOW = 'CTA_SHOW',
    CTA_CLICK = 'CTA_CLICK',
    ORIENTATION_CHANGED = 'ORIENTATION_CHANGED',
    AUDIO_MUTE = 'AUDIO_MUTE',
}
