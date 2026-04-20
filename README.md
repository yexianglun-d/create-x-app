# create-x-app-cli

一条命令生成生产级项目模板的 Node.js CLI。

当前脚手架支持交互式问答、环境检测、模板渲染、点文件恢复、依赖安装、Husky 初始化、Git 初始化，以及 `--verbose` / `--debug` 诊断输出。

## 特性

- 交互式创建三套模板：`react-vite-ts`、`node-ts`、`java-fullstack`
- 自动注入公共协作文件：`AGENTS.md`、`coding-rules.md`、`README.md`
- 支持模板扩展项：React Router、Tailwind、Express、Dotenv
- 自动将 `_gitignore`、`_eslintrc.json` 等恢复为真实点文件
- 自动执行 `npm install`、`husky install`、`git init`
- 提供 `--skip-install`、`--skip-git`、`--verbose`、`--debug`

## 使用方式

发布后可直接通过 `npx` 使用：

```bash
npx create-x-app-cli my-app
```

本地开发环境下可直接运行：

```bash
node bin/cli.js my-app
```

## 交互流程

CLI 按以下顺序执行：

1. 检测本机环境：Node.js、Git、pnpm、Java
2. 询问模板类型
3. 询问功能模块与模板扩展项
4. 询问包管理器
5. 确认后生成目标项目
6. 视配置执行依赖安装、Husky 初始化、Git 初始化

## 模板说明

### `react-vite-ts`

- React 18 + Vite 5 + TypeScript 5
- 可选扩展：`react-router`、`tailwind`

### `node-ts`

- Node.js + TypeScript + tsx
- 可选扩展：`express`、`dotenv`

### `java-fullstack`

- 生成前端工程和后端说明文档
- 前端工程位于 `frontend/`
- 后端搭建说明位于 `BACKEND.md`

## 命令参数

```bash
create-x-app-cli [project-name] [options]
```

可用参数：

- `--skip-install`
  跳过脚手架完成后的依赖安装
- `--skip-git`
  跳过 `git init`
- `--verbose`
  输出详细执行日志，例如实际执行的命令、目标目录、被跳过的步骤
- `--debug`
  输出调试日志和异常堆栈，包含 `verbose` 的全部信息

示例：

```bash
node bin/cli.js demo-app --verbose
node bin/cli.js demo-app --debug
node bin/cli.js demo-app --skip-install --skip-git
```

## CLI 演示

下面是一段精简后的本地运行示例：

```bash
$ node bin/cli.js demo-app --verbose

┌   create-x-app-cli
✔ 环境检测完成

状态    工具       检测版本      最低要求       影响范围
────  ───────  ────────  ─────────  ───────
✔ 通过  Node.js  v22.22.1  >= 18.0.0  必需
✔ 通过  Git      v2.50.1   >= 2.0.0   可选
⚠ 可选  pnpm     未找到       >= 8.0.0   pnpm 用户
✔ 通过  Java     v21.0.10  >= 21.0.0  可选

? 请选择项目模板 › React + Vite + TypeScript
? 请选择需要的功能模块 › ESLint, Prettier, AGENTS.md, coding-rules.md
? 请选择包管理器 › npm

· 目标目录：/path/to/demo-app
· 已跳过依赖安装步骤
· 已跳过 Git 初始化步骤

后续步骤：
  cd demo-app
  npm run dev
```

## 输出风格

脚手架当前提供以下辅助输出能力：

- 彩色状态日志：基于 `chalk`
- Spinner 动画：基于 `ora`
- 交互式问答：基于 `@clack/prompts`
- 统一表格输出：用于环境检测结果
- 分级日志输出：普通、详细、调试三级
- 统一异常展示：支持未处理异常和 Promise rejection

## 本地开发

安装依赖：

```bash
npm install
```

运行测试：

```bash
node --test
```

本地调试 CLI：

```bash
node bin/cli.js my-app --verbose
```

## 已验证事项

- 根仓库 `node --test` 通过
- `react-vite-ts` 模板可完成安装、Husky 初始化、Git 初始化和构建
- `node-ts`、`java-fullstack` 模板已完成文件结构校验
- `--verbose`、`--debug` 输出链路可用

## 发布前建议

发布前建议至少执行以下命令：

```bash
node --test
node bin/cli.js release-check --skip-install --skip-git
npm pack --dry-run
```

## 发布元数据现状

当前 `package.json` 已补齐：

- `name`
- `version`
- `description`
- `keywords`
- `author`
- `license`
- `repository`
- `homepage`
- `bugs`
- `publishConfig.access`
- `bin`
- `files`
- `engines`

当前使用的发布信息：

- `author`: `赵铁柱`
- `license`: `MIT`
- `repository`: `https://github.com/yexianglun-d/create-x-app.git`
- `homepage`: `https://github.com/yexianglun-d/create-x-app#readme`
- `bugs`: `https://github.com/yexianglun-d/create-x-app/issues`
