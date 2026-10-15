/**
 * 给每格的 `num` 数字标签分配一个互不重复的随机整数。
 *
 *   node tools/exec.mjs scene tools/js/set-slot-num-random.js
 *   node tools/exec.mjs scene tools/js/set-slot-num-random.js '{"min":50,"max":200}'
 *
 * 「不重复」靠不放回抽样：先在 [min, max] 里取整池洗牌，再按 BrokenLayer 的子节点顺序一人一个。
 * 所以 `max - min + 1` 必须 ≥ 槽位数，分不到的槽位会出现在返回值的 `skipped` 里。
 *
 * ⚠️ 不能直接写 `label.string = ...`：`Label.string` 不走编辑器的属性变更通知，场景不会被标脏，
 * `save-scene` 返回 false、改动只活在编辑器内存里（字节不落盘）。必须走
 * `Editor.Message.request('scene', 'set-property', ...)`（Inspector 改 Label 走的就是它）。
 *
 * 每次跑都是新的一组随机数（这不是接线脚本，没有幂等一说）。
 */
const min = (args && args.min) ?? 50;
const max = (args && args.max) ?? 200;
if (max < min) throw new Error(`min(${min}) 比 max(${max}) 大`);

const canvas = cc.director.getScene().getChildByName('Canvas');
const brokenLayer = canvas.getChildByPath('GameLayer/BrokenLayer');

const pool = [];
for (let v = min; v <= max; v++) pool.push(v);
for (let i = pool.length - 1; i > 0; i--) {
  const j = Math.floor(Math.random() * (i + 1));
  const t = pool[i]; pool[i] = pool[j]; pool[j] = t;
}

const assigned = [];
const skipped = [];
let k = 0;
for (const slot of brokenLayer.children) {
  const num = slot.getChildByName('num');
  const index = num ? num.components.findIndex((c) => c instanceof cc.Label) : -1;
  if (index < 0 || k >= pool.length) { skipped.push(slot.name); continue; }
  const value = pool[k++];
  const was = num.components[index].string;
  const ok = await Editor.Message.request('scene', 'set-property', {
    uuid: num.uuid,
    path: `__comps__.${index}.string`,
    dump: { type: 'String', value: String(value) },
  });
  if (!ok) { skipped.push(slot.name); continue; }
  assigned.push({ slot: slot.name, was, now: value });
}

return { range: [min, max], assigned, skipped };
