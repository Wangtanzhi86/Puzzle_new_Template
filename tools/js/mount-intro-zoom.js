/**
 * 进关开场接线：GameIntro 改成「把点中的那张集图放大铺满 → 无缝换开头视频」。
 *
 *   Canvas/IntroLayer            挂 GameIntro（select / video / region）
 *   ├── Left / Right             旧挡板，停用（留着对照）
 *   └── 开头视频                 节点上挂 EndVideo（region = Canvas，兜底 12s，结尾渐隐 0.5s）
 *
 *   node tools/exec.mjs scene tools/js/mount-intro-zoom.js
 */
const canvas = cc.director.getScene().getChildByName('Canvas');
const intro = canvas.getChildByName('IntroLayer');
const cls = (name) => cc.js.getClassByName(name);

const select = canvas.getChildByName('Change').getComponent(cls('LevelSelect'));
const videoNode = intro.getChildByName('开头视频');
const video = videoNode.getComponent(cls('EndVideo'));
const gi = intro.getComponent(cls('GameIntro'));
const blurUuid = '63c6f8bb-c836-4c26-8a43-84a4ac2b7cb9';
const blur = await new Promise((res) => cc.assetManager.loadAny(blurUuid, (e, a) => res(e ? null : a)));

intro.active = true;
gi.enabled = true;
gi.select = select;
gi.video = video;
gi.region = canvas;
if (gi.flyTime === undefined) gi.flyTime = 0.34;
if (gi.zoomTime === undefined) gi.zoomTime = 0.5;
if (gi.cornerRadius === undefined) gi.cornerRadius = 26;
if (gi.cornerFade === undefined) gi.cornerFade = 0.22;
if (gi.readyTimeout === undefined) gi.readyTimeout = 1.2;
gi.blurEffect = blur;
if (gi.ghostCount === undefined) gi.ghostCount = 4;
if (gi.ghostOpacity === undefined) gi.ghostOpacity = 0.35;
if (gi.ghostLag === undefined) gi.ghostLag = 16;
if (gi.blurMax === undefined) gi.blurMax = 0.12;

for (const n of ['Left', 'Right']) {
  const node = intro.getChildByName(n);
  if (node) node.active = false;
}

return {
  select: !!gi.select,
  video: !!gi.video,
  region: gi.region && gi.region.name,
  times: [gi.flyTime, gi.zoomTime, gi.cornerRadius, gi.cornerFade, gi.readyTimeout],
  blur: { effect: !!gi.blurEffect, ghosts: gi.ghostCount, opacity: gi.ghostOpacity, lag: gi.ghostLag, max: gi.blurMax },
  videoCfg: { region: video.region && video.region.name, fallback: video.fallbackTime, fadeOut: video.fadeOut },
};
