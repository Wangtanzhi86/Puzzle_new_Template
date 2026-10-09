/**
 * 横屏两栏布局接线，配套 `assets/scripts/ui/LandscapeLayout.ts`。
 * 只是把组件挂到 Canvas 上、把五个口指过去、把碎片池 Layout 的交叉轴对齐勾上 ——
 * 布局本身与所有可调数值都在脚本里（Inspector 里改）。
 *
 *   node tools/exec.mjs scene tools/js/mount-landscape.js
 *
 * 幂等：组件已存在就复用，重复跑只再赋一次同样的引用。
 */
const canvas = cc.director.getScene().getChildByName('Canvas');
const comp = canvas.getComponent('LandscapeLayout') || canvas.addComponent('LandscapeLayout');

comp.gameLayer = canvas.getChildByName('GameLayer');
comp.progressLayer = canvas.getChildByPath('UILayer/ProgressLayer');
comp.poolLayer = canvas.getChildByName('PiecePoolLayer');
comp.poolBg = canvas.getChildByPath('PiecePoolLayer/PoolBG');
comp.scrollView = canvas.getChildByPath('PiecePoolLayer/ScrollView').getComponent(cc.ScrollView);
comp.cta = canvas.getChildByName('GameCta');

const brief = (n) => (n ? { name: n.name, pos: [n.position.x, n.position.y], scale: [n.scale.x, n.scale.y] } : null);
const sizeOf = (n) => (n ? [n.getComponent(cc.UITransform).width, n.getComponent(cc.UITransform).height] : null);
return {
  canvasOwn: canvas.components.map((c) => cc.js.getClassName(c)),
  wired: {
    gameLayer: brief(comp.gameLayer),
    progressLayer: brief(comp.progressLayer),
    poolLayer: brief(comp.poolLayer),
    poolSize: sizeOf(comp.poolLayer),
    poolBg: brief(comp.poolBg),
    poolBgSize: sizeOf(comp.poolBg),
    scrollView: comp.scrollView ? comp.scrollView.node.name : null,
  },
  props: {
    scale: comp.scale,
    columnGap: comp.columnGap,
    railGap: comp.railGap,
    maxRailHeight: comp.maxRailHeight,
    poolBgRotate: comp.poolBgRotate,
    poolBgScale: comp.poolBgScale,
  },
};
