# Velox 全面优化方案

> 版本基线：v1.0.9 · Electron 39 / React 19 / electron-vite 5
> 范围：启动性能、文件同步、Markdown 渲染质量、UI 视觉体系（按 10 条设计规则重建）
> 本文所有结论均来自对 `E:\velox` 源码与 `out/` 产物的实测，关键数据附计算过程。

---

## 实施状态（2026-10-23 更新）

第一轮落地已完成并通过 `typecheck` / `eslint` / `lint:design` / `check:bundle` / `build`，并已实际启动验证（见下方冷启动时序）。

**实测产物对比**

| 指标                 | 改造前                                     | 改造后                      | 变化 |
| -------------------- | ------------------------------------------ | --------------------------- | ---- |
| 首屏 JS + CSS        | 3.0 MB                                     | **991 KB**（gzip 150 KB）   | −67% |
| 首屏 CSS             | 909 KB（含 Semi 777 KB）                   | **164 KB**                  | −82% |
| 渲染器产物总量       | 19.3 MB / 192 chunk                        | **14.4 MB / 104 chunk**     | −25% |
| 最大懒加载 chunk     | 2.93 MB（hljs 全量 + katex + markdown-it） | **915 KB**（CodeMirror）    | −69% |
| shiki oniguruma wasm | 622 KB                                     | **0**（改用 JS regex 引擎） | 移除 |
| Semi UI              | 1.14 MB JS + 777 KB CSS                    | **0**（仅保留 53 KB 图标）  | 移除 |

**实测冷启动时序**（`electron .`，多次采样，日志 `Startup timeline`）：

```
app-ready= 97–120 ms   window-created=233–348 ms   services-ready=262–388 ms   renderer-ready=570–1149 ms
```

即窗口在 **约 230–350 ms** 出现（不再是"双击后干等"），首帧就绪 **约 0.6–1.1 s**（差异来自磁盘缓存与 Defender 扫描：每次重新构建后的首次启动更慢）。窗口参数 > 10 s 未上报时会打 `renderer-not-ready-10s`，渲染层异常（进程崩溃 / 加载失败 / preload 报错 / 无响应）也会写入日志，便于定位。

> 实现细节：骨架退场与 `renderer-ready` 取 `requestAnimationFrame` 与 400 ms 定时器中的**先到者**。窗口被遮挡时 Chromium 会节流 rAF，只依赖 rAF 会让骨架永久停留。

已落地：窗口先行 + 静态骨架 + 主题预置（`nativeTheme` + `prefers-color-scheme`）、惰性服务与按需 `export`、并行恢复、ErrorBoundary、`FileWatchService` 外部修改同步与冲突横幅、shiki 单引擎按需语法、tokens.css 全量令牌（`#131312` + 亮蓝底近黑字）、去边框/双环聚焦/字重−40/图标对齐/tabular-nums/text-wrap/弹簧缓动/反馈自熄、Tab 拖拽 FLIP 过阻尼落位、搜索替换行 Grid 折叠、自研 UI 原语替代 Semi、`lint:design` 与 `check:bundle` 双守卫。

尚未完成（后续迭代，均不在首轮目标内）：`StreamText` 流式字效只有原语与 CSS、还没有流式输出界面消费；MainLayout 拆分与 store 收敛；预览 Markdown Worker 化；视觉回归截图基线；可变字体打包（`360` 目前依赖系统可变字体）。

---

## 第二轮：架构收敛（MainLayout / Worker / 可视基线）

| 项目             | 结果                                                                                                                             |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `MainLayout.tsx` | 2635 行 → **1479 行**（−44%），其中 JSX 仅 314 行                                                                                |
| 纯逻辑           | `layout/app/format.ts`、`searchResults.ts`、`paths.ts`（零 React 依赖）                                                          |
| 组件             | `ResourceExplorer`、`RecentWorkbench`、`EditorLoadingFallback`、`lazyEditors`（共享 lazy 边界）                                  |
| 状态             | `useUpdaterState`、`useExternalDocuments`、`useExplorerResize`、**`useTitleBarSearch`（506 行：查询/工作区搜索/跳转/两种替换）** |
| Store            | `closeTabDecisionStore`（三选一关闭确认）、`appActionsStore`（替代 openPath / loadWorkspace / refreshRecent 三个 ref 镜像）      |
| Markdown 解析    | remark/rehype/KaTeX/sanitize 移入 **Web Worker**（1.4 MB 懒加载 chunk，主线程只做 hast→React）                                   |
| 标题锚点         | 由渲染期模块级计数器改为 **在 hast 上生成**，两个预览并存时不再互相污染                                                          |
| 可视回归         | `npm run test:visual`：真实 Electron + `capturePage` + `pngjs` 比对，浅/深两套基线，**确定性 0 像素差异**                        |

顺带修掉的真实缺陷：**首次启动时双击 `.md` 会被欢迎页覆盖**（`hasSeenWelcome` 分支先于 `pendingPath`），现在命令行文件优先。

新增校验脚本：`npm run test:markdown`（管线契约：锚点/GFM/KaTeX/frontmatter/消毒）、`npm run test:visual[:update]`。

重构全程用可视回归兜底：每次抽取后重跑，浅/深两套基线始终 **0 像素差异**，证明拆分只改结构、未改渲染。

仍留在 `MainLayout` 的（可选下一步）：启动引导 effect（约 120 行）、导出流程（约 60 行）、工作区树 state 与持久化 effect（约 120 行）。

---

## 0. 结论摘要（TL;DR）

| #   | 问题                   | 真正的根因                                                                                                                                                                                                                                     | 修复代价                                      | 预期收益                                                       |
| --- | ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- | -------------------------------------------------------------- |
| 1   | 启动慢，双击后空白等待 | 窗口在「数据库 + 14 个服务 + 菜单 + 更新器」之后才创建；首包 2.13 MB JS + 909 KB CSS；打开文档再拉 4.9 MB 编辑器块；主题在设置 IPC 返回后才应用                                                                                                | 中（主进程重排 + 首屏静态骨架 + 拆包）        | 窗口可见 1.2–2 s → **≤ 350 ms**；可输入 ≤ 1.5 s → **≤ 900 ms** |
| 2   | 外部编辑器改完不刷新   | `chokidar` 只监听 `add/unlink/addDir/unlinkDir`，**从未监听 `change`**；单文件打开时根本没有 watcher；渲染层收到事件也只刷新文件树，从不重载正文                                                                                               | 小（一个 `FileWatchService` + 一条 IPC 协议） | 外部保存 → 界面更新 **≤ 400 ms**                               |
| 3   | Markdown 渲染观感差    | measure 920 px（≈95 字符行宽，远超自身 DESIGN.md 要求的 65–75ch）；h1 `clamp→3rem`(48 px) + `font-weight:760` 尺度断层；`*{font-weight:normal}` 全局重置；引用块/行内码三层装饰叠加；hljs 与 shiki 双引擎产出混杂；无 `text-wrap`/中文标点处理 | 中（纯 CSS + 1 个渲染管线收敛）               | 排版「出版级」+ 代码块视觉统一                                 |

**十条设计规则本身没有一条与现有代码冲突到需要重写**，但它们要求把「边框驱动的层级」整体换成「微明度分层驱动」。当前 CSS 里 **167 处 border、30 处 box-shadow、23 处 transition、0 处 `text-wrap`、0 处 `linear()` 缓动、仅 3 处 `tabular-nums`** —— 这组数字就是 UI 改造的工程量基线。

---

## 1. 现状测绘（量化基线）

### 1.1 代码规模与结构热点

| 文件                                                | 行数 / 体积      | 问题                                                                                                                 |
| --------------------------------------------------- | ---------------- | -------------------------------------------------------------------------------------------------------------------- |
| `src/renderer/src/layout/MainLayout.tsx`            | 2 393 行 / 76 KB | 单组件承担 30+ `useState`、20+ `useEffect`、标签页、搜索、导出、更新器、拖拽投放、工作区。任何改动都触碰整棵树重渲染 |
| `src/renderer/src/layout/SettingsPanel.tsx`         | 1 360 行 / 50 KB | 设置页与偏好持久化耦合                                                                                               |
| `src/renderer/src/assets/main.css`                  | 3 335 行 / 66 KB | 设计令牌与组件样式混在一处，无分层文件                                                                               |
| `src/main/services/export-service.ts`               | 1 325 行         | **顶层 `import` 了 `docx`、`katex`、`markdown-it`、`pngjs`、`jpeg-js`** —— 只有点「导出」才需要，却拖慢每一次冷启动  |
| `src/renderer/src/features/document/useDocument.ts` | 432 行           | **死代码**：全仓库无任何引用（已被 `useTabs` 取代）                                                                  |
| `src/renderer/src/assets/base.css`                  | 67 行            | electron-vite 模板残留 `--ev-*` 变量；`*{font-weight:normal}` 是字重体系的定时炸弹                                   |

### 1.2 产物与首屏关键路径（实测 `out/renderer`）

```
256 个文件 / 19.3 MB     192 个 JS chunk / 17.4 MB     3 个 CSS / 0.9 MB
```

首屏（`index.html` → 首帧）必须加载并执行：

| 资源                         | 体积                          | 说明                                                                                                              |
| ---------------------------- | ----------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `index-*.js`（entry）        | 747 KB                        | MainLayout + 全部 layout 组件                                                                                     |
| `semi-*.js`                  | 1 143 KB                      | **只用到 11 个组件**（Button/Dropdown/Input/InputNumber/Modal/Progress/Select/TextArea/Toast/Tooltip/Typography） |
| `index-*.js`（shared）       | 237 KB                        | 共享运行时                                                                                                        |
| `index-*.css` + `semi-*.css` | 132 + 777 KB                  | Semi 全量样式表                                                                                                   |
| **合计**                     | **≈ 2.13 MB JS + 909 KB CSS** | 首帧前必须解析执行                                                                                                |

点击/恢复文档后再拉编辑器链路：

| 资源                                                                                 | 体积                                   |
| ------------------------------------------------------------------------------------ | -------------------------------------- |
| `editor-*.js`（CodeMirror）                                                          | 936 KB                                 |
| `prosemirror-*.js`                                                                   | 477 KB                                 |
| `markdown-*.js`（**highlight.js 全量 ~190 语言 + katex + markdown-it + dompurify**） | 2 928 KB                               |
| `MarkdownPreview-*.js` + `MarkdownEditor-*.js`                                       | 381 + 181 KB                           |
| **基础链路合计**                                                                     | **≈ 4.9 MB**                           |
| `wasm-*.js`（shiki oniguruma）                                                       | 622 KB — 首次遇到需高亮的代码块才拉取  |
| `mermaid.core-*.js` + 图类型 chunk                                                   | 1 010 KB + 若干 — 仅当文档含图表时拉取 |

