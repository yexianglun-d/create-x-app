# AGENTS.md — create-x-app 项目脚手架 CLI

## 项目概述

构建一个名为 `create-x-app` 的 Node.js CLI 工具，通过交互式终端界面为用户生成项目模板。用户只需运行一条命令，回答几个问题，即可得到一个配置完善、开箱即用的项目目录。

**发布到 npm 后，任何人都可以通过以下方式使用：**

```bash
npx create-x-app
```

---

## 技术选型

| 层级 | 选择 | 用途 |
|---|---|---|
| 运行时 | Node.js ≥ 18 | LTS 版本，原生支持 ESM |
| 语言 | JavaScript (ESM) | package.json 中设置 `"type": "module"` |
| CLI 框架 | `commander` | 解析命令行参数 |
| 交互问答 | `@clack/prompts` | 美观的终端 UI |
| 彩色输出 | `chalk` | v5（ESM 版本）|
| 加载动画 | `ora` | v8（ESM 版本）|
| 执行命令 | `execa` | v9（ESM 版本），用于运行 npm / git |
| 模板渲染 | `ejs` | 向模板文件注入变量 |
| 版本比较 | `semver` | 环境版本检测 |
| 文件工具 | `fs-extra` | 复制目录树、创建目录 |

所有依赖必须兼容 ESM，**禁止**在任何地方使用 CommonJS 的 `require()`。

---

## 仓库目录结构

```
create-x-app/
├── bin/
│   └── cli.js                  ← 入口文件 — #!/usr/bin/env node
├── src/
│   ├── commands/
│   │   └── create.js           ← 编排整个创建流程
│   ├── steps/
│   │   ├── env-check.js        ← 检测 Node / Git / Java / pnpm 版本
│   │   ├── prompts.js          ← 所有 @clack/prompts 交互问答
│   │   ├── resolver.js         ← 将用户选择映射到模板路径
│   │   └── post-actions.js     ← npm install、git init、打印后续步骤
│   ├── generator/
│   │   └── index.js            ← 复制模板文件树 + 渲染 ejs 文件
│   └── utils/
│       ├── logger.js           ← 基于 chalk 封装的日志工具（info/warn/error/success）
│       └── version.js          ← 运行命令、解析版本字符串、semver 比较
├── templates/
│   ├── react-vite-ts/          ← 模板：React + Vite + TypeScript
│   ├── node-ts/                ← 模板：Node.js + TypeScript + ESLint + Prettier
│   └── java-fullstack/         ← 模板：Java 后端 + 前端工程说明
├── shared/                     ← 注入到所有生成项目中的公共文件
│   ├── AGENTS.md.ejs
│   ├── README.md.ejs
│   ├── coding-rules.md
│   ├── commitlint.config.js
│   ├── .husky/
│   │   └── commit-msg
│   └── .gitignore
├── package.json
└── README.md
```

---

## package.json（根目录）

```json
{
  "name": "create-x-app",
  "version": "0.1.1",
  "description": "一条命令生成生产级项目模板",
  "type": "module",
  "bin": {
    "create-x-app": "./bin/cli.js"
  },
  "engines": {
    "node": ">=18.0.0"
  },
  "files": [
    "bin",
    "src",
    "templates",
    "shared"
  ],
  "scripts": {
    "dev": "node bin/cli.js",
    "lint": "eslint src",
    "test": "node --test"
  },
  "dependencies": {
    "@clack/prompts": "^0.9.0",
    "chalk": "^5.3.0",
    "commander": "^12.0.0",
    "ejs": "^3.1.10",
    "execa": "^9.3.0",
    "fs-extra": "^11.2.0",
    "ora": "^8.0.1",
    "semver": "^7.6.0"
  },
  "devDependencies": {
    "eslint": "^9.0.0"
  }
}
```

---

## bin/cli.js

```js
#!/usr/bin/env node

import { program } from 'commander'
import { createCommand } from '../src/commands/create.js'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const pkg = JSON.parse(readFileSync(join(__dirname, '../package.json'), 'utf8'))

program
  .name('create-x-app')
  .description('几秒内生成生产级项目脚手架')
  .version(pkg.version)
  .argument('[project-name]', '要创建的项目目录名称')
  .option('--skip-install', '跳过脚手架完成后的 npm install')
  .option('--skip-git', '跳过 git init')
  .action(createCommand)

program.parse()
```

---

## src/commands/create.js

主编排器，按顺序调用每个步骤。

