// 把埋点组件挂到 Canvas，幂等（重复跑只再确认一次，不动任何值）。
// 组件没有可调参数：分母是运行期从 EndgameCta.winCount 现读的，不在这里配。
//
//   MCP_PORT=<端口> node tools/exec.mjs editor tools/js/refresh.js        # 先让编辑器认识新类
//   MCP_PORT=<端口> node tools/exec.mjs scene  tools/js/mount-analytics.js
//
// 组件在 Canvas 上即可 —— 它只听 EventBus，挂哪个节点都不影响功能，
// 挂 Canvas 是跟 FeatureFlags / AudioManager 那套一致（见 CLAUDE.md §15）。
const canvas = cc.director.getScene().getChildByName('Canvas');
const cls = cc.js.getClassByName('PlayableAnalytics');
if (!cls) return { ok: false, error: 'PlayableAnalytics 类没加载（先跑 refresh.js）' };

const had = !!canvas.getComponent(cls);
const c = had ? canvas.getComponent(cls) : canvas.addComponent(cls);
return {
    ok: true,
    existed: had,
    node: c.node.name,
    canvasOwn: canvas.components.map((x) => cc.js.getClassName(x)),
};