> 实测证据：在 `markdown-BgYZxIti.js` 中 `hljs` 出现 1 632 次、`katex` 71 次 → 确认是 **highlight.js 完整构建**被静态打进编辑器路径。而 `codeHighlight.ts` 同时 `import { codeToHtml } from 'shiki/bundle/web'`，是 **双高亮引擎**。

### 1.3 冷启动时序（代码实测路径 + 阻塞点）

```
[0 ms]      main/index.ts → create-app.ts
            ↑ 此时已执行全部顶层 import：electron-updater / better-sqlite3 / electron-store
              / docx / pngjs / jpeg-js / katex / markdown-it / chokidar / fast-glob
[?]         await app.whenReady()
[ready]     getDatabase()            ← 同步打开 SQLite + WAL + 建表迁移 (database.ts:14-20)
            实例化 14 个 Service        (create-app.ts:145-165)
            registerIpc()             (create-app.ts:167)
            MenuService.install()      (create-app.ts:169)
            updaterService.install()   (create-app.ts:171)
  ⇒ 到这里才 createMainWindow()    (create-app.ts:173)   ★ 窗口创建被整体后置
[win]       loadFile(renderer/index.html)
[parse]     2.13 MB JS + 909 KB CSS 解析执行 → 首帧 → ready-to-show → show()
[effect]    applyThemeToDocument()   ← 要等 preferences.getEditor() IPC 回来 (MainLayout.tsx:1115)
            ↑ 深色用户在首帧看到的是浅色，然后闪成深色
[init]     串行 await 链：session.getLastDocument → document.openPath
            → workspace.getTree（并在此启动 chokidar 全目录监听）+ workspace.getState
[editor]    懒加载 4.9 MB 编辑器块 → 骨架屏结束
```

阻塞点共 8 个，见 §2.1。

### 1.4 其它已发现的工程问题

| 类别   | 位置                                                                                                                   | 说明                                                                         |
| ------ | ---------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| 健壮性 | `App.tsx` / `main.tsx`                                                                                                 | **没有 ErrorBoundary**：任一渲染异常 = 永久白屏，只能重启                    |
| 健壮性 | `main-window.ts:24`                                                                                                    | 未设置 `backgroundColor`：深色模式下 OS 画白底，再刷成深色（与主题闪烁叠加） |
| 一致性 | `main-window.ts:46-49`                                                                                                 | `ready-to-show` 与 `did-finish-load + 120ms` 双通道 show，行为不确定         |
| 死代码 | `document_drafts` / `documents` / `document_blobs` / `document_branches` / `document_snapshots` / `document_events` 表 | 迁移脚本已建表，除 history 分支外基本未接入，长期会掩盖「看似有功能」的误判  |
| 死代码 | `base.css` 的 `--ev-*`、`electron.svg`、`wavy-lines.svg`                                                               | 未使用                                                                       |
| 体验   | `MainLayout` 恢复流程                                                                                                  | 先应用默认设置渲染一遍，设置到达后再渲染一遍 → 编辑器双重挂载 + 滚动位置跳变 |
| 体积   | `index.html`                                                                                                           | `<title>Electron</title>`、无内联骨架、无主题引导脚本                        |

---

## 2. 问题一：启动速度

### 2.1 根因清单

| #   | 根因                                                                                         | 位置                                                       | 影响                                     |
| --- | -------------------------------------------------------------------------------------------- | ---------------------------------------------------------- | ---------------------------------------- |
| A   | **窗口创建被后置**到 DB + 服务 + IPC + 菜单 + 更新器之后                                     | `create-app.ts:135-173`                                    | 直接决定「双击后多久出现窗口」，最大单项 |
| B   | 主进程**顶层 import 全量服务**，含 `docx`(数 MB)、`katex`、`markdown-it`、`electron-updater` | `create-app.ts:6-29`、`export-service.ts:5-25`             | 主进程模块解析 + `v8` 编译时间           |
| C   | `getDatabase()` 同步打开 SQLite 并跑迁移，且在窗口创建前                                     | `create-app.ts:145`、`database.ts:14-20`                   | 磁盘 IO + 首次建表（首次启动最慢）       |
| D   | 首屏 **2.13 MB JS + 909 KB CSS**，Semi 占 77% JS / 85% CSS                                   | 产物实测                                                   | 解析执行 → 首帧延迟                      |
| E   | 打开文档再拉 **4.9 MB** 编辑器块（hljs 全量 + shiki wasm 双份）                              | `codeHighlight.ts:1-3`                                     | 骨架屏停留时间                           |
| F   | 首帧后**串行 4 次 await** 才恢复文档，且 `loadWorkspace` 会启动 chokidar 全树监听            | `MainLayout.tsx:1834-1907`、`workspace-service.ts:238-257` | 「已有界面但空白」的观感                 |
| G   | 主题在 `preferences` IPC 返回后才应用；窗口无 `backgroundColor`                              | `MainLayout.tsx:1115`、`main-window.ts:24`                 | 深色模式白闪（最伤「高级感」）           |
| H   | 无静态首屏骨架：`#root` 空 div，必须等 JS 执行完才有像素                                     | `index.html:13-16`                                         | 首帧完全依赖 2.13 MB JS                  |

### 2.2 改造方案

#### A. 窗口先行，数据后到（收益最大，改动最小）

```ts
// src/main/bootstrap/create-app.ts
export async function createApp(): Promise<void> {
  registerProcessLogging()
  if (!app.requestSingleInstanceLock()) {
    app.quit()
    return
  }

  const appWindowManager = new WindowManager()
  windowManager = appWindowManager
  // …argv / second-instance 保持不动…

  await app.whenReady()
  electronApp.setAppUserModelId(environment.appUserModelId)
  app.on('browser-window-created', (_, w) => optimizer.watchWindowShortcuts(w))
  registerSecurityGuards()

  // ★ 1. 立刻创建窗口（此时只有 preload + 静态骨架，不需要任何服务）
  appWindowManager.createMainWindow()

  // ★ 2. 首帧之后再初始化重活；用 setImmediate 让出事件循环
  setImmediate(() => {
    const database = getDatabase() // 惰性
    const services = buildServices(database) // 纯实例化，无 IO
    registerIpc(services)
    new MenuService(appWindowManager).install()
  })

  // ★ 3. 更新器最后且延迟到空闲/首次交互
  setTimeout(() => void updaterService.installAndCheck(), 8_000)
}
```

配套：

- `getDatabase()` 改为**按需**：`services.documentService` 等首次调用时初始化；或在 `app.whenReady()` 后用 `setTimeout(…, 0)` 放到下一个 tick。
- `ExportService` 的 `docx|katex|markdown-it|pngjs|jpeg-js` 改为 **handler 内动态 import**：

```ts
registerIpcHandler(ipcChannels.document.export, schemas.exportInput, async (input, event) => {
  const { ExportService } = await import('../services/export-service')
  return exportServiceSingleton ??= new ExportService()
}). // …
```

- `MenuService.install()` 必须在窗口存在后调用（它需要 `BrowserWindow`），放到第 2 步即可。

#### B. 静态首屏骨架（首帧不再等 JS）

`index.html` 内联 critical CSS + 与真实布局同构的骨架，React 挂载时替换。要点：

1. 骨架尺寸与真实 titlebar(52px)/tabbar(36px)/正文 measure **完全一致**，避免挂载后跳版（CLS=0）。
2. 主题引导脚本必须在 CSS 之前内联执行，避免白闪：

```html
<script>
  // 同步读取主进程写入的镜像值（见 C）——首帧即正确配色
  try {
    var m = localStorage.getItem('velox.appearance') || 'light'
    document.documentElement.dataset.colorMode = m === 'dark' ? 'dark' : 'light'
  } catch (e) {}
</script>
<style>
  /* 只含骨架与背景 token，约 2 KB */
  html,
  body {
    margin: 0;
    height: 100%;
    overflow: hidden;
  }
  html[data-color-mode='light'] {
    --c-canvas: #f5f5f3;
    --c-surface: #fcfcfb;
    --c-skeleton: rgba(28, 27, 25, 0.06);
  }
  html[data-color-mode='dark'] {
    --c-canvas: #0b0b0a;
    --c-surface: #151515;
    --c-skeleton: rgba(232, 230, 225, 0.06);
  }
  body {
    background: var(--c-canvas);
    font-family: -apple-system, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif;
  }
  #boot {
    display: flex;
    height: 100%;
    flex-direction: column;
    gap: 12px;
    padding: 16px;
  }
  #boot .bar {
    height: 32px;
    border-radius: 6px;
    background: var(--c-skeleton);
  }
  #boot .line {
    height: 12px;
    border-radius: 4px;
    background: var(--c-skeleton);
  }
</style>
```

3. 主进程在 `createMainWindow` 里读一次持久化的 appearance，写入：

```ts
backgroundColor: resolvedAppearance === 'dark' ? '#0b0b0a' : '#f5f5f3'
```

（`resolvedAppearance` 存在 `electron-store` 里，`window-state.ts` 已有现成读法；渲染层每次 `applyThemeToDocument` 时把结果回写 `localStorage`，两个来源共享同一事实。）

4. 窗口策略从「`show:false` + `ready-to-show`」改为 **`show:true` 直接显示**（因为有静态骨架，立即出像素才是「立刻显示 UI」），只保留 `paintWhenInitiallyHidden` 默认行为。移除 `did-finish-load + 120ms` 这条不确定通道。

#### C. 拆包：把首屏压到 ≤ 300 KB

```ts
// electron.vite.config.ts
build: {
  rollupOptions: {
    output: {
      manualChunks(id) {
        if (id.includes('@douyinfe')) return 'legacy-semi'   // 目标：最终删除
        if (id.includes('codemirror') || id.includes('@lezer')) return 'cm'
        if (id.includes('prosemirror')) return 'pm'
        if (id.includes('shiki')) return 'shiki'
        if (id.includes('highlight.js')) return 'hljs'      // 目标：最终删除
        if (id.includes('mermaid')) return 'mermaid'
        if (id.includes('katex')) return 'katex'
      }
    }
  }
}
```

原则：**首屏只允许出现 shell 依赖**（React + 自己写的 primitive 组件），编辑器 / 高亮 / 图表 / 数学 / 设置页全部 `lazy()`，并且**不在首帧 import**。

#### D. 高亮引擎收敛（省 ~1.5 MB）

