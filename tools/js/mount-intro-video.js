/**
 * 开场视频接线（配套 assets/scripts/ui/GameIntro.ts 与 assets/scripts/platform/EndVideo.ts）：
 *
 *   - 去掉旧流程残留的 `Canvas/IntroLayer/Caption` 与 `Canvas/UILayer/StartGuide`
 *   - 新建/复用 `Canvas/IntroLayer/开头视频`：全屏 `cc.VideoPlayer` + `EndVideo`
 *     （region = Canvas，铺满整屏）；节点默认睡着，`EndVideo.play()` 起播
 *   - 回填 `GameIntro.video` / `GameIntro.skip = false`（不再有 region / 卡片放大）
 *
 * 片源 uuid 不写死（重新导入会变），从 `.mp4.meta` 现读后经 args 传进来：
 *
 *   node tools/exec.mjs scene tools/js/mount-intro-video.js "{\"clip\":\"<uuid>\"}"
 *
 * 幂等：节点 / 组件 / 引用已存在就重复赋同样的值。
 */
const canvas = cc.director.getScene().getChildByName('Canvas');
const introNode = canvas.getChildByName('IntroLayer');
const cls = (name) => cc.js.getClassByName(name);
const load = (uuid) => new Promise((res, rej) =>
  cc.assetManager.loadAny(uuid, (e, a) => (e ? rej(new Error(uuid + ' -> ' + e.message)) : res(a))));

// ---------- 去掉标题与「点击屏幕开始」 ----------
const drop = (n) => { if (!n) return; n.removeFromParent(); n.destroy(); };
const caption = introNode.getChildByName('Caption');
drop(caption);
const ui = canvas.getChildByName('UILayer');
drop(ui.getChildByName('StartGuide'));

// ---------- 开头视频 ----------
const opts = args || {};
let node = introNode.getChildByName('开头视频');
if (!node) {
  node = new cc.Node('开头视频');
  node.setParent(introNode);
  const t = node.addComponent(cc.UITransform);
  t.setAnchorPoint(0.5, 0.5);
  t.setContentSize(720, 1280);
}
node.setSiblingIndex(introNode.children.length - 1);
node.setPosition(0, 0, 0);

let player = node.getComponent(cc.VideoPlayer);
if (!player) player = node.addComponent(cc.VideoPlayer);
player.playOnAwake = false;
player.mute = false;
player.loop = false;
player.keepAspectRatio = true;
player.stayOnBottom = false;
player.fullScreenOnAwake = false;
if (opts.clip) player.clip = await load(opts.clip);

let video = node.getComponent(cls('EndVideo'));
if (!video) video = node.addComponent(cls('EndVideo'));
video.player = player;
video.region = canvas;
video.fallbackTime = opts.fallbackTime != null ? opts.fallbackTime : 5;
video.fadeOut = opts.fadeOut != null ? opts.fadeOut : 0.3;

node.active = false;

// ---------- GameIntro 接线 ----------
const intro = introNode.getComponent(cls('GameIntro'));
intro.video = video;
intro.skip = false;

return {
  intro: {
    video: !!intro.video,
    skip: intro.skip,
  },
  video: {
    path: 'Canvas/IntroLayer/开头视频',
    active: node.active,
    clip: player.clip ? player.clip.name : null,
    playOnAwake: player.playOnAwake,
    mute: player.mute,
    keepAspectRatio: player.keepAspectRatio,
    stayOnBottom: player.stayOnBottom,
    region: video.region ? video.region.name : null,
    fallbackTime: video.fallbackTime,
    fadeOut: video.fadeOut,
    hasWidget: !!node.getComponent(cc.Widget),
  },
  layers: {
    introChildren: introNode.children.map((n) => n.name),
    uiChildren: ui.children.map((n) => n.name),
  },
};
