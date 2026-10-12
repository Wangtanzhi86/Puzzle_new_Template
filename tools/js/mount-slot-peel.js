/**
 * 把「贴纸揭角」的全局那组值**物化到每一格**（配套 `PieceSlot.peelOverride` / `peelParams`）。
 *
 * 为什么要这一步：逐格覆盖是「全有或全无」—— 勾上「本格单独配揭角」之后，那一格用的是
 * `slot.peelParams` 自己的值，而它的初值是**类的默认值**（`corner (0,0)` / `liftRatio 0.28`），
 * 不是全局那份。直接勾会静默把方向、大小、快慢全改掉。所以「想从全局那组起步」就跑一次这个。
 *
 * 职责是「给每格一个起点」，不是每次跑都复位：**已经勾上的槽位原样保留**（同 `mount-audio.js`
 * 的「已经有配置就不覆盖」）。想重新从全局起步，在 Inspector 里把那个勾取消再跑。
 *
 *   node tools/exec.mjs scene tools/js/mount-slot-peel.js
 *
 * 幂等：勾上的格子不会被重复动。
 */
const canvas = cc.director.getScene().getChildByName('Canvas');
const brokenLayer = canvas.getChildByPath('GameLayer/BrokenLayer');
const factory = canvas.getChildByPath('PiecePoolLayer/ScrollView').getComponent('PieceFactory');
const p = factory.peelParams;

// 新加的 @property 在老实例上可能还没有 —— 类名注册过，直接按名字取出来造一份
const PeelConfig = cc.js.getClassByName('PeelConfig');

const cloned = [];
const kept = [];
for (const child of brokenLayer.children) {
  const slot = child.getComponent('PieceSlot');
  if (!slot) continue;
  if (slot.peelOverride) {
    kept.push(child.name);
    continue;
  }
  if (!slot.peelParams) slot.peelParams = new PeelConfig();
  const own = slot.peelParams;
  own.corner.set(p.corner.x, p.corner.y);
  own.liftRatio = p.liftRatio;
  own.liftTime = p.liftTime;
  own.stickTime = p.stickTime;
  own.backColor.set(p.backColor);
  own.creaseWidth = p.creaseWidth;
  own.creaseGlow = p.creaseGlow;
  slot.peelOverride = true;
  cloned.push(child.name);
}

const read = (slot) =>
  slot.peelParams.corner.toString() + ' / ' + slot.peelParams.liftRatio + ' / ' + slot.peelParams.liftTime;

return {
  cloned: cloned.map((n) => n + ' -> ' + read(brokenLayer.getChildByName(n).getComponent('PieceSlot'))),
  keptAsIs: kept,
  global: p.corner.toString() + ' / ' + p.liftRatio + ' / ' + p.liftTime,
};
