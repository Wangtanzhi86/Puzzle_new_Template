// 把 AppLovin 埋点组件挂到 Canvas，幂等：已经有就原样保留 —— 重复挂会多出一个实例，
// 事件被报两遍（内部那些一次性标记是各自实例的）。
const canvas = cc.director.getScene().getChildByName('Canvas');
const cls = cc.js.getClassByName('PlayableAnalytics');
if (!cls) return { ok: false, error: 'PlayableAnalytics 类没加载' };

const had = !!canvas.getComponent(cls);
if (!had) canvas.addComponent(cls);

// 报出运行期的实际取值，方便核对：里程碑分母走的到底是不是终局线、
// 当前容器有没有注入上报全局（编辑器里必然没有，这是预期的）
const cta = cc.director.getScene().getComponentInChildren(cc.js.getClassByName('EndgameCta'));
return {
    ok: true,
    existed: had,
    winCount: cta ? cta.winCount : null,
    alPresent: typeof globalThis.ALPlayableAnalytics !== 'undefined',
    components: canvas.components.map((c) => cc.js.getClassName(c)),
};
