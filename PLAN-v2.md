# create-x-app 迭代计划文档（修订版 v2）

> 本文档供 Codex 逐任务执行。每个任务都有明确的输入、输出、验收标准。
> 执行前请先阅读已有的 AGENTS.md 了解项目基础结构。
> **执行规则：完成一个任务 → 运行验收命令确认通过 → 再进入下一个任务。**
> 设计与验收口径以本文件为准，任务状态跟踪以 `IMPLEMENTATION_TODO.md` 为准。

---

## 修订说明（v1 → v2）

| # | 问题 | 修改内容 |
|---|---|---|
| 1 | TASK-101~106 要求手动改 resolver/prompts，与 TASK-003 manifest 驱动冲突 | 统一为 manifest 驱动。新增模板只需建目录 + manifest.json，resolver/prompts/validator 全部自动感知 |
| 2 | V04 与生成器已有目录覆盖逻辑重复；V06 将 Husky 与 ESLint 强绑定理由不成立 | 删除 V04 和 V06 |
| 3 | TASK-201 前后矛盾：说"模板不打包"又要"离线兜底" | 改为"本地模板为默认主链路，远端拉取为可选增强能力" |
| 4 | TASK-202 默认实时拉最新版破坏可重复性 | 改为"模板内保留基线版本为默认，`--latest` 为可选增强" |
| 5 | TASK-003 Part B 集成测试硬编码 features 和 pm | 改为从各模板 manifest 读取 defaultFeatures / requiredPm |

---

## 任务状态标记说明

- `[ ]` 未开始
- `[→]` 进行中
- `[x]` 已完成
- `[!]` 被阻塞，等待依赖

---

## 当前统一基线

- 产品名、CLI 展示名、文档对外名称统一采用 `create-x-app`
- npm 发布包名沿用已发布且有权限的 `create-x-app-cli`
- `PLAN-v2.md` 负责设计和验收口径，`IMPLEMENTATION_TODO.md` 负责状态跟踪和执行顺序回填

---

## PHASE 0 — 工程基础（必须在 PHASE 1 之前全部完成）

> 这四个任务是整个项目的工程地基。
> **PHASE 1 的所有模板任务依赖 TASK-003 Part A 完成后才能开始。**

---

### TASK-000：命名基线收敛（create-x-app）

**目标**
将产品展示名称统一收敛到 `create-x-app`。
npm 包名保留 `create-x-app-cli`，避免与已被占用的 `create-x-app` npm 包名冲突。

**需要修改的范围**

- `package.json`：包名保留 `create-x-app-cli`，`bin` 保留 `create-x-app` 命令别名
- `bin/cli.js`：CLI 名称、帮助文案
- `README.md`、`RELEASE_COMMANDS.md`、`PLAN-v2.md`、`IMPLEMENTATION_TODO.md`
- 其他仍然出现 `create-x-app-cli` 的位置必须是 npm 包名、npx 使用方式或发布说明

**验收标准**
```bash
node -e "const p=require('./package.json'); console.log(p.name, p.bin)"
# ✔ 包名为 create-x-app-cli，bin 同时包含 create-x-app 和 create-x-app-cli
```

---

### TASK-001：选择后强校验（Config Validator）

**目标**
在 `runPrompts` 返回 config 之后、`generateProject` 执行之前，插入统一的校验层，
拦截非法选项组合，给出清晰提示。

**需要创建的文件**：`src/validator/index.js`

**校验规则清单**

> 注意：V04（目录覆盖）已在 `src/generator/index.js` 中处理，此处不重复。
> V06（Husky 要求 ESLint）已删除——Husky 挂的是 commit-msg 的 commitlint，与 ESLint 无关。

| 规则 ID | 条件 | 类型 | 提示语 |
|---|---|---|---|
| V01 | `template === 'monorepo'` 且 `packageManager !== 'pnpm'` | 错误（退出） | "Monorepo 模板必须使用 pnpm（依赖 pnpm workspace）" |
| V02 | `manifest.forbiddenPm` 包含当前 `packageManager` | 错误（退出） | "{模板名} 不支持 {pm}，请选择 {allowedPm}" |
| V03 | `manifest.requiredPm` 存在且不等于当前 `packageManager` | 错误（退出） | "{模板名} 必须使用 {requiredPm}" |
| V05 | `extras.includes('react-router')` 且 `template` 不在 React 类模板列表 | 错误（退出） | "React Router 仅适用于 React 类模板" |

> V01 是保留的具名规则（可读性好）；V02/V03 从 manifest 动态读取，无需硬编码模板名。
> React 类模板列表由 manifest 中 `"framework": "react"` 字段标识，不硬编码。

**实现结构**

```js
// src/validator/index.js
import { loadManifest } from '../manifest/loader.js'
import { logger } from '../utils/logger.js'

export function validateConfig(config) {
  const errors = []
  const manifest = loadManifest(config.template)

  // V01：monorepo 强制 pnpm（具名规则，优先于 manifest 泛化规则）
  if (config.template === 'monorepo' && config.packageManager !== 'pnpm') {
    errors.push('Monorepo 模板必须使用 pnpm（依赖 pnpm workspace）')
  }

  // V02/V03：从 manifest 动态读取 pm 约束
  if (manifest.requiredPm && config.packageManager !== manifest.requiredPm) {
    errors.push(`${manifest.name} 必须使用 ${manifest.requiredPm}`)
  }
  if (manifest.forbiddenPm?.includes(config.packageManager)) {
    const allowed = ['npm','pnpm','yarn'].filter(p => !manifest.forbiddenPm.includes(p))
    errors.push(`${manifest.name} 不支持 ${config.packageManager}，请选择 ${allowed.join(' 或 ')}`)
  }

  // V05：React Router 只用于 React 类模板
  if (
    config.extras?.includes('react-router') &&
    manifest.framework !== 'react'
  ) {
    errors.push('React Router 仅适用于 React 类模板')
  }

  if (errors.length > 0) {
    errors.forEach(e => logger.error(e))
    process.exit(1)
  }
}
```

**需要修改的文件**：`src/commands/create.js`

```js
import { validateConfig } from '../validator/index.js'

const config = await runPrompts(projectNameArg)
validateConfig(config)          // ← 新增，在 generateProject 之前
const templatePath = resolveTemplate(config.template)
```

