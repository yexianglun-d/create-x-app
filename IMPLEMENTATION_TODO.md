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

### [x] TASK-301 匿名使用统计

输出：
- `src/analytics/consent.js`
- `src/analytics/index.js`

验收：
- 删除 `~/.create-x-app/config.json`
- `node bin/cli.js test-analytics`
- `node bin/cli.js --no-telemetry`

完成记录：
- 已新增 `src/analytics/consent.js`，负责一次性同意提示、`~/.create-x-app/config.json` 持久化和 `--no-telemetry` 单次跳过
- 已新增 `src/analytics/index.js`，负责 2 秒超时的匿名上报；payload 仅包含模板 key、CLI 版本、Node 版本和 OS 类型
- 默认不硬编码未知采集端，实际上报端点通过 `CREATE_X_APP_TELEMETRY_ENDPOINT` 配置
- 已验证：`npm run lint`
- 已验证：`node bin/cli.js --help`
- 已验证：临时 HOME 下 `--no-telemetry` 不写入配置
- 已验证：已有同意配置可被读取
- 已验证：本地 HTTP endpoint 可收到匿名 payload

### [x] TASK-302 社区模板市场

输出：
- `search` / `install` / `list` / `remove` 命令
- `src/marketplace/client.js`

验收：
- `npx create-x-app-cli search`
- `npx create-x-app-cli install cxa-plugin-test`
- `npx create-x-app-cli remove cxa-plugin-test`

