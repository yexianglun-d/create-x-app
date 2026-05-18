# create-x-app

[![npm version](https://img.shields.io/npm/v/create-x-app-cli.svg)](https://www.npmjs.com/package/create-x-app-cli)
[![npm downloads](https://img.shields.io/npm/dm/create-x-app-cli.svg)](https://www.npmjs.com/package/create-x-app-cli)
[![Node.js](https://img.shields.io/badge/node-%3E%3D18.0.0-339933.svg)](https://nodejs.org/)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)

`create-x-app` 是一个面向真实项目启动场景的 Node.js 脚手架 CLI。它不只是复制模板文件，而是把环境检测、交互式配置、模板能力声明、公共协作文件、依赖安装、Git 初始化、远程模板、项目升级和插件生态串成一条完整的项目创建链路。

如果你经常需要启动 React、Node.js、Electron、Chrome Extension、移动 H5、Monorepo 或 Java 全栈配套工程，这个工具可以帮你把重复的初始化工作压缩成一次命令和几次选择。

如果这个项目帮你节省了初始化项目的时间，欢迎在 GitHub 上点一个 Star。

```bash
npx create-x-app-cli my-app
```

说明：npm 包名为 `create-x-app-cli`；安装后的命令同时提供 `create-x-app` 和 `create-x-app-cli` 两个别名。

## 目录

- [为什么使用](#为什么使用)
- [功能特性](#功能特性)
- [快速开始](#快速开始)
- [视频演示](#视频演示)
- [内置模板](#内置模板)
- [命令参考](#命令参考)
- [插件生态](#插件生态)
- [匿名统计与隐私](#匿名统计与隐私)
- [本地开发](#本地开发)
- [贡献指南](#贡献指南)
- [路线图](#路线图)
- [许可证](#许可证)

## 为什么使用

很多脚手架只解决“生成文件”的问题，但实际项目启动通常还包括这些细节：

- 检查 Node.js、Git、pnpm、Java 等本地环境是否满足模板要求。
- 根据模板差异动态展示功能模块，而不是让所有模板共用一套固定问答。
- 把 `.gitignore`、`.eslintrc.json`、`.prettierrc` 等点文件安全地从 npm 包中恢复出来。
- 选择性注入 `AGENTS.md`、`coding-rules.md`、Husky、commitlint 等团队协作约定。
- 支持模板升级和社区插件，避免模板能力只能停留在内置版本。

`create-x-app` 的目标是提供一个开箱即用、可扩展、适合团队沉淀工程规范的脚手架基础设施。

## 功能特性

- 交互式创建 8 套内置模板，覆盖前端、后端、桌面端、浏览器插件、移动端和 Monorepo。
- Manifest 驱动模板能力，每个模板可以声明自己的功能项、环境要求、包管理器限制和构建脚本。
- 自动检测 Node.js、Git、pnpm、Java，并以表格展示版本和影响范围。
- 支持 `npm`、`pnpm`、`yarn`，并为 `pnpm/yarn` 提供 Corepack 回退能力。
- 自动恢复点文件，例如 `_gitignore` -> `.gitignore`。
- 自动注入公共协作文件，包括 `AGENTS.md`、`coding-rules.md`、项目 README 和 commitlint 配置。
- 可选执行依赖安装、Husky 初始化、Git 初始化和初始提交。
- 支持 `--remote` 从 GitHub 拉取远端模板，并带有 24 小时本地缓存。
- 支持 `--latest` 在生成项目时刷新依赖到 npm 最新版本。
- 支持 `upgrade` 命令，为已生成项目升级脚手架管理的配置文件。
- 支持 `cxa-plugin-*` 社区模板插件，并提供搜索、安装、列出和移除命令。
- 支持匿名统计同意机制，默认首次询问，可通过 `--no-telemetry` 单次关闭。
- 支持 `--verbose` 和 `--debug`，方便排查模板生成和命令执行问题。

## 快速开始

使用 npm registry 上的最新版本：

```bash
npx create-x-app-cli my-app
```

跳过依赖安装和 Git 初始化，适合快速预览生成结果：

```bash
npx create-x-app-cli my-app --skip-install --skip-git
```

使用远端最新模板：

```bash
npx create-x-app-cli my-app --remote
```

强制刷新远端模板缓存：

```bash
npx create-x-app-cli my-app --remote --no-cache
```

生成时刷新依赖版本：

```bash
npx create-x-app-cli my-app --latest
```

本地调试仓库源码：

```bash
npm install
node bin/cli.js my-app --verbose
```

## 视频演示

[观看 15 秒教学视频](https://github.com/yexianglun-d/create-x-app/blob/main/docs/media/create-x-app-tutorial-15s.mp4)

![create-x-app 15 秒教学视频预览](https://raw.githubusercontent.com/yexianglun-d/create-x-app/main/docs/media/create-x-app-tutorial-15s-preview.png)

## 交互流程

CLI 会按以下顺序执行：

1. 检测本机环境。
2. 选择项目模板。
3. 选择通用功能和模板专属扩展。
4. 选择包管理器。
5. 展示配置摘要并等待确认。
6. 复制模板、渲染 EJS、恢复点文件、裁剪未启用产物。
7. 根据选项执行依赖安装、Husky 初始化和 Git 初始化。

示例输出：

```text
┌   create-x-app
- 正在检测开发环境...
✔ 环境检测完成

状态    工具       检测版本      最低要求       影响范围
────  ───────  ────────  ─────────  ───────
✔ 通过  Node.js  v22.22.1  >= 18.0.0  必需
✔ 通过  Git      v2.50.1   >= 2.0.0   可选
⚠ 可选  pnpm     未找到       >= 8.0.0   pnpm 用户
✔ 通过  Java     v21.0.10  >= 21.0.0  可选

◆  请选择项目模板
◆  请选择需要的功能模块
◆  请选择包管理器
◆  确认开始生成项目？
```

## 内置模板

| 模板 key | 适用场景 | 主要内容 |
|---|---|---|
| `react-vite-ts` | 中小型 React 前端应用 | React 18、Vite 5、TypeScript、可选 React Router 和 Tailwind |
| `node-ts` | Node.js 服务端和脚本工程 | TypeScript、tsx、ESLint、可选 Express 和 Dotenv |
| `java-fullstack` | Java 后端配套前端工程 | React 前端工程、Spring Boot 后端搭建说明、Docker Compose 示例 |
| `react-admin` | 后台管理系统 | React、Ant Design、Zustand、权限路由、请求封装、后台布局 |
| `electron-app` | 桌面端应用 | Electron、Vue 3 或 React 渲染进程、IPC 示例、打包配置 |
| `chrome-ext` | Chrome 浏览器插件 | Manifest V3、React popup、content script、background 三入口 |
| `monorepo` | 多包全栈工作区 | Turborepo、pnpm workspace、web、api、shared 三包结构 |
| `mobile-h5` | 移动端 H5 页面 | Vue 3、Vant、rem 自适应、基础请求封装 |

## 功能模块

不同模板会根据自己的 manifest 展示可用能力。常见模块包括：

- `ESLint`：代码质量检查。
- `Prettier`：代码格式化。
- `commitlint + Husky`：提交信息校验和 Git Hooks。
- `AGENTS.md`：AI 编程助手协作规则。
- `coding-rules.md`：团队代码规范。
- 模板专属扩展：React Router、Tailwind、Express、Dotenv 等。

## 命令参考

### 创建项目

```bash
create-x-app [project-name] [options]
```

| 参数 | 说明 |
|---|---|
| `--skip-install` | 跳过脚手架完成后的依赖安装 |
| `--skip-git` | 跳过 `git init`、`git add` 和初始提交 |
| `--remote` | 从 GitHub 拉取远端最新模板，默认使用 npm 包内置模板 |
| `--no-cache` | 配合 `--remote` 使用，忽略 24 小时缓存 |
| `--latest` | 生成时从 npm 拉取最新依赖版本 |
| `--no-telemetry` | 跳过本次匿名使用统计 |
| `--verbose` | 输出详细执行日志 |
| `--debug` | 输出调试日志和错误堆栈，包含 `verbose` 信息 |

### 升级已生成项目

```bash
npx create-x-app-cli upgrade
```

`upgrade` 只处理脚手架管理的配置文件，例如 `tsconfig.json`、`.eslintrc.json`、`vite.config.ts`、`.prettierrc`、`commitlint.config.js`。它不会主动修改业务源码。

### 社区模板市场

```bash
npx create-x-app-cli search [keyword]
npx create-x-app-cli install cxa-plugin-your-template
npx create-x-app-cli list
npx create-x-app-cli remove cxa-plugin-your-template
```

| 命令 | 说明 |
|---|---|
| `search [keyword]` | 从 npm registry 搜索 `cxa-plugin-*` 社区模板 |
| `install <package-name>` | 全局安装一个社区模板插件 |
| `list` | 列出当前可被 CLI 发现的社区模板插件 |
| `remove <package-name>` | 全局卸载一个社区模板插件 |

## 插件生态

社区插件让模板不必全部内置到主仓库。一个插件包需要满足以下约定：

```text
cxa-plugin-example/
├── package.json      # 包含 "cxa-plugin": true
├── manifest.json     # 模板元数据
└── template/         # 模板文件目录
```

`package.json` 示例：

```json
{
  "name": "cxa-plugin-example",
  "version": "0.1.0",
  "type": "module",
  "cxa-plugin": true,
  "files": ["manifest.json", "template", "README.md"]
}
```

插件包名必须使用 `cxa-plugin-*` 或 `@scope/cxa-plugin-*`。安装后，CLI 会扫描当前项目和全局 `node_modules`，并将插件模板追加到模板列表末尾，显示为 `[插件] 模板名称`。

仓库内提供了一个可本地联调的示例插件：

```bash
cd examples/cxa-plugin-example
npm link
create-x-app list
create-x-app my-plugin-app
npm uninstall -g cxa-plugin-example
```

## 匿名统计与隐私

首次创建项目时，CLI 会询问是否允许发送匿名使用统计，并将选择保存到：

```text
~/.create-x-app/config.json
```

匿名统计只包含以下字段：

- 模板 key
- CLI 版本
- Node.js 版本
- OS 类型

不会收集项目名、项目路径、用户名、仓库地址、源码内容、环境变量或任何个人身份信息。

如果需要跳过某一次运行：

```bash
npx create-x-app-cli my-app --no-telemetry
```

实际上报端点由 `CREATE_X_APP_TELEMETRY_ENDPOINT` 配置。未配置端点时，即使用户同意，CLI 也不会发送网络请求。

## 本地开发

环境要求：

- Node.js >= 18.0.0
- npm
- Git

安装依赖：

```bash
npm install
```

运行 CLI：

```bash
node bin/cli.js my-app
```

查看帮助：

```bash
node bin/cli.js --help
node bin/cli.js upgrade --help
node bin/cli.js search --help
```

代码质量检查：

```bash
npm run lint
```

发布前建议执行：

```bash
npm run lint
node bin/cli.js --help
npm pack --dry-run
```

## 项目结构

```text
create-x-app/
├── bin/                    # CLI 入口
├── src/
│   ├── analytics/          # 匿名统计同意和上报
│   ├── commands/           # create / upgrade / marketplace 命令
│   ├── generator/          # 模板复制、渲染、裁剪、依赖刷新
│   ├── marketplace/        # npm 插件市场客户端
│   ├── plugins/            # 插件扫描和模板注册
│   ├── remote/             # 远程模板拉取与缓存
│   ├── steps/              # 环境检测、问答、后置动作
│   ├── upgrade/            # 配置升级能力
│   ├── utils/              # 日志、版本、包管理器适配
│   └── validator/          # 配置校验
├── templates/              # 内置模板
├── shared/                 # 注入所有生成项目的公共文件
└── examples/               # 社区插件示例
```

## 贡献指南

欢迎提交 Issue 和 Pull Request。建议遵循以下规则：

- Bug 报告请包含复现命令、Node.js 版本、操作系统、期望结果和实际结果。
- 新增模板请提供 `manifest.json`、模板目录、生成后的运行说明和最小验证步骤。
- 新增 CLI 能力请保持 ESM 写法，不使用 CommonJS `require()`。
- 新增依赖前请说明必要性，避免为简单逻辑引入重型依赖。
- 提交信息建议遵循 Conventional Commits，例如 `feat:`、`fix:`、`docs:`、`chore:`。

## 路线图

- 恢复 `node:test` 自动化回归测试。
- 将模板内 ESLint 8 配置统一升级到 ESLint 9 flat config。
- 提供更多官方示例插件。
- 为社区模板市场补充更严格的插件健康度检查。
- 增加模板生成结果的快照验证和端到端 smoke test。

## 许可证

[MIT](./LICENSE)