**测试文件**：`test/validator.test.js`

```js
// ✔ monorepo + npm → V01 错误退出
// ✔ monorepo + pnpm → 通过
// ✔ manifest.requiredPm = 'pnpm'，传入 npm → V03 错误
// ✔ manifest.forbiddenPm = ['yarn']，传入 yarn → V02 错误
// ✔ react-router + node-ts 模板 → V05 错误
// ✔ react-router + react-vite-ts 模板 → 通过
```

**验收标准**
```bash
node --test test/validator.test.js
# ✔ 所有校验用例通过
```

---

### TASK-002：包管理器适配层（PM Adapter）

**目标**
将所有包管理器命令（install / run / exec / dlx）统一封装，
其余所有模块只调用适配层，禁止直接拼接 pm 命令字符串。

**需要创建的文件**：`src/utils/pm-adapter.js`

**完整实现**

```js
import { execa } from 'execa'

const PM_COMMANDS = {
  npm: {
    install:    ['install'],
    installPkg: (pkg) => ['install', pkg],
    run:        (script) => ['run', script],
    dlx:        (cmd, ...args) => ['exec', '--', cmd, ...args],
    lockFile:   'package-lock.json',
  },
  pnpm: {
    install:    ['install'],
    installPkg: (pkg) => ['add', pkg],
    run:        (script) => ['run', script],
    dlx:        (cmd, ...args) => ['dlx', cmd, ...args],
    lockFile:   'pnpm-lock.yaml',
  },
  yarn: {
    install:    ['install'],
    installPkg: (pkg) => ['add', pkg],
    run:        (script) => ['run', script],
    dlx:        (cmd, ...args) => ['dlx', cmd, ...args],
    lockFile:   'yarn.lock',
  },
}

export function createPmAdapter(pm) {
  const cmds = PM_COMMANDS[pm]
  if (!cmds) throw new Error(`不支持的包管理器：${pm}`)

  return {
    install:    (cwd)        => execa(pm, cmds.install,              { cwd }),
    installPkg: (pkg, cwd)   => execa(pm, cmds.installPkg(pkg),     { cwd }),
    run:        (script, cwd)=> execa(pm, cmds.run(script),         { cwd }),
    dlx:        (cmd, cwd, ...args) =>
                               execa(pm, cmds.dlx(cmd, ...args),    { cwd }),
    lockFile:   cmds.lockFile,
    name:       pm,
  }
}
```

**需要修改的文件**

- `src/steps/post-actions.js`：所有 execa 调用改为 `pm.install` / `pm.dlx` / `pm.run`
- `src/commands/upgrade.js`（TASK-203）：同上
- `shared/README.md.ejs`：`<%= packageManager %> install` 保持不变（已正确）
- 所有模板 `package.json.ejs`：新增 `"packageManager": "<%= packageManager %>@latest"`

**测试文件**：`test/pm-adapter.test.js`

```js
// ✔ npm dlx('husky') → ['exec', '--', 'husky']
// ✔ pnpm dlx('husky') → ['dlx', 'husky']
// ✔ yarn dlx('husky') → ['dlx', 'husky']
// ✔ 各 pm lockFile 字段正确
// ✔ 未知 pm 抛出错误
```

**验收标准**
```bash
node --test test/pm-adapter.test.js
# ✔ 所有适配用例通过

node bin/cli.js test-npm  # 选 npm
node bin/cli.js test-pnpm # 选 pnpm
node bin/cli.js test-yarn # 选 yarn
# ✔ 三个项目生成正确 lockfile
# ✔ husky 在三种 pm 下均正确安装
```

---

### TASK-003：模板 Manifest + 集成测试

#### Part A：模板 Manifest（PHASE 1 所有模板任务的前置依赖）

**目标**
为每个模板目录定义 `manifest.json`，作为 resolver / prompts / validator / 集成测试
的统一数据源。**新增模板只需建目录 + manifest，不需要修改任何逻辑代码。**

**每个模板目录下新增 `manifest.json`，完整字段规范如下**

```json
{
  "key": "react-vite-ts",
  "name": "React + Vite + TypeScript",
  "description": "适合中小型前端应用，React 工程开箱即用",
  "version": "1.0.0",
  "framework": "react",
  "requiredPm": null,
  "forbiddenPm": [],
  "requiredEnv": { "node": ">=18.0.0" },
  "optionalEnv": {},
  "supportedFeatures": ["eslint", "prettier", "husky", "agents", "coding-rules"],
  "defaultFeatures":   ["eslint", "prettier", "husky", "agents", "coding-rules"],
  "extras": [
    { "key": "react-router", "label": "React Router v6",  "default": false },
    { "key": "tailwind",     "label": "Tailwind CSS v3",  "default": false }
  ],
  "subPrompts": [],
  "devScript": "dev",
  "buildScript": "build",
  "devPort": 5173,
  "integrationTest": {
    "skipBuild": false,
    "skipDevServer": false,
    "installWorkspaces": ["."],
    "buildWorkspace": "."
  }
}
```

**各现有模板的 manifest（立即创建）**

| 模板 key | framework | requiredPm | forbiddenPm | devPort |
|---|---|---|---|---|
| react-vite-ts | react | null | [] | 5173 |
| node-ts | node | null | [] | 3000 |
| java-fullstack | react | null | [] | 5173 |

**`subPrompts` 字段规范**（用于 electron-app 等需要子问答的模板）

```json
"subPrompts": [
  {
    "key": "renderer",
    "type": "select",
    "label": "选择渲染进程框架",
    "options": [
      { "value": "vue", "label": "Vue 3 + TypeScript" },
      { "value": "react", "label": "React + TypeScript" }
    ],
    "default": "vue"
  }
]
```

**需要创建的文件**：`src/manifest/loader.js`

```js
import { readFileSync, readdirSync, existsSync } from 'fs'
import { join } from 'path'
import { fileURLToPath } from 'url'
import { dirname } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const TEMPLATES_DIR = join(__dirname, '../../templates')

export function loadManifest(templateKey) {
  const p = join(TEMPLATES_DIR, templateKey, 'manifest.json')
  if (!existsSync(p)) throw new Error(`模板 ${templateKey} 缺少 manifest.json`)
  return JSON.parse(readFileSync(p, 'utf8'))
}

export function loadAllManifests() {
  return readdirSync(TEMPLATES_DIR)
    .filter(d => existsSync(join(TEMPLATES_DIR, d, 'manifest.json')))
    .map(d => loadManifest(d))
    .sort((a, b) => a.key.localeCompare(b.key))
}
```