```js
import { runEnvCheck } from '../steps/env-check.js'
import { runPrompts } from '../steps/prompts.js'
import { resolveTemplate } from '../steps/resolver.js'
import { generateProject } from '../generator/index.js'
import { runPostActions } from '../steps/post-actions.js'
import { intro, outro } from '@clack/prompts'
import chalk from 'chalk'

export async function createCommand(projectNameArg, options) {
  console.log()
  intro(chalk.bgCyan.black(' create-x-app '))

  // 第一步 — 环境检测（可选工具只警告，不退出）
  await runEnvCheck()

  // 第二步 — 交互问答（返回 config 对象）
  const config = await runPrompts(projectNameArg)

  // 第三步 — 解析模板目录路径
  const templatePath = resolveTemplate(config.template)

  // 第四步 — 复制模板 + 公共文件 + 渲染 ejs
  await generateProject({ config, templatePath })

  // 第五步 — npm install、git init、打印说明
  await runPostActions({ config, options })

  outro(chalk.green(`项目 ${config.projectName} 已就绪！`))
}
```

---

## src/steps/env-check.js

在继续之前，检查用户环境是否满足最低要求。

### 检测项目

| 工具 | 最低版本 | 是否必须 | 检测方式 |
|---|---|---|---|
| Node.js | 18.0.0 | 是 — 缺失则终止 | `node --version` |
| Git | 2.0.0 | 是 — 缺失则警告，继续执行 | `git --version` |
| pnpm | 8.0.0 | 否 — 仅当用户选择 pnpm 时检测 | `pnpm --version` |
| Java | 21.0.0 | 否 — 仅与 java-fullstack 模板相关 | `java -version 2>&1` |

### 实现要点

- 使用 `execa` 在 try/catch 中运行每条命令
- 使用 `semver.gte(检测到的版本, 最低版本)` 进行比较
- 可选工具不满足时使用 `logger.warn()`，必须工具失败时使用 `logger.error()` + `process.exit(1)`
- 检测过程中显示 spinner（使用 `ora`）
- 最后用 chalk 打印汇总表格

### 输出格式示例

```
✔  Node.js   v20.11.0   ✓（要求 ≥18）
✔  Git        2.43.0    ✓（要求 ≥2）
⚠  Java       未找到     可选 — java-fullstack 模板需要
```

---

## src/steps/prompts.js

所有面向用户的问题，全部使用 `@clack/prompts`。返回一个 `config` 对象。

### 问答顺序

```
1. 项目名称（文本输入）
   - 默认值："my-app"
   - 校验：必须匹配 /^[a-z0-9-_]+$/，不允许空格
   - 若通过 CLI 参数传入，跳过此问题

2. 选择模板（单选）
   - 1. React + Vite + TypeScript       (react-vite-ts)
   - 2. Node.js + TypeScript + ESLint   (node-ts)
   - 3. Java 全栈 + 前端配套说明        (java-fullstack)

3. 需要的功能模块（多选）
   默认勾选：
   - [x] ESLint
   - [x] Prettier
   - [x] commitlint + Husky
   - [x] AGENTS.md
   - [x] coding-rules.md
   仅对 react-vite-ts 显示：
   - [ ] React Router v6
   - [ ] Tailwind CSS v3
   仅对 node-ts 显示：
   - [ ] Express.js
   - [ ] Dotenv + 环境变量校验

4. 包管理器（单选）
   - npm（默认）
   - pnpm
   - yarn

5. 确认？（confirm — 执行前展示汇总信息）
```

### 返回的 config 结构

```js
{
  projectName: 'my-app',          // 字符串
  template: 'react-vite-ts',      // 'react-vite-ts' | 'node-ts' | 'java-fullstack'
  features: ['eslint', 'prettier', 'husky', 'agents', 'coding-rules'],
  extras: ['tailwind'],           // 模板专属附加功能
  packageManager: 'npm',          // 'npm' | 'pnpm' | 'yarn'
  targetDir: '/absolute/path/to/my-app'
}
```

### 处理用户取消操作

用 `@clack/prompts` 的 `isCancel()` 包裹每个问题。若用户在任意问题处按 Ctrl+C，调用 `cancel('操作已取消')` 并执行 `process.exit(0)`。

---

## src/steps/resolver.js

将模板 key 简单映射到文件系统路径。