- 删除 `highlight.js` 全量依赖，只保留 `shiki` 单例 + **显式语言白名单**（12 个足够覆盖日常：ts/tsx/js/jsx/python/go/rust/java/bash/json/yaml/sql/md）。
- 用 `createHighlighter`（异步单例 + `codeToHtml` 复用），不再走 `shiki/bundle/web` 的 190 语言动态表。
- 主题固定为 `light:github-light / dark:github-dark` 的 `defaultColor:false` 双主题（现有代码已经这么写），CSS 侧自己控制背景，避免 shiki 自带 `#fff` 与 `#fcfcfb` 打架。
- `katex` 只在文档里出现 `$`/`$$` 才加载 CSS 与字体。

#### E. 恢复流程并行化 + 空闲化

```ts
// 现在：串行 4 次 IPC
// 改为：一帧内并行拿到「要打开什么」，再决定渲染
const [prefs, recentWs, lastDoc] = await Promise.all([
  window.api.preferences.getEditor(),
  window.api.recent.listWorkspaces(),
  window.api.session.getLastDocument()
])
// 主题与字体设置立刻应用（在首帧之后、编辑器挂载之前，只有 1 次渲染）
applyThemeToDocument(…)
// 文档正文最后加载；工作区树延迟到 requestIdleCallback（或编辑器挂载后 200ms）
```

- `loadWorkspace` 里的 `watchWorkspace`（chokidar 全树 `depth:5`）改为**延迟 500 ms 或首次交互后**启动，且只对「已展开目录」做精确监听（见 §3）。
- 编辑器懒加载期间用**与真实编辑器等高的骨架**（现有 `EditorLoadingFallback` 已具备，只需保证与最终 measure 一致）。

#### F. 其它低成本项

| 项             | 做法                                                                                            |
| -------------- | ----------------------------------------------------------------------------------------------- |
| 主进程模块编译 | `require('v8-compile-cache')`（开启 20–40% 主进程 require 提速）；或打包后 `NODE_COMPILE_CACHE` |
| Windows 首启动 | 安装器写 `NSIS` 预热；release 版加 `asar` + `compression: maximum`（只影响体积，不改加载）      |
| 单实例         | 已有 `requestSingleInstanceLock`，第二实例走 `second-instance` 立即 focus，无需等待服务         |
| 开发期         | `--watch` 下避免全量 rebuild；生产包关闭 `devtools` 自动打开                                    |

### 2.3 启动预算表

| 阶段                      | 现在（估） | 目标          | 手段                                        |
| ------------------------- | ---------- | ------------- | ------------------------------------------- |
| 进程 → `whenReady`        | 120–250 ms | 100 ms        | v8-compile-cache + 顶层 import 瘦身（B）    |
| 窗口可见（首帧）          | —          | **≤ 350 ms**  | 窗口先行（A）+ 静态骨架（B）                |
| shell 可交互（点击/拖拽） | 1.0–1.5 s  | ≤ 600 ms      | 首包 ≤ 300 KB（C）                          |
| 文档可输入                | 1.5–3 s    | **≤ 900 ms**  | 高亮收敛（D）+ 编辑器块拆分 + 并行恢复（E） |
| 深色模式首帧正确          | 0          | **必须 0 闪** | 主题引导（B-3/G）                           |

### 2.4 埋点与测量（附录 D 给完整脚本）

- 主进程：`process.getCreationTime()`、`performance.now()` 打点 `t0/ready/window-created/did-finish-load/first-paint`，写 `electron-log`。
- 渲染层：`performance.mark('boot')` … `performance.measure('boot→interactive')`，`PerformanceObserver` 收 LCP/CLS。
- CI 守卫：`scripts/check-startup-budget.mjs` —— 解析产物体积，超过预算直接失败（防回归）。

---

## 3. 问题二：外部修改不自动刷新

### 3.1 根因（全链路 5 处）

```ts
// src/main/services/workspace-service.ts:251-256 —— 唯一一处 watcher 注册
this.watcher
  .on('add', notifyChange)
  .on('unlink', notifyChange)
  .on('addDir', notifyChange)
  .on('unlinkDir', notifyChange) // ★ 没有 'change'
```

1. **没有 `change` 事件**：在别的编辑器保存 = 内容变化，不触发 `add/unlink` → 事件不产生。这是主因。
2. **只在工作区存在时监听**：`watchWorkspace()` 仅由 `openFolder()` / `getTree()` 调用。双击单个 `.md`、拖入单文件、从最近列表打开时**根本不存在 watcher**。
3. **监听范围与用途错位**：watcher 的语义是「刷新文件树」，不是「跟踪已打开文档」；`ignored` 还排除了所有 dotfile，`depth: 5` 之外的文档不可见。
4. **渲染层只刷新树**：
   - `MainLayout.tsx:1912-1916` → `refreshWorkspaceTree()`；
   - `useDocument.ts:152-156`（死代码）→ 同样只刷树。
     全仓库**没有任何地方读取「文件变了」并重载正文**。
5. **缺失冲突语义**：本地有未保存修改时怎么办？删除/重命名/被外部覆盖怎么办？目前没有任何策略。

### 3.2 方案：新增 `FileWatchService`（主进程）+ 文档变更协议

#### 主进程

```ts
// src/main/services/file-watch-service.ts
const DEBOUNCE = 120

export class FileWatchService {
  private watchers = new Map<string, FSWatcher>() // key: normalized path
  private selfWrites = new Map<string, number>() // path → expiry ms

  /** 由 openPath 成功后调用；每个打开的文档一把精确 watcher */
  watchDocument(filePath: string): void {
    const key = normalize(filePath)
    if (this.watchers.has(key)) return
    const w = chokidar.watch(key, {
      ignoreInitial: true,
      awaitWriteFinish: { stabilityThreshold: 80, pollInterval: 20 }, // 防止半写读
      depth: 0
    })
    w.on('change', () => this.emitChange(key))
      .on('unlink', () => this.emitRemoved(key))
      .on('error', (e) => logger.warn(`watch error ${key}`, e))
    this.watchers.set(key, w)
  }

  /** 工作区树监听单独一条通道，仅目录结构变化 */
  watchWorkspaceTree(rootPath: string): void {
    /* 保留现有实现，去掉 change 需求 */
  }

  /** 应用自身写入后登记，避免自触发 */
  markSelfWrite(filePath: string): void {
    this.selfWrites.set(normalize(filePath), Date.now() + 400)
  }

  private emitChange(p: string): void {
    const until = this.selfWrites.get(p)
    if (until && Date.now() < until) return // 自写抑制
    const st = statSync(p, { throwIfNoEntry: false })
    if (!st) return
    const payload = { path: p, mtimeMs: st.mtimeMs, size: st.size }
    if (payload.mtimeMs === this.lastMtime.get(p)) return // 无实质变化
    this.lastMtime.set(p, payload.mtimeMs)
    broadcast(ipcChannels.document.externalChange, payload) // 120ms 去抖合并
  }
}
```

要点：

- **文档 watcher 与树 watcher 分离**。文档 watcher 精确到文件（`depth: 0`），不受 `ignored` 影响、不受 `depth` 限制。
- `awaitWriteFinish` 解决「别的编辑器边写边触发」导致读到半截文件。
- `markSelfWrite` 在 `DocumentService.save()` 写入成功后登记，**400 ms 窗口内回写事件直接丢弃**（否则自己保存也会触发重载，产生光标跳动）。
- 删除单独走 `externalRemoved`，UI 进入「文件已不存在」状态。

#### IPC 协议

```ts
// shared/channels.ts
document: {
  // …
  externalChange: 'document:external-change',
  externalRemoved: 'document:external-removed',
  reloadFromDisk: 'document:reload-from-disk'   // 渲染层主动请求重读
}
```

```ts
// shared/types.ts
export interface ExternalChangeEvent {
  path: string
  mtimeMs: number
  size: number
}
```

#### 渲染层（useTabs + 编辑器）

```
收到 externalChange(path):
├─ 该 path 不是任何 tab            → 忽略（仅树刷新）
├─ tab 干净（!dirty）              → 静默重载
│    document.reloadFromDisk() → setTabContent(preserveCursor:true, preserveScroll:true)
│    编辑器侧：ProseMirror 用 tr.setMeta('addToHistory', false) 更新文档并恢复选区行
│    CodeMirror 用 changes({from:0,to:doc.length,insert}) + 记录/恢复 selection
│    顶部 2.5s 自熄提示条：「已同步外部修改」（timing 见 §5.10）
├─ tab 有未保存修改（dirty）        → 不自动覆盖，出内联横幅
│    「文件已被外部修改：［重新加载（丢弃我的修改）］［保留我的修改］」
│    冲突期间持续显示，不做自熄
└─ 文件被删除 / 重命名             → tab 标记「文件已不在磁盘」，提供「另存为」
```

实现落点：

- `src/renderer/src/features/tabs/useTabs.ts` 增加 `applyExternalChange(tabId, content)`，内部走现有的不可变更新，避免整树重渲染。
- `RichMarkdownEditor.tsx` / `SourceMarkdownEditor.tsx` 暴露 `externalContent` prop（而非直接 `content`），在编辑器内部以 `addToHistory:false` 的方式应用，**保留撤销栈语义**（撤销不应该把所有外部内容撤没）。
- 新增 `<InlineBanner>` 组件（去边框、微明度分层、无阴影），供冲突提示与同步提示复用。

### 3.3 生命周期与边界

| 场景                                               | 行为                                                                                                                |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| 关闭 tab                                           | `unwatchDocument`，避免 watcher 泄漏                                                                                |
| 应用退出                                           | 统一 `await watcher.close()`（现有 `unwatchWorkspace` 已示范）                                                      |
| 网络盘 / WSL / 虚拟机共享目录                      | inotify 不可靠 → 退化为「窗口聚焦时 stat 比对」（`BrowserWindow.on('focus')` 触发一次轻量校验），成本极低且体验一致 |
| 超大目录                                           | 只监听打开的文档 + 已展开目录；**不做全树递归监听**                                                                 |
| 同文件多 tab                                       | 按 path 去重，事件广播给所有持有该 path 的 tab                                                                      |
| 自己的保存                                         | `markSelfWrite` 抑制（关键，否则每次 Ctrl+S 光标跳）                                                                |
| 外部程序「原地替换」（如 Vim 写临时文件再 rename） | `unlink` + `add` 组合需合并成一次 change（用 120 ms 去抖 + `mtime` 兜底）                                           |

### 3.4 验收用例

