// 把功能开关面板挂到 Canvas，幂等：已经有就原样保留（不能像 build-scene.js 那样
// removeComponent 重挂，那会把 Inspector 里勾好的值复位成默认值）。
const canvas = cc.director.getScene().getChildByName('Canvas');
const cls = cc.js.getClassByName('FeatureFlags');
if (!cls) return { ok: false, error: 'FeatureFlags 类没加载' };

const had = !!canvas.getComponent(cls);
const c = had ? canvas.getComponent(cls) : canvas.addComponent(cls);
return {
    ok: true,
    existed: had,
    values: {
        pieceGlow: c.pieceGlow,
        trail: c.trail,
        sweepOnRepair: c.sweepOnRepair,
        sweepOnComplete: c.sweepOnComplete,
        guide: c.guide,
        progress: c.progress,
        audio: c.audio,
    },
};