```js
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const TEMPLATES_DIR = join(__dirname, '../../templates')

const TEMPLATE_MAP = {
  'react-vite-ts':   join(TEMPLATES_DIR, 'react-vite-ts'),
  'node-ts':         join(TEMPLATES_DIR, 'node-ts'),
  'java-fullstack':  join(TEMPLATES_DIR, 'java-fullstack'),
}

export function resolveTemplate(templateKey) {
  const path = TEMPLATE_MAP[templateKey]
  if (!path) throw new Error(`未知模板：${templateKey}`)
  return path
}
```

---

## src/generator/index.js

将选中的模板和公共文件复制到目标目录，然后渲染所有 `.ejs` 文件。

### 执行流程

```
1. 若 targetDir 已存在且非空 → 询问用户是否覆盖
2. ensureDir(targetDir)
3. 将 shared/ 复制到 targetDir（overwrite: false，模板可覆盖公共文件）
4. 将 templateDir/ 复制到 targetDir（overwrite: true，模板优先）
5. 递归遍历 targetDir，找到所有 *.ejs 文件
6. 对每个 .ejs 文件：
   a. 用 ejs.renderFile(filePath, templateVars) 渲染
   b. 将渲染结果写入去掉 .ejs 扩展名的同名文件
   c. 删除原 .ejs 文件
7. 处理附加功能：若 config.extras 包含 'tailwind'，
   则将 templates/extras/tailwind/ 额外复制到 targetDir
```

### 传递给 ejs 的 templateVars 对象

```js
{
  projectName: config.projectName,
  template: config.template,
  packageManager: config.packageManager,
  features: config.features,              // 字符串数组
  hasEslint: config.features.includes('eslint'),
  hasPrettier: config.features.includes('prettier'),
  hasHusky: config.features.includes('husky'),
  year: new Date().getFullYear(),
  nodeVersion: process.version,
}
```

### 点文件命名约定

模板中的点文件以 `_文件名` 存储，避免 npm publish 时被忽略。生成器复制后必须重命名：

```
_gitignore      → .gitignore
_eslintrc.json  → .eslintrc.json
_prettierrc     → .prettierrc
_env.example    → .env.example
_husky/         → .husky/
```

实现 `renameDotfiles(targetDir)` 函数，遍历目录树，将所有以 `_` 开头的文件或文件夹重命名为 `.` + 剩余部分。

---

## src/steps/post-actions.js

所有文件就位后执行。

### 按顺序执行以下步骤

```
1. 若 features 包含 'husky'：
   - 执行：[packageManager] install（在 targetDir 内）
   - 执行：npx husky install
   - 执行：chmod +x .husky/commit-msg

2. 否则，若 !options.skipInstall：
   - 执行：[packageManager] install

3. 若 !options.skipGit：
   - 执行：git init
   - 执行：git add .
   - 执行：git commit -m "chore: 通过 create-x-app 初始化项目"

4. 打印"后续步骤"提示面板：
```

```
后续步骤：
  cd my-app
  npm run dev

项目文档：
  AGENTS.md       ← AI 协作规则说明
  coding-rules.md ← 团队代码规范
```

每个耗时步骤使用 `ora` spinner。执行失败时打印 stderr 并继续（不中断流程）。

---

## src/utils/logger.js

```js
import chalk from 'chalk'

export const logger = {
  info:    (msg) => console.log(chalk.cyan('ℹ'), msg),
  success: (msg) => console.log(chalk.green('✔'), msg),
  warn:    (msg) => console.log(chalk.yellow('⚠'), msg),
  error:   (msg) => console.error(chalk.red('✖'), msg),
  step:    (msg) => console.log(chalk.gray('→'), msg),
}
```

---

## src/utils/version.js

```js
import { execa } from 'execa'
import semver from 'semver'

/**
 * 运行 CLI 命令，从 stdout/stderr 中提取 semver 字符串。
 * 若命令失败或未找到版本号，返回 null。
 */
export async function detectVersion(command, args = []) {
  try {
    const { stdout, stderr } = await execa(command, args, { reject: false })
    const output = stdout || stderr
    const match = output.match(/(\d+\.\d+[\.\d]*)/)
    return match ? semver.coerce(match[1])?.version ?? null : null
  } catch {
    return null
  }
}

/**
 * 若 detected >= minimum 返回 true。
 */
export function meetsMinimum(detected, minimum) {
  if (!detected) return false
  return semver.gte(detected, minimum)
}
```

---

## 模板：react-vite-ts

路径：`templates/react-vite-ts/`

