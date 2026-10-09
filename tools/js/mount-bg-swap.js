/**
 * 横屏底图接线，配套 `assets/scripts/ui/BackgroundSwap.ts`。
 * 把组件挂到 `Canvas/BackgroundLayer` 上，把两个口指过去：`bg` = 子节点 `Bg_Sprite` 的 Sprite，
 * `landscapeFrame` = assets/recourses/UI及背景/横屏背景.jpg（2226×1668）。
 * 竖屏那张不用配 —— 组件 `onLoad` 读的就是 `Bg_Sprite` 上挂着的那张。
 *
 *   node tools/exec.mjs scene tools/js/mount-bg-swap.js
 *
 * 幂等：组件已存在就复用，重复跑只再赋一次同样的引用。
 */
const canvas = cc.director.getScene().getChildByName('Canvas');
const layer = canvas.getChildByName('BackgroundLayer');
const bg = layer.getChildByPath('Bg_Sprite').getComponent(cc.Sprite);

const LANDSCAPE_UUID = '35ce0428-845c-425b-bd5b-a528c2863f02@f9941';
const frame = await new Promise((resolve, reject) => {
  cc.assetManager.loadAny(LANDSCAPE_UUID, (err, asset) => (err ? reject(new Error(LANDSCAPE_UUID + ' -> ' + err.message)) : resolve(asset)));
});

const comp = layer.getComponent('BackgroundSwap') || layer.addComponent('BackgroundSwap');
comp.bg = bg;
comp.landscapeFrame = frame;

const f = comp.landscapeFrame;
return {
  layerOwn: layer.components.map((c) => cc.js.getClassName(c)),
  bg: comp.bg ? comp.bg.node.name + ' | ' + comp.bg.spriteFrame.name : null,
  landscapeFrame: f ? f.name + ' | ' + f.uuid : null,
  landscapeSize: f ? [f.rect.width, f.rect.height] : null,
  landscapeInset: f ? [f.insetTop, f.insetBottom, f.insetLeft, f.insetRight] : null,
  bgSprite: { type: bg.type, sizeMode: bg.sizeMode, width: bg.node.getComponent(cc.UITransform).width },
};
