/**
 * 给 `Canvas/GameLayer/Scene_BG/地上脏水` 接线：
 *   - Sprite 改成 FILLED + VERTICAL + `fillStart = 1`（顶边起步，配合负的 `fillRange` 就是从
 *     上往下刷），尺寸模式钉成 CUSTOM
 *   - 场景里 `fillRange` 存 1：编辑模式不跑 onLoad，得看得见才好摆位；运行期 onLoad 归 0 = 默认隐藏
 *   - 节点上挂 `GroundWater`（听 `REPAIR_FAILED`，见 §14）
 *
 *   node tools/exec.mjs scene tools/js/mount-ground-water.js
 *
 * 幂等：组件已存在就复用，Sprite 属性重复赋同样的值。
 */
const node = cc.director.getScene().getChildByPath('Canvas/GameLayer/Scene_BG/地上脏水');
const sp = node.getComponent(cc.Sprite);
sp.type = cc.Sprite.Type.FILLED;
sp.fillType = cc.Sprite.FillType.VERTICAL;
sp.sizeMode = cc.Sprite.SizeMode.CUSTOM;
sp.fillStart = 1;
sp.fillRange = 1;

let gw = node.getComponent('GroundWater');
if (!gw) gw = node.addComponent('GroundWater');

return {
    node: node.name,
    active: node.active,
    size: [node.getComponent(cc.UITransform).width, node.getComponent(cc.UITransform).height],
    sprite: 'type=' + sp.type + ' fillType=' + sp.fillType + ' fillStart=' + sp.fillStart + ' fillRange=' + sp.fillRange + ' sizeMode=' + sp.sizeMode,
    frame: sp.spriteFrame ? sp.spriteFrame.name : null,
    comps: node.components.map((c) => c.constructor.name),
    delay: gw.delay,
    revealTime: gw.revealTime,
};
