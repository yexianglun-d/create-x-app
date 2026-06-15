# create-x-app CLI 脚手架修复与迭代整改方案

**审查对象**：`yexianglun-d/create-x-app`  
**仓库地址**：https://github.com/yexianglun-d/create-x-app  
**审查日期**：2026-06-15  
**文档版本**：v1.0  
**定位**：把前一轮审查结论转化为可执行的修复计划、PR Backlog 和验收清单。

---

## 1. 执行摘要

`create-x-app` 已具备一个多模板 Node.js CLI 脚手架的主链路：交互式创建、模板 Manifest、环境检测、依赖安装、Git 初始化、远程模板、升级命令、插件市场和匿名统计均已有实现或雏形。项目 README 对外定位为“适合团队沉淀工程规范的脚手架基础设施”。

但从生产级 CLI 脚手架的标准看，当前最需要修复的不是继续增加模板数量，而是补齐可靠性、安全性、自动化和可复现能力。尤其是测试与发布门禁、非交互模式、Manifest 驱动边界、目录覆盖安全、远程模板供应链、插件健康度，以及升级机制都需要系统性整改。

**总体策略**：先修地基，再扩能力。短期目标是把项目从“功能可演示”提升到“团队敢用、CI 能跑、发布可控、回滚有据”。

### 1.1 最高优先级结论

| 优先级 | 修复主题 | 为什么必须先做 |
|---|---|---|
| P0 | 测试与发布门禁 | CLI 会写文件、安装依赖、初始化 Git；没有自动化测试会放大模板回归风险。 |
| P0 | 非交互模式 | 没有 `--template --pm --yes`，就很难进入 CI、自动化、团队文档和 smoke test。 |
| P0 | Manifest schema 化 | 现在仍有硬编码规则，后续模板和插件会不断增加维护成本。 |
| P0 | 目录安全策略 | 非空目录确认后直接清空，缺少 dry-run、backup、force 语义。 |
| P0 | 远程模板与插件安全 | 远程 main 分支漂移，插件依赖 npm 包信任边界，供应链控制不足。 |
| P0 | `--skip-install` 语义修复 | 选择 Husky 时会绕过用户跳过安装意图，且 Windows 下 `chmod` 有兼容风险。 |

---

## 2. 审查依据

本整改方案基于以下公开文件和源码模块做静态审查。未进行本地 clone 后的完整运行验证，因此本文的验收项应作为后续 PR 的实际验证门槛。

| 类别 | 依据 |
|---|---|
| 产品定位与功能 | README.md：项目定位、8 套内置模板、远程模板、插件生态、匿名统计、命令参考。 |
| 包元数据 | package.json：包名、版本、Node engines、bin、scripts、依赖列表。 |
| CLI 入口 | bin/cli.js：现有命令与 options。 |
| 创建主流程 | src/commands/create.js：环境检测、prompt、validate、resolve、generate、post-actions、telemetry。 |
| 生成器 | src/generator/index.js：模板复制、EJS 渲染、点文件恢复、extras、裁剪、latest 依赖刷新。 |
| 环境检测 | src/steps/env-check.js：Node/Git/pnpm/Java 固定检测。 |
| 后置动作 | src/steps/post-actions.js：依赖安装、Husky、Git 初始化、next steps。 |
| 校验器 | src/validator/index.js：包管理器与模板/extra 组合校验。 |
| 远程模板 | src/remote/template-fetcher.js 与 resolver：GitHub Contents API、main 分支、24 小时缓存、失败回退。 |
| 插件生态 | src/plugins/loader.js 与 src/marketplace/client.js：插件扫描、npm 搜索、周下载量。 |
| 升级命令 | src/upgrade/applier.js：diff 后覆盖/跳过。 |
| 计划记录 | IMPLEMENTATION_TODO.md：历史测试、集成测试、快照和 CI 曾建立但后续被清除的记录。 |

---

## 3. 整改优先级定义

