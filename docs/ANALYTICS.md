# 试玩埋点接入说明（AppLovin Playable Analytics）

> **本文分两半，先看该读哪一半：**
> - **§1–§6 是可移植的接入规范** —— 换到任何试玩项目原样可用，不引用本项目的任何文件。
> - **§7 是本项目的接线实例** —— 照它的**形状**做，**不要**照抄里面的事件名（那些是本项目的 `GameEvent`，别的项目没有）。
>
> **如果你是「从别的项目拿到这份文档」的 AI**：读 §1–§6 就能完成接入，§7 当成一个完整实例对照。
> **如果你在维护本项目**：查「某个上报点在哪一行」直接跳 §7。
>
> 本文内部的「§N」指本文自己；写 `CLAUDE.md §N` 的才指那份规范文件。

---

# 第一部分 · 接入规范（可移植）

## 1. 这是什么

AppLovin 对**沉浸式试玩广告**要求内部主动上报几个关键节点，用来算「有多少人真的开始玩了、卡在第几格、有多少人转化」。不接的话广告照常跑，但后台没有这一层数据，投放优化只能看到曝光和点击。

官方文档（**唯一权威来源**，本文是它的落地版）：

<https://support.applovin.com/en/growth/promoting-your-apps/welcome-to-applovin/playable-analytics-integration>
→ **HTML analytics integration** 章节

### 三条铁律

1. **只用预定义事件名**。官方明说自定义事件**不会被追踪**，报上去等于没报。全表见 §2，拼写逐字照抄。
2. **必须包存在性守卫**，且**不能自己定义** `ALPlayableAnalytics`：

   ```js
   if (typeof window.ALPlayableAnalytics !== 'undefined') {
       window.ALPlayableAnalytics.trackEvent('CHALLENGE_STARTED');
   }
   ```

   这个全局**由投放容器注入**。本地浏览器、编辑器、非 AppLovin 平台的产物里都没有它 ——
   守卫就是「这些环境下静默跳过」的机制，不是防御性判空。

3. **有条件的事件必须配对**：用了 `LOADING` 就必须用 `LOADED`；用了 `CHALLENGE_STARTED` 就必须至少用
   `CHALLENGE_SOLVED`、`CHALLENGE_FAILED` 之一。**这是交审硬伤**，不是可选优化。

### 什么时候不用接

官方列了两条豁免：**交互点少于 3 个**的、**5 秒内就跳转**的纯展示型 HTML。有胜负、有进度的玩法不豁免。

## 2. 官方事件全表

| 事件名 | 要求 | 什么时候发 | 报表里能看出什么 |
|---|---|---|---|
| `DISPLAYED` | **必报** | 画面出来、玩家现在可以操作了 | 所有流失率的分母 |
| `LOADING` | 可选 | 开始加载 | 只在**真有 loading 屏**时用 |
| `LOADED` | 条件（用了 `LOADING` 就必须用） | 加载完成、可以显示 | 「卡在加载」的人 |
| `CHALLENGE_STARTED` | 可选 | 玩家第一次**真的动手** | 与 `DISPLAYED` 的差 = 看了没动手的人 |
| `CHALLENGE_PASS_25` | 条件 | 进度到 25% | 见 §4 第 1 条：分母不是总量 |
| `CHALLENGE_PASS_50` | 条件 | 进度到 50% | 三档之间的流失 = 难度曲线 |
| `CHALLENGE_PASS_75` | 条件 | 进度到 75% | 同上 |
| `CHALLENGE_SOLVED` | 条件 | 达成通关条件那一刻 | 转化主力。**与 `CHALLENGE_STARTED` 配对的必须项之一** |
| `CHALLENGE_FAILED` | 条件 | 失败判定成立那一刻 | 另一条配对必须项 |
| `CHALLENGE_RETRY` | 条件（**只能用在实现了 `CHALLENGE_FAILED` 之后**） | 从失败恢复到可玩 | 重试率 |
| `ENDCARD_SHOWN` | 可选 | 结算 / 结束界面**在广告内部**亮起 | 看到 endcard 的人 |
| `CTA_CLICKED` | 可选 | 玩家点了下载入口 | 点击率。自动跳转算不算要显式决策，见 §4 第 3 条 |
| `COMPLETED` | **已废弃** | 别用 | 用 `CHALLENGE_SOLVED` 代替 |

