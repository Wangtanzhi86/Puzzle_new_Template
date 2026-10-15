/**
 * 给「完成背景」那支画笔定一套参数：笔头调细、笔数拉满，整段涂色的流程放长。
 *
 *   node tools/exec.mjs scene tools/js/set-scene-brush.js
 *
 * 原来的 5 笔 / 半径 0.3 是照**碎片**尺寸定的，铺到 582×840 的完成背景上笔头太粗 ——
 * 起笔那一瞬就是一团半径 0.3×840 = 252px 的圆（直径占画面宽度的 87%，几乎盖住半张图），
 * 看着像「一下子糊了一大片」而不是「在刷」。这里改成：
 *
 *   笔数拉到材质的上限 12（`BRUSH_MAX_ROWS`，见 `brush-reveal.effect`，改那个常量要两边一起改），
 *   半径取 0.08 ⇒ 笔头半径 0.08×840 ≈ 67px、直径占画面宽度 23%，起笔那一下才像「先点一下」。
 *
 * ⚠️ `SceneBgSwap.instant`（「直接亮出来」）**勾着时这几个数一个都不起作用** ——
 *    那条路上不建材质、不起 tween，完成图是当刻亮出来的。这个脚本只在退回画笔涂色时才管用。
 *
 * ⚠️ 半径不能无限降：低于「相邻笔迹不留缝」的下限，笔迹之间会露出没涂到的底。
 * 那个下限**不能靠读代码推**，是把 `brush-reveal.effect` 的覆盖判定抄成普通 JS 逐像素量出来的
 * （见 [docs/WORKLOG.md] 「完成背景那支画笔」）。实测：下限 = c ÷ 笔数，c 只跟底图长宽比有关 ——
 * 本图 582×840（A≈0.69）时 c ≈ 0.74，12 笔 ⇒ 0.062；A = 1 的方图要 1÷笔数，A = 0.3 只要 0.46÷笔数。
 * 取 0.08 是压着下限再留 ~30% 余量（素材边缘有 feather 羽化，贴着下限配边界会发虚）。
 *
 * 想再细只能**先改材质**：12 是 `BRUSH_MAX_ROWS` 那个循环的上界，笔数封在 12，
 * 半径就不能低于 0.062。真要更细的笔头得把 `BRUSH_MAX_ROWS` 抬上去，两边一起改。
 *
 * 幂等：每次都按上面的规则重算一遍写回（这几个数是**算出来的**，不是手调的）。
 * `revealTime` 是唯一一个手感的数：只在明显偏短（≤1.3）时抬到 2.5，之后在 Inspector 里调多少都保留。
 * ⚠️ 别为了「再长一点」把它往 3 秒以上堆 —— `winCount = 0` 时这一段是**主路径**上的，
 * 演完才抛 `END_SHOW` 亮结束界面，拖多久玩家就等多久才看见 CTA。
 */
const canvas = cc.director.getScene().getChildByName('Canvas');
const bg = canvas.getChildByPath('GameLayer/Scene_BG');
const comp = bg.getComponent('SceneBgSwap');

// 和 `SceneBgSwap.BRUSH_MAX_ROWS` / `brush-reveal.effect` 里那个 12 是同一个数
const ROWS = 12;
// 下限 0.74 ÷ 12 = 0.062（实测，见文件头），再留 ~30% 余量
const radius = 0.08;

comp.rows = ROWS;
comp.radius = radius;
if (comp.revealTime <= 1.3) comp.revealTime = 2.5;

const ut = comp.revealView ? comp.revealView.node.getComponent(cc.UITransform) : null;
return {
  rows: comp.rows,
  radius: comp.radius,
  feather: comp.feather,
  revealTime: comp.revealTime,
  // 起笔那一瞬是个半径 = radius×高 的圆，直径相对画面宽度：
  headOfStart: ut ? [
    +(comp.radius * ut.height).toFixed(1),
    +(comp.radius * ut.height * 2 / ut.width).toFixed(2),
  ] : null,
  board: ut ? [ut.width, ut.height] : null,
};