| #   | 步骤                                | 期望                              |
| --- | ----------------------------------- | --------------------------------- |
| 1   | 打开 a.md，用 VS Code 改动并保存    | ≤ 400 ms 内正文更新，光标行号保持 |
| 2   | 同上，但 Velox 内有未保存修改       | 出现冲突横幅，正文不被覆盖        |
| 3   | 在 Velox 内 Ctrl+S                  | **不触发**重载，光标不跳          |
| 4   | 双击单个 a.md（无工作区）后外部修改 | 同样能刷新（当前完全失效）        |
| 5   | 外部删除 a.md                       | tab 显示「文件已不在磁盘」        |
| 6   | 外部重命名 a.md → b.md              | 旧 tab 标记丢失，树已更新         |
| 7   | 连续快速保存 5 次                   | 只重载 1 次（去抖生效）           |
| 8   | 深色模式下重载                      | 不闪白                            |

---

## 4. 问题三：Markdown 渲染质量

### 4.1 诊断（12 条，全部可定位）

| #   | 现象                       | 证据                                                                                                                                                     |
| --- | -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **行宽过长**，眼睛回扫困难 | `previewMaxWidth: 920`（`preferences.ts:106`）+ `padding: 24px clamp(20px,4vw,32px)` → 有效行宽 ≈ 856 px ≈ **95 个拉丁字符**；DESIGN.md 自己要求 65–75ch |
| 2   | **标题尺度断层**           | `h1 { font-size: clamp(2rem, 1.45rem+1.7vw, 3rem) }`（`markdown-content.css:51`）在 1400 px 窗口下 = **48 px**，正文 16 px，比例 3:1；h2 33 px           |
| 3   | **字重过重且不统一**       | 标题 `760`、`strong 700`、label `600` 混用；`base.css:39` 的 `*{font-weight:normal}` 全局重置让继承不可预测                                              |
| 4   | **三层装饰叠加**           | 引用块：1 px 边框 + 4 px 左侧粗条 + 双层渐变（`rich-content.css:88-100`）；行内 code：底色 + `inset 0 0 0 1px` + 彩色文字                                |
| 5   | **垂直韵律缺失**           | 段落 `0.85em`、列表项 `0.28em`、标题上 `1.5em` 下 `0.72em`，无统一节奏基线                                                                               |
| 6   | **高亮引擎不一致**         | 未命中 shiki 的语言走 `hljs`，产出 `.hljs` 类；命中走 shiki，产出 `span[style]` —— 同一文档两种观感                                                      |
| 7   | **中文排版缺处理**         | 无 `text-wrap: pretty`（孤字）、无 `text-spacing-trim`（标点挤压）、`word-break: break-word` + `overflow-wrap: anywhere` 会切断词                        |
| 8   | **表格**                   | 无 `tabular-nums`，表头字重与正文同层，宽表无横向滚动提示                                                                                                |
| 9   | **图片**                   | 无圆角/无 `figure` 节奏、无 caption、基线对齐导致行内图片撑高行距                                                                                        |
| 10  | **任务列表**               | checkbox 与文本基线不齐（缺 `vertical-align` 处理）                                                                                                      |
| 11  | **行内图标**               | 无统一 `-0.125em` 基线规则，各组件各自用 flex 居中                                                                                                       |
| 12  | **数字抖动**               | 仅 3 处 `tabular-nums`；字数、行号、行内数字在等宽场景会跳动                                                                                             |

### 4.2 新排版尺度（可直接替换）

```css
.markdown-preview,
.preview-edit-prosemirror .ProseMirror {
  /* 字体：中文优先，避免 Inter + 中文回退的字重错配 */
  --md-font:
    -apple-system, 'Segoe UI', 'PingFang SC', 'Hiragino Sans GB', 'Noto Sans SC', 'Microsoft YaHei',
    sans-serif;
  --code-font: ui-monospace, 'SF Mono', 'Cascadia Mono', Consolas, monospace;

  font-family: var(--md-font);
  font-size: 16px; /* 正文 */
  line-height: 1.68; /* 从 1.72 收紧；中文 1.65–1.7 更紧致 */
  letter-spacing: 0.01em; /* 中文正文轻微字距，抵消亚像素糊 */
  text-wrap: pretty; /* 规则 8：防孤字 */
  text-spacing-trim: space-all; /* CJK 标点挤压（Chromium 123+，本运行时可用） */
  line-break: strict; /* 禁止 。，） 等出现在行首 */
  word-break: normal;
  overflow-wrap: break-word; /* 从 anywhere 收回，避免腰斩单词 */
  font-variant-numeric: tabular-nums; /* 规则 6 */
  max-width: 68ch; /* ≈ 720px @16px，落在 65–75ch 舒适区 */
  margin-inline: auto;
}
```

标题尺度（比例 1.25，去掉 `clamp` 视口插值，避免窗口一拉就走形）：

| 层级 | 字号          | 行高 | 字重（浅/暗） | 上 / 下外边距                                    |
| ---- | ------------- | ---- | ------------- | ------------------------------------------------ |
| h1   | 2rem (32)     | 1.15 | 620 / 580     | 0 / .55em                                        |
| h2   | 1.625rem (26) | 1.2  | 620 / 580     | 1.9em / .5em                                     |
| h3   | 1.375rem (22) | 1.25 | 600 / 560     | 1.7em / .45em                                    |
| h4   | 1.125rem (18) | 1.35 | 600 / 560     | 1.5em / .4em                                     |
| h5   | 1rem (16)     | 1.4  | 600 / 560     | 1.35em / .35em                                   |
| h6   | .875rem (14)  | 1.4  | 560 / 520     | 1.3em / .3em（`letter-spacing:.04em`，不用大写） |

- 标题**不再**用 `font-weight: 760`；改用 620/580，正是「暗色补偿」规则要的结果。
- h1 从 48 → 32 px：Typora/GitHub 级别，不再是「PPT 大标题」。

段落与列表：

```css
p {
  margin: 0.78em 0;
}
ul,
ol {
  margin: 0.68em 0;
  padding-inline-start: 1.5em;
}
li {
  margin: 0.3em 0;
}
li > p {
  margin: 0.2em 0;
}
hr {
  margin: 2.2em 0;
  height: 1px;
  border: 0;
  background: color-mix(in oklab, var(--text-primary) 9%, transparent);
}
```

### 4.3 组件级重做清单

#### 引用块（去掉三层装饰，改为微明度分层）

```css
blockquote {
  margin: 1.1em 0;
  padding: 0.55em 0 0.55em 1.05em;
  border: 0; /* 去边框 */
  border-inline-start: 2px solid color-mix(in oklab, var(--accent-fill) 45%, transparent);
  border-radius: 0 6px 6px 0;
  background: color-mix(in oklab, var(--surface-canvas) 70%, var(--surface-base));
  color: var(--text-secondary);
  font-style: normal;
}
```

#### 行内代码

```css
:where(.markdown-preview, .ProseMirror) code:not(pre code) {
  padding: 0.12em 0.36em;
  border-radius: 4px;
  background: color-mix(in oklab, var(--surface-canvas), #1c1b19 6%);
  box-shadow: none; /* 去掉 inset 1px 环 */
  color: var(--text-primary);
  font-family: var(--code-font);
  font-size: 0.9em;
  font-variant-ligatures: none;
}
[data-color-mode='dark'] :where(.markdown-preview, .ProseMirror) code:not(pre code) {
  background: color-mix(in oklab, var(--surface-raised), #ffffff 9%);
  color: #d6d3cc;
}
```

#### 表格

```css
table {
  border-collapse: separate; /* 允许圆角与行悬浮 */
  border-spacing: 0;
  width: 100%;
  margin: 1.3em 0;
  font-variant-numeric: tabular-nums;
  font-size: 0.95em;
}
thead th {
  border: 0;
  border-bottom: 1px solid color-mix(in oklab, var(--text-primary) 12%, transparent);
  padding: 0.55em 0.7em;
  font-weight: 600; /* 暗色 560 */
  text-align: start;
  color: var(--text-primary);
}
tbody td {
  border: 0;
  padding: 0.5em 0.7em;
}
tbody tr + tr td {
  box-shadow: inset 0 1px 0 color-mix(in oklab, var(--text-primary) 6%, transparent);
}
tbody tr:hover td {
  background: color-mix(in oklab, var(--surface-base), #1c1b19 2.4%);
}
/* 宽表横向滚动 + 右侧渐隐提示 */
.table-scroll {
  overflow-x: auto;
}
.table-scroll {
  mask-image: linear-gradient(90deg, #000 92%, transparent);
}
```

#### 图片 / figure

```css
img {
  display: block;
  max-width: 100%;
  height: auto;
  margin: 1.2em auto;
  border-radius: 8px;
}
img[data-inline='true'] {
  display: inline;
  vertical-align: -0.125em;
}
figure {
  margin: 1.4em 0;
}
figcaption {
  margin-top: 0.5em;
  color: var(--text-tertiary);
  font-size: 0.85em;
  text-align: center;
}
```

#### 任务列表

```css
.task-list-item {
  list-style: none;
  margin-left: -1.2em;
}
.task-list-checkbox {
  inline-size: 15px;
  block-size: 15px;
  margin-inline-end: 0.5em;
  vertical-align: -0.125em; /* 规则 5：行内图标对齐 */
  accent-color: var(--accent-fill);
}
```

#### 代码块（统一引擎后的视觉）

```css
.markdown-code-block {
  margin: 1.35em 0;
  border: 0; /* 去边框 */
  border-radius: 10px;
  background: color-mix(in oklab, var(--surface-canvas), #1c1b19 3.5%);
  box-shadow: inset 0 0 0 1px color-mix(in oklab, var(--text-primary) 6%, transparent);
  overflow: hidden;
}
[data-color-mode='dark'] .markdown-code-block {
  background: #111110; /* 比 canvas 略深，靠微明度而非边框 */
  box-shadow: inset 0 0 0 1px rgba(232, 230, 225, 0.05);
}
.markdown-code-toolbar {
  display: flex;
  justify-content: space-between;
  padding: 6px 10px 4px;
  font-size: 11.5px;
  font-variant-numeric: tabular-nums;
  color: var(--text-tertiary);
}
.markdown-code-line-numbers {
  min-width: 2.6em;
  font-variant-numeric: tabular-nums;
  color: color-mix(in oklab, var(--text-tertiary) 55%, transparent);
  border: 0; /* 竖线改为背景差 */
  background: transparent;
}
```

### 4.4 渲染管线收敛

