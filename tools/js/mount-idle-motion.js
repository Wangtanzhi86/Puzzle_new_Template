/**
 * 待机动画接线：给 `Scene_BG/马桶隐藏节点` 下的两团气体各挂一个 IdleMotion ——
 *   - 气体大：左右来回飘
 *   - 气体小：上下略微拉伸
 * 基准就是编辑器里摆的位置 / 缩放，`IdleMotion` 自己存快照，这里只填参数。
 *
 *   node tools/exec.mjs scene tools/js/mount-idle-motion.js
 *
 * 幂等：组件已存在就只重写参数。
 */
const canvas = cc.director.getScene().getChildByName('Canvas');
const holder = canvas.getChildByPath('GameLayer/Scene_BG/马桶隐藏节点');

function mount(name, props) {
  const node = holder.getChildByName(name);
  let comp = node.getComponent('IdleMotion');
  if (!comp) comp = node.addComponent('IdleMotion');
  Object.assign(comp, props);
  return { name, props };
}

return {
  wired: [
    mount('气体大', { swayX: 25, period: 3.2, phase: 0 }),
    mount('气体小', { stretchY: 0.12, period: 1.8, phase: 0.25 }),
  ],
  untouched: holder.children.filter((n) => !n.getComponent('IdleMotion')).map((n) => n.name),
};
