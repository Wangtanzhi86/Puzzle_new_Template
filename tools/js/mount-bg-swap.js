/**
 * 横屏底图接线，配套 `assets/scripts/ui/BackgroundSwap.ts`。
 * 把组件挂到 `Canvas/BackgroundLayer` 上，把 `bg` 口指向子节点 `Bg_Sprite` 的 Sprite。
 * 竖屏那张不用配 —— 组件 `onLoad` 读的就是 `Bg_Sprite` 上挂着的那张。
 *
 * ⚠️ `landscapeFrame`（横屏那张底图）**不在这里配**：横屏背景那段美术已经随旧素材一起删了，
 * 场景里现在是 null。美术出了横版底图之后在 Inspector 里拖进 `BackgroundSwap.landscapeFrame`，
 * 或者在这个脚本里补一段 load（别再写死 uuid —— 每次重新导入都会变）。
 *
 *   node tools/exec.mjs scene tools/js/mount-bg-swap.js
 *
 * 幂等：组件已存在就复用，重复跑只再赋一次同样的引用。
 */
const canvas = cc.director.getScene().getChildByName('Canvas');
const layer = canvas.getChildByName('BackgroundLayer');
const bg = layer.getChildByPath('Bg_Sprite').getComponent(cc.Sprite);

const comp = layer.getComponent('BackgroundSwap') || layer.addComponent('BackgroundSwap');
comp.bg = bg;

const f = comp.landscapeFrame;
return {
  layerOwn: layer.components.map((c) => cc.js.getClassName(c)),
  bg: comp.bg ? comp.bg.node.name + ' | ' + (comp.bg.spriteFrame ? comp.bg.spriteFrame.name : '<空>') : null,
  landscapeFrame: f ? f.name + ' | ' + f.uuid : null,
  bgSprite: { type: bg.type, sizeMode: bg.sizeMode, width: bg.node.getComponent(cc.UITransform).width },
};
