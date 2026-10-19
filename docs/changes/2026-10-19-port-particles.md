# 2026-10-19 · 从 CopyPuzzle 移植粒子与炉火，并把三处编译错误修掉

## 改了什么

**新增三个组件**（`assets/scripts/effects/`）：

| 文件 | 对应 CopyPuzzle | 说明 |
| --- | --- | --- |
| `Particle2D.ts` | `effects/Particle2D.ts`（自写 Sprite 池 + cocos2d-x 逐帧积分） | 逻辑逐行一致（`_build/resetSystem/stopSystem/_spawn/update`、`rand11/clamp255`、`dt > 0.1` 钳制），**所有字段改成 @property**，中文 displayName |
| `FireAction.ts` | `effects/FireAction.ts`（炉火不是粒子，是两张 sprite 交叉淡入翻页） | `frames/minOpacity/fadeTime/changeInterval/spriteScale/spriteAnchor` 全在面板上；帧顺序照原版 **fire-4 / fire-3 / fire-2 / fire-1**（数组最后一个 fire-1 先出场） |
| `EventTrigger.ts` | 取代 `effects/EventCondition.ts` | 起停条件全部可配：`playOnLoad` / `startEvents`（全部到齐）/ `startDelay` / `stopEvents`（任一到达）/ `stopDelay` / `slotIndex`（-1 = 任意，填了就只认 `PIECE_REPAIRED` 的第一个参数） |

**素材**：雪 / 烟 / 柔光 / 火星 / 火焰四帧复制到 `assets/recourses/particles/`（snow、smoke-puff、shine、spark、fire-1…4），加色用的 `SpriteAdd.effect` 复制到 `assets/effects/`。

**场景接线**（`tools/js/apply-copy-particles.js`，幂等，已跑并存盘）：`Canvas` 下新建 `FxLayer`（插在 `GameLayer` 之后），挂五个节点：

| 节点 | 组件 | 位置（画布中心为原点） | 起停（默认值，面板可改） |
| --- | --- | --- | --- |
| `FxSnow` | Particle2D（雪 + 加色） | (110, 430) | 进场就播；`LEVEL_COMPLETE` +0.5s 停 |
| `FxSmoke` | Particle2D（烟，普通 alpha） | (305, -60) | `PIECE_REPAIRED` +1.9s 起 |
| `FxFireShine` | Particle2D（柔光 + 加色） | (305, -230) | `PIECE_REPAIRED` +1.8s 起 |
| `FxFireSparks` | Particle2D（火星 + 加色） | (305, -300) | `PIECE_REPAIRED` +1.8s 起 |
| `FxFire` | FireAction（四帧翻页） | (305, -255) | `PIECE_REPAIRED` +1.8s 起 |

**顺带修掉三处编译错误**（`run_script_diagnostics` 从 3 条到 0 条）：

1. `gameplay/DragController.ts:183` —— `this.pool.insertOnFail(entry)` 把**布尔字段**当方法调（TS2349）。
   `PiecePool` 里从来没有 `insertNearest`，也就是「失败插入 / 推开邻居」**只有开关没有实现**。
   这次补上了 `PiecePool.insertNearest(entry)`：按碎片**当前**的横向位置找插入下标（数 `content` 里横坐标更靠左的子节点）
   → 把它的 `spacer` 挪到那个下标 → `updateLayout(true)` + `centerLayoutContent` → 其余碎片照旧世界位用 `insertTime`
   （0.14s）滑过去，同时自己落到新位置再 `settle`。
2. `ui/ScreenAdapter.ts:32` —— `applyResolution(design, policy: ResolutionPolicy)` 收 `ResolutionPolicy`，
   而引擎 `ResolutionPolicy.FIXED_HEIGHT` 的类型就是 `number`（TS2345）。`core/UISpace.ts` 的参数类型改成 `number`。
3. `platform/EndVideo.ts` —— `private start = (): void => {}` 与 `Component.start` 撞名（TS2415），改名 `begin`。