「条件」= 你用了 `CHALLENGE_STARTED` 才需要它；而**一旦用了 `CHALLENGE_STARTED`，`SOLVED` / `FAILED` 至少得有一个**。

**官方给的顺序**：

```
LOADING → LOADED → DISPLAYED → CHALLENGE_STARTED → PASS_25 / PASS_50 / PASS_75
        → CHALLENGE_SOLVED → ENDCARD_SHOWN → CTA_CLICKED
```

（`CTA_CLICKED` 也可能发生在 `ENDCARD_SHOWN` 之前。）

**每个事件一局只报一次**，重复调用没有意义、还会污染报表。§3 的实现在本地也兜了一道。

## 3. 参考实现

零依赖，纯 JS 语法即可（TS 项目直接用）。一个文件，抄进去就能跑。

```ts
// playable-analytics.ts —— 零依赖，任何项目可直接抄

export const PA = {
    DISPLAYED: 'DISPLAYED',
    LOADING: 'LOADING',
    LOADED: 'LOADED',
    CHALLENGE_STARTED: 'CHALLENGE_STARTED',
    CHALLENGE_PASS_25: 'CHALLENGE_PASS_25',
    CHALLENGE_PASS_50: 'CHALLENGE_PASS_50',
    CHALLENGE_PASS_75: 'CHALLENGE_PASS_75',
    CHALLENGE_SOLVED: 'CHALLENGE_SOLVED',
    CHALLENGE_FAILED: 'CHALLENGE_FAILED',
    CHALLENGE_RETRY: 'CHALLENGE_RETRY',
    ENDCARD_SHOWN: 'ENDCARD_SHOWN',
    CTA_CLICKED: 'CTA_CLICKED',
} as const;

export type PaEvent = typeof PA[keyof typeof PA];

const fired = new Set<string>();

const DEBUG = typeof location !== 'undefined' && location.hash.indexOf('debug') >= 0;

/** 唯一的出口。所有上报都走它 —— 守卫、去重、调试日志都只在这一处 */
export function track(name: PaEvent): void {
    const a = (window as any).ALPlayableAnalytics;
    if (typeof a === 'undefined') return;   // 官方要求的守卫：容器没注入就整体静默跳过
    if (fired.has(name)) return;            // 一局只报一次
    fired.add(name);
    if (DEBUG) console.log('[Analytics] ' + name);
    a.trackEvent(name);
}

const MARKS = [0.25, 0.5, 0.75];
const MARK_EVENTS: PaEvent[] = [PA.CHALLENGE_PASS_25, PA.CHALLENGE_PASS_50, PA.CHALLENGE_PASS_75];
const passed = [false, false, false];

/**
 * 进度里程碑。**一次把它们三个都算完** —— 进度一次跨过好几格时不会漏报。
 * `goal` 传的是「结算门槛」不是「总量」，理由见 §4 第 1 条。
 */
export function trackProgress(done: number, goal: number): void {
    if (goal <= 0) return;
    const ratio = done / goal;
    for (let i = 0; i < MARKS.length; i++) {
        if (passed[i] || ratio < MARKS[i]) continue;
        passed[i] = true;
        track(MARK_EVENTS[i]);
    }
}

/** 重开一局时调。单局试玩（没有重开路径）不需要 */
export function resetAnalytics(): void {
    fired.clear();
    passed.fill(false);
}
```

**怎么接进你的项目 —— 两种形状，都能过审：**