**manifest 驱动 resolver**（修改 `src/steps/resolver.js`，替换 TEMPLATE_MAP 硬编码）

```js
import { loadManifest } from '../manifest/loader.js'
import { join } from 'path'

const TEMPLATES_DIR = join(...)

export function resolveTemplate(templateKey) {
  // 触发 manifest 存在性校验（不存在则抛出）
  loadManifest(templateKey)
  return join(TEMPLATES_DIR, templateKey)
}
```

**manifest 驱动 prompts**（修改 `src/steps/prompts.js`）

```js
import { loadAllManifests } from '../manifest/loader.js'

// 模板选项：从 manifests 自动生成，无需手动维护列表
const manifests = loadAllManifests()
const templateChoices = manifests.map(m => ({
  value: m.key,
  label: m.name,
  hint:  m.description,
}))

// 选定模板后，extras 从 manifest.extras 读取
const selectedManifest = manifests.find(m => m.key === config.template)
const extrasChoices = selectedManifest.extras.map(e => ({
  value: e.key, label: e.label, selected: e.default,
}))

// subPrompts：若 manifest.subPrompts 非空，逐一追加问答
for (const sp of selectedManifest.subPrompts ?? []) {
  config[sp.key] = await prompt(sp)  // 统一处理 select / text / confirm
}

// packageManager：若模板强制指定 requiredPm，则跳过问答直接锁定
if (selectedManifest.requiredPm) {
  config.packageManager = selectedManifest.requiredPm
} else {
  const availablePmOptions = ['npm', 'pnpm', 'yarn']
    .filter(pm => !(selectedManifest.forbiddenPm ?? []).includes(pm))

  config.packageManager = await select({
    message: '请选择包管理器',
    options: availablePmOptions.map(pm => ({ value: pm, label: pm })),
    initialValue: availablePmOptions[0],
  })
}

// supportedFeatures / defaultFeatures 也从 manifest 读取
const featureChoices = selectedManifest.supportedFeatures.map(f => ({
  value: f,
  label: FEATURE_LABELS[f],
  selected: selectedManifest.defaultFeatures.includes(f),
}))
```

**测试文件**：`test/manifest/loader.test.js`

```js
// ✔ loadManifest('react-vite-ts') 返回正确对象
// ✔ loadManifest('不存在的key') 抛出错误
// ✔ loadAllManifests() 返回数组，每项含必要字段
// ✔ manifest 驱动后，resolver 对已知 key 返回正确路径
// ✔ manifest 驱动后，resolver 对未知 key 抛出（manifest 不存在）
```

**验收标准**
```bash
node --test test/manifest/loader.test.js
# ✔ 所有 loader 用例通过

node bin/cli.js
# ✔ 模板列表由 manifests 自动生成（当前 3 项）
# ✔ 新增一个 manifest.json 后重启，列表自动新增该模板，无需改代码
```

---

#### Part B：集成测试（每新增模板后同步补充）

**目标**
自动验证每个模板生成后的文件结构和构建结果，作为 CI 回归防线。
测试配置**全部从 manifest 读取**，不硬编码任何模板专属值。

**需要创建的文件**

```
test/integration/
├── runner.js            ← 集成测试主程序
└── snapshots/           ← 文件结构快照（首次运行 --update-snapshots 生成）
    ├── react-vite-ts.json
    ├── node-ts.json
    └── java-fullstack.json
```

**runner.js 核心逻辑**

```js
import { loadAllManifests } from '../../src/manifest/loader.js'
import { resolveTemplate } from '../../src/steps/resolver.js'
import { createPmAdapter } from '../../src/utils/pm-adapter.js'
import { generateProject }  from '../../src/generator/index.js'
import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'

const manifests = loadAllManifests()

for (const manifest of manifests) {
  // 测试配置完全来自 manifest，不硬编码
  const testConfig = {
    projectName:  'integration-test',
    template:      manifest.key,
    features:      manifest.defaultFeatures,          // ← 来自 manifest
    extras:        manifest.extras
                     .filter(e => e.default)
                     .map(e => e.key),
    packageManager: manifest.requiredPm ?? 'npm',     // ← 来自 manifest
    targetDir:     mkdtempSync(tmpdir() + '/cxa-'),
  }

  // 对 subPrompts 取默认值
  for (const sp of manifest.subPrompts ?? []) {
    testConfig[sp.key] = sp.default
  }

  try {
    const templatePath = await resolveTemplate(manifest.key)
    const pm = createPmAdapter(testConfig.packageManager)

    await generateProject({ config: testConfig, templatePath })

    // 1. 文件结构快照校验
    await assertSnapshot(manifest.key, testConfig.targetDir)

    // 2. install + build（使用 manifest 指定的包管理器）
    if (!manifest.integrationTest?.skipBuild) {
      await pm.install(testConfig.targetDir)
      await pm.run(manifest.buildScript, testConfig.targetDir)
    }

    console.log(`✔ [${manifest.key}] 集成测试通过`)
  } finally {
    rmSync(testConfig.targetDir, { recursive: true, force: true })
  }
}
```

**integrationTest 字段用途**

| 字段 | 用途 | 示例 |
|---|---|---|
| `skipBuild` | 无 build script 的模板设为 true | 某些纯运行期模板 |
| `skipDevServer` | 无 dev server 的模板跳过端口检查 | electron-app: true |
| `installWorkspaces` | 集成测试需要执行依赖安装的工作目录列表 | java-fullstack: [".", "frontend"] |
| `buildWorkspace` | 执行 build script 的工作目录 | java-fullstack: "frontend" |

**snapshots/react-vite-ts.json 格式**

```json
{
  "files": [
    "package.json", "vite.config.ts", "tsconfig.json", "index.html",
    "src/main.tsx", "src/App.tsx",
    ".gitignore", ".eslintrc.json", ".prettierrc",
    "AGENTS.md", "README.md", "coding-rules.md", "commitlint.config.js"
  ],
  "packageJsonFields": {
    "scripts.dev": "vite",
    "scripts.build": "tsc && vite build"
  }
}
```