**文档**：`docs/TUNING.md` §16 末尾加 6 行（飘雪 / 烟雾 / 柔光火星 / 炉火 / 起停条件 / 位置与层级）。

## 为什么这么改（含否掉的方案）

- **为什么不用 `EventCondition`**：它把条件写死在代码里（`events` 数组在装配点填）。这次的要求是「起停条件也在
  Inspector 里改」，所以换成 `EventTrigger` —— 事件名是 `GameEvent` 的字符串值，脚本里只负责传参。没有搬 `EventCondition` 本身。
- **为什么事件不是原版的数字 131–137**：原版走 `completeEvent` 数字号，本工程走字符串 `GameEvent`。搬运时映射成
  `PIECE_REPAIRED` / `LEVEL_COMPLETE`；**没有**为了对齐原版去造一套数字事件——那会和现有 `RepairSystem` 打架。
- **坐标是估的**：原版火在**左**（壁炉在左）、窗在**右**；新工程背景正好相反（壁炉在右、窗在右），所以火/烟/柔光/火星的 x
  全部镜像到正侧。数值本身照抄原版再乘 1.739（414→720 的宽度比）。**这些位置是占位值，本来就是留给人手调的。**
- **容器为什么夹在 GameLayer 与 PiecePoolLayer 之间**：要「火苗被壁炉边缘挡一半」同时「雪盖住拼图」，但又不能让雪盖住
  HUD 或拖拽中的碎片。放 `UILayer` 太上层、放背景层则火会整块被壁炉图挡掉。
- **否掉：直接用 `cc.ParticleSystem2D`**。工程里那块「魔法仙尘」用的就是它，但它的混合模式、位置模式都不在 Inspector 上
  （`SceneBgSwap.glow()` 运行期改材质），和这次「所有参数都能在面板上改」冲突；而且原版的发射/积分语义是 2.x 的。
- **否掉：把粒子参数做成一个配置资源（JSON/asset）**。那样改参数得改数据文件，不是用户要的「属性检查器里改」。

## 怎么验的

- `node tools/mcp.mjs run_script_diagnostics` → **0 条**（`exitCode: 0`）。
- `node tools/exec.mjs scene tools/js/apply-copy-particles.js` → 返回 `FxLayer` 在 `siblingIndex: 3`、五个子节点齐全、
  贴图与 `SpriteAdd` 都加载到了，随后**自动存盘**（`bdd769ed-06ed-4ddc-86e0-54318ac1aeba`）。
- 读回 `assets/scene.scene` 核对：`FxSnow` 的 `Particle2D` 序列化值（`stopEvents:["LEVEL_COMPLETE"]`、`totalParticles:250`、
  `life:1.5`、`angle:250`、`endColor.a:0` …）、`FxFire` 的 `frames` 是 4 帧且顺序 fire-4→fire-1、
  `additiveEffect` 指向 `8c682025-…`（SpriteAdd）、三个加色粒子的 `additive:true`。

## 影响什么 + 还没验的部分

- 影响：每次进游戏多 5 个粒子发射器（250 + 400 + 15 + 500 粒子上限）与一个双 sprite 翻页动画；都在 `FxLayer` 一个节点下，
  同贴图同材质会自动合批，但**没测 draw call**。
- **没验**：预览 / 截图 / 真机一个都没跑（用户偏好：实现类改完自己验）。所以「雪落下来好不好看、火苗在不在壁炉口里、
  烟会不会糊住壁炉」全都还只是坐标上算出来的。**调位置/大小/速度就在 Inspector 里改 `FxLayer` 的五个节点与它们的组件**，
  改坏了重跑一次 `apply-copy-particles.js` 会写回默认值。
- 雪现在**整关完成**才停（原版是「窗修好就停」）。要做到原版那样：把 `FxSnow.stopEvents` 改成 `PIECE_REPAIRED`、
  `slotIndex` 填窗那一格的序号（需要先确认关卡里窗是哪个 slot）。