完成记录：
- 已新增 `search` / `install` / `list` / `remove` 命令并接入 CLI help
- 已新增 `src/marketplace/client.js`，通过 npm registry 搜索 `cxa-plugin-*` 插件并展示名称、描述、周下载量
- 已新增 `src/marketplace/npm.js`，统一执行全局 npm 插件安装和移除
- 已扩展插件 loader，`list` 复用当前目录和全局 `node_modules` 扫描结果
- 已验证：`npm run lint`
- 已验证：`node bin/cli.js --help`
- 已验证：`node bin/cli.js search --help`
- 已验证：`node bin/cli.js install --help`
- 已验证：`node bin/cli.js list --help`
- 已验证：`node bin/cli.js remove --help`
- 已验证：`node bin/cli.js search --limit 5`
- 已验证：本地 mock registry 可返回并过滤 `cxa-plugin-*`
- 已验证：临时 `npm link` 插件可被 `node bin/cli.js list` 识别，随后已卸载清理
- 已验证：`node bin/cli.js install react` 会拒绝非插件包名

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
- [x] 已完成：`create-x-app-cli@0.3.0` 已发布
- [x] 已验证：`npm view create-x-app-cli version` 返回 `0.3.0`
- [x] 已完成：`TASK-301`，匿名使用统计已完成
- [x] 已完成：`TASK-302`，社区模板市场已完成
- [x] 已完成：Phase 3 生态建设全部任务
- [x] 已完成：`v1.0.0` 版本号与发布文档收口
- [x] 已验证：`npm install --package-lock-only`
- [x] 已验证：`npm run lint`
- [x] 已验证：`node bin/cli.js --help`
- [x] 已验证：`node bin/cli.js upgrade --help`
- [x] 已验证：`node bin/cli.js search --help`
- [x] 已验证：`node bin/cli.js install --help`
- [x] 已验证：`node bin/cli.js list --help`
- [x] 已验证：`node bin/cli.js remove --help`
- [x] 已验证：`npm pack --dry-run`
- [x] 已完成：`create-x-app-cli@1.0.0` 已发布
- [x] 已验证：`npm view create-x-app-cli version` 返回 `1.0.0`
- [x] 已验证：`npx -y create-x-app-cli --version` 返回 `1.0.0`
- [x] 已验证：`npx -y create-x-app-cli cxa-smoke --skip-install --skip-git --no-telemetry` 可生成项目
- [x] 已发现并修复：`chrome-ext` 模板 lint 脚本误指向不存在的 `popup` 目录，已改为 `eslint src --ext .ts,.tsx --report-unused-disable-directives`
- [x] 已验证：本地修复版生成 `chrome-ext` 后，`npm install`、`npm run build`、`npm run lint` 均通过
- [x] 已完成：新增 `examples/cxa-plugin-example` 示例插件
- [x] 已验证：`cxa-plugin-example` 包名当前 npm registry 返回 404，可用于发布
- [x] 已验证：`examples/cxa-plugin-example` 执行 `npm pack --dry-run` 通过
- [x] 已验证：`cxa-plugin-example` 通过 `npm link` 后可被 `node bin/cli.js list` 识别
- [x] 已验证：`cxa-plugin-example` 可通过生成器生成项目并运行 `node src/index.js`
- [x] 已清理：已执行 `npm uninstall -g cxa-plugin-example`
- [x] 已完成：`v1.0.1` patch 发布前收口
- [x] 已完成：`v1.0.1` 版本号与发布文档收口
- [x] 已验证：`npm install --package-lock-only`
- [x] 已验证：`npm run lint`
- [x] 已验证：`node bin/cli.js --help`
- [x] 已验证：`node bin/cli.js --version` 返回 `1.0.1`
- [x] 已验证：根包 `npm pack --dry-run` 产物为 `create-x-app-cli@1.0.1`
- [x] 已验证：示例插件 `npm pack --dry-run` 产物为 `cxa-plugin-example@0.1.0`
- [x] 已完成：本地提交并推送 `fix: prepare v1.0.1 smoke fixes`
- [x] 已完成：`create-x-app-cli@1.0.1` 已发布
- [x] 已验证：`npm view create-x-app-cli version` 返回 `1.0.1`
- [x] 已验证：`npx -y create-x-app-cli --version` 返回 `1.0.1`
- [x] 已验证：`npx -y create-x-app-cli cxa-v101-smoke --skip-install --skip-git --no-telemetry` 可生成项目
- [x] 已验证：发布后生成的 `chrome-ext` 项目执行 `npm install`、`npm run build`、`npm run lint` 均通过
- [x] 已完成：恢复 `node:test` 单元测试、模板集成测试、CLI smoke 测试和 GitHub Actions CI
- [x] 已完成：模板 ESLint 配置统一迁移到 ESLint 9 flat config 体系，并保留 `.eslintrc.json` 升级兼容识别
- [x] 已完成：新增插件 manifest 校验、安装前 npm metadata 预检、搜索结果更新时间展示和插件开发文档
- [x] 已完成：新增主包 release workflow 与示例插件 release workflow
- [x] 已验证：`npm run lint`
- [x] 已验证：`npm test`
- [x] 已验证：`CXA_SKIP_TEMPLATE_INSTALL=1 npm run test:snapshot-update`
- [x] 已验证：`CXA_SKIP_TEMPLATE_INSTALL=1 npm run test:integration`
- [x] 已验证：`npm run test:integration`，8 套模板均完成 install / build / lint
- [x] 已验证：`npm run test:smoke`
- [x] 已验证：示例插件 `npm pack --dry-run` 产物只包含 `manifest.json`、`template`、`README.md` 与必要 package 元数据
- [!] 后续确认：`cxa-plugin-example` 当前 npm registry 返回 404，可发布；但当前本机 `npm whoami` 返回 `E401 Unauthorized`，需要登录 npm 后执行发布和真实市场闭环验证
- [→] 已开始：`create_x_app_repair_plan_v1.md` 稳定性修复批次
- [x] 已完成：`CXA-FIX-005`，`--skip-install` 现在会跳过依赖安装和 Husky 初始化，Husky hook 权限改为平台感知处理
- [x] 已完成：`CXA-FIX-010`，生成后 next steps 改为只展示实际存在的项目文档，并从 manifest 读取 dev script
- [x] 已完成：`CXA-FIX-002` 基础非交互模式，支持 `--template`、`--pm`、`--features`、`--extras`、`--yes`、`--cwd`、`--target`、`--print-config`
- [x] 已完成：`CXA-FIX-004` 第一阶段目录安全策略，支持 `--dry-run` 不写入和 `--force` 显式覆盖；非空目录默认拒绝
- [x] 已完成：`CXA-FIX-003` 第一阶段 manifest schema 化，新增 `schemas/manifest.schema.json`，模板 manifest 补齐 `schemaVersion`、`features`、`upgrade.managedFiles`
- [x] 已完成：生成器、问答、配置校验和 upgrade diff 改为读取 manifest feature artifacts、extra metadata 和 managed files
- [x] 已完成：`CXA-FIX-006A`，远程模板支持 `--ref`、`--strict-remote`，缓存按 `template + ref + commit` 隔离
- [x] 已完成：`CXA-FIX-006B`，生成项目写入 `.create-x-app/template-lock.json`，记录模板来源、ref、commit、CLI 版本和选择项
- [x] 已完成：`CXA-FIX-007A`，插件安装前展示包元信息、CLI API 兼容性、license、repository、npm lifecycle 脚本等风险摘要
- [x] 已完成：`CXA-FIX-007B`，新增 `create-x-app plugin doctor`，已安装插件可诊断 manifest、兼容性和健康度
- [x] 已完成：`CXA-FIX-009`，环境检测拆分为 CLI Node 基础检测和选定模板后的 manifest requirements 检测，React/npm 不再提示 Java/pnpm
- [x] 已完成：`CXA-FIX-011`，新增 `--deps baseline/latest-patch/latest-minor/latest-major/latest`，默认保持 baseline，`--latest` 作为兼容别名
- [x] 已完成：`CXA-FIX-012`，新增 `create_start/create_success/*_failed` 阶段事件和 `telemetry status/on/off`，失败事件仅包含阶段与错误类别
- [x] 已完成：`CXA-FIX-008`，新增 `.create-x-app/project.json`、`files.json`、upgrade ownership/hash 判断、backup、`--check/--diff/--apply`
- [x] 已完成：`CXA-FIX-013`，新增 `--preset`，支持内置 preset、本地 JSON 和 `github:owner/repo/path#ref`
- [x] 已完成：`CXA-FIX-014`，新增 `template lint/test/pack` 与 `plugin init` 模板作者工具链
- [x] 已完成：`CXA-FIX-015`，新增可选 `ai-native` feature，按需注入 Cursor、Claude、Copilot、MCP、ADR 和 Prompt 文件
- [!] 外部阻塞：`cxa-plugin-example` 当前 npm registry 仍返回 404；代码、workflow 和文档已补齐，仍需 npm 登录后发布并执行真实 `search/install/list/create/remove` 闭环
- [ ] 下一步：发布示例插件后执行真实 npm 市场闭环验证，并视情况发布主包 patch 版本

