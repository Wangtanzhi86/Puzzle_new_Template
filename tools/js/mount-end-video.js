/**
 * 结尾视频接线，配套 `assets/scripts/platform/EndVideo.ts`：
 *   - `Canvas/GameLayer/Scene_BG/结尾视频` 节点：**不给 Widget**（引擎在 `META_LOADED` 那一下会把节点
 *     尺寸改成片源原始像素，Widget 会跟它抢）；尺寸 / 位置只是 `META_LOADED` 之前的占位，
 *     真正的摆位与缩放由 `EndVideo.fit()` 按「播放区域」现算
 *   - 节点挂 `cc.VideoPlayer`（clip / mute / 不自动播 / 等比）与 `EndVideo`（`player` / `region` 口）
 *   - `region` 指 `Canvas/GameLayer/Scene_BG`：视频等比铺满拼图区、溢出的裁掉
 *   - 回填 `CtaController.endVideo`（挂在 `Canvas/UILayer/CtaLayer` 上）
 *   - 节点默认 `active = false`：引擎的 `onDisable` 才把 video 元素设成 `visibility: hidden`，
 *     **不演就必须让节点睡着**，否则那块地方的触摸永远到不了画布
 *
 * 片源的 uuid **不写死**（重新导入会变），由调用方从 `.meta` 现读后经 args 传进来：
 *
 *   node tools/exec.mjs scene tools/js/mount-end-video.js "{\"clip\":\"<uuid>\"}"
 *
 * 不传 args 就只接节点 / 组件 / 引用，`clip` 保持原样（那样点了没反应，`play()` 拿不到片源）。
 *
 * 幂等：节点 / 组件 / 引用已存在就重复赋同样的值。
 */
const canvas = cc.director.getScene().getChildByName('Canvas');
const sceneBg = canvas.getChildByPath('GameLayer/Scene_BG');

const load = (uuid) => new Promise((res, rej) =>
  cc.assetManager.loadAny(uuid, (e, a) => (e ? rej(new Error(uuid + ' -> ' + e.message)) : res(a))));

let node = sceneBg.getChildByName('结尾视频');
const created = !node;
if (!node) {
  node = new cc.Node('结尾视频');
  node.setParent(sceneBg);
  const t = node.addComponent(cc.UITransform);
  t.setAnchorPoint(0.5, 0.5);
  t.setContentSize(720, 1280);
}
node.setPosition(0, 0, 0);

let player = node.getComponent(cc.VideoPlayer);
if (!player) player = node.addComponent(cc.VideoPlayer);
player.playOnAwake = false;
// 要听到视频自己的声音（结尾视频有音轨）。被浏览器拦时 `EndVideo.start()` 会自己退成静音，
// 所以这儿开着不冒险 —— 见 AGENTS.md §18
player.mute = false;
player.loop = false;
player.keepAspectRatio = true;
player.stayOnBottom = false;
player.fullScreenOnAwake = false;
if (args.clip) player.clip = await load(args.clip);

let video = node.getComponent('EndVideo');
if (!video) video = node.addComponent('EndVideo');
video.player = player;
video.region = sceneBg;

const cta = canvas.getChildByPath('UILayer/CtaLayer').getComponent('CtaController');
cta.endVideo = video;

node.active = false;

const ut = node.getComponent(cc.UITransform);
return {
  created,
  node: { path: 'Canvas/GameLayer/Scene_BG/结尾视频', active: node.active, size: [ut.width, ut.height], pos: [node.position.x, node.position.y], anchor: [ut.anchorX, ut.anchorY], hasWidget: !!node.getComponent(cc.Widget) },
  player: {
    clip: player.clip ? player.clip.name : null,
    playOnAwake: player.playOnAwake,
    mute: player.mute,
    loop: player.loop,
    keepAspectRatio: player.keepAspectRatio,
    stayOnBottom: player.stayOnBottom,
    fullScreenOnAwake: player.fullScreenOnAwake,
  },
  endVideo: { player: !!video.player, region: video.region ? video.region.name : null, fallbackTime: video.fallbackTime },
  cta: { endVideo: !!cta.endVideo, ctaRoot: cta.ctaRoot ? cta.ctaRoot.name : null },
  sceneBgChildren: sceneBg.children.map((n) => n.name + (n.active ? '' : '(睡)')),
};
