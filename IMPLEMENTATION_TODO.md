# create-x-app 可执行开发清单

## 文档用途

本文件用于固化 `create-x-app` 的实现计划，避免后续对话上下文过长导致执行偏移。

后续开发默认遵循本文件：

- 按依赖顺序推进，不跳步。
- 每完成一项就更新勾选状态。
- 遇到 Bug 不做补丁式修复，直接定位根因并做完整解决。
- 关键实现、业务核心或难理解代码块，补充结构化注释说明。

## 最小主链路

第一阶段先打通以下主链路：

1. CLI 入口可执行
2. 环境检测可运行
3. 交互问答可返回配置
4. 模板路径可解析
5. 项目文件可生成
6. 后置动作可执行
7. 测试可运行

## 执行阶段

### P0 基础骨架

- [x] T01 创建根目录 `package.json`
  输出：根目录包配置
  完成标准：包含 `type: "module"`、`bin`、`files`、`scripts`、`engines.node >= 18`、依赖和开发依赖
  验证方式：后续模块可正常读取配置；CLI 入口可加载

- [x] T02 创建 `src/utils/logger.js`
  输出：统一日志工具
  完成标准：提供 `info`、`success`、`warn`、`error`、`step`
  验证方式：被其他模块导入时无报错

- [x] T03 创建 `src/utils/version.js`
  输出：版本检测工具
  完成标准：实现 `detectVersion()`、`meetsMinimum()`
  验证方式：`node --version` 可解析；未知命令返回 `null`

### P1 环境与解析

- [x] T04 创建 `src/steps/env-check.js`
  输出：环境检测步骤
  完成标准：检测 Node、Git、pnpm、Java；使用 `ora`；正确区分必需项与可选项
  验证方式：执行 CLI 时先输出环境检测汇总

- [x] T05 创建 `src/steps/resolver.js`
  输出：模板路径解析器
  完成标准：支持 `react-vite-ts`、`node-ts`、`java-fullstack` 三种模板；未知模板抛错
  验证方式：已知 key 返回绝对路径，未知 key 抛出 `Error`

### P2 交互主链路

- [x] T06 创建 `src/steps/prompts.js`
  输出：交互问答模块
  完成标准：支持项目名、模板、功能模块、包管理器、确认；支持取消退出
  验证方式：可产出完整 `config` 对象；取消时优雅退出

- [x] T07 创建 `src/commands/create.js`
  输出：主编排器
  完成标准：按 `env-check -> prompts -> resolver -> generator -> post-actions` 顺序调用
  验证方式：主流程顺序正确，异常不被静默吞掉

- [x] T08 创建 `bin/cli.js`
  输出：CLI 入口文件
  完成标准：支持 `[project-name]`、`--skip-install`、`--skip-git`
  验证方式：`node bin/cli.js demo --skip-install --skip-git` 能进入主流程

### P3 生成器核心

- [x] T09 创建 `src/generator/index.js` 基础复制能力
  输出：项目生成器基础版本
  完成标准：可创建目标目录、复制 `shared/`、复制模板目录
  验证方式：目标目录中出现复制后的文件树

- [x] T10 在生成器中实现 `.ejs` 递归渲染
  输出：模板渲染能力
  完成标准：所有 `.ejs` 文件可渲染为真实文件，并删除原 `.ejs`
  验证方式：生成后的 `README.md`、`AGENTS.md` 变量被正确替换

- [x] T11 在生成器中实现点文件重命名
  输出：点文件重命名能力
  完成标准：支持 `_gitignore -> .gitignore` 及其他 `_xxx -> .xxx`
  验证方式：输出目录中不存在 `_gitignore`，存在 `.gitignore`

- [x] T12 在生成器中实现 extras 注入逻辑
  输出：模板扩展能力
  完成标准：根据 `config.extras` 注入额外模板内容
  验证方式：勾选扩展项后生成对应文件

### P4 后置动作

- [x] T13 创建 `src/steps/post-actions.js`
  输出：安装依赖、初始化仓库、打印后续步骤
  完成标准：支持 install、husky install、chmod、git init、git add、git commit
  验证方式：`--skip-install`、`--skip-git` 两条分支行为正确

