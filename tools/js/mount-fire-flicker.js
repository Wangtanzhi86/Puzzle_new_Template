/**
 * 给 `Scene_BG/火` 挂上火焰跳动（`assets/scripts/gameplay/FireFlicker.ts`）：
 *   - 每帧改 `UITransform.contentSize` 纵向拉伸 / 横向伸缩，**底边钉住**，只有上半截在动
 *   - 基准取组件 `onLoad` 那一刻的尺寸 / 位置，这里只填幅度和节奏
 *
 *   node tools/exec.mjs scene tools/js/mount-fire-flicker.js
 *
 * 幂等：组件已存在就只重写参数。
 */
const canvas = cc.director.getScene().getChildByName('Canvas');
const fire = canvas.getChildByPath('GameLayer/Scene_BG/火');

let comp = fire.getComponent('FireFlicker');
if (!comp) comp = fire.addComponent('FireFlicker');
comp.stretchX = 0.08;
comp.stretchY = 0.15;
comp.period = 0.6;
comp.phase = 0;
comp.wobble = 0.35;

const ut = fire.getComponent(cc.UITransform);
return {
    node: fire.name,
    comps: fire.components.map((c) => cc.js.getClassName(c)),
    base: { size: [ut.width, ut.height], pos: [fire.position.x, fire.position.y] },
    tune: {
        stretch: comp.stretchX + ' / ' + comp.stretchY,
        period: comp.period + 's',
        wobble: comp.wobble,
    },
};
