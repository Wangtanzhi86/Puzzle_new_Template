export enum GameEvent {
    GAME_INIT = 'GAME_INIT',
    LEVEL_BUILT = 'LEVEL_BUILT',
    POOL_BUILT = 'POOL_BUILT',
    PIECE_PICK = 'PIECE_PICK',
    PIECE_DRAG = 'PIECE_DRAG',
    PIECE_SNAP_SUCCESS = 'PIECE_SNAP_SUCCESS',
    PIECE_SNAP_FAIL = 'PIECE_SNAP_FAIL',
    PIECE_REPAIRED = 'PIECE_REPAIRED',
    REPAIR_FAILED = 'REPAIR_FAILED',
    /** 灭火器换成「喷射」那张、喷出来那一刻（`ExtinguishAction.spray()`，不是这一格修好当刻） */
    EXTINGUISH_SPRAY = 'EXTINGUISH_SPRAY',
    /** 灭火器到位之后**开始上下摇晃**那一刻（`ExtinguishAction.shake()` 开头） */
    EXTINGUISH_SHAKE = 'EXTINGUISH_SHAKE',
    /** 火节点被隐藏那一刻（`ExtinguishAction.spray()` 里 `fire.active = false`，火渐隐走完） */
    FIRE_HIDE = 'FIRE_HIDE',
    /** 「修复效果」整棵亮出来那一刻（`HammerAction.play()`，敲击动画的起点） */
    REPAIR_FX = 'REPAIR_FX',
    /** 「修复效果」整棵收掉那一刻（`HammerAction.step()`，整段演完）；绑在 `REPAIR_FX` 上的循环音靠它停 */
    REPAIR_FX_HIDE = 'REPAIR_FX_HIDE',
    PIECE_SHOWN = 'PIECE_SHOWN',
    REPAIR_PROGRESS = 'REPAIR_PROGRESS',
    LEVEL_COMPLETE = 'LEVEL_COMPLETE',
    END_SHOW = 'END_SHOW',
    END_DROP = 'END_DROP',
    GAME_OVER = 'GAME_OVER',
    GUIDE_HIDE = 'GUIDE_HIDE',
    GUIDE_HOLD = 'GUIDE_HOLD',
    GUIDE_RESUME = 'GUIDE_RESUME',
    CTA_SHOW = 'CTA_SHOW',
    CTA_CLICK = 'CTA_CLICK',
    ORIENTATION_CHANGED = 'ORIENTATION_CHANGED',
    AUDIO_MUTE = 'AUDIO_MUTE',
}
