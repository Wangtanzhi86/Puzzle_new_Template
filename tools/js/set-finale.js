/**
 * 收尾那一段（最后一格露面 → 结束界面之间）的几个数 + 扫光开关，写在一处：
 *
 *   node tools/exec.mjs scene tools/js/set-finale.js                    # 现在的状态：那道横扫关着
 *   node tools/exec.mjs scene tools/js/set-finale.js "{\"sweep\":true}"  # 想把横扫开回来时
 *
 * 时间轴（从「最后一格露面」= 最后一个 `PIECE_SHOWN` 起算）：
 *
 *   **扫光关着（当前）**：0.0 当刻落笔
 *   扫光开着：            0.0→0.5 **定格**（`RepairSweep.completeDelay`）→ 0.5→1.4
 *                        **一道光横扫整块拼图**（`FeatureFlags.sweepOnComplete` + `completeTime`）
 *                        → 1.4 起落笔（`SceneBgSwap.delay` = 定格 + 横扫）
 *   ……之后看 `SceneBgSwap.instant`：
 *     · **勾着（当前）**：当刻把完成图亮出来（不走画笔），`revealTime` 不起作用 → 抛 `END_SHOW`
 *     · 取消勾选：画笔涂色 `revealTime` 秒（+ 仙尘）→ 抛 `END_SHOW`
 *   → 结尾视频（§18）→ 结束界面。
 *
 * 为什么是一对：`SceneBgSwap.delay` 和 `RepairSweep` 那两个数没有事件能替它们传话（§5：事件与发射方
 * 一律不动），只能各配一个延时。**扫光关着时 delay 必须填 0**，否则最后一格露脸之后白等一段 ——
 * `verify-scene.js` 的 `checkFinale` 会报这一条。想留一口白（停一下再落笔）就填那个值，但那条检查会照报，
 * 得先改它的口径。
 *
 * ⚠️ `winCount > 0` 的老路上这一段演不到（商店在最后一块**吸附当刻**就开了）；
 *    `winCount = 0` 时它整段都在主路径上，**通往 CTA 的时间 = delay + revealTime + 结尾视频**。
 */
const canvas = cc.director.getScene().getChildByName('Canvas');
const flags = canvas.getComponent('FeatureFlags');
const sweep = canvas.getChildByName('EffectLayer').getComponent('RepairSweep');
const bg = canvas.getChildByPath('GameLayer/Scene_BG').getComponent('SceneBgSwap');

const HOLD = 0.5;   // 定格（只有扫光开着时才有意义）
const SWEEP = 0.9;  // 横扫时长（= RepairSweep.completeTime）
const on = !!(args && args.sweep === true);

flags.sweepOnComplete = on;
sweep.completeTime = SWEEP;
sweep.completeDelay = HOLD;
bg.delay = on ? HOLD + SWEEP : 0;

return {
  sweepOnComplete: flags.sweepOnComplete,
  sweepOnRepair: flags.sweepOnRepair,
  hold: sweep.completeDelay,
  sweepTime: sweep.completeTime,
  brushDelay: bg.delay,
  brushReveal: bg.revealTime,
  instant: bg.instant,
  toEndShow: +(bg.instant ? bg.delay : bg.delay + bg.revealTime).toFixed(2),
};