| 优先级 | 定义 | 进入标准 | 退出标准 |
|---|---|---|---|
| P0 | 可信度与安全地基 | 会影响生成正确性、数据安全、自动化或供应链边界。 | 有测试、有验收、有文档、有回滚策略。 |
| P1 | 可用性与维护效率 | 不一定阻断发布，但会影响团队使用体验和长期维护。 | 功能完整、边界明确、文档可执行。 |
| P2 | 平台化增强 | 面向生态、企业化、AI-native 或模板作者体验。 | 可独立发布，不拖累核心链路。 |

---

## 4. P0 修复项

### CXA-FIX-001：恢复测试体系与发布门禁

**问题**：`package.json` 当前 scripts 只包含 `dev` 和 `lint`。实施记录中也能看到历史曾建立 `node:test`、集成测试、快照和 CI，但后续测试文件与脚本被清除。这会导致 8 套模板、插件、远程模板、升级命令等功能缺少持续回归保障。

**风险**：

- 模板依赖升级或 EJS 条件渲染变更后，可能生成不可安装、不可构建的项目。
- Windows/macOS/Linux 差异不会被发现。
- `npm pack` 可能漏带模板、shared 文件或 bin 文件。
- release 只能依赖人工记忆，无法规模化维护。

**修复目标**：建立最小但有效的质量门禁：单测、集成测试、全模板 smoke、发布包检查和 GitHub Actions 矩阵。

**建议新增 scripts**：

```json
{
  "scripts": {
    "dev": "node bin/cli.js",
    "lint": "eslint src",
    "test": "node --test",
    "test:unit": "node --test test/unit/*.test.js",
    "test:integration": "node --test test/integration/*.test.js",
    "test:snapshot-update": "node scripts/update-template-snapshots.js",
    "smoke": "node scripts/smoke-all-templates.js",
    "pack:check": "npm pack --dry-run",
    "release:check": "npm run lint && npm test && npm run smoke && npm run pack:check"
  }
}
```

**最小测试覆盖**：

| 模块 | 测试类型 | 必测点 |
|---|---|---|
| manifest loader | unit | 内置模板可加载、缺字段报错、插件 manifest 校验。 |
| validator | unit | monorepo/pnpm、forbiddenPm、extras/framework 组合。 |
| pm-adapter | unit | npm/pnpm/yarn install、dlx、corepack 回退。 |
| generator | integration/snapshot | 点文件恢复、EJS 渲染、feature/extras 裁剪、metadata。 |
| resolver/remote | unit/integration | 本地、远程、no-cache、远程失败回退、strict 模式。 |
| plugin loader | unit | scoped/unscoped 插件、非法包名、缺 template/manifest。 |
| upgrade | unit/integration | 检测、diff、skip/overwrite、备份。 |
| post-actions | integration | skip install、husky、git 初始化失败降级。 |

**CI 矩阵建议**：

| 维度 | 值 |
|---|---|
| Node.js | 18.x / 20.x / 22.x |
| OS | ubuntu-latest / macos-latest / windows-latest |
| 包管理器 | npm / pnpm / yarn |
| 模板 | 8 套内置模板全部 smoke |
| 发布检查 | `npm pack --dry-run`，检查 tarball 文件清单。 |

**验收标准**：

```bash
npm run lint
npm test
npm run smoke
npm run pack:check
npm run release:check
```

所有命令在 Linux、macOS、Windows 至少一个 CI 矩阵中通过。任何新增模板必须补 snapshot 与 smoke case。

---

### CXA-FIX-002：新增非交互式创建模式

**问题**：CLI 当前 options 主要是 `--skip-install`、`--skip-git`、`--remote`、`--no-cache`、`--latest`、`--no-telemetry`、`--verbose`、`--debug`。创建主流程固定调用 `runPrompts(projectNameArg)`，无法用完整参数绕过交互。

**风险**：

- 不能在 CI 中稳定批量生成项目。
- 不能给团队文档提供一条可复制命令。
- 不能被 DevOps、AI Agent、内部平台无头调用。
- 自动化测试必须模拟交互，复杂且脆弱。

**建议新增参数**：