## 当前约定

- 若无额外说明，默认按本文件的任务顺序推进
- 每完成一项任务，立即回填状态、验收命令和结论

## Phase 4 — 模板实用化重构

目标：
保留当前 8 套内置模板，但把生成项目从“技术演示页 / 脚手架说明页”重构为各行业都能直接二次开发的业务启动包。去 AI 化边界限定为生成 UI/UX 和业务文案去模板感，不删除仓库协作规则，也不强制移除可选 `ai-native` 功能。

统一验收口径：

- 生成页面不出现 `create-x-app` badge、欢迎模板、示例接口、编辑某文件开始开发等模板自述内容
- 每套模板至少包含真实业务场景、真实命名、列表 / 表单 / 状态流，以及 loading / error / empty / success 中的必要状态
- Web / H5 / Admin / Monorepo / Java 前端首屏无明显重叠、移动端可用
- 8 套模板都通过生成、安装、构建和 lint；`java-fullstack` 额外通过 Maven 编译或测试
- 保留 manifest、remote、upgrade provenance、插件发现和模板作者工具链的兼容性

### [x] TASK-401 模板实用化规则与内容去模板感

输出：
- 更新模板 UI / 文案基线，移除应用页面中的模板自述
- 更新共享 README 生成内容，保留来源说明但不把脚手架卖点写进应用体验
- 增加生成内容扫描口径