**npm scripts**（新增到根 package.json）

```json
"test:integration": "node test/integration/runner.js",
"test:snapshot-update": "node test/integration/runner.js --update-snapshots"
```

**CI 配置**：`.github/workflows/ci.yml`

```yaml
name: CI
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20' }
      - run: npm install
      - run: node --test
      - run: npm run test:integration
```

**验收标准**
```bash
npm run test:snapshot-update   # 首次：生成所有快照
npm run test:integration       # 验证

# ✔ 每个模板输出：
#   [react-vite-ts] ✔ 文件结构正确
#   [react-vite-ts] ✔ npm install 成功
#   [react-vite-ts] ✔ npm run build 成功
```

---

## PHASE 1 — 模板扩展

> **前置条件：TASK-001 + TASK-002 + TASK-003 Part A 全部完成。**
>
> **新增模板的统一规则（PHASE 1 所有任务遵守）：**
> 1. 只创建 `templates/<key>/` 目录内的文件 + `manifest.json`
> 2. **不修改** `src/steps/resolver.js`、`src/steps/prompts.js`、`src/validator/index.js`
>    这三个文件会自动感知新 manifest
> 3. 新增模板后运行 `npm run test:snapshot-update` 生成快照，再跑 `npm run test:integration`
> 4. 新模板的 extras 必须在模板目录内自洽实现（可通过 EJS 条件渲染），
>    不复用 `templates/extras/*` 的历史全局覆盖机制；现有全局 extras 仅兼容旧模板

---

### TASK-101：后台管理系统模板（react-admin）

**目标**
生成一套开箱即用的中后台项目，含侧边栏布局、路由权限、请求封装。

**需要创建的文件**

```
templates/react-admin/
├── manifest.json              ← 必须首先创建
├── package.json.ejs
├── vite.config.ts
├── tsconfig.json
├── index.html.ejs
├── src/
│   ├── main.tsx
│   ├── App.tsx
│   ├── router/
│   │   └── index.tsx          ← React Router v6，含权限守卫
│   ├── layouts/
│   │   └── MainLayout.tsx     ← 侧边栏 + 顶栏 + 内容区布局（Antd Layout）
│   ├── pages/
│   │   ├── Dashboard.tsx
│   │   ├── Login.tsx
│   │   └── NotFound.tsx
│   ├── stores/
│   │   └── auth.ts            ← Zustand 存储 token 和用户信息
│   ├── api/
│   │   ├── client.ts          ← Axios 实例，含拦截器、401 跳转
│   │   └── user.ts            ← 示例接口
│   ├── hooks/
│   │   └── useRequest.ts
│   └── types/
│       └── index.ts
├── _gitignore
├── _eslintrc.json
└── _prettierrc
```

**manifest.json**

```json
{
  "key": "react-admin",
  "name": "React 后台管理系统",
  "description": "React + Antd Pro + Zustand，含权限路由和请求封装",
  "version": "1.0.0",
  "framework": "react",
  "requiredPm": null,
  "forbiddenPm": [],
  "requiredEnv": { "node": ">=18.0.0" },
  "optionalEnv": {},
  "supportedFeatures": ["eslint", "prettier", "husky", "agents", "coding-rules"],
  "defaultFeatures":   ["eslint", "prettier", "husky", "agents", "coding-rules"],
  "extras": [
    { "key": "tailwind", "label": "Tailwind CSS v3", "default": false },
    { "key": "i18n",     "label": "国际化（i18next）", "default": false }
  ],
  "subPrompts": [],
  "devScript": "dev",
  "buildScript": "build",
  "devPort": 5173,
  "integrationTest": { "skipBuild": false, "skipDevServer": false }
}
```

> 说明：`react-admin` 的 `tailwind` / `i18n` extras 必须在模板目录内自行完成条件渲染，
> 不依赖当前仓库中的全局 `templates/extras/tailwind` 覆盖逻辑。

**package.json.ejs 依赖**

```json
"dependencies": {
  "react": "^18.3.1",
  "react-dom": "^18.3.1",
  "react-router-dom": "^6.23.0",
  "axios": "^1.7.0",
  "zustand": "^4.5.0",
  "antd": "^5.18.0",
  "@ant-design/icons": "^5.3.0"<% if (extras.includes('i18n')) { %>,
  "i18next": "^23.11.0",
  "react-i18next": "^14.1.0"<% } %>
}
```

**router/index.tsx 核心逻辑**

```tsx
// 权限守卫：未登录跳转 /login
// 路由：/ → MainLayout > Dashboard，/login → Login，* → NotFound
// React.lazy + Suspense 懒加载
```

**api/client.ts 核心逻辑**

```ts
// baseURL 读取 import.meta.env.VITE_API_BASE_URL
// 请求拦截：注入 Authorization: Bearer {token}
// 响应拦截：401 → 清除 token → 跳转 /login
```

**验收标准**
```bash
# manifest 驱动验证：重启 CLI，模板列表自动新增 "React 后台管理系统"
node bin/cli.js
# ✔ 列表中出现新模板，无需改代码

# 生成并验证
node bin/cli.js test-admin   # 选 react-admin
cd test-admin && npm install && npm run dev
# ✔ http://localhost:5173 显示登录页
# ✔ npm run build 通过

# 集成测试
npm run test:snapshot-update
npm run test:integration
# ✔ [react-admin] 集成测试通过
```

---

### TASK-102：Electron 桌面应用模板（electron-app）

**目标**
生成 Electron + Vue 3 或 React（用户通过 subPrompts 选择）的桌面应用，含 IPC 示例和打包配置。

**需要创建的文件**

```
templates/electron-app/
├── manifest.json
├── package.json.ejs
├── electron/
│   ├── main.ts
│   ├── preload.ts
│   └── ipc/handlers.ts
├── src/
│   ├── main.ts              ← Vue 版本
│   ├── main.tsx             ← React 版本（通过 ejs 条件渲染）
│   ├── App.vue
│   ├── App.tsx
│   └── composables/useElectron.ts
├── vite.config.ts
├── tsconfig.json
├── electron-builder.json.ejs
└── _gitignore
```

**manifest.json**