| 参数 | 说明 |
|---|---|
| `--template <key>` | 直接指定模板。 |
| `--pm <npm\|pnpm\|yarn>` | 指定包管理器。 |
| `--features <list>` | 指定通用功能，如 `eslint,prettier,husky`。 |
| `--extras <list>` | 指定模板扩展，如 `tailwind,react-router`。 |
| `--yes` / `-y` | 使用默认值并跳过确认。 |
| `--cwd <path>` | 指定创建基准目录。 |
| `--target <path>` | 指定目标目录。 |
| `--force` | 明确允许覆盖目标目录。 |
| `--dry-run` | 只打印将写入、覆盖、删除的文件，不真正写入。 |
| `--print-config` | 输出最终配置 JSON，便于调试。 |
| `--preset <name/path/url>` | 加载团队预设。 |

**目标命令示例**：

```bash
npx create-x-app-cli my-app   --template react-vite-ts   --pm pnpm   --features eslint,prettier,agents,coding-rules   --extras tailwind,react-router   --skip-install   --skip-git   --no-telemetry   --yes
```

**实现建议**：

- 把 `runPrompts` 拆成 `buildInteractiveConfig()` 与 `buildConfigFromOptions()`。
- 引入统一的 `normalizeCreateConfig(input)`，无论来自 prompt 还是 CLI options，都走同一套 validate。
- `--yes` 只跳过确认，不应跳过 validate。
- 非交互模式下缺少必要参数时，输出明确错误，而不是退回 prompt。

**验收标准**：

```bash
node bin/cli.js demo   --template react-vite-ts   --pm npm   --features eslint,prettier   --extras tailwind   --skip-install   --skip-git   --no-telemetry   --yes
```

运行期间不得出现任何交互 prompt；生成后 package.json、点文件、extras 和 feature 裁剪结果正确。

---

### CXA-FIX-003：Manifest schema 化并消灭核心硬编码

**问题**：项目文档强调 Manifest 驱动模板能力，但生成器里仍有 `FILE_BASED_EXTRAS`、`FEATURE_ARTIFACTS`、包管理器版本等硬编码；validator 也存在 `monorepo` 与 `react-router` 的特判；`generateProject` 复制实际 `templatePath`，但 manifest 仍通过 `loadManifest(config.template)` 读取。

**风险**：

- 新增 feature 需要同时改 manifest 和 generator，破坏插件可扩展性。
- 远程模板、插件模板和本地 manifest 可能错位。
- 模板数量越多，硬编码规则越多，后续维护复杂度指数上升。

**修复目标**：把模板能力、文件产物、环境要求、包管理器限制、post actions 和升级白名单全部下沉到 manifest，并用 JSON Schema 校验。

**建议 manifest v1 结构**：

```json
{
  "$schema": "https://create-x-app.dev/schemas/manifest-v1.json",
  "schemaVersion": "1.0",
  "key": "react-vite-ts",
  "name": "React + Vite + TypeScript",
  "version": "1.0.1",
  "framework": "react",
  "requirements": {
    "node": ">=18.0.0",
    "git": ">=2.0.0",
    "packageManagers": ["npm", "pnpm", "yarn"]
  },
  "features": {
    "eslint": {
      "label": "ESLint",
      "default": true,
      "artifacts": [".eslintrc.json"]
    },
    "husky": {
      "label": "commitlint + Husky",
      "default": false,
      "artifacts": [".husky", "commitlint.config.js"],
      "postActions": ["husky.install", "husky.chmod"]
    }
  },
  "extras": {
    "tailwind": {
      "label": "Tailwind CSS",
      "mode": "file",
      "source": "extras/tailwind",
      "artifacts": ["tailwind.config.ts", "postcss.config.js"]
    }
  },
  "scripts": {
    "dev": "npm run dev",
    "build": "npm run build"
  },
  "upgrade": {
    "managedFiles": ["tsconfig.json", "vite.config.ts", ".prettierrc"]
  }
}
```

**实现步骤**：

1. 新增 `schemas/manifest.schema.json`。
2. 所有内置模板 manifest 通过 schema 校验。
3. 插件 manifest 使用同一 schema，但允许扩展字段。
4. generator 从 `templatePath/manifest.json` 读取实际模板 manifest。
5. 移除 generator 的 `FEATURE_ARTIFACTS` 和 `FILE_BASED_EXTRAS`。
6. validator 不再按模板 key 特判，而是读取 manifest rules。

**验收标准**：