| 形状 | 怎么做 | 适合 |
|---|---|---|
| **A. 直接调** | 在「第一次动手」「进度更新」「跳转之前」那几行直接写 `track(PA.CHALLENGE_STARTED)` | 小项目、触发点少。最少的代码、最直白 |
| **B. 集中成一个监听组件** | 玩法各模块照旧只抛既有事件，埋点组件单独监听这些事件再 `track()` | 触发点多、想让埋点与玩法解耦（本项目用的就是这种，见 §7） |

**关键不是形状，是时机** —— 见 §4。形状 B 有个附带好处：业务代码一行不改，加新的上报点也不用回头动发射方；
但它要求项目本身有事件总线，**没有的话别为了埋点现造一个**，用形状 A。

**不要自己定义 `window.ALPlayableAnalytics`**。想自测就临时塞个假的，见 §6。

## 4. 通用映射规则

拿到一个新项目，按这张表找落点：

| 官方事件 | 在你的项目里找哪个时刻 | 判定问句 |
|---|---|---|
| `DISPLAYED` | 首屏就绪 | **哪一行执行完之后，玩家的第一次点击会被响应？** 通常是「关卡 / 场景构建完成」或「首屏入场动画播完」。别早于它（画面还没出来不算显示），也别晚到玩家已经动手之后 |
| `CHALLENGE_STARTED` | 第一次有效输入 | 哪一行代表「玩家第一次真的动手」？要把误触 / 无效点击排除掉 |
| `PASS_25/50/75` | 进度更新的那一行 | 分母不是总量 —— 见第 1 条 |
| `CHALLENGE_SOLVED` | 通关判定成立那一 tick | **跳转之前** —— 见第 2 条 |
| `CHALLENGE_FAILED` | 失败判定成立那一 tick | 没有失败态就别接 |
| `CHALLENGE_RETRY` | 从失败恢复到可玩那一 tick | 只能用在接了 `CHALLENGE_FAILED` 之后 |
| `ENDCARD_SHOWN` | 结算页在**广告内部**亮起 | 注意：直接跳商店**不算** endcard。没有结算页就别接 |
| `CTA_CLICKED` | 跳商店的**唯一出口** | 自动跳转要不要算 —— 见第 3 条 |

### 1. `PASS_*` 的分母是「结算门槛」，不是「总量」

如果玩法会在没玩完的时候就结算（比如「修满 4 格就自动跳商店」，而总共 6 格），
**分母必须取那个结算门槛（4），不是总量（6）**。

按总量算的话，玩家在第 4 格就被跳走了，75% 那档和 `CHALLENGE_SOLVED` **永远不会出现** ——
这直接违反 §1 铁律 3 的配对要求，报表上还会显示成「所有人都卡死在 50%」。

本条针对的是一大类玩法：**提前结算、按比例通关、限时结束**都适用。

### 2. 上报排在跳转前面

跳转和上报写在同一个回调里时，**先 `track()`、后跳转**。

原因：这类回调链（事件总线的 `emit`、SDK 的回调）**不保证兜异常** —— 任何一环抛一下，
写在它后面那句就永远不执行。上报在前，最坏情况是跳转丢了；跳转在前，最坏情况是数据丢了
（还会顺带漏掉 `CTA_CLICKED`）。

### 3. 自动跳转要不要算 `CTA_CLICKED`，必须显式决定

很多试玩会在通关 / 失败时**无用户交互地自动跳商店**。按「点 CTA 的出口」这个定义，
这一跳和玩家手点走的是同一个出口，所以报 `CTA_CLICKED` 是自洽的。

- **报**：报表上「点击率」会偏高（自动跳的也被算进去）。
- **不报**：主力路径（大多数人是被自动跳走的）在点击那一列上会是 **0**，更难解释。

**两种都有先例，但必须是有意选的**，别让它是「顺手写出来的」。本项目选的是「报」，理由见 §7.5。

### 4. 上报点要挂在「必然发生且最多发生一次」的位置

