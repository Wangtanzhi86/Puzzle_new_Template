# 结束界面卡片可点击跳商店 + 点击火光放大并压到卡片后面（2026-10-20）

## 改了什么

- [EndCarousel.ts](assets/scripts/ui/EndCarousel.ts)：
  - 新增 `bridge` / `tapSlop`(14px) / `tapToStore`；按下记起点，`TOUCH_MOVE` 里按 `max(|dx|,|dy|)` 判「是否已超过容差」，
    `TOUCH_END` 时位移仍 ≤ 容差才算**点击**（`TOUCH_CANCEL` 一律不算，走单独的 `onTouchCancel`）。
  - 点击 → `burst()` 炸一次 + `bridge.openStore()` + `EventBus.emit(GameEvent.CTA_CLICK)`（与 `StoreButton` 同口径）。
  - `layout()` 里卡片 `siblingIndex` 改为 `1 + …`：0 号位永久留给身后的粒子层。
- 场景 `End/Carousel/CenterBurst`：`setSiblingIndex(0)`（原来在卡片之上），粒子放大 ——
  `totalParticles 150 / emissionRate 1600 / life 0.7±0.35 / speed 520±320 / startSize 48±34 / posVar 60×80`，
  `CardBurst.emitTime 0.08 → 0.14`（喷射更久、铺得更开）。
- 生成器 [mount-end-carousel.js](tools/js/mount-end-carousel.js) 同步；接线/调整脚本 [mount-end-tap.js](tools/js/mount-end-tap.js)。

## 为什么这么改

拖动与点击在同一个节点上抢触摸，只能用位移区分：容差内=点击（跳转），超过=拖动（只吸附，不跳转）。
取 14px 是因为手指按下时的抖动通常在 10px 内，而横滑一张卡片要 ~53px（spacing 132 / 2.5），两者不会误判。
火光压到卡片后面：粒子在卡片上层会糊住人物脸，压到底层后只有**从卡片四周窜出来的那圈**可见 —— 观感是「从卡片背后炸开」。

## 怎么验的

- TS 诊断 `no errors`；`npm run check` `ok: true`。
- 场景回读：`burstIndex 0`、`component.bridge` 已指向 Canvas 上的 `MraidBridge`、`tapSlop 14 / tapToStore true`、粒子参数如上。
- 按约定没有跑预览。

## 影响什么 + 还没验的部分

- 点到卡片任意位置都会跳商店（不区分中间/两侧卡片）；拖动结束不再误触跳转。
- 后续调整（同日）：`angleVar 180 → 360`（2.x 语义是 `angle + angleVar/2·rand(-1,1)`，180 只覆盖上半圈），
  `speedVar 320→240`、`startSizeVar 34→24`、`posVar 60×80→32×44` 让喷射更聚集；
- 没验：① 火光在 240×400 卡片背后露出多少（不够就再抬 `speed` 或 `posVar`）；
  ② `tapSlop 14` 在你的设备上是否够钝（若拖动偶尔误跳，提到 20）；
  ③ 跳转后 MRAID 的 `CTA_CLICK` 埋点是否按预期只在真点击时发。