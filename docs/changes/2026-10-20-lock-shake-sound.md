# 点锁着的关卡配一声音效（2026-10-20）

## 改了什么

- [LevelSelect.ts](assets/scripts/ui/LevelSelect.ts)：新增公开回调 `onLockShake`（非 @property），`shakeLock()` 起晃那一刻调一次。
- [AudioManager.ts](assets/scripts/audio/AudioManager.ts)：
  - `AudioEvent` 加 `LOCK_SHAKE = 'LOCK_SHAKE'`（明确注释「不是 GameEvent」）。
  - 新属性 `select: LevelSelect`；`onEnable` 里 `this.select.onLockShake = this.onLockShake`，`onDisable` 置 null。
  - `build()` 里 `LOCK_SHAKE` 和 `LAST_SHOWN` / `CAROUSEL_SLIDE` 一样不注册 EventBus，由回调点名。
  - `onLockShake` 先 `this.unlock()` 再放 —— 这一下发生在选关，全局 `input` 那条「首次触摸」不保证收到（卡片自己接了触摸）。
- 音源用 [放置音.MP3](assets/recourses/audio/放置音.MP3)（uuid `6bd6acf9-f3f9-497a-8af1-9f399d99cc29`）。
- 场景：`AudioManager.select` → Canvas/Change 上的 `LevelSelect`；`cues` 第 7 条 `LOCK_SHAKE`（音量 0.8、不循环、无渐入渐出）。
- 接线脚本 [mount-lock-shake-sound.js](tools/js/mount-lock-shake-sound.js)。

## 为什么这么改

锁图标晃了但没声，那一下缺「点不动」的反馈；用现成的放置音先顶上，比再合成一条省事。
回调而不是新增 GameEvent：§5 规定业务代码不往事件总线里加新事件名，这类「组件自己点名」的音效一律走回调，
与 `BUTTON_DOWN` / `LAST_SHOWN` / `CAROUSEL_SLIDE` 同一个套路。

## 怎么验的

- TS 诊断 `no errors`。
- 场景回读：`AudioManager.select = {__id__:614}`；第 7 条 cue =
  `event LOCK_SHAKE / clip 6bd6acf9-…（放置音）/ volume 0.8 / loop false / stopEvent NONE`。
- 按约定没有跑预览、没有试听。

## 影响什么 + 还没验的部分

- 没验：① 放置音当锁晃动音是否合适（音色偏「放碎片」）；② 音量 0.8 是否过大；
  ③ 连点锁着的卡会连响（每次晃都放一遍）。想换音源只需改 `cues` 里那一条的 clip。