### 需要创建的目录结构

```
react-vite-ts/
├── package.json.ejs
├── vite.config.ts
├── tsconfig.json
├── tsconfig.node.json
├── index.html.ejs
├── src/
│   ├── main.tsx
│   ├── App.tsx
│   ├── App.css
│   └── vite-env.d.ts
├── public/
│   └── favicon.svg
├── _gitignore
├── _eslintrc.json
└── _prettierrc
```

### package.json.ejs 内容

```json
{
  "name": "<%= projectName %>",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "lint": "eslint src --ext ts,tsx --report-unused-disable-directives"
  },
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1"<% if (extras.includes('react-router')) { %>,
    "react-router-dom": "^6.23.0"<% } %>
  },
  "devDependencies": {
    "@types/react": "^18.3.3",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.0",
    "typescript": "^5.4.5",
    "vite": "^5.3.0"<% if (hasEslint) { %>,
    "eslint": "^9.0.0",
    "@typescript-eslint/eslint-plugin": "^7.0.0",
    "@typescript-eslint/parser": "^7.0.0"<% } %><% if (hasPrettier) { %>,
    "prettier": "^3.3.0"<% } %><% if (extras.includes('tailwind')) { %>,
    "tailwindcss": "^3.4.0",
    "autoprefixer": "^10.4.19",
    "postcss": "^8.4.38"<% } %>
  }
}
```

### vite.config.ts

```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': '/src' },
  },
})
```

### tsconfig.json

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

### src/App.tsx

```tsx
function App() {
  return (
    <main style={{ fontFamily: 'system-ui', padding: '2rem' }}>
      <h1>欢迎使用 create-x-app</h1>
      <p>编辑 <code>src/App.tsx</code> 开始开发。</p>
    </main>
  )
}

export default App
```

---

## 模板：node-ts

路径：`templates/node-ts/`

### 需要创建的目录结构

```
node-ts/
├── package.json.ejs
├── tsconfig.json
├── src/
│   └── index.ts.ejs
├── _gitignore
├── _eslintrc.json
├── _prettierrc
└── _env.example
```

### package.json.ejs 内容

```json
{
  "name": "<%= projectName %>",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "lint": "eslint src"
  },
  "dependencies": {<% if (extras.includes('express')) { %>
    "express": "^4.19.2"<% } else { %>
  <% } %>
  },
  "devDependencies": {
    "typescript": "^5.4.5",
    "tsx": "^4.15.0",
    "@types/node": "^20.14.0"<% if (hasEslint) { %>,
    "eslint": "^9.0.0",
    "@typescript-eslint/eslint-plugin": "^7.0.0",
    "@typescript-eslint/parser": "^7.0.0"<% } %><% if (hasPrettier) { %>,
    "prettier": "^3.3.0"<% } %><% if (extras.includes('express')) { %>,
    "@types/express": "^4.17.21"<% } %><% if (extras.includes('dotenv')) { %>,
    "dotenv": "^16.4.5"<% } %>
  }
}
```

### tsconfig.json

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "rootDir": "src",
    "outDir": "dist",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true
  },
  "include": ["src"],
  "exclude": ["node_modules", "dist"]
}
```

### src/index.ts.ejs

```ts
<% if (extras.includes('dotenv')) { %>import 'dotenv/config'
<% } %><% if (extras.includes('express')) { %>import express from 'express'

const app = express()
const PORT = process.env.PORT ?? 3000

app.use(express.json())

app.get('/', (_req, res) => {
  res.json({ message: '你好，来自 <%= projectName %>' })
})

app.listen(PORT, () => {
  console.log(`服务已启动：http://localhost:${PORT}`)
})
<% } else { %>
console.log('你好，来自 <%= projectName %>')
<% } %>
```

---

## 模板：java-fullstack

路径：`templates/java-fullstack/`

此模板**不生成 Java 项目**（Maven/Gradle 超出本工具范围），而是生成一套前端工程（与 react-vite-ts 相同）加上一份详细的 `BACKEND.md` 说明如何搭建 Spring Boot 端。

### 目录结构

```
java-fullstack/
├── frontend/              ← 与 react-vite-ts 模板相同
│   └── （所有 react-vite-ts 文件）
├── BACKEND.md             ← Spring Boot 搭建指南
└── docker-compose.yml.ejs
```

### BACKEND.md 内容

编写一份清晰的 Markdown 文档，包含以下内容：

**一、环境要求** — Java 21、Maven 3.9+、推荐 IntelliJ IDEA

**二、创建 Spring Boot 项目** — 访问 start.spring.io，配置如下：
- Spring Boot 3.x
- 打包方式：Jar
- Java 版本：21
- 依赖：Spring Web、Spring Data JPA、Lombok、Validation、Spring Security

**三、推荐目录结构**

```
src/main/java/com/example/app/
├── config/
├── controller/
├── service/
├── repository/
├── model/
│   ├── entity/
│   └── dto/
└── exception/
```

**四、CORS 配置** — 添加允许 `http://localhost:5173` 的代码片段