- 新增一个插件模板不需要改 generator/validator 源码。
- 本地模板、远程模板、插件模板都读取自身目录中的 manifest。
- manifest 不合法时，CLI 给出字段级错误信息。

---

### CXA-FIX-004：改造目标目录安全策略

**问题**：当前目标目录已存在且非空时，用户确认后直接 `emptyDir(targetDir)` 清空。虽然有确认，但缺少 dry-run、文件列表、backup 和 force 语义。

**风险**：

- 用户在错误目录执行命令可能造成不可逆删除。
- 生成失败后无法恢复旧内容。
- CI 与非交互模式下覆盖语义不清晰。

**修复目标**：默认安全，明确破坏性操作，生成过程尽量原子化。

**建议策略**：

| 场景 | 默认行为 | 可选行为 |
|---|---|---|
| 目录不存在 | 创建 | 无需确认 |
| 目录为空 | 写入 | 无需确认 |
| 目录非空，无 `--force` | 拒绝并提示 | 可用 `--dry-run` 查看冲突 |
| 目录非空，有 `--force` | 允许覆盖 | 建议同时 `--backup` |
| 目录非空，有 `--backup` | 先备份再覆盖 | 备份到 `.create-x-app-backup/<timestamp>` |

**建议新增命令体验**：

```bash
create-x-app my-app --dry-run
create-x-app my-app --force --backup
```

**实现建议**：

- 先生成到临时目录：`.create-x-app-tmp-<timestamp>`。
- 生成成功后再 merge 或 rename 到目标目录。
- 覆盖前打印会新增、覆盖、删除的文件数量和列表。
- 对交互模式，确认文案必须包含目标绝对路径和删除数量。

**验收标准**：

- 非空目录默认不清空。
- `--dry-run` 不创建、不删除任何文件。
- `--backup` 可恢复原始目录。
- 中途生成失败不会留下半成品覆盖用户文件。

---

### CXA-FIX-005：修复 `--skip-install` 与 Husky/Windows 兼容性

**问题**：后置动作中只要选择 Husky，就会设置 `shouldInstallDependencies = true`，即使用户传了 `--skip-install`。同时 Husky 初始化后调用外部 `chmod +x .husky/commit-msg`，在 Windows 下存在兼容隐患。

**风险**：

- 用户明确要求跳过安装，但 CLI 仍然执行安装，违反参数语义。
- 离线环境、内网环境、CI dry-run 环境可能被意外阻断。
- Windows 用户可能遇到无意义的 `chmod` 失败。

**修复目标**：`--skip-install` 必须是强语义；Husky 初始化与 chmod 应平台感知。

**建议行为**：

| 条件 | 行为 |
|---|---|
| `--skip-install` | 永远不执行依赖安装。 |
| 选择 Husky 且跳过安装 | 跳过 Husky 初始化，并输出手动命令。 |
| 非 Windows | 使用 Node `fs.chmod(path, 0o755)` 设置权限。 |
| Windows | 不执行 chmod，仅提示 Git hooks 可正常由 Git 处理。 |

**建议输出**：

```text
已跳过依赖安装。由于启用了 Husky，请在安装依赖后手动执行：
  npm install
  npx husky install
```

**验收标准**：

```bash
node bin/cli.js demo --template react-vite-ts --features husky --skip-install --yes
```

不得执行任何 install/dlx 命令；Windows CI 不应因为 chmod 失败而出现 warning 噪声。

---

### CXA-FIX-006：加固远程模板供应链

**问题**：远程模板固定从 GitHub `main` 分支拉取，24 小时缓存，失败时 resolver warning 后回退本地模板。当前没有 ref pinning、checksum、strict 模式或远程来源锁定记录。

**风险**：

- `main` 是漂移目标，同一命令不同日期可能生成不同项目。
- 远程失败回退本地可能让用户误以为使用了最新模板。
- 缺少完整性校验和来源追踪，不利于排障与审计。

**修复目标**：远程模板必须可追踪、可固定、可验证、失败语义明确。

**建议新增参数**：

