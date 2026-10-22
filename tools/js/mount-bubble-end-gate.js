const canvas = cc.director.getScene().getChildByName('Canvas');
const cta = canvas.getChildByPath('UILayer/CtaLayer').getComponent('CtaController');
const layer = canvas.getChildByPath('GameLayer/BubbleLayer');
if (!cta) throw new Error('CtaController not found');
if (!layer) throw new Error('BubbleLayer not found');
cta.waitNodes = ['Bubble_01', 'Bubble_02', 'Bubble_03']
  .map((name) => layer.getChildByName(name))
  .filter((n) => !!n);
return {
  cta: cta.node.name,
  waitNodes: cta.waitNodes.map((n) => n.name),
  activeNow: cta.waitNodes.map((n) => n.activeInHierarchy),
};