别挂在每帧 / 每次输入上 —— 那要靠调用方自己保证次数。选「状态迁移的那一 tick」最稳。

## 5. 落地检查清单

交给别人之前逐条对一遍：

- [ ] 事件名**逐字**对照 §2，拼写没错（大小写、下划线都要对）
- [ ] 每一次调用都包在**存在性守卫**里
- [ ] 只用**预定义**事件名，没有任何自定义事件
- [ ] 用了 `CHALLENGE_STARTED` → 至少配了 `CHALLENGE_SOLVED` 或 `CHALLENGE_FAILED`
- [ ] 用了 `LOADING` → 配了 `LOADED`；**没有 loading 屏就没接这两个**
- [ ] 每个事件一局最多发一次
- [ ] `PASS_*` 的分母是**结算门槛**，不是总量
- [ ] 上报排在跳转**前面**
- [ ] 自动跳转算不算 `CTA_CLICKED` 是**有意决定的**
- [ ] 本地 / 编辑器 / 非 AppLovin 平台下**静默跳过、不报错**

## 6. 自测

1. 打开产物，地址后加 `#debug`（见 §3 的 `DEBUG`）。
2. 控制台里手动塞一个假的记录器，再玩一局：

   ```js
   window.ALPlayableAnalytics = { calls: [], trackEvent(n) { this.calls.push(n); } };
   ```

3. 玩完看 `ALPlayableAnalytics.calls`，顺序应该符合 §2 给的官方顺序。
   本项目的期望序列见 §7.1。
4. **不塞假全局**时，控制台一行 `[Analytics]` 都不该有 —— 那就是守卫在起作用。
5. **真机验证只能靠 AppLovin 后台的试玩报表**，本地没有办法模拟容器注入。

---

# 第二部分 · 本项目接线（实例）

> 以下全部是「拼图修复 · 试玩广告」这一个项目的具体落点。换项目时**照形状、不要照抄名字**。

## 7.1 代码落点与挂载

| 文件 | 作用 |
|---|---|
| [assets/scripts/platform/PlayableAnalytics.ts](../assets/scripts/platform/PlayableAnalytics.ts) | 埋点组件，挂在 `Canvas` 上，**只听 `EventBus`**（§3 的形状 B） |
| [tools/js/mount-analytics.js](../tools/js/mount-analytics.js) | 接线脚本（幂等） |

**发射方一行没改。** 所有触发点都是项目里早就存在的 `GameEvent`（CLAUDE.md §5 事件清单），
组件只是多了一个监听者 —— 符合「模块间只通过 EventBus 通信」和「事件与发射方一律不动」两条约定。

挂载（MCP 端口每轮可能变，当前值见 CLAUDE.md 现状速查）：

```bash
MCP_PORT=<端口> node tools/exec.mjs editor tools/js/refresh.js          # 先让编辑器认识新类
MCP_PORT=<端口> node tools/exec.mjs scene  tools/js/mount-analytics.js  # 挂在 Canvas 上，幂等
```

本地自测的期望序列（对应 §6）：

```
DISPLAYED → CHALLENGE_STARTED → CHALLENGE_PASS_25 → CHALLENGE_PASS_50
          → CHALLENGE_PASS_75 → CHALLENGE_SOLVED → CTA_CLICKED
```

（`ENDCARD_SHOWN` 按 §7.4 不会出现。）

## 7.2 事件映射（本项目的落点）