**五、连接前端** — 更新 vite.config.ts，将代理指向 `http://localhost:8080`

**六、环境变量** — 提供含数据库、JWT 密钥占位符的 `application.yml` 模板

---

## 公共文件（注入所有模板）

### shared/AGENTS.md.ejs

```markdown
# AGENTS.md

## 项目：<%= projectName %>

> 本文件描述了 AI 编程助手（Copilot、Claude、Cursor、Codex 等）
> 在本仓库中应遵守的约定和上下文信息。

## 技术栈

- 模板：<%= template %>
- 包管理器：<%= packageManager %>
- 脚手架年份：<%= year %>

## 代码规范

- 所有新文件必须使用 TypeScript（开启 strict 模式）。
- 优先使用函数式风格，除非框架强制使用类。
- 只使用命名导出，React 组件和 Next.js 页面除外可用默认导出。
- 文件名约定：普通文件用 kebab-case，组件文件用 PascalCase。

## 提交信息格式

遵循 Conventional Commits 规范：
  feat: 新增用户登录功能
  fix: 修正分页中的差一错误
  chore: 更新依赖
  docs: 补充 API 文档

## 禁止事项

- 禁止提交密钥或 .env 文件。
- 禁止在无说明注释的情况下用 @ts-ignore 禁用 TypeScript 严格检查。
- 禁止直接向 main 分支推送代码。
```

### shared/README.md.ejs

```markdown
# <%= projectName %>

由 [create-x-app](https://npmjs.com/package/create-x-app) 脚手架生成。

## 技术栈

<% if (template === 'react-vite-ts') { %>
- React 18 + Vite 5 + TypeScript 5
<% } else if (template === 'node-ts') { %>
- Node.js + TypeScript 5 + tsx
<% } else { %>
- Java 21 + Spring Boot 3 / React + Vite + TypeScript
<% } %>
<% if (hasEslint) { %>- ESLint<% } %><% if (hasPrettier) { %> + Prettier<% } %>
<% if (hasHusky) { %>- Husky + commitlint<% } %>

## 快速开始

```bash
<%= packageManager %> install
<%= packageManager %> run dev
```

## 延伸阅读

- [AGENTS.md](./AGENTS.md) — AI 助手协作约定
- [coding-rules.md](./coding-rules.md) — 团队代码规范
```

### shared/coding-rules.md（静态文件，非 ejs）

```markdown
# 代码规范

## 通用原则

- 优先使用 `const`，次选 `let`，禁止使用 `var`。
- 使用可选链（`?.`）和空值合并（`??`）。
- 避免魔法数字，将其提取为具名常量。
- 函数应只做一件事，且不超过 40 行。
- 避免嵌套三元表达式。

## TypeScript

- 开启 strict 模式，不得单独禁用任何严格检查项。
- 避免使用 `any`，使用 `unknown` 并配合类型守卫收窄类型。
- 对象类型结构优先用 interface，联合类型和别名用 type。
- 类型定义应与其实现一并导出。

## React（如适用）

- 每个文件只包含一个组件。
- 只使用函数组件 + Hooks，禁止类组件。
- 组件不超过 150 行，超出时拆分为子组件。
- 业务逻辑不放在组件内，提取到 hooks 或 utils 中。
- 列表渲染必须提供 key，禁止使用数组索引作为 key。

## Git 工作流

- 分支命名：`feat/...`、`fix/...`、`chore/...`
- 合并到 main 前必须经过 Code Review。
- feature 分支合并时使用 Squash commits。

## 测试

- 测试文件命名：`*.test.ts` 或 `*.spec.ts`。
- 测试文件与源文件放在同一目录下。
- 业务逻辑代码覆盖率目标 ≥ 80%。
```

### shared/commitlint.config.js