- [x] T14 补充全局错误处理
  输出：统一异常退出逻辑
  完成标准：未捕获 `rejection` 时打印友好错误并以 `code 1` 退出
  验证方式：手动制造异常时输出明确错误

### P5 模板与共享文件

- [x] T15 创建 `templates/react-vite-ts/`
  输出：React + Vite + TypeScript 模板
  完成标准：包含 `package.json.ejs`、Vite 配置、TS 配置、React 入口、规范文件
  验证方式：生成项目后可执行 `install` 和 `run dev`

- [x] T16 创建 `templates/node-ts/`
  输出：Node + TypeScript 模板
  完成标准：包含 `package.json.ejs`、`tsconfig.json`、`src/index.ts.ejs`、环境和规范文件
  验证方式：生成项目后可执行 `run dev`、`run build`

- [x] T17 创建 `templates/java-fullstack/`
  输出：Java 全栈说明模板
  完成标准：生成 `frontend/`、`BACKEND.md`、`docker-compose.yml.ejs`
  验证方式：目录结构正确，说明文档完整

- [x] T18 创建 `shared/`
  输出：公共注入文件
  完成标准：包含 `AGENTS.md.ejs`、`README.md.ejs`、`coding-rules.md`、`commitlint.config.js`、`.husky/commit-msg`、`_gitignore`
  验证方式：三套模板输出都带有公共文件

### P6 测试

- [x] T19 创建 `test/version.test.js`
  输出：版本工具测试
  完成标准：覆盖未知命令返回 `null`、Node 版本解析成功
  验证方式：`node --test`

- [x] T20 创建 `test/resolver.test.js`
  输出：模板解析测试
  完成标准：覆盖正确路径解析和未知模板异常
  验证方式：`node --test`

- [x] T21 创建 `test/generator.test.js`
  输出：生成器测试
  完成标准：覆盖文件复制、点文件重命名、EJS 渲染
  验证方式：`node --test`

### P7 联调与验收

- [x] T22 安装依赖并跑通主流程
  输出：可运行的 CLI
  完成标准：`npm install` 成功，`node bin/cli.js my-test-project` 可完整执行
  验证方式：手动检查生成目录和执行结果

- [x] T23 执行手动验收清单
  输出：人工验收记录
  完成标准：下列事项全部通过
  验证方式：逐项打勾

  - [x] 环境检测表格正常显示
  - [x] 所有问答正常交互
  - [x] 选择每套模板均能生成正确文件树
  - [x] 输出目录中出现 `.gitignore`，而非 `_gitignore`
  - [x] 输出目录中包含 `AGENTS.md`、`README.md`、`coding-rules.md`
  - [x] `README.md` 和 `AGENTS.md` 中的 `projectName` 变量已正确渲染
  - [x] `npm install` 无报错完成
  - [x] `git init + 初始提交` 成功执行

- [x] T24 执行发布前检查
  输出：发布前确认结果
  完成标准：发布前检查项全部通过
  验证方式：逐项打勾

  - [x] 更新 `package.json` 版本号
  - [x] 确认 `files` 字段包含 `bin`、`src`、`templates`、`shared`
  - [x] 本地运行 `node bin/cli.js` 验证完整流程
  - [x] 确认 npm 包名 `create-x-app-cli` 可用
    已确认 `create-x-app` 被占用，当前已切换发布名为 `create-x-app-cli`；registry 查询结果为未发现现有同名包
  - [x] 准备含使用说明和 CLI 演示的 `README.md`
  - [x] 执行 `npm pack --dry-run`
  - [x] 补齐真实发布元数据：`repository`、`homepage`、`bugs`、`author`、`license`
    已写入：GitHub 仓库 `https://github.com/yexianglun-d/create-x-app.git`、许可证 `MIT`、作者 `赵铁柱`

## 推荐执行顺序

按以下顺序推进最稳：

1. `T01 -> T03`
2. `T04 -> T08`
3. `T09 -> T14`
4. `T15 -> T18`
5. `T19 -> T21`
6. `T22 -> T24`

## 第一轮最小可运行目标

如果要先打通第一版主链路，优先做这 8 项：

- [x] T01
- [x] T02
- [x] T03
- [x] T04
- [x] T05
- [x] T06
- [x] T07
- [x] T08

## 当前约定

后续对话中若未额外说明，默认以本文件为当前执行基线。
