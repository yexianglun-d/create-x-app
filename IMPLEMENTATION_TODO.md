# create-x-app 实施跟踪清单（对齐 PLAN-v2）

## 文档用途

本文件用于跟踪 `PLAN-v2.md` 的实际执行状态、依赖顺序、验收结果和阻塞项。

约定如下：

- 设计与验收口径以 `PLAN-v2.md` 为准
- 任务状态、执行顺序、完成记录以本文件为准
- 本轮产品名、CLI 展示名、文档对外名称统一采用 `create-x-app`
- npm 发布包名沿用已发布且有权限的 `create-x-app-cli`
- 遇到 Bug 不做补丁式修复，直接定位根因并做完整解决
- 业务核心、复杂流程或难理解代码块，补充结构化注释说明

## 当前基线

### 历史能力基线（已完成）

- [x] 当前仓库已具备可运行的 CLI 主链路
- [x] 已支持 `react-vite-ts`、`node-ts`、`java-fullstack` 三套模板
- [x] 已具备环境检测、交互问答、模板渲染、点文件恢复、依赖安装、Git 初始化
- [x] 曾建立基础单元测试：`version`、`resolver`、`generator`、`logger`

### 当前待收敛项

- [x] npm 包名已按发布权限保留为 `create-x-app-cli`，CLI 展示名保留 `create-x-app`
- [x] 现有模板的 resolver / prompts / validator 已切换到 manifest 驱动
- [x] 包管理器命令已抽离到统一适配层，模板 package.json 已写入 `packageManager`
- [x] 曾建立集成测试框架、快照基线和 CI 工作流；测试文件与测试脚本已按维护要求清除

## 状态标记说明

- `[ ]` 未开始
- `[→]` 进行中
- `[x]` 已完成
- `[!]` 被阻塞

## 本轮推荐执行顺序

1. `TASK-000`
2. `TASK-003 Part A`
3. `TASK-001`
4. `TASK-002`
5. `TASK-003 Part B`
6. `TASK-101 -> TASK-105`
7. `TASK-106`
8. `TASK-201 -> TASK-204`
9. `TASK-301 -> TASK-302`
10. `TASK-G01 -> TASK-G03`

## Phase 0 — 工程基础

### [x] TASK-000 命名基线收敛（create-x-app）

输出：
统一 CLI 帮助文案、README、发布文档和共享模板中的产品命名；npm 包名保留 `create-x-app-cli` 用于发布。

验收：
- `package.json` 包名为 `create-x-app-cli`
- CLI 展示名和 `bin.create-x-app` 保持 `create-x-app`
- `node --test`

### [x] TASK-001 选择后强校验（Config Validator）

依赖：
- `TASK-003 Part A`

输出：
- `src/validator/index.js`
- `src/commands/create.js` 接入统一校验层

验收：
- `node --test test/validator.test.js`

### [x] TASK-002 包管理器适配层（PM Adapter）

输出：
- `src/utils/pm-adapter.js`
- `src/steps/post-actions.js` 全量切换为 PM adapter

验收：
- `node --test test/pm-adapter.test.js`
- 生成 `npm` / `pnpm` / `yarn` 项目并验证依赖安装与 Husky 初始化

### [x] TASK-003 Part A 模板 Manifest

输出：
- 现有 3 套模板补齐 `manifest.json`
- `resolver` / `prompts` / `validator` 改为 manifest 驱动
- `requiredPm` 存在时跳过包管理器问答并直接锁定

验收：
- `node --test test/manifest/loader.test.js`
- `node bin/cli.js`
- 新增一个 manifest 后，模板列表自动出现新项

### [x] TASK-003 Part B 集成测试框架

输出：
- `test/integration/runner.js`
- `test/integration/snapshots/`
- 根 `package.json` 新增 `test:integration` / `test:snapshot-update`

验收：
- `npm run test:snapshot-update`
- `npm run test:integration`

## Phase 1 — 模板扩展

统一规则：

- 新增模板时只在 `templates/<key>/` 目录内实现模板文件和 `manifest.json`
- Phase 1 模板任务不直接修改 `resolver.js` / `prompts.js` / `validator.js`
- 新模板 extras 必须在模板目录内自洽实现，不复用历史 `templates/extras/*` 全局覆盖逻辑
- 每完成一个模板任务，都要更新 snapshot 并执行集成测试

### [x] TASK-101 React 后台管理系统（react-admin）