1. **单高亮引擎**：删除 `highlight.js`，`codeHighlight.ts` 只保留 shiki 单例；`plaintext`/未知语言走 `escapeHtml` + `data-language="Plain"`。
2. **补齐 GFM**：`remark-gfm` 已启用，但 `sanitizeSchema` 需放行 `input[type=checkbox]`、`del`、`table` 的 `align`/`colgroup`，否则任务列表与表格对齐被吞（见 `sanitizeSchema.ts` 待核对项）。
3. **软换行策略**：默认 `remark-breaks` 关闭（符合标准 Markdown）；给「Typora 风格软换行」一个设置项，而不是隐式改变。
4. **标题锚点**：现有自定义 slug 逻辑可保留，但 `resetHeadingRenderState()` 是模块级可变状态 —— 并发渲染（两个预览面板）会互相污染，改为把计数值放在一次渲染的闭包内传递。
5. **`processSync` 主线程开销**：`MarkdownPreview` 的 `useMemo` 在每次 `content` 变化时全量重解析。改为：
   - 输入侧 120 ms 防抖；
   - > 100 KB 文档切到增量策略（只重解析变更行所在块）；
   - 最终形态：`unified` 跑在 Worker（`new Worker(new URL('./md.worker.ts', import.meta.url))`），主线程只接收 React 元素树或 HTML。
6. **KaTeX 字体**：`rehype-katex` 会引入 `katex.min.css`（含 ~20 个 woff2）。改为按需动态 `import('katex/dist/katex.min.css')`，且 `font-display: swap`。

---

## 5. 十条规则落地规范

> 每条给出：**规则语义 → 令牌/实现 → 关键代码 → 验收**。所有动效统一走 `--ease-*` 令牌，禁止就地写 `cubic-bezier`。

### 5.1 去边框：靠 1%–3% 微明度分层

**令牌阶梯（L\* 由 sRGB→CIE Lab 实测）**

| 模式 | 令牌                | 色值                     | L\*    | 相对上一级    |
| ---- | ------------------- | ------------------------ | ------ | ------------- |
| 浅   | `--surface-sunken`  | `#eeedea`                | 93.75  | —             |
| 浅   | `--surface-canvas`  | **`#f5f5f3`**            | 96.49  | +2.74         |
| 浅   | `--surface-base`    | **`#fcfcfb`**            | 98.94  | +2.45         |
| 浅   | `--surface-raised`  | `#ffffff`（仅弹层/模态） | 100.00 | +1.06         |
| 暗   | `--surface-canvas`  | **`#0b0b0a`**            | 3.00   | —（非纯黑 ✓） |
| 暗   | `--surface-base`    | **`#151515`**            | 6.77   | +3.77         |
| 暗   | `--surface-raised`  | **`#1a1a19`**            | 9.23   | +2.45         |
| 暗   | `--surface-overlay` | **`#20201e`**            | 12.18  | +2.95         |

> 暗色第一级 +3.77 略超出「1%–3%」区间。若要严格合规，把第二级换成 `#131312`（L\* 5.85，Δ=2.85）即可，其余不变。

**交互态用 `color-mix` 派生，不再手调 12 个 hex**（这是让层级「一致」而非「拼凑」的关键）：

```css
:root[data-color-mode='light'] {
  /* --local-surface 由组件就近覆盖（默认落在 --surface-base 上） */
  --surface-hover: color-mix(in oklab, var(--local-surface, var(--surface-base)), #1c1b19 3.2%);
  --surface-active: color-mix(in oklab, var(--local-surface, var(--surface-base)), #1c1b19 6%);
  --surface-press: color-mix(in oklab, var(--local-surface, var(--surface-base)), #1c1b19 9%);
}
:root[data-color-mode='dark'] {
  --surface-hover: color-mix(in oklab, var(--local-surface, var(--surface-base)), #ffffff 5%);
  --surface-active: color-mix(in oklab, var(--local-surface, var(--surface-base)), #ffffff 8%);
  --surface-press: color-mix(in oklab, var(--local-surface, var(--surface-base)), #ffffff 11%);
}
/* 组件只需声明自己所处的层级，交互态自动跟随：
   .sidebar { --local-surface: var(--surface-canvas); }
   .sidebar .row:hover { background: var(--surface-hover); } */
```

**167 处 border 的替换矩阵**

| 类别                        | 现有写法                                   | 替换为                                                                               |
| --------------------------- | ------------------------------------------ | ------------------------------------------------------------------------------------ |
| 面板/区域分隔（≥ 12 处）    | `border-right: 1px solid var(--line-soft)` | 删除；用 `background` 的 `--surface-canvas` vs `--surface-base` 之差                 |
| 卡片/代码块/图片（≈ 30 处） | `border: 1px solid …`                      | `box-shadow: inset 0 0 0 1px color-mix(…, 6–8%)`（**唯一保留的「线」**，且是发丝级） |
| 输入/按钮（≈ 40 处）        | `border: 1px solid`                        | 删除；`background: var(--surface-sunken)` + 双环聚焦（§5.2）                         |
| 表格（≈ 22 处）             | `border: 1px solid`                        | 只留表头下一条 `12%` 透明线 + 行间 `6%` 内阴影                                       |
| 分割线 `hr` / toolbar 底边  | `border-bottom`                            | `background: color-mix(in oklab, currentColor 8%, transparent)` 的 1px 元素          |
| 焦点/选中                   | `outline`                                  | 双环 `box-shadow`（§5.2）                                                            |
| **必须保留**                | —                                          | 无障碍焦点指示、`prefers-contrast: more` 下的回退边框、系统强制色模式                |

**禁止项（用 lint 守，见附录 E）**：`#000`/`#000000`、`border: 1px solid #ccc` 类硬编码、`border-radius: 0` 的容器。

**验收**：把界面截图转灰度后，**仍能分辨层级**（说明不是靠边框，而是靠明度）；同时浅色/暗色各抽查 8 个界面无「线框感」。

### 5.2 输入框：聚焦不加 outline，双环咬合

```css
.field {
  --local-surface: var(--surface-sunken);
  border: 0;
  border-radius: 8px;
  background: var(--local-surface);
  box-shadow: inset 0 1px 1.5px color-mix(in oklab, #1c1b19 4%, transparent); /* 静止：内凹咬合 */
  transition:
    background 160ms var(--ease-out-quart),
    box-shadow 180ms var(--ease-out-quart);
}
.field:hover {
  background: var(--surface-hover);
}

/* 聚焦：外环（光晕）+ 内环（贴边实线）+ 内阴影（凹陷）→ 三层叠出「咬合」 */
.field:focus-within,
.field:focus-visible {
  outline: none; /* 规则要求：不加 outline */
  background: var(--surface-base);
  box-shadow:
    inset 0 0 0 1.5px color-mix(in oklab, var(--accent-fill) 62%, transparent),
    inset 0 1px 2px color-mix(in oklab, #1c1b19 7%, transparent),
    0 0 0 3px color-mix(in oklab, var(--accent-fill) 14%, transparent);
}
[data-color-mode='dark'] .field:focus-within {
  box-shadow:
    inset 0 0 0 1.5px color-mix(in oklab, var(--accent-fill) 58%, transparent),
    inset 0 1px 2px rgba(0, 0, 0, 0.45),
    0 0 0 3px color-mix(in oklab, var(--accent-fill) 18%, transparent);
}
```

- **无障碍必须保留**：`outline: none` 的前提是 `box-shadow` 环 **对比度 ≥ 3:1 且厚度 ≥ 2px**；上面的内环 1.5 px + 3 px 光晕满足 WCAG 2.4.11。请在 `@media (forced-colors: active)` 里恢复 `outline: 1px solid`。
- 报错态：内环换 `--danger`，同时加 `aria-invalid`，不只靠颜色。

### 5.3 暗色补偿：字重全降 40

**技术前提**：`font-weight: 360` 只有在**可变字体**上才真正生效；静态 Inter 只有 100/200…900 离散档，360 会被吸附到 300 或 400。因此：

1. 内置 **Inter Variable**（wght 100–900）子集 woff2（含拉丁），中文走系统字体（PingFang/微软雅黑本身是可变或有多档）。
2. 用 `--w-*` 令牌 + `calc()` 统一降重：

```css
:root {
  --w-body: 400;
  --w-strong: 700;
  --w-label: 600;
  --w-heading: 620;
  --w-medium: 520;
}
[data-color-mode='dark'] {
  --w-body: 360;
  --w-strong: 660;
  --w-label: 560;
  --w-heading: 580;
  --w-medium: 480;
}
body {
  font-weight: var(--w-body);
  font-variation-settings: 'wght' var(--w-body);
}
```

| 语义          | 浅色 | 暗色    |
| ------------- | ---- | ------- |
| 正文          | 400  | **360** |
| 次要文字      | 400  | 360     |
| 强调 `strong` | 700  | 660     |
| 标签/按钮     | 600  | 560     |
| 标题          | 620  | 580     |
| 导航选中      | 600  | 560     |

3. **必须删除** `base.css:39` 的 `* { font-weight: normal; }` —— 它会覆盖上面所有数值（这是当前字重表现不可预测的元凶）。改成只对需要重置的元素显式声明。

**验收**：暗色下 15 px 白字不再「发胖」；灰度截图里 400 与 360 的笔画密度差约 3–5%，肉眼是「更收敛」而非「更细」。

### 5.4 流式打字：90 ms 晕开

语义拆解：**每个字 90 ms 完成 blur(6px)→清晰；相邻字起点错开 30 ms** → 任意时刻约有 3 个字同时在半清晰状态，形成「晕开」推进感。

```css
@keyframes glyph-in {
  from {
    opacity: 0;
    filter: blur(6px);
    transform: translateY(1px) scale(0.995);
  }
  to {
    opacity: 1;
    filter: blur(0);
    transform: none;
  }
}
.glyph {
  display: inline-block;
  /* 不用 will-change，避免每字一个合成层 */
  animation: glyph-in 90ms cubic-bezier(0.215, 0.61, 0.355, 1) both;
  animation-delay: calc(var(--i, 0) * 30ms);
}
@media (prefers-reduced-motion: reduce) {
  .glyph {
    animation: none;
  }
}
```

React 侧封装（按 token 增量 reveal，只包「本帧新增」的字，避免整段重排）：

```tsx
// src/renderer/src/components/StreamText.tsx
import { useMemo, useRef } from 'react'
import type { CSSProperties } from 'react'

export function StreamText({ text }: { text: string }): React.JSX.Element {
  const prevRef = useRef('')
  const prev = prevRef.current

  const { stable, fresh } = useMemo(() => {
    prevRef.current = text
    // 内容被整体替换（非增量）→ 全部当新字处理
    if (!text.startsWith(prev)) return { stable: '', fresh: text }
    return { stable: prev, fresh: text.slice(prev.length) }
  }, [text, prev])

  // 新鲜字数量过多时退化为整段淡入，避免同帧创建上千个动画
  const chunked = fresh.length > 200

  return (
    <span className="stream" data-chunked={chunked}>
      {stable}
      {chunked ? (
        <span className="stream-bulk">{fresh}</span>
      ) : (
        [...fresh].map((ch, i) => (
          <span key={i} className="glyph" style={{ '--i': i } as CSSProperties}>
            {ch}
          </span>
        ))
      )}
    </span>
  )
}
```