| 参数 | 说明 |
|---|---|
| `--ref <tag|sha|branch>` | 指定远程模板 ref，默认使用 CLI 版本对应 tag。 |
| `--strict-remote` | 远程失败直接失败，不回退本地。 |
| `--verify-template` | 校验 manifest 声明的 checksum/signature。 |
| `--template-source <url>` | 后续支持自定义企业模板源。 |

**生成项目记录建议**：

```json
{
  "template": "react-vite-ts",
  "source": "github",
  "owner": "yexianglun-d",
  "repo": "create-x-app",
  "ref": "v1.0.1",
  "commit": "abc123...",
  "sha256": "...",
  "createdBy": "create-x-app-cli@1.0.1"
}
```

**验收标准**：

- `--remote --ref v1.0.1` 生成结果可复现。
- `--strict-remote` 在断网时失败，不回退本地。
- 输出清晰显示实际使用的 template source/ref/commit。

---

## 5. P1 修复项

### CXA-FIX-007：插件健康度与安装前风险提示

**问题**：插件 loader 主要基于包名和 `package.json` 中的 `cxa-plugin: true` 识别插件；marketplace 搜索返回名称、版本、描述和周下载量。当前缺少 schema 校验、兼容版本、license、仓库、发布时间、安装脚本、安全风险等展示。

**修复目标**：插件不是“能扫到就可信”，而是要有最小健康度评分和安装前透明提示。

**建议插件 manifest 增加字段**：

```json
{
  "cxaPluginApi": ">=1.0.0 <2.0.0",
  "author": "...",
  "repository": "...",
  "license": "MIT",
  "requiresNetwork": false,
  "postActions": [],
  "writesOutsideTarget": false
}
```

**搜索/安装前展示**：

| 指标 | 说明 |
|---|---|
| weekly downloads | npm 周下载量。 |
| last publish | 最近发布时间。 |
| license | 许可证。 |
| repository | 是否声明源码仓库。 |
| compatibility | 支持的 CLI API 版本。 |
| scripts risk | 是否含 postinstall/preinstall。 |
| manifest valid | 是否通过 schema。 |

**验收标准**：

- 非法 manifest 插件不会进入模板列表。
- 安装前展示风险摘要。
- `create-x-app plugin doctor` 可检查已安装插件。

---

### CXA-FIX-008：把 upgrade 从“覆盖配置”升级为 migration engine

**问题**：当前 upgrade 的 applier 支持查看 diff、覆盖或跳过，但本质仍是把脚手架管理配置写成模板版本。它缺少文件 ownership、旧版本 hash、三方 merge、迁移脚本、备份和回滚。

**修复目标**：建立项目元数据和模板锁文件，让升级可以判断“模板改了什么、用户改了什么、是否冲突”。

**建议生成项目时写入**：

```text
.create-x-app/
  project.json
  template-lock.json
  files.json
```

**建议 metadata**：

```json
{
  "template": "react-vite-ts",
  "templateVersion": "1.0.1",
  "createdBy": "create-x-app-cli@1.0.1",
  "features": ["eslint", "prettier"],
  "extras": ["tailwind"],
  "files": {
    "tsconfig.json": {
      "owned": true,
      "hash": "..."
    }
  }
}
```

**新增命令**：

```bash
create-x-app upgrade --check
create-x-app upgrade --diff
create-x-app upgrade --apply
create-x-app upgrade --backup
create-x-app upgrade --from 1.0.1 --to 1.1.0
```

**验收标准**：

- 用户改过的文件不会被静默覆盖。
- 冲突文件进入三方 merge 或明确 conflict 列表。
- 每次 upgrade 生成报告和备份。

---

### CXA-FIX-009：模板感知的环境检测

**问题**：环境检测在选择模板之前固定检查 Node.js、Git、pnpm、Java。对 React 模板用户来说，Java 警告是噪声；对未来 Docker、Go、Rust、Android SDK 等模板来说，当前机制扩展性不足。

**修复目标**：拆成全局检测和模板检测。

**建议流程**：

```text
启动 CLI
→ 检查 Node.js 与 CLI 运行环境
→ 选择模板/读取非交互参数
→ 读取 manifest.requirements
→ 检查模板所需工具
→ 给出阻断项、警告项和修复命令
```

**manifest requirements 示例**：