| AppLovin 事件 | 由哪个 `GameEvent` 触发 | 在哪一行抛 | 报表里什么意思 |
|---|---|---|---|
| `DISPLAYED` | `LEVEL_BUILT` | [LevelFactory.ts:48](../assets/scripts/level/LevelFactory.ts#L48) | 关卡建好、碎片池即将填充 = 玩家**可以开始操作了**。这里就是本广告的「起跑线」 |
| `CHALLENGE_STARTED` | `PIECE_PICK` | [DragController.ts:72](../assets/scripts/gameplay/DragController.ts#L72) | 第一次真的拿起一块碎片。**与 `DISPLAYED` 的差** = 有多少人看了但没动手 |
| `CHALLENGE_PASS_25` | `REPAIR_PROGRESS` | [RepairSystem.ts:41](../assets/scripts/gameplay/RepairSystem.ts#L41) | 修到第一档，见 §7.3 的基准算法 |
| `CHALLENGE_PASS_50` | `REPAIR_PROGRESS` | 同上 | 修到中段 |
| `CHALLENGE_PASS_75` | `REPAIR_PROGRESS` | 同上 | 修到后段。**三档的流失率**就是关卡难度曲线 |
| `CHALLENGE_SOLVED` | `GAME_OVER` | [EndgameCta.ts:95](../assets/scripts/platform/EndgameCta.ts#L95) | 达成终局条件，跳商店**之前**那一 tick |
| `CHALLENGE_FAILED` | `REPAIR_FAILED` | [PieceSlot.ts:200](../assets/scripts/level/PieceSlot.ts#L200) | 修错。**当前场景走不到**，见 §7.4 |
| `ENDCARD_SHOWN` | `CTA_SHOW` | [CtaController.ts:73](../assets/scripts/platform/CtaController.ts#L73) | 结束界面在广告内部亮起来。**当前场景走不到**，见 §7.4 |
| `CTA_CLICKED` | `CTA_CLICK` | [EndgameCta.ts:109](../assets/scripts/platform/EndgameCta.ts#L109) / [CtaController.ts:122](../assets/scripts/platform/CtaController.ts#L122) / [GameCta.ts:65](../assets/scripts/platform/GameCta.ts#L65) | 玩家点了下载。**自动跳转也算**（见 §7.5） |

每个事件**只报一次**（组件内部一次性标记）；`PASS_25/50/75` 三条各自独立只报一次。
重开一局要重新计 —— 本广告是单局试玩，没有重开路径。

不接的事件和原因：

| 事件 | 为什么不接 |
|---|---|
| `LOADING` / `LOADED` | 本项目**没有 loading 屏**：单文件内联，引擎起来就是画面。官方明确说这种情况「Skip LOADING and LOADED and start with DISPLAYED」——所以起手就是 `DISPLAYED` |
| `CHALLENGE_RETRY` | 玩法**没有「重试」这个概念**（无失败态、无扣命、无倒计时）。官方规定它只能用在实现了 `CHALLENGE_FAILED` 之后 |
| `COMPLETED` | 官方已标注废弃，用 `CHALLENGE_SOLVED` 代替 |

## 7.3 里程碑的基准：分母是终局线，不是槽位总数

这是 §4 第 1 条在本项目的实例。

`CHALLENGE_PASS_25/50/75` 的 `done / 分母` 里那个分母**取 `EndgameCta.winCount`**（现在是 **4**），
不是槽位总数（6）。`winCount = 0`（不按数量跳、退回「全部修完出结束界面」那条老路）时才退回用
`REPAIR_PROGRESS` 给的槽位总数。

**为什么必须这样**：`winCount < 槽位数` 时玩家修到第 4 格就被自动跳走了，按 6 算的话后两档和
`CHALLENGE_SOLVED` 永远不会出现 —— 那违反官方「用了 `CHALLENGE_STARTED` 就必须至少用
`CHALLENGE_SOLVED` / `CHALLENGE_FAILED` 之一」的配对要求，报表上也会显示成「所有人都卡死」。

`winCount` 是**运行期从场景里读的**（`director.getScene().getComponentInChildren(EndgameCta)`，
和 `FeatureFlags.panel` 同一套路），读一次缓存。**不在 Inspector 上重复配一份** ——
那种「两处数值不同步」的坑 CLAUDE.md §16 记过一次。

当前配置下的实际触发点：

| `winCount` | 分母 | 25% | 50% | 75% | SOLVED |
|---|---|---|---|---|---|
| **4**（现状） | 4 | 第 1 格 | 第 2 格 | 第 3 格 | 第 4 格 |
| 0（不按数量跳） | 槽位数 6 | 第 2 格 | 第 3 格 | 第 5 格 | 修满全部 |

一次跨过好几格也不会漏报：三个阈值是一次算完的（过了哪几档就按序补发哪几档）。

## 7.4 当前场景走不到的两条

- **`CHALLENGE_FAILED`**：只有配了「达标后的修复图（`altView`）」的槽位才会抛 `REPAIR_FAILED`
  （且它的「前置槽位（`requires`）」没修齐）。当前 6 个槽位这两项**全空**，所以永远不会抛 ——
  埋点这侧接了，是为了配置一改就自动生效，不用再回来动代码。
- **`ENDCARD_SHOWN`**：`CTA_SHOW` 由 `CtaController` 抛，而 `CtaController` 只在「全部修完」那条路上
  被 `END_SHOW` 叫醒。`winCount = 4 < 6`，玩家在第 4 格就被 `EndgameCta` 跳走了，`END_SHOW` 到不了。

这两条**不影响合规**：官方要求的是「用了 `CHALLENGE_STARTED` 就必须有 `SOLVED` 或 `FAILED` 之一」，
`CHALLENGE_SOLVED` 是走得到的。

## 7.5 自动跳转也报 `CTA_CLICKED`

这是 §4 第 3 条在本项目的决策。

成功那条（修满 `winCount`）和失败那条都是**无用户交互自动跳商店**（`mraid.open()` 自己弹）。
这一跳照样报 `CTA_CLICKED`，因为它和玩家手点走的是**同一个** `openStore()` 出口、抛的是同一个 `CTA_CLICK`。

这样报表上「点击率」会把自动跳转算进去，看着偏高。**这是有意的**（接入时确认过）：
换成不报的话，主力路径（多数人是被自动跳走的）在点击那一列上会是 0，反而更难解释。

> ⚠️ 自动跳转本身是不是 AppLovin 的合规项，和埋点无关，是独立的一条 —— 见 CLAUDE.md 现状速查里的风险项。

## 7.6 各环境下的行为

| 环境 | 行为 |
|---|---|
| AppLovin 容器 | 正常上报 |
| 本地浏览器直接开产物（`#debug`） | 没有该全局，`typeof` 守卫直接 return，**静默无操作** |
| 编辑器 Game View | 同上，静默跳过 |
| Moloco / Google 产物 | 同一份源码，两家容器不注入这个全局，也是静默跳过。**不属于任何一家的禁项**，不影响打包（不是外链、不是 `mraid.js`、不用改通道表） |

## 7.7 要改的时候注意什么

| 改了 | 要做什么 |
|---|---|
| 关卡槽位数 | 什么都不用做。分母是 `winCount`，`PASS_*` 的触发点自动跟着走 |
| `EndgameCta.winCount` | 什么都不用做，运行期现读。但**改成 0** 会让分母退回槽位总数，顺便让 `ENDCARD_SHOWN` 变成走得到 —— 那两条按 §7.4 说明已经接好了 |
| 给某个槽位配上 `requires` + `altView` | 什么都不用做，`REPAIR_FAILED` 一抛就开始报 `CHALLENGE_FAILED` |
| 想加新的里程碑 | 改 `PlayableAnalytics.ts` 里的 `PASS_MARKS` / `PASS_EVENTS` 两个数组，长度对齐即可（**只能用官方预定义的事件名**） |
| 想加一个全新的上报点 | 先确认官方事件表（§2）里有对应名字；没有就别报 —— 自定义事件不会被追踪。然后在 `onEnable` / `onDisable` 里**对称**加一对 `EventBus.on` / `off` |
| 想临时关掉整条 | 直接从 `Canvas` 上把组件摘掉。**不要**加进 `FeatureFlags` —— 合规项不进开关表，而埋点是平台要求、不是可选表现 |