> `--i` 只在「本批新增字」内递增 → 30 ms 错开永远从 0 开始，长时间流式不会累积出巨大延迟。

**应用位置**（当前没有 AI 面板，落地为两处真实场景）：

1. **外部文件重载 / 块级增量更新**：新出现的段落做一次 glyph-in，给「刷新」一个可感知但克制的反馈。
2. **未来 AI 助手面板**：本组件即为基座；`--i` 由流式 chunk 的字符序号驱动。

### 5.5 行内图标：`vertical-align: -0.125em`

```css
.icon-inline {
  display: inline;
  inline-size: 1em;
  block-size: 1em;
  vertical-align: -0.125em; /* 规则值：视觉基线对齐 */
  fill: none;
  stroke: currentColor;
  stroke-width: 1.75;
  stroke-linecap: round;
  stroke-linejoin: round;
  flex: none;
}
/* 图标按钮仍用 flex 居中，不要混用 */
.icon-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
```

替换清单：Semi `Icon*`（40+ 处）、任务列表 checkbox、代码块复制图标、状态栏图标、树节点图标。统一 `1em` 尺寸 + `1.75` 描边，**移除所有 `width/height` 硬编码 px**。

### 5.6 数字防抖：`tabular-nums`

```css
.tnum,
.statusbar,
.tab-close-count,
.code-line-numbers,
table,
time,
.search-count,
.shortcut-key {
  font-variant-numeric: tabular-nums;
  font-feature-settings: 'tnum' 1;
}
```

落地位置：状态栏（行:列 / 字数 / 词数）、代码块行号、表格、搜索结果计数（`3 / 128`）、时间戳、快捷键提示、更新进度百分比。

**验收**：字数从 1 999 → 2 000 时，右侧元素不位移。

### 5.7 丝滑折叠：Grid `0fr → 1fr`（免 JS 测高）

```css
.collapsible {
  display: grid;
  grid-template-rows: 0fr;
  transition: grid-template-rows 320ms var(--ease-drag);
}
.collapsible[data-open='true'] {
  grid-template-rows: 1fr;
}
.collapsible > .collapsible-inner {
  min-height: 0; /* 必须：否则 0fr 不塌陷 */
  overflow: hidden;
  opacity: 0;
  transition: opacity 200ms var(--ease-out-quart);
}
.collapsible[data-open='true'] > .collapsible-inner {
  opacity: 1;
}
```

替换清单（现有 `max-height` 过渡 5 处 + JS 测量）：

| 位置           | 现状                           | 改为                                                        |
| -------------- | ------------------------------ | ----------------------------------------------------------- |
| 文档大纲折叠   | `outline.css` 宽度切换         | Grid 行折叠 + 宽度过渡                                      |
| 设置页分组     | 条件渲染（无动画）             | `.collapsible`                                              |
| 代码块折叠     | 无折叠                         | 新增 `data-collapsed` + Grid                                |
| 侧栏显示/隐藏  | `explorerVisible` 直接卸载 DOM | Grid + `opacity`，**保持 DOM**（避免重挂载丢失滚动/展开态） |
| 搜索面板高级项 | 条件渲染                       | `.collapsible`                                              |

> `grid-template-rows` 过渡在 Chromium 107+ 支持插值，Electron 39（Chromium 142）完全可用。

### 5.8 防孤字：`text-wrap: pretty`

```css
p,
li,
blockquote,
dd,
figcaption {
  text-wrap: pretty;
} /* 段落级：避免末行单字 */
h1,
h2,
h3,
.empty-state-title,
.modal-title {
  text-wrap: balance;
} /* 标题级：均衡断行 */
```

> `pretty` 目前对 CJK 收益小于拉丁文（中文不做 hyphenation），因此**必须同时**做 §5.8 的 CJK 标点处理：`text-spacing-trim: space-all` + `line-break: strict`（禁止 `。，` 出现在行首）。验收方式：缩小窗口宽度，确保标题不出现「单字成行」。

### 5.9 动效性格：过阻尼拖拽 / 欠阻尼微弹

CSS 无法直接写弹簧，用 **`linear()` 缓动函数**（Chromium 113+，本运行时已支持）把弹簧曲线逐点采样。以下是按 `m=1, k, c` 物理积分得到的**实测数据**（附录 C 含完整采样表）：

**过阻尼 1200/80 —— 拖拽类，零回弹「咬死」**

- ω = 34.64 rad/s，ζ = 1.155（过阻尼）
- 稳定时间（0.1%）= **366 ms**，超调 ≈ **0%**（最大 0.999）
- 手感：100 ms 已到 79.8%，200 ms 到 97.3%，之后「贴住」不飘

```css
:root {
  --ease-drag: linear(
    0,
    0.095,
    0.265,
    0.431,
    0.57,
    0.679,
    0.761,
    0.823,
    0.87,
    0.904,
    0.929,
    0.948,
    0.961,
    0.972,
    0.979,
    0.985,
    0.989,
    0.992,
    0.994,
    0.995,
    0.997,
    0.998,
    0.998,
    0.999,
    1
  );
  --dur-drag: 366ms;
}
```

**欠阻尼 380/18 —— 微弹类（对勾/点赞）**

- ω = 19.49，ζ = 0.462（欠阻尼），原始超调 **19.5%**、稳定 775 ms
- 18 px 图标上 19.5% 太「跳」→ 振幅系数取 `A = 0.32`，窗口收到 420 ms，可见超调 **6.2%**（§C 表）

```css
@keyframes pop {
  0% {
    transform: scale(0.68);
  }
  25% {
    transform: scale(0.967);
  }
  45% {
    transform: scale(1.062);
  }
  65% {
    transform: scale(1.014);
  }
  85% {
    transform: scale(0.988);
  }
  100% {
    transform: scale(1);
  }
}
.pop {
  animation: pop 420ms linear both;
} /* 关键帧本身已是弹簧采样，线性推进即可 */
```

**应用矩阵**

| 交互                 | 曲线                                                                      | 时长         | 备注                                           |
| -------------------- | ------------------------------------------------------------------------- | ------------ | ---------------------------------------------- |
| 侧栏宽度拖拽         | 拖拽中：**无缓动**（1:1 跟随指针）；释放/双击复位/键盘调整：`--ease-drag` | 366 ms       | 拖拽中加过渡会产生「橡皮筋」延迟，必须区分两段 |
| Tab 拖拽排序         | 位置用 `--ease-drag`（落位），其余 tab 让位用 `--ease-out-quart` 160 ms   | 366 / 160 ms | 落位后**零回弹**才有「咬死」感                 |
| 复制对勾 / 收藏      | `pop` 关键帧                                                              | 420 ms       | 振幅 6%                                        |
| 面板展开/收起        | `--ease-drag`                                                             | 320 ms       | 与 §5.7 共用                                   |
| Toast 进入           | 欠阻尼 `pop` 的**位移动画**变体（y: 8px→0，A=0.2）                        | 380 ms       | 不要用 scale                                   |
| Hover / Focus / 颜色 | `cubic-bezier(.215,.61,.355,1)` 160–180 ms                                | —            | 与全局缓动统一                                 |

> 注意：`linear()` 只做「时间→进度」映射，**不能**直接给 `transform: translate(x, y)` 的连续拖拽插值；拖拽排序请用 FLIP + 上述缓动。
> 全部动效必须在 `@media (prefers-reduced-motion: reduce)` 下降级为 `transition: none`。

### 5.10 反馈自熄：复制对勾 2.5 s

**现状**：`codeBlockModel.ts:74` 写 `setTimeout(…, 1200)`，且 CSS 只有颜色切换、**无过渡**，同时 `Toast.success('代码已复制')` 造成双重反馈（右下角弹窗 + 图标变绿）。

```css
.markdown-code-action {
  transition: color 140ms var(--ease-out-quart);
}
.markdown-code-block[data-copy-state='copied'] .markdown-code-action-copy {
  color: var(--success);
  animation: pop 420ms linear both; /* 欠阻尼微弹 */
}
/* 2.2s 常显 → 0.3s 淡出（总 2.5s），JS 与 CSS 时长必须一致 */
.markdown-code-block[data-copy-state='copied'] .markdown-code-action-copy::after {
  content: '';
  animation: copy-fade 2500ms var(--ease-out-quart) forwards;
}
@keyframes copy-fade {
  0%,
  88% {
    opacity: 1;
  }
  100% {
    opacity: 0;
  }
}
```

```ts
// codeBlockModel.ts
function setCodeBlockCopied(el: HTMLElement): void {
  el.dataset.copyState = 'copied'
  window.clearTimeout(copyTimers.get(el))
  copyTimers.set(
    el,
    window.setTimeout(() => {
      if (el.dataset.copyState === 'copied') delete el.dataset.copyState
      copyTimers.delete(el)
    }, 2500)
  ) // 1200 → 2500
}
```

- **移除 `Toast.success`**（图标已是确认），改为 `aria-live="polite"` 屏幕阅读器播报，避免双通道噪音。
- 图标本身 `aria-label` 从「复制代码」切换为「已复制」，2.5 s 后复原。
- 同一类「自熄反馈」统一到一个 `useSelfDismiss(2500)` hook，供树节点重命名成功、保存成功等复用。

---

## 6. UI 全量重构

### 6.1 移除 Semi UI（首屏最大的单笔收益）

只有 11 个组件在用，却付 1.14 MB JS + 777 KB CSS。自研轻量 primitive（放 `src/renderer/src/ui/`）：

| Semi                           | 替代                                      | 体积预算 |
| ------------------------------ | ----------------------------------------- | -------- |
| Button                         | `<Btn variant="solid\|soft\|ghost" size>` | 1.5 KB   |
| Input / TextArea / InputNumber | `<Field>` + 原生元素 + §5.2 双环          | 2 KB     |
| Select / Dropdown              | `<Menu>`（自绘定位 + `role=menu`）        | 3 KB     |
| Modal                          | `<Dialog>`（原生 `<dialog>` + 焦点陷阱）  | 2 KB     |
| Toast                          | `<Toaster>`（单实例队列 + `aria-live`）   | 1.5 KB   |
| Tooltip                        | 纯 CSS + `popover` 属性                   | 1 KB     |
| Typography                     | 直接语义标签 + `.tnum`                    | 0        |
| Progress                       | `<progress>` + 令牌                       | 0.5 KB   |
| Icons                          | 自绘 24 个 SVG（描边 1.75）               | 4 KB     |