```json
{
  "requirements": {
    "node": ">=18.0.0",
    "git": ">=2.0.0",
    "java": null,
    "docker": ">=24.0.0"
  }
}
```

**验收标准**：

- React 模板不再提示 Java。
- Java 模板仍能阻断/警告 Java 版本问题。
- 新模板可以通过 manifest 增加工具检测，不改 env-check 源码。

---

### CXA-FIX-010：修正生成后 next steps 的真实性

**问题**：后置输出固定展示 `AGENTS.md` 与 `coding-rules.md`，但这些文件是可选功能；未启用时会被生成器裁剪。

**修复目标**：所有输出都应基于实际生成结果，而不是基于理想模板。

**实现建议**：

```js
if (await fs.pathExists(join(config.targetDir, 'AGENTS.md'))) {
  console.log(' AGENTS.md ← AI 协作规则说明')
}
if (await fs.pathExists(join(config.targetDir, 'coding-rules.md'))) {
  console.log(' coding-rules.md ← 团队代码规范')
}
```

**验收标准**：

- 未选择 agents/coding-rules 时，next steps 不展示不存在文件。
- 选择后才展示对应文档。
- dev/build 命令从 manifest scripts 读取，不硬编码 `run dev`。

---

### CXA-FIX-011：调整 `--latest` 依赖策略，默认保持可复现

**问题**：`--latest` 会把匹配 semver 的依赖刷新到 npm latest。对脚手架来说，可复现通常比“最新”更重要；latest 可能引入 major breaking change，使模板代码和依赖 API 不匹配。

**修复目标**：默认使用模板验证过的 baseline，用户显式选择升级策略。

**建议替换参数**：

| 参数 | 行为 |
|---|---|
| `--deps baseline` | 默认，使用模板验证版本。 |
| `--deps latest-patch` | 只升 patch。 |
| `--deps latest-minor` | 升 minor，不跨 major。 |
| `--deps latest-major` | 允许 major，但强提示风险。 |
| `--deps latest` | 等价于全部 latest，标记为 experimental。 |

**验收标准**：

- 默认生成结果和模板 lock/baseline 一致。
- latest-major/experimental 策略有明确风险提示。
- CI 对 baseline 必须 build 通过，对 latest 可作为允许失败的 nightly job。

---

### CXA-FIX-012：补齐匿名统计的失败阶段事件

**问题**：当前创建成功后才上报 create event。失败路径、用户取消、安装失败、远程模板失败等最有价值的信息不会被记录。

**修复目标**：在不采集敏感信息的前提下，记录阶段性匿名事件，帮助定位失败高发点。

**建议事件**：

```text
create_start
prompt_cancelled
env_check_failed
resolve_template_failed
generate_failed
install_failed
git_failed
create_success
```

**隐私边界**：

- 不采集项目名、路径、用户名、仓库地址、源码、环境变量。
- 失败信息只记录错误阶段和错误类别，不上传完整 stack trace。
- 提供 `telemetry status/on/off` 命令。

**验收标准**：

- `--no-telemetry` 对所有阶段生效。
- 失败事件不包含本地路径。
- 首次同意机制和配置文件行为保持兼容。

---

## 6. P2 增强项

### CXA-FIX-013：Preset 体系

支持团队固定配置，降低重复选择成本。

```bash
create-x-app my-app --preset company-react
create-x-app my-app --preset ./preset.json
create-x-app my-app --preset github:org/frontend-preset
```

preset 示例：

```json
{
  "template": "react-vite-ts",
  "pm": "pnpm",
  "features": ["eslint", "prettier", "husky", "agents"],
  "extras": ["tailwind"],
  "git": true,
  "install": true
}
```

---

### CXA-FIX-014：模板作者工具链

新增命令：

```bash
create-x-app template lint
create-x-app template test
create-x-app template pack
create-x-app plugin init
create-x-app plugin doctor
```

目标是让插件作者在发布前就能本地验证 manifest、模板渲染、文件裁剪和 build smoke。

---

### CXA-FIX-015：AI-native 工程规范扩展

既然已有 `AGENTS.md` 和 `coding-rules.md`，可以继续扩展为：