```json
{
  "key": "electron-app",
  "name": "Electron 桌面应用",
  "description": "Electron 31 + Vue 3 / React，含 IPC 通信示例和跨平台打包",
  "version": "1.0.0",
  "framework": "electron",
  "requiredPm": null,
  "forbiddenPm": [],
  "requiredEnv": { "node": ">=18.0.0" },
  "optionalEnv": {},
  "supportedFeatures": ["eslint", "prettier", "agents", "coding-rules"],
  "defaultFeatures":   ["eslint", "prettier", "agents", "coding-rules"],
  "extras": [],
  "subPrompts": [
    {
      "key": "renderer",
      "type": "select",
      "label": "选择渲染进程框架",
      "options": [
        { "value": "vue",   "label": "Vue 3 + TypeScript" },
        { "value": "react", "label": "React + TypeScript" }
      ],
      "default": "vue"
    }
  ],
  "devScript": "dev",
  "buildScript": "build",
  "devPort": null,
  "integrationTest": { "skipBuild": false, "skipDevServer": true }
}
```

**注意**：Husky 不在 supportedFeatures 中——Electron 项目通常不需要提交规范强校验。

**IPC 通信示例（必须实现）**

```ts
// preload.ts：contextBridge.exposeInMainWorld('electronAPI', { getSystemInfo })
// ipc/handlers.ts：ipcMain.handle('get-system-info', () => ({ platform, version }))
// App.vue / App.tsx：mounted/useEffect 时调用 window.electronAPI.getSystemInfo()
```

**electron-builder.json.ejs**

```json
{
  "appId": "<%= projectName %>.app",
  "productName": "<%= projectName %>",
  "directories": { "output": "release" },
  "mac":   { "target": "dmg" },
  "win":   { "target": "nsis" },
  "linux": { "target": "AppImage" }
}
```

**验收标准**
```bash
node bin/cli.js test-electron   # 选 electron-app → 渲染框架选 Vue 3
cd test-electron && npm install
npm run dev
# ✔ Electron 窗口打开，显示系统信息（来自 IPC 调用）
npm run build
# ✔ release/ 目录生成打包产物

npm run test:integration
# ✔ [electron-app] 集成测试通过（skipDevServer = true，跳过端口检查）
```

---

### TASK-103：Chrome 扩展模板（chrome-ext）

**目标**
生成 Chrome 扩展模板，Manifest V3，含 popup、content script、background 三个入口。

**需要创建的文件**

```
templates/chrome-ext/
├── manifest.json
├── manifest.json.ejs          ← Chrome 扩展的 manifest（注意与模板 manifest 区分）
├── vite.config.ts             ← 多入口构建
├── package.json.ejs
├── tsconfig.json
├── src/
│   ├── popup/
│   │   ├── index.html
│   │   ├── main.tsx
│   │   └── Popup.tsx
│   ├── content/
│   │   └── index.ts
│   ├── background/
│   │   └── index.ts
│   └── types/chrome.d.ts
└── _gitignore
```

> 注意：模板目录下存在两个 manifest：
> - `manifest.json`：模板元信息，供 CLI 读取
> - `manifest.json.ejs`：生成项目用的 Chrome 扩展 manifest，渲染后输出为 `manifest.json`
> loader.js 读取的是不含 .ejs 后缀的那个，生成器处理 .ejs 文件时会跳过已有的 manifest.json。

**模板 manifest.json**

```json
{
  "key": "chrome-ext",
  "name": "Chrome 浏览器插件",
  "description": "Manifest V3 + React，含 popup / content / background 三入口",
  "version": "1.0.0",
  "framework": "react",
  "requiredPm": null,
  "forbiddenPm": ["yarn"],
  "requiredEnv": { "node": ">=18.0.0" },
  "optionalEnv": {},
  "supportedFeatures": ["eslint", "prettier", "agents", "coding-rules"],
  "defaultFeatures":   ["eslint", "prettier", "agents", "coding-rules"],
  "extras": [],
  "subPrompts": [],
  "devScript": "dev",
  "buildScript": "build",
  "devPort": null,
  "integrationTest": { "skipBuild": false, "skipDevServer": true }
}
```

**Chrome manifest.json.ejs**

```json
{
  "manifest_version": 3,
  "name": "<%= projectName %>",
  "version": "1.0.0",
  "permissions": ["storage", "activeTab", "scripting"],
  "action": { "default_popup": "popup/index.html" },
  "background": { "service_worker": "background/index.js", "type": "module" },
  "content_scripts": [{ "matches": ["<all_urls>"], "js": ["content/index.js"] }]
}
```

**消息通信示例（必须实现）**

```ts
// popup 点击按钮 → chrome.tabs.sendMessage → content script 高亮页面标题
// content script → sendResponse → popup 展示反馈
```

**验收标准**
```bash
node bin/cli.js test-ext   # 选 chrome-ext
cd test-ext && npm install && npm run build
# ✔ dist/ 含正确结构
# ✔ Chrome 扩展管理页加载 dist/ 后插件图标出现
npm run test:integration
# ✔ [chrome-ext] 集成测试通过
```

---

### TASK-104：全栈 Monorepo 模板（monorepo）

**目标**
Turborepo + pnpm workspace，前端（React + Vite）、API（Node + Express）、shared 类型三个子包。

**需要创建的文件**

```
templates/monorepo/
├── manifest.json
├── package.json.ejs           ← 根 package.json，workspaces 配置
├── pnpm-workspace.yaml
├── turbo.json
├── tsconfig.base.json
├── apps/
│   ├── web/
│   │   ├── package.json.ejs
│   │   ├── vite.config.ts
│   │   └── src/
│   │       ├── main.tsx
│   │       └── App.tsx
│   └── api/
│       ├── package.json.ejs
│       ├── tsconfig.json
│       └── src/
│           └── index.ts       ← Express，引用 shared 类型
└── packages/
    └── shared/
        ├── package.json
        ├── tsconfig.json
        └── src/
            └── index.ts       ← 公共类型：User、ApiResponse
```

**manifest.json**