合计 ≈ **16 KB vs 1.9 MB**。迁移顺序：Toast → Typography → Button → Input → Tooltip → Select/Dropdown → Modal（Modal 最后，涉及焦点管理与 portal）。

**必须一并完成的无障碍要求**（PRODUCT.md 要求 AAA）：Tab 序完整、`Esc` 关闭、焦点陷阱与归还、`aria-*` 正确、`:focus-visible` 双环、`prefers-reduced-motion`、强制色模式回退。

### 6.2 窗口 chrome

- 无边框 + `-webkit-app-region: drag`（现有结构可保留），但：
  - 窗口圆角（Windows 11）与 `transparent` 的取舍：**不做透明窗口**（会禁用 GPU 合成、拖影），改用系统圆角。
  - 标题栏高度 52 px 偏大，改 **44 px**（`--titlebar-height: 44px`），并让拖拽区覆盖整条空白带。
  - 最小尺寸 760×520 合理，保留。
  - 关闭按钮 hover 用 `--danger` 8% 微明度底，不用红块。

### 6.3 Tab 栏

```css
.tab[data-active='true'] {
  background: var(--surface-base);
  box-shadow:
    inset 0 0 0 1px color-mix(in oklab, var(--text-primary) 5%, transparent),
    0 1px 0 var(--surface-base); /* 与下方内容区「焊接」 */
  border-radius: 8px 8px 0 0;
}
.tab:not([data-active='true']):hover {
  background: var(--surface-hover);
}
.tab-close {
  opacity: 0;
  transition: opacity 140ms var(--ease-out-quart);
}
.tab:hover .tab-close,
.tab[data-active='true'] .tab-close {
  opacity: 1;
}
```

- 未保存圆点：`6px` 圆点 + `--accent-fill`，与关闭按钮互斥（hover 时圆点淡出、× 淡入）。
- 溢出：横向滚动 + 滚轮转横向，隐藏滚动条但保留 `scroll-snap`。

### 6.4 工作区树

- 行高 30 px（紧凑 26 / 舒适 34 已有令牌）。
- 缩进 14 px/级，用 `padding-inline-start: calc(8px + var(--depth) * 14px)`，不用嵌套容器。
- 选中态：`background: var(--brand-soft)` → 改 `color-mix(in oklab, var(--accent-fill) 10%, transparent)` + `font-weight: var(--w-label)`。
- 展开箭头用 Grid 折叠（§5.7）过渡，不用 `rotate` + `max-height`。
- 目录/文件图标：`1em`、`vertical-align: -0.125em`（§5.5）。

### 6.5 设置面板

- 1360 行单文件 → 拆成 `settings/General.tsx`、`Appearance.tsx`、`Editor.tsx`、`Backup.tsx`、`Export.tsx`、`Shortcuts.tsx` + `settings/registry.ts`（声明式字段表，支持搜索）。
- 分组折叠统一 `.collapsible`。
- 每个改动即时预览（主题/字号/行宽），但**持久化 250 ms 去抖**（现有 180 ms 保留）。
- 新增「排版」分组，暴露 §4.2 的 measure/字号/行高/字重偏移（暗色补偿可开关）。

### 6.6 状态栏 / 空态 / 骨架

- 状态栏 24 px：左「行:列」、中「字数·词数·预计阅读时长」，全部 `tabular-nums`，颜色 `--text-tertiary`，**无边框**（用背景差）。
- 空态（无文档）：一句引导 + 3 个动作（新建/打开/打开文件夹），居中、最大 44 ch。
- 骨架：`--skeleton` 用 `color-mix` 派生，`animation: shimmer 1.6s ease-in-out infinite` 但**尊重 reduced-motion**；骨架块尺寸必须与真实内容一致（避免 CLS）。

---

## 7. 工程化

### 7.1 MainLayout 拆分（2 393 行）

```
src/renderer/src/app/
├── AppShell.tsx            // 布局骨架 + 拖拽分隔
├── useAppBootstrap.ts      // 启动编排（并行 IPC + 主题引导）
├── useTheme.ts
├── explorer/ExplorerPanel.tsx  (from WorkspaceTree)
├── editor/EditorHost.tsx       // lazy 边界 + 骨架
├── search/                    // 标题栏搜索 + 工作区搜索
├── export/ExportDialog.tsx
├── updater/UpdaterDialog.tsx
└── status/StatusBar.tsx
```

目标：单文件 ≤ 300 行；`MainLayout` 只做组合。

### 7.2 状态管理

现状 30+ `useState` + 十余个 `useRef` 同步镜像（`loadWorkspaceRef`、`openPathRef`…）→ 极易出现陈旧闭包。建议：

- 引入一个 **~400 行** 的自研 store（`createStore` + `useSyncExternalStore`），或直接 `zustand`（2 KB）。
- 把「标签页集合 + 激活页 + 脏标记 + 外部变更」收敛到一个 reducer，天然解决 §3 的状态一致性。
- 保留 `useRef` 仅用于 DOM 与计时器。

### 7.3 测试与 CI 守卫

| 脚本                        | 断言                                                                                        |
| --------------------------- | ------------------------------------------------------------------------------------------- |
| `check-startup-budget.mjs`  | 首屏 chunk ≤ 300 KB、编辑器链路 ≤ 1.8 MB（gzip 前）                                         |
| `check-design-tokens.mjs`   | 禁止 `#000`、禁止 `border: 1px solid` 新增、`text-wrap` 覆盖率、`tabular-nums` 覆盖数字组件 |
| `check-external-reload.mjs` | 起一个临时目录 + fs 触发 change，断言 IPC 事件与重载路径                                    |
| 视觉回归                    | Playwright + 截图 diff（浅/暗 × 4 个界面），阈值 0.1%                                       |
| 现有 4 个脚本               | `test:rich-markdown` / `test:document-images` / `test:tab-close` 保留并纳入 CI              |

### 7.4 清理项

- 删除 `useDocument.ts`（432 行死代码）、`base.css` 的 `--ev-*`、`electron.svg`、`wavy-lines.svg`、未接线的 6 张表。
- `src/renderer/index.html` 的 `<title>Electron</title>` → `Velox`。
- 统一 `logger` 级别，生产环境关闭 `console.*`（现有 `console.error` 若干）。

---

## 8. 路线图

### Sprint 1（≈ 1 周）· 「不卡、不乱、不闪」

| 任务                                                         | 影响          | 验收                      |
| ------------------------------------------------------------ | ------------- | ------------------------- |
| 窗口先行 + 静态骨架 + `backgroundColor`                      | 启动          | 窗口 ≤ 350 ms，深色零白闪 |
| 恢复流程并行化 + 工作区延迟                                  | 启动          | 文档可输入 ≤ 900 ms       |
| `FileWatchService` + 文档变更协议 + 冲突横幅                 | 问题 2        | 8 条用例全过              |
| 复制自熄 2.5 s + 图标负值对齐 + `tabular-nums` + `text-wrap` | 规则 5/6/8/10 | 视觉抽查                  |
| ErrorBoundary + 空态兜底                                     | 健壮性        | 人为抛错不白屏            |

### Sprint 2（≈ 1.5 周）· 「设计体系换代」

| 任务                                                   | 影响     | 验收                                    |
| ------------------------------------------------------ | -------- | --------------------------------------- |
| 令牌全量替换（去边框 / 微明度分层 / hex 清理）         | 全站视觉 | 灰度截图仍可辨层级                      |
| 输入框双环、焦点体系、`prefers-contrast` 回退          | 规则 2   | 键盘可达性检查                          |
| 暗色字重降 40（可变字体接入）                          | 规则 3   | 暗色笔画密度对比                        |
| 弹簧缓动令牌 + 折叠 Grid 化 + 拖拽落位                 | 规则 7/9 | 交互手感回归                            |
| Markdown 排版重做（尺度/表格/代码/引用/图片/任务列表） | 问题 3   | 4 类文档（技术/随笔/表格密集/图表）目检 |
| 高亮引擎收敛为 shiki 单例                              | 体积     | 编辑器链路 ≤ 1.8 MB                     |

### Sprint 3（≈ 2 周）· 「减重与护城河」

| 任务                                                       | 影响           |
| ---------------------------------------------------------- | -------------- |
| 移除 Semi UI（11 组件 → 自研 primitive）                   | 首屏 −1.9 MB   |
| MainLayout 拆分 + store 收敛                               | 可维护性       |
| 预览 Markdown Worker 化 + 增量解析                         | 大文档输入延迟 |
| 启动/设计/同步三项 CI 守卫 + 视觉回归                      | 防回归         |
| 文档：更新 `DESIGN.md` 为 v2（新令牌、动效性格、字号尺度） | 一致性         |

---

## 9. 风险与回滚

| 风险               | 说明                                        | 缓解                                                                        |
| ------------------ | ------------------------------------------- | --------------------------------------------------------------------------- |
| 去边框后层级不清   | 微明度差在低质量屏（TN/亮度 40%）上可能消失 | 保留「发丝内阴影 6–8%」作为兜底；`prefers-contrast: more` 恢复 1px 边框     |
| 可变字体体积       | Inter Variable 子集约 90–140 KB woff2       | 只子集拉丁 + `unicode-range`；中文走系统字体                                |
| `linear()` 兼容    | 需 Chromium 113+；Electron 39 满足          | `@supports (transition-timing-function: linear(0,1))` 回退到 `cubic-bezier` |
| 移除 Semi 回归     | Modal/Dropdown 的定位与焦点易出错           | 先做影子组件并行验证，再切 import；逐组件灰度                               |
| 文件监听跨平台     | 网络盘/WSL inotify 不可靠                   | 聚焦时 stat 兜底（§3.3）                                                    |
| 外部重载 vs 撤销栈 | 错误做法会让 Ctrl+Z 抹掉用户输入            | 强制 `addToHistory: false` + 单测覆盖                                       |
| 文档体积上限       | 10 MB 文档同步解析会卡                      | 阈值降级（> 100 KB 关实时预览 / 提示）                                      |

---

## 10. 验收清单（Definition of Done）

**性能**

- [ ] 冷启动窗口可见 ≤ 350 ms（3 次取中位数）
- [ ] 文档可输入 ≤ 900 ms
- [ ] 首屏 chunk ≤ 300 KB；编辑器链路 ≤ 1.8 MB
- [ ] 深色模式首帧即正确，无闪烁（录屏逐帧检查）
- [ ] 1 万字文档输入到预览更新 P95 ≤ 16 ms