- Cursor rules。
- Claude Code instructions。
- GitHub Copilot instructions。
- MCP server config。
- PR review prompt。
- ADR 模板。
- commit message prompt。

这些应作为可选 features，不应默认污染所有模板。

---

## 7. 建议版本路线图

| 版本 | 目标 | 必须包含 |
|---|---|---|
| v1.0.2 | 稳定性补丁 | `--skip-install` 语义修复、Windows chmod 修复、next steps 修复。 |
| v1.1.0 | 自动化可用 | 非交互模式、dry-run、release:check、基础 CI。 |
| v1.2.0 | Manifest 正规化 | manifest schema、generator 读取 templatePath manifest、去核心硬编码。 |
| v1.3.0 | 安全边界 | remote ref/strict/verify、插件健康度、目录 backup。 |
| v1.4.0 | 升级系统 | `.create-x-app/` 元数据、upgrade check/diff/apply/backup。 |
| v2.0.0 | 平台化 | preset、模板作者工具、插件 API 版本化、企业模板源。 |

---

## 8. 可直接拆分的 GitHub Issues

### Issue 1：Restore automated tests and release gates

**目标**：恢复单测、集成测试、模板 smoke 和发布包检查。

**范围**：

- 新增 `npm test`、`npm run smoke`、`npm run release:check`。
- CI 覆盖 Node 18/20/22 与 Ubuntu/Windows/macOS。
- 8 套模板至少执行生成、安装、构建或等价 smoke。

**验收**：

```bash
npm run release:check
```

---

### Issue 2：Add non-interactive create options

**目标**：支持无 prompt 创建项目。

**新增参数**：`--template`、`--pm`、`--features`、`--extras`、`--yes`、`--target`、`--cwd`、`--force`、`--dry-run`。

**验收**：

```bash
node bin/cli.js demo --template react-vite-ts --pm pnpm --features eslint,prettier --extras tailwind --skip-install --skip-git --yes
```

不得出现交互 prompt。

---

### Issue 3：Introduce manifest schema v1

**目标**：所有模板和插件通过统一 schema 校验。

**范围**：

- 新增 `schemas/manifest.schema.json`。
- 内置模板 manifest 全量迁移。
- generator/validator 不再硬编码 feature/extras 规则。

**验收**：新增模板只需要新增模板目录和 manifest，不需要改核心源码。

---

### Issue 4：Load manifest from resolved templatePath

**目标**：生成器读取实际模板目录下的 manifest。

**原因**：远程模板、插件模板和本地模板可能版本不同，不能只按 `config.template` 读注册表。

**验收**：本地、远程、插件三类模板的 metadata 均记录真实来源。

---

### Issue 5：Add safe target directory strategy

**目标**：加入 `--dry-run`、`--force`、`--backup`。

**验收**：非空目录默认拒绝；dry-run 不写入；backup 可恢复；失败不破坏已有内容。

---

### Issue 6：Respect skip-install and make Husky platform-aware

**目标**：`--skip-install` 永远不执行 install；Husky 初始化平台感知。

**验收**：Windows CI 无 chmod warning；选择 Husky + skip-install 时输出手动命令。

---

### Issue 7：Harden remote template resolution

**目标**：支持 `--ref`、`--strict-remote`、`--verify-template`。

**验收**：断网 strict 模式失败；非 strict 模式回退但明确展示“实际使用本地模板”。

---

### Issue 8：Add plugin health check and manifest validation

**目标**：插件安装、搜索、加载前都执行健康度与 schema 校验。

**验收**：非法插件不会进入模板列表；安装前显示 license、repo、last publish、weekly downloads、compatibility。

---

### Issue 9：Upgrade metadata and migration engine

**目标**：升级命令改为基于模板锁、文件 hash 和 backup 的迁移系统。

**验收**：用户修改过的配置不会被静默覆盖；升级报告可追踪。

---

## 9. 发布前检查清单

每次发布前必须满足：

- [ ] `npm run lint` 通过。
- [ ] `npm test` 通过。
- [ ] `npm run smoke` 通过。
- [ ] `npm pack --dry-run` 包含 bin、src、templates、shared 和必要文档。
- [ ] 至少一个模板执行 install + build。
- [ ] Windows smoke 通过。
- [ ] README 命令参考与 `bin/cli.js --help` 一致。
- [ ] CHANGELOG 记录 breaking changes、migration notes 和 known issues。
- [ ] 对远程模板、插件、telemetry 变更更新 SECURITY/隐私说明。