输出：
- 新增 `templates/react-admin/`
- 支持登录页、主布局、权限路由、Axios 拦截器、Zustand 鉴权状态
- 模板 extras 支持通过 manifest `artifacts` 清理未启用的模板内产物

验收：
- `node bin/cli.js test-admin`
- `cd test-admin && npm install && npm run build`
- `npm run test:snapshot-update`
- `npm run test:integration`

完成记录（2026-04-22）：
- 已新增 `react-admin` manifest、页面骨架、权限路由、鉴权 store、请求层与后台布局
- 已修复懒加载路由类型与未使用导入导致的 `tsc` 构建失败
- 已将未启用 inline extra 的文件产物统一收敛到生成器裁剪阶段
- 已通过 `node --test`
- 已通过 `npm run test:snapshot-update`
- 已通过 `npm run test:integration`

### [x] TASK-102 Electron 桌面应用（electron-app）

输出：
- 新增 `templates/electron-app/`
- 通过 `subPrompts.renderer` 选择 Vue 3 或 React 渲染进程
- 完成 IPC 系统信息示例

验收：
- `node bin/cli.js test-electron`
- `cd test-electron && npm install && npm run build`
- `npm run test:integration`

完成记录（2026-04-22）：
- 已新增 `electron-app` manifest、主进程、preload、IPC handler、Vue/React 双渲染层模板和打包配置
- 已为生成器补齐 `subPromptArtifacts` 通用裁剪能力，用于根据子问答删除未选中的模板分支文件
- 已修复子问答配置未透传到 EJS 渲染上下文的主链路问题
- 已通过 `node --test`
- 已通过 `npm run test:snapshot-update`
- 已通过 `npm run test:integration`

### [x] TASK-103 Chrome 浏览器插件（chrome-ext）

输出：
- 新增 `templates/chrome-ext/`
- Manifest V3 + popup/content/background 三入口

验收：
- `node bin/cli.js test-ext`
- `cd test-ext && npm install && npm run build`
- `npm run test:integration`

完成记录（2026-04-22）：
- 已新增 `chrome-ext` manifest、Chrome 扩展 `manifest.json.ejs`、popup/content/background 三入口模板
- 已通过 popup -> content script -> response 的消息通信链路示例实现页面标题高亮反馈
- 已通过独立 post-build 脚本将生成后的扩展 `manifest.json` 注入 `dist/`
- 已修复 `validator.test` 临时 manifest 与 `loadAllManifests()` 并发读写冲突的测试隔离问题
- 已通过 `node --test`
- 已通过 `npm run test:snapshot-update`
- 已通过 `npm run test:integration`

### [x] TASK-104 全栈 Monorepo（monorepo）

输出：
- 新增 `templates/monorepo/`
- `requiredPm = pnpm`
- Turborepo + pnpm workspace + web/api/shared 三包

验收：
- `node bin/cli.js test-mono`
- `cd test-mono && pnpm install && pnpm build`
- `npm run test:integration`

完成记录（2026-04-22）：
- 已新增 `monorepo` manifest、pnpm workspace、Turbo 配置、web/api/shared 三包结构
- 已为 PM adapter 增加 `pnpm/yarn -> corepack` 回退能力，解决当前环境无独立 `pnpm` 二进制时的执行问题
- 已统一将生成项目的 `packageManager` 字段从 `@latest` 收敛为明确 semver，修复 corepack 严格校验失败
- 已为 `monorepo` 增加 `build-workspace.mjs`，实现“Turbo 优先，corepack 兜底”的构建编排
- 已通过 `node --test`
- 已通过 `npm run test:snapshot-update`
- 已通过 `npm run test:integration`

### [x] TASK-105 移动端 H5（mobile-h5）

输出：
- 新增 `templates/mobile-h5/`
- Vue 3 + Vant + rem 自适应

验收：
- `node bin/cli.js test-h5`
- `cd test-h5 && npm install && npm run build`
- `npm run test:integration`

完成记录（2026-04-22）：
- 已新增 `mobile-h5` manifest、Vue Router、Vant 页面骨架、rem 自适应工具和请求 composable
- 已接入 `postcss-pxtorem` 与 `unplugin-vue-components + @vant/auto-import-resolver`
- 已修复 `Home.vue` 中 `Ref<T | null>` 直接在模板空值合并导致的 `vue-tsc` 类型推断错误
- 已通过 `node --test`
- 已通过 `npm run test:snapshot-update`
- 已通过 `npm run test:integration`

### [x] TASK-106 全量回归验证

输出：
- 完成 Phase 0 + Phase 1 全量回归

