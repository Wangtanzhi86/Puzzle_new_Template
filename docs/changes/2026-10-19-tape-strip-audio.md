# 贴胶带时每一条胶带播放一次撕胶带音效

- 日期：2026-10-19
- 提交：<待回填>
- 关联：AGENTS.md §5 / §15 / docs/worklog/07-音频.md

## 改了什么

- `core/GameEvent.ts` 新增 `TAPE_STRIP`。
- `audio/AudioManager.ts` 的 `AudioEvent` 同步新增 `TAPE_STRIP`（下拉框可选）。
- `gameplay/TapeWipe.ts` 在每条胶带真正开始擦出的那一瞬抛 `GameEvent.TAPE_STRIP`；胶带根节点下有几条子节点就抛几次，当前 3 条。
- 场景 `Canvas/AudioManager.cues` 追加一条 `TAPE_STRIP / 撕胶带.mp3 / 音量 1 / 无渐入渐出`。
- 新增幂等接线脚本 `tools/js/mount-tape-audio.js`，只认 `TAPE_STRIP` 这一条，其余音频配置不碰。

## 为什么这么改

- 现有事件里没有「每条胶带开始擦出」这个时机：`PIECE_SHOWN` 是整格演完才抛一次，`PIECE_SNAP_SUCCESS` 是吸附那一刻，都不对。
- 没有把 `AudioSource` 直接挂到胶带子节点上：那样会绕过 `AudioManager` 的首次交互解锁、MRAID 静音、结束停全部与总音量，和项目现有音频规范冲突。
- 撕胶带音频实测时长 **0.522417 秒**，胶带每条间隔 `wipeTime 0.5 + gap 0.08 = 0.58 秒`，所以单条 `AudioSource` 重新起播时上一声刚好放完，不会互相截断。若以后换成更长的音频，后一条会把前一条截掉，需要另配多声道或缩短间隔。

## 怎么验的

- `node tools/mcp.mjs run_script_diagnostics '{}'`：TypeScript 0 错误。
- `node tools/exec.mjs scene tools/js/mount-tape-audio.js`：输出新 cue `TAPE_STRIP | 撕胶带 | 1 | 渐入渐出 0s→0s`，其余 4 条原样保留。
- `node tools/exec.mjs editor tools/js/save.js`：场景存盘 `bdd769ed-06ed-4ddc-86e0-54318ac1aeba`。
- 解析 `assets/scene.scene`：AudioCue 第 277 条 `event=TAPE_STRIP`、`clip=b2b578ae-d3e4-46f8-ba38-61c249ac4382`。
- `npm run check`：通过，missing 与改动前一致（无新增告警）。

## 影响什么 / 还没验的部分

- 只影响 `Slot_03` 的胶带揭晓；其他槽位没有 `TapeWipe`，不会抛这个事件。
- 编辑器里听不到真实声音（web 音频播放器在非预览态不播），**实际听感 / 三连音是否叠得自然需要在 Game View 或真机确认**。
- 自动打关如果替玩家放掉 `Slot_03`，胶带动画照演，音效也会照响；如果希望接管期间静音，把 `TAPE_STRIP` 加进 `AudioManager.AUTO_SILENT` 即可。
- 换更长音频时的截断问题见上。
