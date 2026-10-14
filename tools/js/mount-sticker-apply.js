/**
 * 「贴纸贴平」接线，配套 `assets/scripts/gameplay/StickerApply.ts`（和碎片揭角共用
 * `assets/effects/sticker-peel-*.effect` 那一对材质）。
 *
 *   - EffectLayer 上挂 StickerApply（全局一个实例，和 RepairSweep / RepairReveal / CircleReveal 并列）
 *   - 两个材质口从 `PieceFactory.peelFrontEffect` / `peelBackEffect` 上抄过来（**同一对 effect**）
 *   - 翘哪个角 / 翘起来的比例 / 背面底色 / 折线宽度与强度也照抄全局那份 —— 这几项是**没勾
 *     「本格单独配揭角」的槽位**的回落值，必须和碎片那边一模一样，吸附那一刻「手上翘着的角」
 *     和「缺口上翘着的角」才是同一个姿势。勾了覆盖的槽位现读它自己那份，不受这里影响
 *     （`StickerApply.play` 里 `host.peel` 优先）
 *   - 把六格的 `stickerApply` 指过去，并清掉它们各自的 `circleReveal` / `brushReveal`
 *     （三个都是「整格接管」、都要往同一张修复图上挂材质，只能填一个；`repair()` 里贴平排在
 *     最前面、命中就 return，所以别处都填时后面那些一次都跑不到 —— 留着只会让人以为它在生效）
 *   - 收尾脉冲的材质口 = `piece-glow.effect`（贴平推完那一下「缩小淡出 → 放大淡入」途中的边缘高亮，
 *     和拖动亮边同一份材质，不跟圆形扩散抢 —— 它不揭任何东西，只是贴好那一下的反馈）
 *
 * ⚠️ 六格全接贴平。要让某一格改回圆形扩散，把它的名字从下面那个 SLOTS 里去掉、再把
 * `PieceSlot.circleReveal` 指回 `EffectLayer` 上那个 CircleReveal 即可。
 *
 * ⚠️ 每跑一次都会把这些调参重新写一遍（`applyTime` 抄的是碎片的 `stickTime`），
 * 在 Inspector 里改过再跑就会被复位 —— 同 `mount-spray-action.js`。只想改观感就别再跑它。
 * （改全局那份之后要重跑它一次，否则没勾覆盖的槽位两边姿势对不上；`verify-scene.js` 会报。）
 *
 *   node tools/exec.mjs scene tools/js/mount-sticker-apply.js
 *
 * 幂等：组件 / 引用已存在就重复赋同样的值。
 */
const canvas = cc.director.getScene().getChildByName('Canvas');
const effectLayer = canvas.getChildByName('EffectLayer');
const brokenLayer = canvas.getChildByPath('GameLayer/BrokenLayer');
const factory = canvas.getChildByPath('PiecePoolLayer/ScrollView').getComponent('PieceFactory');
const p = factory.peelParams;

const PULSE_UUID = 'c2dbdffc-63f9-4eb7-975c-da194178407f';
const SLOTS = ['Slot_01', 'Slot_02', 'Slot_03', 'Slot_04', 'Slot_05', 'Slot_06'];

const loadEffect = (uuid) =>
  new Promise((res, rej) =>
    cc.assetManager.loadAny(uuid, (e, a) => (e ? rej(new Error(uuid + ' -> ' + e.message)) : res(a))),
  );

let apply = effectLayer.getComponent('StickerApply');
if (!apply) apply = effectLayer.addComponent('StickerApply');
apply.frontEffect = factory.peelFrontEffect;
apply.backEffect = factory.peelBackEffect;
apply.corner = p.corner.clone();
apply.openRatio = p.liftRatio;
apply.applyTime = p.stickTime;
apply.backColor = p.backColor.clone();
apply.creaseWidth = p.creaseWidth;
apply.creaseGlow = p.creaseGlow;
if (!apply.pulseEffect) apply.pulseEffect = await loadEffect(PULSE_UUID);

const wired = [];
const cleared = [];
for (const name of SLOTS) {
  const slot = brokenLayer.getChildByName(name).getComponent('PieceSlot');
  slot.stickerApply = apply;
  if (slot.circleReveal) {
    slot.circleReveal = null;
    cleared.push(name + ' 圆形扩散');
  }
  if (slot.brushReveal) {
    slot.brushReveal = null;
    cleared.push(name + ' 画笔涂色');
  }
  wired.push(name);
}

return {
  front: apply.frontEffect.name + ' | ' + apply.frontEffect.uuid,
  back: apply.backEffect.name + ' | ' + apply.backEffect.uuid,
  corner: apply.corner.toString(),
  openRatio: apply.openRatio,
  applyTime: apply.applyTime,
  backColor: apply.backColor.toString(),
  creaseWidth: apply.creaseWidth,
  creaseGlow: apply.creaseGlow,
  pulseEffect: apply.pulseEffect ? apply.pulseEffect.name + ' | ' + apply.pulseEffect.uuid : null,
  pulse: [apply.pulseShrinkScale, apply.pulseMinOpacity, apply.pulseDownTime, apply.pulseUpTime, apply.pulseMarginRatio, apply.pulseRimRatio].join(' / '),
  wired,
  cleared,
  stillOtherReveal: brokenLayer.children
    .filter((n) => {
      const s = n.getComponent('PieceSlot');
      return s && (s.circleReveal || s.brushReveal);
    })
    .map((n) => n.name),
};