验收：
- `node --test`
- `npm run test:integration`
- `node bin/cli.js`

完成记录（2026-04-22）：
- 已通过 `node --test`
- 已通过 `npm run test:integration`
- 已完成 CLI 交互核验：
- 模板列表显示 8 项（3 个历史模板 + 5 个新增模板）
- 选择 `electron-app` 后会出现 `renderer` 子问答，默认 `Vue 3 + TypeScript`
- 选择 `monorepo` 后不会再询问包管理器，确认面板直接锁定 `pnpm`
- 选择 `chrome-ext` 时包管理器问答仅保留 `npm / pnpm`，`yarn` 在交互层被屏蔽，validator 继续保留兜底校验

## Phase 2 — 智能能力

### [x] TASK-201 远程模板拉取（--remote）

输出：
- `src/remote/template-fetcher.js`
- `resolveTemplate` 支持 `--remote` 远端增强与失败回退本地

验收：
- `node --input-type=module -e "import { resolveTemplate } from './src/steps/resolver.js'; console.log(await resolveTemplate('react-vite-ts'))"`
- `node --input-type=module -e "import { resolveTemplate } from './src/steps/resolver.js'; console.log(await resolveTemplate('react-vite-ts', { remote: true, noCache: true }))"`
- `node --input-type=module -e "globalThis.fetch = async () => { throw new Error('mock offline') }; const { resolveTemplate } = await import('./src/steps/resolver.js'); console.log(await resolveTemplate('react-vite-ts', { remote: true, noCache: true }))"`

完成记录（2026-05-18）：
- 已新增 `src/remote/template-fetcher.js`，支持 GitHub Contents API 递归下载模板
- 已实现 `~/.create-x-app/cache/templates` 下 24 小时远端模板缓存
- 已新增 `--remote` 与 `--no-cache` CLI 选项
- 已将 `resolveTemplate` 切换为异步，并支持远端失败回退本地模板
- 已通过 `npm run lint`
- 已通过本地解析、远端拉取和模拟断网回退验证

### [x] TASK-202 依赖版本刷新（--latest）

输出：
- `src/utils/pkg-version.js`
- 生成器支持读取模板基线版本并在 `--latest` 时刷新

验收：
- 默认生成器调用保留模板基线版本
- `options.latest = true` 时刷新 npm latest 版本
- 模拟断网时 `options.latest = true` 回退模板基线版本

完成记录（2026-05-18）：
- 已新增 `src/utils/pkg-version.js`，并发查询 npm registry latest 版本
- 已新增 `--latest` CLI 选项
- 生成器会扫描已渲染 `package.json`，只刷新当前用户选择后真实存在的依赖
- 依赖版本拉取失败时按包粒度回退基线版本，不阻断项目生成
- 已通过 `npm run lint`
- 已通过默认基线、latest 刷新和模拟断网回退验证

### [x] TASK-203 项目升级命令（upgrade）

输出：
- `src/commands/upgrade.js`
- `src/upgrade/detector.js`
- `src/upgrade/differ.js`
- `src/upgrade/applier.js`

验收：
- 生成项目写入 `cxa-template` / `cxa-version`
- detector 能识别 `react-vite-ts`
- differ 能识别 `tsconfig.json` 配置差异
- 应用模板内容后配置文件恢复正确
- 无差异生成项目执行 `node bin/cli.js upgrade` 正常退出

完成记录（2026-05-18）：
- 已新增 `src/commands/upgrade.js`
- 已新增 `src/upgrade/detector.js`，支持 package 标记与依赖启发式识别模板
- 已新增 `src/upgrade/differ.js`，仅比较脚手架配置白名单文件
- 已新增 `src/upgrade/applier.js`，支持覆盖、跳过、查看 diff 后再决定
- 已在生成器中写入 `cxa-template` 与 `cxa-version`
- 已通过 `npm run lint`
- 已通过临时项目差异检测、配置应用和无差异 upgrade 命令验证
- 已通过真实交互验证：查看 diff 后选择覆盖，配置文件正确恢复

### [x] TASK-204 插件系统（Plugin API）

输出：
- `src/plugins/loader.js`
- `src/plugins/registry.js`
- 内置模板与社区插件模板统一注册

验收：
- 本地 `npm link` 测试插件
- 运行 `node /path/to/bin/cli.js test-plugin`

