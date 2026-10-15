/**
 * 按**每一格自己的形状**算一份揭角参数（`PieceSlot.peelParams`，见 AGENTS.md §16）。
 *
 *   node tools/exec.mjs scene tools/js/set-slot-peel.js
 *
 * 23 格原来抄的是同一份（都掀右下角 / 比例 0.25），可碎片从 17×34 到 431×140 都有：
 * 同一个比例落到 171×775 的长条上，折线离角 167px —— 掀掉一大块；
 * 落到 17×34 的小碎片上只有 9px，几乎看不出来。所以按形状逐格算：
 *
 *   1. **掀哪个角**：宽÷高 ≥ `WIDE`（宽扁的）掀**右边** —— 角取右边缘中点 `(1, 0.5)`，
 *      折出来的是一条竖折线，整条右边缘翻过去（`peelLine` 的折线不要求过角，任意点都行）；
 *      其余（竖长的、近正方的）掀**右下角** `(1, 0)`。
 *   2. **掀起的比例**：先定折线的绝对深度 `d = DEPTH × 短边`（世界 px），再折成比例 ——
 *      `peelLine` 的 `amount` 是「沿角到对角的方向推多远」，那个方向上的跨度 `span` 就是下面
 *      `spanOf()` 复述的那一句（和 `peelLine` 里同源，别各写一份）。于是无论碎片多大，
 *      掀起来的那块**占短片的比例是一样的**。
 *   3. **折线高光带宽**：同步按 `d` 折算。它原来写的是「相对碎片高」，落到 775 高的长条上
 *      光带就有 39px（比折线本身还厚）—— 一整块都糊成高光了。
 *
 * 快慢（`liftTime` / `stickTime`）与背面底色不动。
 *
 * ⚠️ 它会**覆盖**每格 `peelParams` 里手调过的值 —— 改完美术、碎片尺寸变了就重跑一次。
 * 尺寸取自「修复后」那张图（池里那块碎片就是它的图，两边是同一张）。
 */
const DEPTH = 0.28;   // 折线深度 ÷ 碎片短边
const BAND = 0.22;    // 折线高光带宽 ÷ 折线深度
const WIDE = 1.2;     // 宽 ÷ 高 ≥ 它就算「宽扁」，掀右边

const canvas = cc.director.getScene().getChildByName('Canvas');
const brokenLayer = canvas.getChildByPath('GameLayer/BrokenLayer');

// 顺手把 `StickerApply` 那 6 个抄写值同步成全局那份（`mount-sticker-apply.js` 会做的前半件事）——
// 现在 23 格都勾了「本格单独配揭角」，贴平现读的就是本格这份，那 6 个值没人读；但 `verify-scene.js`
// 会拿它和全局比，留一处不一致就报一条。**别为此去跑 `mount-sticker-apply.js`** —— 它会顺手把
// slot 的 `brushReveal` 清掉（见现状速查），只为同步 8 个数不值当。
const factory = canvas.getChildByPath('PiecePoolLayer/ScrollView').getComponent('PieceFactory');
const apply = canvas.getChildByName('EffectLayer').getComponent('StickerApply');
let synced = false;
if (factory && factory.peelParams && apply) {
  const g = factory.peelParams;
  // 逐字段抄成**副本**（`clone()`），别把全局那个实例直接挂过去 —— 那样两边共用一个对象，
  // 以后改哪边都是改两边（`mount-sticker-apply.js` 也是 clone）
  apply.corner = g.corner.clone();
  apply.openRatio = g.liftRatio;
  apply.applyTime = g.stickTime;
  apply.backColor = g.backColor.clone();
  apply.creaseWidth = g.creaseWidth;
  apply.creaseGlow = g.creaseGlow;
  synced = true;
}

// 和 `StickerPeel.peelLine()` 里那句同源：折线方向 u 是归一化坐标里的「角 → 中心」，
// 矩形在 u 方向上的跨度是 |ux|×w + |uy|×h
const spanOf = (cx, cy, w, h) => {
  let ux = 0.5 - cx;
  let uy = 0.5 - cy;
  const len = Math.sqrt(ux * ux + uy * uy) || 1;
  return (Math.abs(ux / len) * w + Math.abs(uy / len) * h);
};

const rows = [];
for (const child of brokenLayer.children) {
  const slot = child.getComponent('PieceSlot');
  if (!slot) continue;
  const view = slot.repairedView || slot.brokenView;
  if (!view) continue;
  const ut = view.node.getComponent(cc.UITransform);
  const w = ut.width;
  const h = ut.height;
  const wide = w / h >= WIDE;

  const corner = wide ? [1, 0.5] : [1, 0];
  const short = Math.min(w, h);
  const depth = DEPTH * short;
  const p = slot.peelParams;
  p.corner.set(corner[0], corner[1]);
  p.liftRatio = Math.round((depth / spanOf(corner[0], corner[1], w, h)) * 1000) / 1000;
  p.creaseWidth = Math.round(((BAND * depth) / h) * 1000) / 1000;

  rows.push({
    slot: child.name,
    size: [w, h],
    corner: wide ? '右边' : '右下角',
    lift: p.liftRatio,
    depth: +depth.toFixed(1),
    creaseW: p.creaseWidth,
  });
}
return { stickerApplySynced: synced, slots: rows };
