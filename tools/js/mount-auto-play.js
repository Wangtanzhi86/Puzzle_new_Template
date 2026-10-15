/**
 * 自动打关接线，配套 `assets/scripts/gameplay/AutoPlayer.ts`（见 AGENTS.md §16）。
 *
 *   node tools/exec.mjs scene tools/js/mount-auto-play.js
 *
 * 1. `Canvas/GameLayer` 挂 `AutoPlayer`（和 `DragController` 同一节点 —— 两个都是「往里喂输入」的）。
 * 2. `pool` 口指到 `Canvas/PiecePoolLayer` 上的 `PiecePool`。
 *
 * ⚠️ 总开关不在这儿，在 `Canvas` 的 `FeatureFlags` 面板上（「自动打关」），**当前默认关**。
 * 面板关着时这个组件一条监听都不注册，怎么调这几个数都不会有画面变化。
 *
 * 幂等：`pool` 每次重跑都重新指一遍（接线），**调参项只在组件是新建的时候写初值** ——
 * 门槛和节奏是要在 Inspector 里反复试的，重跑一次接线不该把调好的值冲回默认。
 */
const canvas = cc.director.getScene().getChildByName('Canvas');
const layer = canvas.getChildByName('GameLayer');
const pool = canvas.getChildByName('PiecePoolLayer').getComponent('PiecePool');

const had = !!layer.getComponent('AutoPlayer');
const ctrl = had ? layer.getComponent('AutoPlayer') : layer.addComponent('AutoPlayer');
ctrl.pool = pool;

if (!had) {
    // 玩家自己修够 2 块系统接管。⚠️ 这个数要 < `EndgameCta.winCount`（`winCount = 0` = 不按数量跳、
    // 修完为止，那时不受限）—— 不然玩家自己就修满了，接管无事可做
    ctrl.afterPlaced = 2;
    ctrl.startDelay = 0.5;
    ctrl.stagger = 0.05;
    ctrl.batches = 2;
    ctrl.gap = 0.15;
    ctrl.flyTime = 0.25;
}

const flags = canvas.getComponent('FeatureFlags');
return {
    node: ctrl.node.name,
    existed: had,
    pool: ctrl.pool ? ctrl.pool.node.name : null,
    afterPlaced: ctrl.afterPlaced,
    startDelay: ctrl.startDelay,
    stagger: ctrl.stagger,
    batches: ctrl.batches,
    gap: ctrl.gap,
    flyTime: ctrl.flyTime,
    autoPlayFlag: flags ? flags.autoPlay : null,
    slots: cc.director.getScene().getChildByName('Canvas').getChildByPath('GameLayer/BrokenLayer').children.length,
};