完成记录（2026-05-18）：
- 已新增 `src/plugins/loader.js`，扫描当前目录和全局 `node_modules` 中的 `cxa-plugin-*` 插件
- 已新增 `src/plugins/registry.js`，合并内置模板与插件模板
- 已将 `src/manifest/loader.js` 切换到统一 registry
- 已将 `resolver` 改为使用 manifest 中的 `templatePath`，插件模板不走远端拉取
- 已通过 `npm run lint`
- 已通过本地 `npm link` 插件验收：插件显示为 `[插件] 测试模板`，能正确生成项目
- 已通过插件卸载后消失验证，内置模板保持正常

## Phase 3 — 生态建设

### [ ] TASK-301 匿名使用统计

输出：
- `src/analytics/consent.js`
- `src/analytics/index.js`

验收：
- 删除 `~/.create-x-app/config.json`
- `node bin/cli.js test-analytics`
- `node bin/cli.js --no-telemetry`

### [ ] TASK-302 社区模板市场

输出：
- `search` / `install` / `list` / `remove` 命令
- `src/marketplace/client.js`

验收：
- `npx create-x-app-cli search`
- `npx create-x-app-cli install cxa-plugin-test`
- `npx create-x-app-cli remove cxa-plugin-test`

## 全局任务

### [x] TASK-G01 测试链路处理

要求：
- Phase 1 执行期间曾同步补充单元测试、集成测试和快照
- 2026-05-18 已按维护要求清除测试文件和测试脚本
- 后续若恢复自动化测试，需要重新建立 `node:test` 与集成测试入口

### [x] TASK-G02 文档同步更新

要求：
- 每个 Phase 结束后更新 `AGENTS.md`
- 同步更新 `README.md`
- 插件规范统一以 `manifest.json` 为准

### [→] TASK-G03 版本发布

要求：
- Phase 0 + Phase 1 完成后发布 `v0.2.0`
- Phase 2 完成后发布 `v0.3.0`
- Phase 3 完成后发布 `v1.0.0`

发布前固定执行：
- `npm run lint`
- `node bin/cli.js --help`
- `npm pack --dry-run`

## 本轮执行记录

- [x] 已完成：`PLAN-v2.md` 与 `IMPLEMENTATION_TODO.md` 命名和任务结构对齐
- [x] 已完成：`TASK-000` 命名基线收敛，npm 包名按发布权限保留为 `create-x-app-cli`
- [x] 已验证：`node --test`
- [x] 已完成：`TASK-003 Part A`，现有三套模板已补齐 `manifest.json`
- [x] 已完成：`TASK-001`，create 主流程已接入统一配置校验
- [x] 已完成：`TASK-002`，post-actions 已切换到 PM adapter，模板已写入 `packageManager`
- [x] 已验证：`node --test test/manifest/loader.test.js test/validator.test.js test/pm-adapter.test.js`
- [x] 已验证：`node --test`
- [x] 已完成：`TASK-003 Part B`，新增 `test:integration`、`test:snapshot-update`、快照文件与 CI 工作流
- [x] 已验证：`npm run test:snapshot-update`
- [x] 已验证：`npm run test:integration`
- [x] 已完成：`TASK-101` 到 `TASK-106`，Phase 1 五套新增模板与全量回归已完成
- [x] 已完成：按维护要求清除测试文件和测试脚本
- [x] 已验证：`npm run lint`
- [x] 已验证：`node bin/cli.js --help`
- [x] 已验证：`npm pack --dry-run`
- [x] 已完成：`create-x-app-cli@0.2.0` 已发布并完成发布后验证
- [x] 已完成：`TASK-201`，远程模板拉取、缓存和失败回退链路已完成
- [x] 已完成：`TASK-202`，依赖版本 latest 刷新和失败回退链路已完成
- [x] 已完成：`TASK-203`，项目配置升级命令已完成
- [x] 已完成：`TASK-204`，插件系统（Plugin API）已完成
- [x] 已完成：Phase 2 智能能力全部任务
- [x] 已完成：`v0.3.0` 版本号与发布文档收口
- [x] 已验证：`npm install --package-lock-only`
- [x] 已验证：`npm run lint`
- [x] 已验证：`node bin/cli.js --help`
- [x] 已验证：`node bin/cli.js upgrade --help`
- [x] 已验证：`npm pack --dry-run`
- [→] 当前：等待执行 `npm publish --access public --otp=<一次性验证码>`
- [ ] 下一步：发布后执行 `npm view create-x-app-cli version` 与 `npx create-x-app-cli my-first-project` 验证

## 当前约定

- 若无额外说明，默认按本文件的任务顺序推进
- 每完成一项任务，立即回填状态、验收命令和结论