```json
{
  "key": "monorepo",
  "name": "全栈 Monorepo（Turborepo）",
  "description": "Turborepo + pnpm workspace，前端 / API / 共享类型三包联动",
  "version": "1.0.0",
  "framework": "react",
  "requiredPm": "pnpm",
  "forbiddenPm": ["npm", "yarn"],
  "requiredEnv": { "node": ">=18.0.0" },
  "optionalEnv": {},
  "supportedFeatures": ["eslint", "prettier", "husky", "agents", "coding-rules"],
  "defaultFeatures":   ["eslint", "prettier", "agents", "coding-rules"],
  "extras": [],
  "subPrompts": [],
  "devScript": "dev",
  "buildScript": "build",
  "devPort": 5173,
  "integrationTest": { "skipBuild": false, "skipDevServer": false }
}
```

**packages/shared/src/index.ts**

```ts
export interface User { id: string; name: string; email: string }
export interface ApiResponse<T> { code: number; data: T; message: string }
```

**turbo.json**

```json
{
  "$schema": "https://turbo.build/schema.json",
  "pipeline": {
    "build": { "dependsOn": ["^build"], "outputs": ["dist/**"] },
    "dev":   { "cache": false, "persistent": true },
    "lint":  {}
  }
}
```

**验收标准**
```bash
# 注意：monorepo 强制使用 pnpm，validator 会拦截其他选择
node bin/cli.js test-mono   # 选 monorepo，pm 自动锁定 pnpm
cd test-mono && pnpm install
pnpm dev
# ✔ apps/web @ 5173，apps/api @ 3000 同时启动
# ✔ shared 类型在 apps/api 中可 import（无 TS 报错）
pnpm build
# ✔ 全部子包构建成功
npm run test:integration
# ✔ [monorepo] 集成测试通过（使用 pnpm）
```

---

### TASK-105：移动端 H5 模板（mobile-h5）

**目标**
Vue 3 + Vant + rem 自适应的移动端 H5 模板。

**需要创建的文件**

```
templates/mobile-h5/
├── manifest.json
├── package.json.ejs
├── vite.config.ts
├── tsconfig.json
├── index.html
├── src/
│   ├── main.ts
│   ├── App.vue
│   ├── router/
│   │   └── index.ts
│   ├── views/
│   │   ├── Home.vue
│   │   └── Detail.vue
│   ├── composables/
│   │   └── useRequest.ts
│   ├── styles/
│   │   └── reset.css
│   └── utils/
│       └── rem.ts             ← 动态设置 html font-size
└── _gitignore
```

**manifest.json**

```json
{
  "key": "mobile-h5",
  "name": "移动端 H5（Vue 3 + Vant）",
  "description": "Vue 3 + Vant + rem 自适应，适合微信 H5 / 移动端活动页",
  "version": "1.0.0",
  "framework": "vue",
  "requiredPm": null,
  "forbiddenPm": [],
  "requiredEnv": { "node": ">=18.0.0" },
  "optionalEnv": {},
  "supportedFeatures": ["eslint", "prettier", "husky", "agents", "coding-rules"],
  "defaultFeatures":   ["eslint", "prettier", "agents", "coding-rules"],
  "extras": [],
  "subPrompts": [],
  "devScript": "dev",
  "buildScript": "build",
  "devPort": 5173,
  "integrationTest": { "skipBuild": false, "skipDevServer": false }
}
```

**vite.config.ts 关键配置**

```ts
// postcss-pxtorem：px → rem（rootValue: 37.5，基于 375px 设计稿）
// unplugin-vue-components + @vant/auto-import-resolver：Vant 按需引入
```

**utils/rem.ts**

```ts
// 监听 resize，动态设置 document.documentElement.fontSize
// 基准：375px 宽度对应 37.5px 根字体
// 最大宽度限制 540px
```

**验收标准**
```bash
node bin/cli.js test-h5   # 选 mobile-h5
cd test-h5 && npm install && npm run dev
# ✔ 移动端模拟器下布局正常，缩放自适应
# ✔ Vant 组件渲染正常
npm run test:integration
# ✔ [mobile-h5] 集成测试通过
```

---

### TASK-106：TASK-001~105 完成后的回归验证

**目标**
PHASE 0 + PHASE 1 全部完成后，执行完整回归，确认 manifest 驱动机制没有遗漏。

**验收清单**
```bash
# 1. 全量单元测试
node --test
# ✔ 所有测试通过（包含 validator、pm-adapter、manifest loader）

# 2. 全量集成测试
npm run test:integration
# ✔ 8 个模板全部通过

# 3. CLI 完整交互验证
node bin/cli.js
# ✔ 模板列表显示 8 项（3 原有 + 5 新增）
# ✔ 选 monorepo 时 pm 自动锁定 pnpm，选其他 pm 时 validator 拦截
# ✔ 选 electron-app 出现渲染框架子问答
# ✔ 选 chrome-ext + yarn 时 validator 拦截（V02）
```

---

## PHASE 2 — 智能能力

---

### TASK-201：远程模板拉取（增强层，非默认主链路）

**目标**
在本地模板（默认主链路）之上叠加远端拉取能力：
用户主动传 `--remote` 时从 GitHub 拉取最新模板；不传则始终使用本地模板。
本地模板永远打包在 npm 包内，保证离线可用。

**架构说明**

```
默认行为（无 --remote）：
  resolver → 本地 templates/ 目录（v1 行为，不变）

增强行为（传 --remote）：
  resolver → 先尝试远端拉取 → 成功则用远端 → 失败则回退本地并警告
```

> 与 v1 的区别：v1 表述为"默认远端拉取，离线兜底"，改为"默认本地，--remote 为增强"。
> 理由：脚手架的首要职责是可重复、可离线、可验收。联网能力是锦上添花，不是主链路。

**需要创建的文件**：`src/remote/template-fetcher.js`

```js
// fetchRemoteTemplate(templateKey, cacheDir)
// 1. GET https://api.github.com/repos/<owner>/create-x-app/contents/templates/<key>
// 2. 递归下载所有文件到 cacheDir/cxa-<key>-<commit-sha>/
// 3. 缓存有效期 24 小时（mtime 判断）
// 4. 超时 5 秒，失败抛出异常（由 resolver 捕获并回退）
```

**需要修改的文件**

- `src/steps/resolver.js`
- `src/commands/create.js`：`await resolveTemplate(...)`
- `test/integration/runner.js`：同步切换到异步 `resolveTemplate`

