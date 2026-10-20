# 跳过开头视频

## 改了什么

- 场景：`Canvas/IntroLayer` 的 `GameIntro.video` 置空（`IntroLayer/开头视频` 节点保留、仍 `active = false`）。不新增/修改代码。
- `docs/STATUS.md`、`docs/VIDEO.md` 标注当前跳过状态与恢复方式。

## 为什么这么改

用户要求「开头不用播放视频了，把那条路先跳过」。

`GameIntro` 本身对空 `video` 有现成分支：点关仍把卡片 `Window/Fill` 放大到铺满，`startZoom()` 里 `!this.video` 直接令 `_playing = false`，放大完成 `trySwap()` 走 `finish()` —— 收起 `IntroLayer` 并照常抛 `GUIDE_RESUME` + `GAME_START`，BGM/常驻音起点不变。

否掉的方案：
- 直接停用 `IntroLayer`：会连 `GAME_START` 一起没有，`AudioManager` 的 BGM 与常驻音永远不起。
- 删掉 `开头视频` 节点：以后要恢复还得重建 `VideoPlayer`/`EndVideo`；留着不碍事。
- 给 `GameIntro` 加 `skipVideo` 开关：这次是场景数据选择，不是通用能力，没必要加字段。

## 怎么验的

- `npm run check`（`verify-scene.js` 只读）：`ok: true`，只剩原有的 `ProgressController.label` 为空、背景九宫格 inset 为 0 两条。
- 场景 diff 确认 `GameIntro.video` 由引用变为 `null`；同时编辑器保存时清掉了 4 个残留的旧 `LuggageDrop` 组件（上一轮已从槽位移除，只是当时没落盘），不影响接线。
- 未跑预览。

## 影响什么 + 还没验的部分

- 点关后不再有全屏视频，放大卡片铺满即进游戏；开场时长变短。
- `IntroLayer` 仍会拦截输入直到 `finish()`，和原来一致。
- 待验：真机/预览里点关到可操作的过渡是否顺、`GAME_START` 后 BGM 是否照常起。
提交：9df1641