验收：
- `rg "create-x-app|欢迎使用|示例接口|编辑 src|模板" <generated-project>` 仅允许 README、`.create-x-app` 元数据和开发协作文档中的合理来源说明
- 已完成：共享 README 已降噪，集成测试新增应用内容扫描，应用源码 / 页面文案禁止模板自述命中

### [x] TASK-402 React / Admin / H5 前端模板业务化

输出：
- `react-vite-ts` 改为轻量业务工作台
- `react-admin` 改为通用运营后台，包含客户 / 工单 / 审批等真实业务面
- `mobile-h5` 改为报名 / 预约 / 活动转化页

验收：
- 生成默认项目并执行 install / build / lint
- 浏览器检查桌面和移动首屏，无模板自述、无明显布局重叠
- 已完成：`react-vite-ts`、`react-admin`、`mobile-h5` 已改为真实业务场景；集成测试默认矩阵通过
- 已完成：额外验证 `react-vite-ts` 的 `react-router + tailwind` 组合与 `react-admin` 的 `tailwind + i18n` 组合均 install / build / lint 通过
- 已完成：浏览器打开默认 React 模板首屏，DOM 检查 `forbiddenHits=[]`

### [x] TASK-403 Node / Monorepo API 模板业务化

输出：
- `node-ts` 默认转为实用 API starter，Express / Dotenv 默认开启
- `monorepo` 的 `web/api/shared` 围绕同一套客户 / 任务类型联动

验收：
- 生成默认项目并执行 install / build / lint
- API 返回结构、前端请求和共享类型一致
- 已完成：`node-ts` 默认开启 Express / Dotenv，提供健康检查与客户事项 API；`monorepo` 的 web / api / shared 围绕同一业务类型联动
- 已完成：`npm run test:integration` 覆盖默认生成、安装、构建和 lint

### [x] TASK-404 Java 全栈模板升级为真实 Spring Boot 后端

输出：
- `java-fullstack` 生成 Spring Boot 3 + Java 21 + Maven 后端
- 提供 Controller / Service / Repository / Entity / DTO / 统一响应结构
- 前端通过 `/api` 代理联调后端

验收：
- 生成项目后 `frontend` install / build / lint 通过
- 后端 `mvn test` 或等价 Maven 编译测试通过
- 已完成：`java-fullstack` 已生成 Spring Boot 3 + Java 21 + Maven 后端，包含 Controller / Service / Repository / Entity / DTO / 统一响应结构
- 已完成：集成测试新增 Maven workspace 验证，`npm run test:integration` 中 `backend` 执行 `mvn test` 通过

### [x] TASK-405 Electron / Chrome Extension 模板业务化

输出：
- `electron-app` 改为本地工作台工具，提供文件选择、批处理清单和本地状态保存
- `chrome-ext` 改为网页采集 / 笔记插件，捕获标题、URL、选中文本并保存到 `chrome.storage.local`

验收：
- 生成默认项目并执行 install / build / lint
- Electron Vue / React 分支都能构建
- Chrome MV3 manifest、content、background、popup 构建产物完整
- 已完成：`electron-app` 已改为本地批处理工作台，支持文件选择、清单状态和本地保存；Vue / React 渲染分支均可构建
- 已完成：`chrome-ext` 已改为网页采集 / 笔记插件，使用 `activeTab`、content script 和 `chrome.storage.local`
- 已完成：额外验证 Electron React 分支 install / build / lint 通过

### [x] TASK-406 全量回归与发布前检查

输出：
- 更新集成测试快照
- 完成全量 lint / unit / smoke / integration 验证
- 完成至少一轮生成项目内容扫描

验收：
- `npm run lint`
- `npm run test:unit`
- `npm run test:smoke`
- `npm run test:integration`
- 生成内容扫描通过
- 已完成：`npm run lint` 通过
- 已完成：`npm run test:unit` 通过
- 已完成：`npm run test:smoke` 通过
- 已完成：`npm run test:integration` 通过，8 套模板默认矩阵均生成、安装、构建、lint；`java-fullstack` 额外 `mvn test` 通过
- 已完成：`CXA_SKIP_TEMPLATE_INSTALL=1 npm run test:snapshot-update` 已更新集成测试快照