```js
export async function resolveTemplate(templateKey, { remote = false } = {}) {
  const localPath = join(TEMPLATES_DIR, templateKey)
  loadManifest(templateKey)  // 本地 manifest 校验（始终执行）

  if (!remote) return localPath   // 默认：直接返回本地路径

  try {
    const remotePath = await fetchRemoteTemplate(templateKey)
    return remotePath
  } catch (err) {
    logger.warn(`远端模板拉取失败，使用本地版本（${err.message}）`)
    return localPath
  }
}
```

**bin/cli.js 新增选项**

```
--remote          使用远端最新模板（默认：使用本地模板）
--no-cache        配合 --remote 使用，忽略缓存强制重新拉取
```

**验收标准**
```bash
# 默认（本地）
node bin/cli.js test-local
# ✔ 无网络请求，直接使用本地模板

# 远端增强
node bin/cli.js test-remote --remote
# ✔ 显示"正在拉取最新模板..."
# ✔ 成功则使用远端模板

# 远端失败回退
node bin/cli.js test-fallback --remote  # 断网或 token 不存在
# ✔ 显示警告"远端拉取失败，使用本地版本"
# ✔ 正常生成项目（使用本地模板）
```

---

### TASK-202：依赖版本刷新（--latest 可选增强）

**目标**
模板内 `package.json.ejs` 的版本号保持基线版本（可预期、可重复）。
新增 `--latest` 标志：传入时在生成前从 npm registry 拉取最新版，替换基线版本。

**架构说明**

```
默认行为（无 --latest）：
  templateVars.versions = 模板内硬编码的基线版本
  → 可重复、可离线、行为稳定

增强行为（传 --latest）：
  拉取各包最新版 → 替换 templateVars.versions → 渲染 package.json.ejs
  → 失败时回退基线版本并警告
```

> 与 v1 的区别：v1 默认实时拉取。改为默认基线，`--latest` 为可选。
> 理由：脚手架生成的项目要能在 CI、离线环境重复执行验收，
> 每次追最新版会导致集成测试不稳定（今天通过、明天依赖升级后失败）。

**需要创建的文件**：`src/utils/pkg-version.js`

```js
// getLatestVersions(packageNames[], { timeout = 3000 } = {})
// 并发 GET https://registry.npmjs.org/{pkg}/latest
// 超时或失败的包返回 null（使用方回退基线版本）
```

**需要修改的文件**：`src/generator/index.js`

```js
// 默认：baselineVersions 来自模板 package.json.ejs 的注释块（见下方约定）
// --latest：调用 getLatestVersions 替换

templateVars.versions = options.latest
  ? await fetchLatestWithFallback(baselineVersions)
  : baselineVersions
```

**模板基线版本约定（在每个模板 package.json.ejs 顶部注释声明）**

```json
<%#
BASELINE_VERSIONS:
react=18.3.1
react-dom=18.3.1
vite=5.3.0
typescript=5.4.5
%>
```

生成器解析此注释，提取 `baselineVersions` 对象。`--latest` 时以此对象的 key 集合去 npm 查询。

**bin/cli.js 新增选项**

```
--latest    生成时从 npm 拉取最新依赖版本（默认：使用模板基线版本）
```

**验收标准**
```bash
# 默认（基线版本）
node bin/cli.js test-baseline
# ✔ package.json 版本号与模板基线一致，无网络请求

# --latest
node bin/cli.js test-latest --latest
# ✔ 显示"正在检测最新依赖版本..."
# ✔ package.json 版本号 ≥ 基线版本
# ✔ npm install 无冲突

# 断网时 --latest
node bin/cli.js test-latest-offline --latest  # 断网
# ✔ 显示警告"版本拉取失败，使用基线版本"
# ✔ 正常生成（使用基线）
```

---

### TASK-203：项目升级命令（upgrade）

**目标**
为已有项目提供配置文件升级能力，对比新版模板与当前配置，生成 diff，用户确认后选择性应用。

**新增命令**：`npx create-x-app-cli upgrade`（在项目根目录运行）

**需要创建的文件**

- `src/commands/upgrade.js`
- `src/upgrade/detector.js`：检测当前项目的模板类型
- `src/upgrade/differ.js`：生成配置文件 diff 列表
- `src/upgrade/applier.js`：将用户选择的变更写入文件

**detector.js 检测逻辑**

```js
// 1. 读取 package.json 中的 "cxa-template" 字段
// 2. 若无此字段，通过依赖关系猜测（有 vite + react → react-vite-ts）
// 3. 返回模板 key 或 null
```

**differ.js 对比范围**（只对比配置文件，不触碰业务代码）

```
tsconfig.json / tsconfig.node.json
.eslintrc.json
vite.config.ts
.prettierrc
commitlint.config.js
```

**applier.js 交互逻辑**

```js
// 对每个有差异的文件，用 @clack/prompts 询问：
// ○ 覆盖  ○ 跳过  ○ 查看 diff 后决定
// 选"查看 diff"时终端打印（新增行绿色 +，删除行红色 -）
```

**生成项目时注入标记**（修改 `src/generator/index.js`）

```js
// 写入 package.json 时追加：
// "cxa-template": "react-vite-ts",
// "cxa-version": "0.1.0"
```

**验收标准**
```bash
node bin/cli.js test-upgrade
cd test-upgrade
# 手动修改 tsconfig.json 某字段，模拟版本偏差

npx create-x-app-cli upgrade
# ✔ 检测到模板类型
# ✔ 列出有差异的文件
# ✔ 查看 diff 功能正常
# ✔ 应用后文件内容正确更新
```

---

### TASK-204：插件系统（Plugin API）

**目标**
允许社区以 npm 包的形式发布自定义模板插件（`cxa-plugin-<name>`），
CLI 自动扫描已安装的插件并将其模板合并到选项列表。

**插件包规范**

```
cxa-plugin-nuxt/
├── package.json    ← 含 "cxa-plugin": true 标记
├── manifest.json   ← 与内置模板 manifest 格式完全相同
└── template/       ← 模板文件，结构与内置模板相同
```

**需要创建的文件**

- `src/plugins/loader.js`：扫描 node_modules 中的插件包
- `src/plugins/registry.js`：合并内置模板 + 插件模板为统一列表

**loader.js 逻辑**

