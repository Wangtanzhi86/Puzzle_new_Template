/**
 * 两件事，都作用在 `Canvas/GameLayer/BrokenLayer` 下：
 *
 *  1. 把槽位按 `PieceSlot.pieceId`（碎片序号）升序重排 `siblingIndex`。
 *     ⚠️ 玩法顺序不依赖它 —— `LevelFactory.build()` 自己会 `sort(pieceId)`。
 *     这一步只是让编辑器里的排列和池子里的顺序对上，方便美术对照。
 *
 *  2. 把每格的 `Broken` 子节点的 **Node 变换**（position / rotation / scale）
 *     与 **UITransform**（contentSize / anchorPoint）抄成它自己 `Repaired` 的那一份。
 *     两张图同位置同尺寸，修复瞬间才不会跳（AGENTS.md §6）。
 *
 *   node tools/exec.mjs scene tools/js/align-slot-broken.js
 *
 * 幂等：已对齐的格子照抄一遍同样的值；已排好的顺序重排成同样的顺序。
 */
const canvas = cc.director.getScene().getChildByName('Canvas');
const brokenLayer = canvas.getChildByPath('GameLayer/BrokenLayer');

const v3 = (v) => `(${v.x}, ${v.y}, ${v.z})`;
const sz = (u) => `${u.width}x${u.height}`;

const slots = [];
const skipped = [];

for (const child of brokenLayer.children) {
  const slot = child.getComponent('PieceSlot');
  const broken = child.getChildByName('Broken');
  const repaired = child.getChildByName('Repaired');
  if (!slot || !broken || !repaired) {
    skipped.push(`${child.name} (slot=${!!slot} Broken=${!!broken} Repaired=${!!repaired})`);
    continue;
  }

  const bu = broken.getComponent(cc.UITransform);
  const ru = repaired.getComponent(cc.UITransform);
  const before = `pos ${v3(broken.position)} scale ${v3(broken.scale)} / ${sz(bu)} anchor (${bu.anchorX}, ${bu.anchorY})`;

  broken.setPosition(repaired.position);
  broken.setRotation(repaired.rotation);
  broken.setScale(repaired.scale);
  bu.setContentSize(ru.width, ru.height);
  bu.setAnchorPoint(ru.anchorX, ru.anchorY);

  const after = `pos ${v3(broken.position)} scale ${v3(broken.scale)} / ${sz(bu)} anchor (${bu.anchorX}, ${bu.anchorY})`;

  slots.push({
    name: child.name,
    pieceId: slot.pieceId,
    from: child.getSiblingIndex(),
    changed: before !== after,
    before,
    after,
  });
}

// 按碎片序号升序重排
const order = slots.slice().sort((a, b) => a.pieceId - b.pieceId);
for (let i = 0; i < order.length; i++) {
  brokenLayer.getChildByName(order[i].name).setSiblingIndex(i);
  order[i].to = i;
}

return {
  synced: slots.filter((s) => s.changed).length,
  unchanged: slots.filter((s) => !s.changed).length,
  skipped,
  reordered: order.filter((s) => s.from !== s.to).map((s) => `${s.name}(id=${s.pieceId}) ${s.from} -> ${s.to}`),
  finalOrder: brokenLayer.children.map((n) => {
    const s = n.getComponent('PieceSlot');
    return `${n.name}:${s ? s.pieceId : '?'}`;
  }),
  changedDetail: slots.filter((s) => s.changed).map((s) => `${s.name}(id=${s.pieceId})  ${s.before}  ->  ${s.after}`),
};