---

## 10. 不建议当前继续投入的方向

在 P0 修复完成前，不建议优先投入：

1. **继续堆新模板**：模板越多，回归面越大。
2. **强化营销文案**：当前更需要验证矩阵，而不是更多“生产级”描述。
3. **默认 latest 依赖**：会牺牲可复现性。
4. **开放复杂插件执行能力**：供应链边界未建立前，不应让插件拥有更大副作用。
5. **深度企业特性**：preset、私有模板源可以设计，但应排在地基修复之后。

---

## 11. 建议 PR 顺序

| 顺序 | PR | 说明 |
|---|---|---|
| 1 | 修复 skip-install / Husky / next steps | 小而明确，适合 v1.0.2。 |
| 2 | 引入 release:check 与基础测试骨架 | 先让后续改动有门禁。 |
| 3 | 非交互模式 | 让 smoke test 和 CI 简化。 |
| 4 | 安全目录策略 | 与非交互模式配套。 |
| 5 | manifest schema | 为插件和远程模板打地基。 |
| 6 | generator 读取 templatePath manifest | 解决来源错位。 |
| 7 | remote ref/strict/verify | 增强供应链可靠性。 |
| 8 | plugin health check | 降低社区模板风险。 |
| 9 | upgrade metadata | 开始做真正迁移系统。 |

---

## 12. 附录 A：建议 GitHub Actions 工作流骨架

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:

jobs:
  test:
    strategy:
      fail-fast: false
      matrix:
        os: [ubuntu-latest, macos-latest, windows-latest]
        node: [18, 20, 22]
    runs-on: ${{ matrix.os }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node }}
          cache: npm
      - run: npm ci
      - run: npm run lint
      - run: npm test
      - run: npm run smoke
      - run: npm run pack:check
```

---

## 13. 附录 B：建议 smoke-all-templates 验收逻辑

```text
for each template in manifests:
  create temp dir
  run CLI in non-interactive mode
  assert package.json exists
  assert manifest.json removed from output
  assert selected feature files exist
  assert unselected feature files absent
  run package manager install
  run manifest.verify.commands
  cleanup temp dir
```

---

## 14. 参考来源

- GitHub 仓库：https://github.com/yexianglun-d/create-x-app
- README：https://raw.githubusercontent.com/yexianglun-d/create-x-app/main/README.md
- package.json：https://raw.githubusercontent.com/yexianglun-d/create-x-app/main/package.json
- CLI 入口：https://raw.githubusercontent.com/yexianglun-d/create-x-app/main/bin/cli.js
- 创建主流程：https://raw.githubusercontent.com/yexianglun-d/create-x-app/main/src/commands/create.js
- 生成器：https://raw.githubusercontent.com/yexianglun-d/create-x-app/main/src/generator/index.js
- 环境检测：https://raw.githubusercontent.com/yexianglun-d/create-x-app/main/src/steps/env-check.js
- 后置动作：https://raw.githubusercontent.com/yexianglun-d/create-x-app/main/src/steps/post-actions.js
- 校验器：https://raw.githubusercontent.com/yexianglun-d/create-x-app/main/src/validator/index.js
- 远程模板拉取：https://raw.githubusercontent.com/yexianglun-d/create-x-app/main/src/remote/template-fetcher.js
- 模板解析：https://raw.githubusercontent.com/yexianglun-d/create-x-app/main/src/steps/resolver.js
- 插件加载：https://raw.githubusercontent.com/yexianglun-d/create-x-app/main/src/plugins/loader.js
- 插件市场：https://raw.githubusercontent.com/yexianglun-d/create-x-app/main/src/marketplace/client.js
- 升级应用器：https://raw.githubusercontent.com/yexianglun-d/create-x-app/main/src/upgrade/applier.js
- 实施跟踪：https://raw.githubusercontent.com/yexianglun-d/create-x-app/main/IMPLEMENTATION_TODO.md