**功能**

- [ ] 外部修改 → 自动重载（干净）/ 冲突横幅（脏）
- [ ] 应用自身保存不触发重载
- [ ] 单文件（无工作区）同样可刷新
- [ ] 删除/重命名有明确状态

**视觉（10 条规则）**

- [ ] 全站无纯黑；灰度截图可辨 4 级表面
- [ ] 输入聚焦为双环、无 outline、对比度 ≥ 3:1
- [ ] 暗色字重较浅色 −40，且数值真实生效（DevTools 校验 `font-variation-settings`）
- [ ] 流式字效 90 ms / 30 ms 错开，reduced-motion 下关闭
- [ ] 行内图标 `vertical-align: -0.125em`
- [ ] 数字等宽（字数千位切换不位移）
- [ ] 折叠全部走 Grid `0fr→1fr`，无 JS 测高
- [ ] 标题/段落启用 `text-wrap: balance/pretty`
- [ ] 拖拽 366 ms 零回弹；对勾 420 ms 微弹（超调 ≈ 6%）
- [ ] 复制对勾 2.5 s 自熄，无 Toast 双反馈

---

## 附录 A · 设计令牌全量

```css
/* ============ 表面（微明度分层，L* 实测） ============ */
:root[data-color-mode='light'] {
  --surface-sunken: #eeedea; /* L* 93.75 输入框/凹陷区 */
  --surface-canvas: #f5f5f3; /* L* 96.49 应用底色 */
  --surface-base: #fcfcfb; /* L* 98.94 内容区/侧栏 */
  --surface-raised: #ffffff; /* L* 100.0 弹层/模态（唯一纯白） */

  --text-primary: #1c1b19; /* 15.77:1 — AAA */
  --text-secondary: #56534b; /*  7.03:1 — AAA（#5a574f 仅 6.61，勿用） */
  --text-tertiary: #6f6b62; /*  4.86:1 — AA，仅 ≥14px 辅助信息 */
  --text-disabled: #a5a199; /*  装饰用，不承载信息 */

  --accent-fill: #2563eb; /* 白字标签 5.15:1 — AAA */
  --accent-fill-hover: #1d4ed8;
  --accent-text: #1d4ed8; /* 6.53:1 — AAA，链接与强调文字专用 */
  --accent-soft: color-mix(in oklab, #3b82f6 12%, transparent);
  --accent-line: color-mix(in oklab, #3b82f6 45%, transparent);

  --success: #15803d;
  --warning: #b45309;
  --danger: #b4432f;
}

:root[data-color-mode='dark'] {
  --surface-canvas: #0b0b0a; /* L* 3.00 非纯黑 */
  --surface-base: #151515; /* L* 6.77 */
  --surface-raised: #1a1a19; /* L* 9.23 */
  --surface-overlay: #20201e; /* L* 12.18 菜单/浮层 */
  --surface-float: #262624; /* L* 15.09 最高层 */

  --text-primary: #e8e6e1; /* 13.96–15.79:1 — AAA */
  --text-secondary: #a8a49b; /*  7.01–7.92:1 — AAA */
  --text-tertiary: #8d8981; /*  5.00–5.65:1 — AA */
  --text-disabled: #6f6b63;

  --accent-fill: #4f8cff; /* 深底标签用 #0b0b0a，6.12:1 — AAA */
  --accent-fill-hover: #6ea3ff;
  --accent-text: #6ea3ff; /* 6.92–7.83:1 — AAA */
  --accent-soft: color-mix(in oklab, #4f8cff 16%, transparent);
  --accent-line: color-mix(in oklab, #4f8cff 40%, transparent);

  --success: #79c8a8;
  --warning: #e8b463;
  --danger: #e08b78;
}

/* ============ 字重（规则 3） ============ */
:root[data-color-mode='light'] {
  --w-body: 400;
  --w-medium: 520;
  --w-strong: 700;
  --w-label: 600;
  --w-heading: 620;
}
:root[data-color-mode='dark'] {
  --w-body: 360;
  --w-medium: 480;
  --w-strong: 660;
  --w-label: 560;
  --w-heading: 580;
}

/* ============ 尺度 ============ */
:root {
  --measure: 68ch; /* 正文行宽上限 */
  --radius-sm: 4px;
  --radius-md: 6px;
  --radius-lg: 8px;
  --radius-xl: 10px;
  --hairline: color-mix(in oklab, currentColor 7%, transparent);

  --ease-out-quart: cubic-bezier(0.215, 0.61, 0.355, 1); /* 规则 4 同款 */
  --ease-inout: cubic-bezier(0.65, 0, 0.35, 1);
  --dur-fast: 140ms;
  --dur-base: 180ms;
  --dur-slow: 320ms;
  --dur-drag: 366ms; /* 附录 C */
  --dur-pop: 420ms;
  --dur-feedback: 2500ms; /* 规则 10 */
}
```

## 附录 B · 关键 CSS（可直接落地）

```css
/* 无边框容器：靠内阴影发丝线，而不是 border */
.surface {
  background: var(--surface-base);
  border: 0;
  border-radius: var(--radius-lg);
  box-shadow: inset 0 0 0 1px var(--hairline);
}
.surface--flat {
  box-shadow: none;
  background: var(--surface-canvas);
}
.surface--float {
  background: var(--surface-raised);
  box-shadow:
    inset 0 0 0 1px var(--hairline),
    0 8px 24px -8px color-mix(in oklab, #1c1b19 12%, transparent),
    0 2px 6px -2px color-mix(in oklab, #1c1b19 8%, transparent);
}
[data-color-mode='dark'] .surface--float {
  background: var(--surface-overlay);
  box-shadow:
    inset 0 0 0 1px rgba(232, 230, 225, 0.07),
    0 12px 32px -12px rgba(0, 0, 0, 0.7);
}
```

## 附录 C · 弹簧采样数据

**过阻尼 1200/80（拖拽）**：ζ=1.155，稳定 366 ms，超调 ≈ 0

| t    | 100 ms | 150 ms | 200 ms | 250 ms | 300 ms | 366 ms |
| ---- | ------ | ------ | ------ | ------ | ------ | ------ |
| 进度 | .798   | .920   | .973   | .991   | .997   | 1.000  |

`linear(0, .095, .265, .431, .57, .679, .761, .823, .87, .904, .929, .948, .961, .972, .979, .985, .989, .992, .994, .995, .997, .998, .998, .999, 1)`

**欠阻尼 380/18（微弹）**：ζ=0.462，原始超调 19.5% / 稳定 775 ms；取振幅 0.32、窗口 420 ms 后：

| 关键帧 | 0%   | 5%   | 10%  | 15%  | 20%  | 25%  | 30%   | 35%   | 40%   | 45%       | 50%   | 55%   | 60%   | 65%   | 70%   | 75%  | 80%  | 85%  | 90%  | 95%  | 100%  |
| ------ | ---- | ---- | ---- | ---- | ---- | ---- | ----- | ----- | ----- | --------- | ----- | ----- | ----- | ----- | ----- | ---- | ---- | ---- | ---- | ---- | ----- |
| scale  | .680 | .703 | .760 | .832 | .905 | .967 | 1.015 | 1.045 | 1.060 | **1.062** | 1.055 | 1.042 | 1.028 | 1.014 | 1.003 | .995 | .990 | .988 | .988 | .990 | 1.000 |

峰值 1.062 → 可见超调 **6.2%**，回落后有 2 个 < 1 的微沉（.988），正是「欠阻尼」的手感来源。

## 附录 D · 启动埋点脚本

```ts
// src/main/diagnostics/startup-marks.ts
import { performance } from 'node:perf_hooks'
import { app } from 'electron'
const t0 = performance.now()
const marks: Array<[string, number]> = [['process-created', 0]]
export const mark = (name: string): void => {
  marks.push([name, performance.now() - t0])
}
export const flush = (): void => {
  const rows = marks.map(([n, t]) => `${n.padEnd(18)} ${t.toFixed(1)} ms`)
  console.info(`\n[velox:startup]\n${rows.join('\n')}\n`)
}
app.once('ready', () => mark('app-ready'))
app.once('browser-window-created', () => mark('window-created'))
// main-window.ts: webContents.once('did-finish-load', () => mark('did-finish-load'))
//                      webContents.once('did-frame-finish-load' … ) / 'paint'
flush()
```

渲染层：

```ts
performance.mark('boot')
requestAnimationFrame(() => {
  performance.mark('first-paint')
  performance.measure('boot→first-paint', 'boot', 'first-paint')
  // 编辑器挂载后再打一枚 'editor-ready'
})
```

## 附录 E · 设计守卫脚本（节选）

```js
// scripts/check-design-tokens.mjs
import { readFileSync } from 'node:fs'
import fg from 'fast-glob'

const files = await fg('src/renderer/src/**/*.{css,tsx,ts}')
const errors = []

for (const file of files) {
  const text = readFileSync(file, 'utf8')
  if (/#000\b|#000000\b/i.test(text)) errors.push(`${file}: 出现纯黑`)
  if (
    /border(-(top|right|bottom|left))?:\s*1px\s+solid\s+(?!#)(?!var)/.test(text) &&
    !file.includes('forced-colors')
  )
    errors.push(`${file}: 硬编码 border（请用内阴影发丝线）`)
}
const css = files
  .filter((f) => f.endsWith('.css'))
  .map((f) => readFileSync(f, 'utf8'))
  .join('\n')

if (!/text-wrap:\s*pretty/.test(css)) errors.push('缺少 text-wrap: pretty')
if (!/grid-template-rows:\s*0fr/.test(css)) errors.push('缺少 Grid 折叠实现')
if (errors.length) {
  console.error(errors.join('\n'))
  process.exit(1)
}
console.log('design tokens ok')
```

---

## 附：需要你确认的 3 个决策

1. **暗色第二级**用 `#151515`（+3.77%，略超 3%）还是收紧为 `#131312`（+2.85%，严格合规）？
2. **accent 配色**：深色模式按钮采用「亮蓝底 + 近黑字」（`#4f8cff` + `#0b0b0a`，AAA），还是沿用「深蓝底 + 白字」（`#2563eb` + `#fff`，5.15:1 AAA 但深底上按钮边界对比仅 3.0:1）？
3. **是否直接移除 Semi UI**（收益 −1.9 MB 首屏，代价是自研 11 个组件的交互与无障碍回归测试）？若想分步，可先只替换 Toast/Typography/Button，保留 Modal/Select。
