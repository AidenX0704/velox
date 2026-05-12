# Velox

[![GitHub stars](https://img.shields.io/github/stars/AidenX0704/velox?style=social)](https://github.com/AidenX0704/velox/stargazers)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Electron](https://img.shields.io/badge/Electron-39-47848f?logo=electron)](https://www.electronjs.org/)
[![React](https://img.shields.io/badge/React-19-149eca?logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178c6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)

Velox 是一个基于 Electron、React 与 TypeScript 构建的高性能桌面端 Markdown 编辑器，目标是提供现代化的沉浸式所见即所得写作体验，同时保留纯粹的源码编辑、分栏预览、灵活的主题定制和完备的本地桌面应用能力。

> 项目仍处于早期开发阶段。欢迎 Star、试用、提交 Issue 或 Pull Request。

## 预览

Velox 当前提供源码编辑、分栏预览和所见即所得的富文本编辑等三种工作模式，并支持主题色、亮色、黑色和跟随系统外观自动切换。

## 特性

- **多编辑模式**：支持源码编辑、源码/预览分栏、所见即所得富文本编辑。
- **Markdown 增强渲染**：支持标题、引用、列表、任务列表、表格、代码块、公式和常见排版能力。
- **代码块体验**：支持代码高亮、语言标识、自动检测、复制代码、折叠/展开代码块。
- **预览编辑能力**：基于 ProseMirror 实现文档结构的直接编辑，支持基础块、列表、表格、行内公式与块级公式。
- **工作区管理**：内置全功能侧边栏资源管理器，支持新建、重命名、删除文件，实时监听文件系统变动，并支持文档会话状态恢复。
- **主题系统**：支持多套预设主题色、自定义主题色、亮色、黑色和跟随系统外观切换。
- **桌面应用架构**：主进程服务化拆分、严格类型化 IPC、隔离 preload API、窗口状态管理、安全配置和全平台打包。
- **本地持久化**：使用 SQLite (better-sqlite3) 稳定保存编辑器偏好、最近文件、最近工作区、工作区展开状态与各文档的会话状态。

## 技术栈

- **Runtime**：Electron、electron-vite
- **UI**：React、TypeScript、Semi Design
- **编辑器**：CodeMirror 6、ProseMirror、prosemirror-tables
- **Markdown**：markdown-it、markdown-it-multimd-table、markdown-it-task-lists、markdown-it-texmath
- **渲染增强**：Shiki、highlight.js、KaTeX、DOMPurify
- **持久化**：better-sqlite3、SQLite WAL、chokidar
- **工程化**：pnpm、ESLint、Prettier、electron-builder

## 项目结构

```text
src/
  main/              Electron 主进程、服务、IPC、窗口与数据库
  preload/           contextBridge 暴露的安全 API
  renderer/src/      React UI、编辑器、布局、主题与样式
  shared/            主进程/渲染进程共享类型、通道与偏好配置

build/               应用图标、macOS entitlements 与打包资源
resources/           运行时资源
scripts/             工程脚本，例如图标生成
```

核心模块：

- `src/main/database/`：SQLite 初始化、迁移与仓储层。
- `src/main/services/`：文档、工作区、偏好设置、最近记录、自动更新等主进程服务。
- `src/main/ipc/`：类型化 IPC 注册与参数校验。
- `src/renderer/src/modules/editor/`：源码编辑、预览、富文本编辑模式。
- `src/renderer/src/features/theme/`：主题色与亮色/黑色/系统模式运行时同步。
- `src/renderer/src/layout/`：主布局、标题栏、状态栏、工作区与设置面板。

## 开发环境

建议使用：

- Node.js 20+
- pnpm 10+
- macOS / Windows / Linux 桌面环境

安装依赖：

```bash
pnpm install
```

## 常用命令

```bash
# 开发模式
pnpm dev

# 预览生产构建
pnpm start

# 生成应用图标
pnpm run icons

# 类型检查
pnpm run typecheck

# 代码检查
pnpm run lint

# 生产构建
pnpm run build

# 打包目录构建
pnpm run build:unpack

# 平台打包
pnpm run build:mac
pnpm run build:win
pnpm run build:linux
```

## 打包说明

应用图标源文件位于 `build/logo.svg`，运行：

```bash
pnpm run icons
```

会生成：

- `build/icon.png`
- `build/icon.ico`
- `build/icon.icns`
- `resources/icon.png`

Velox 使用 `better-sqlite3` 作为本地 SQLite 存储引擎。它是原生模块，如果更换 Electron、Node 版本或清理依赖后出现 native binding 错误，可以执行：

```bash
pnpm exec electron-builder install-app-deps
```

自动更新默认关闭。发布时可以通过环境变量配置更新源：

```bash
VELOX_UPDATE_URL=https://your-update-host.example.com pnpm run build:mac
```

## 当前支持的 Markdown 能力

- 标题、段落、强调、粗体、链接、图片
- 有序列表、无序列表、嵌套列表、任务列表预览
- 引用块、分割线、行内代码、围栏代码块
- 表格、多行表格基础渲染
- 行内公式与块级公式
- 代码块语法高亮、语言切换、复制、折叠

## 路线图

- [x] 主题色、自定义主题色、亮色/黑色/系统外观自动切换
- [x] 应用 Logo 与跨平台打包图标体系
- [x] 全功能工作区资源管理器与文件系统实时同步
- [ ] 更强大的所见即所得富文本排版交互
- [ ] 表格工具栏、增删行列、对齐与批量选择交互
- [ ] 公式块可视化编辑与错误提示
- [ ] 命令面板、全局搜索、快捷键设置与插件体系
- [ ] 单元测试、端到端测试与 CI 发布流程

## 贡献

欢迎通过 Issue 反馈问题、提出想法，也欢迎提交 Pull Request。

推荐流程：

1. Fork 本仓库。
2. 基于 `main` 创建功能分支。
3. 保持改动聚焦，尽量避免混入无关格式化。
4. 提交前运行检查：

```bash
pnpm run lint
pnpm run typecheck
pnpm run build
```

提交信息建议使用清晰的动词开头，例如：

```text
feat: add theme presets
fix: resolve settings select icon overlap
docs: improve packaging guide
```

## 支持项目

如果这个项目对你有帮助，欢迎点一个 Star：

[![GitHub stars](https://img.shields.io/github/stars/AidenX0704/velox?style=social)](https://github.com/AidenX0704/velox/stargazers)

Star 数会通过 GitHub badge 自动展示。

## 开源许可

本项目基于 [MIT License](LICENSE) 开源。