```js
// 1. 扫描 node_modules，过滤 cxa-plugin- 前缀 + "cxa-plugin": true
// 2. 读取各插件的 manifest.json，校验必要字段
// 3. 检查 minCliVersion（若有）
// 4. 返回插件列表 { key, name, templatePath }[]
```

**registry.js 逻辑**

```js
// loadAllManifests() 改为从 registry 读取（内置 + 插件合并）
// resolver 和 prompts 无需修改（已走 loadAllManifests）
```

**验收标准**
```bash
# 创建测试插件并 npm link
mkdir cxa-plugin-test && cd cxa-plugin-test
# 创建符合规范的 package.json + manifest.json + template/
npm link

cd /tmp && node /path/to/bin/cli.js test-plugin
# ✔ 模板列表末尾出现"[插件] 测试模板"
# ✔ 选择后正确生成文件

npm uninstall -g cxa-plugin-test
node bin/cli.js
# ✔ 插件选项消失，内置模板正常
```

---

## PHASE 3 — 生态建设

---

### TASK-301：匿名使用统计（可选择关闭）

**隐私原则**

- 不收集项目名、路径、任何个人信息
- 仅收集：模板 key、CLI 版本、Node 版本、OS 类型
- 首次运行询问一次，结果持久化到 `~/.create-x-app/config.json`
- 任何时候 `--no-telemetry` 可跳过本次上报

**需要创建的文件**

- `src/analytics/consent.js`：首次同意提示
- `src/analytics/index.js`：上报逻辑（2 秒超时，失败静默）

**验收标准**
```bash
rm ~/.create-x-app/config.json
node bin/cli.js test-analytics
# ✔ 出现一次性同意提示
# ✔ 同意后触发上报

node bin/cli.js --no-telemetry
# ✔ 本次不上报，config.json 同意状态不变
```

---

### TASK-302：社区模板市场（CLI 内搜索 + 安装）

**新增命令**

```bash
npx create-x-app-cli search [keyword]
npx create-x-app-cli install cxa-plugin-nuxt
npx create-x-app-cli list
npx create-x-app-cli remove cxa-plugin-nuxt
```

**需要创建的文件**

- `src/commands/search.js`
- `src/commands/install.js`
- `src/commands/remove.js`
- `src/commands/list.js`
- `src/marketplace/client.js`：npm registry 搜索（`cxa-plugin-` 前缀）

**验收标准**
```bash
npx create-x-app-cli search
# ✔ 列出社区插件（名称、描述、周下载量）

npx create-x-app-cli install cxa-plugin-test
# ✔ 安装成功，下次运行出现在模板列表

npx create-x-app-cli remove cxa-plugin-test
# ✔ 卸载成功
```

---

## 全局任务

### TASK-G01：单元测试同步补充

每完成一个 TASK，立即补充对应测试文件。

| 新增测试文件 | 覆盖内容 |
|---|---|
| `test/validator.test.js` | V01~V05 所有规则 |
| `test/pm-adapter.test.js` | 三种 pm 的命令映射 |
| `test/manifest/loader.test.js` | loadManifest / loadAllManifests |
| `test/remote-fetcher.test.js` | 网络失败回退本地；缓存命中 |
| `test/pkg-version.test.js` | 拉取成功；失败回退基线 |
| `test/plugins/loader.test.js` | 扫描到合规插件；过滤不合规包 |
| `test/upgrade/differ.test.js` | 相同文件返回空 diff；不同文件正确 diff |

运行：`node --test`

---

### TASK-G02：文档更新

**AGENTS.md 每 Phase 结束后更新**

- 新增模板 key 列表和 manifest 字段说明
- 新增插件规范（`manifest.json` 字段）
- 更新实现顺序（追加新文件）

**README.md 更新内容**

```markdown
## 支持的模板

| 模板 | 技术栈 |
|------|--------|
| react-vite-ts   | React 18 + Vite 5 + TypeScript 5 |
| node-ts         | Node 18 + TypeScript + tsx |
| java-fullstack  | Spring Boot 3 + React |
| react-admin     | React + Antd Pro + Zustand |
| electron-app    | Electron 31 + Vue 3 / React |
| chrome-ext      | Manifest V3 + React |
| monorepo        | Turborepo + pnpm workspace |
| mobile-h5       | Vue 3 + Vant + rem 适配 |

## 可选标志

| 标志 | 说明 |
|------|------|
| --remote  | 从 GitHub 拉取最新模板（默认使用本地模板）|
| --latest  | 从 npm 拉取最新依赖版本（默认使用基线版本）|
| --skip-install | 跳过 npm install |
| --skip-git     | 跳过 git init |
| --no-telemetry | 本次不上报使用统计 |
```

---

### TASK-G03：版本发布

```
PHASE 0 + PHASE 1 完成 → npm version minor → v0.2.0 → npm publish
PHASE 2 完成           → npm version minor → v0.3.0 → npm publish
PHASE 3 完成           → npm version major → v1.0.0 → npm publish
```

发布前每次执行：
```bash
npm run lint
node bin/cli.js --help
npm pack --dry-run
```

---

## 完整任务依赖关系

```
TASK-000（命名收敛） ─┐
TASK-001（强校验）  ─┼─→ TASK-101~105（新增模板，只建目录+manifest）
TASK-002（PM适配）  ─┤        └→ TASK-106（回归验证）
TASK-003 Part A    ─┘
（manifest驱动）
TASK-003 Part B             └→（每模板后同步补 snapshot）
（集成测试框架）
                       └→ PHASE 2（TASK-201~204）
                                └→ PHASE 3（TASK-301~302）

TASK-G01（单元测试）── 随每个任务同步
TASK-G02（文档）    ── Phase 结束时
TASK-G03（发布）    ── Phase 全部验收后
```

---

## 执行检查清单（每个任务完成后核对）

```
[ ] 若本次任务是新增模板：manifest.json 已创建且字段完整
[ ] 若本次任务是 Phase 1 模板任务：未直接修改 resolver.js / prompts.js / validator.js
[ ] 所有 pm 命令走适配层，无裸 execa('npm', ...) 调用
[ ] 新代码有完整 try/catch
[ ] 对应测试文件已编写并通过
[ ] 集成测试 snapshot 已更新（npm run test:snapshot-update）
[ ] git commit 信息符合 Conventional Commits
```