```js
export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [2, 'always', [
      'feat', 'fix', 'docs', 'style', 'refactor',
      'perf', 'test', 'chore', 'revert', 'ci',
    ]],
    'subject-max-length': [2, 'always', 100],
  },
}
```

### shared/.husky/commit-msg

```sh
#!/bin/sh
npx --no -- commitlint --edit "$1"
```

### shared/_gitignore

```
node_modules/
dist/
.env
.env.local
.DS_Store
*.log
coverage/
```

---

## 各模板共享的 ESLint 配置（写入各模板目录的 _eslintrc.json）

```json
{
  "root": true,
  "env": { "es2022": true, "node": true },
  "parser": "@typescript-eslint/parser",
  "parserOptions": { "ecmaVersion": "latest", "sourceType": "module" },
  "plugins": ["@typescript-eslint"],
  "extends": [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended"
  ],
  "rules": {
    "no-console": "warn",
    "@typescript-eslint/no-unused-vars": ["error", { "argsIgnorePattern": "^_" }],
    "@typescript-eslint/no-explicit-any": "error"
  }
}
```

---

## 错误处理要求

- 每个 `async` 函数必须包裹在 try/catch 中。
- 关键步骤失败（generate、npm install），清晰打印错误后以 code 1 退出。
- 可选步骤失败（git commit），打印警告后继续执行。
- 禁止静默吞掉任何错误。
- 未捕获的 rejection 必须在退出前打印用户友好的错误信息。

```js
process.on('unhandledRejection', (err) => {
  logger.error('发生意外错误：' + err.message)
  process.exit(1)
})
```

---

## 测试

在 `test/` 目录下使用 Node.js 内置的 `node:test` 编写测试。

### 需要实现的测试

| 文件 | 测试内容 |
|---|---|
| `test/version.test.js` | `detectVersion` 对未知命令返回 null；对 `node` 命令返回 semver 字符串 |
| `test/resolver.test.js` | 已知 key 返回正确路径；未知 key 抛出错误 |
| `test/generator.test.js` | 将文件复制到临时目录；`_gitignore` 正确重命名为 `.gitignore`；ejs 变量正确渲染 |

运行命令：`node --test`

---

## Codex 的实现顺序

按照以下顺序创建文件，避免 import 报错：

1. `package.json`（根目录）
2. `src/utils/logger.js`
3. `src/utils/version.js`
4. `src/steps/env-check.js`
5. `src/steps/resolver.js`
6. `src/steps/prompts.js`
7. `src/generator/index.js`
8. `src/steps/post-actions.js`
9. `src/commands/create.js`
10. `bin/cli.js`
11. 所有模板文件（react-vite-ts、node-ts、java-fullstack）
12. 所有公共文件（shared/）
13. 测试文件

实现完成后，运行以下命令进行验证：

```bash
npm install
node bin/cli.js my-test-project
```

### 手动验证清单

- [ ] 环境检测表格正常显示
- [ ] 所有问答正常交互
- [ ] 选择每套模板均能生成正确的文件树
- [ ] 输出目录中出现 `.gitignore`（而非 `_gitignore`）
- [ ] 输出目录中包含 `AGENTS.md`、`README.md`、`coding-rules.md`
- [ ] `README.md` 和 `AGENTS.md` 中的 `projectName` 变量已正确渲染
- [ ] npm install 无报错完成
- [ ] git init + 初始提交成功执行

---

## 发布前检查清单

在运行 `npm publish` 之前：

- [ ] 更新 package.json 中的版本号（使用 `npm version patch`）
- [ ] 确认 `files` 字段包含 `bin`、`src`、`templates`、`shared`
- [ ] 本地运行 `node bin/cli.js` 验证完整流程正常
- [ ] 在 npmjs.com 确认包名 `create-x-app` 可用
- [ ] 撰写含使用说明和 CLI 演示动图的 `README.md`
- [ ] 运行 `npm pack --dry-run` 预览将要发布的文件列表

```bash
npm login
npm publish --access public
```

发布后通过以下命令验证：

```bash
npx create-x-app my-first-project
```

---

## 完成标准

满足以下所有条件即视为项目完成：

1. `npx create-x-app` 全流程零手动操作可运行
2. 三套模板均能生成有效、可运行的项目（`npm run dev` 正常启动）
3. 每个生成的项目均包含公共文件（AGENTS.md、coding-rules.md、husky）
4. 环境检测对版本过低的工具能正确发出警告
5. 所有测试通过：`node --test`
6. 包已发布并可从 npm 安装
