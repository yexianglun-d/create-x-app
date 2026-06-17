# create-x-app CLI 修复执行文档（交给 Codex 使用）

> 目标仓库：`https://github.com/yexianglun-d/create-x-app.git`  
> 项目类型：npm CLI 工具  
> 主要技术栈：Node.js、ESM、Commander.js、chalk/picocolors、npm/npx、测试框架为 Node 内置 test runner  
> 文档用途：把代码审查发现的问题拆成可执行任务，交给 Codex 按优先级逐项修复。  
> 执行原则：每次只修一个任务；必须补测试；必须能复现问题；必须提供验收结果。

---

## 0. 给 Codex 的总指令

你是这个仓库的修复执行者。不要泛泛重构，不要顺手改无关代码，不要把多个高风险问题混在一个提交里。你必须按本文档的任务顺序执行，完成一个任务后再进入下一个任务。

### 0.1 不可妥协的规则

1. **一个任务一个分支或一个独立提交。** 不允许把安全修复、CI 修复、格式化、重构混在一起。
2. **先读代码再改代码。** 本文档中的路径和代码片段来自审查结果，但你仍必须打开当前仓库确认实际实现。
3. **所有用户输入路径必须通过统一安全解析。** 禁止继续直接 `join(targetDir, userControlledPath)`。
4. **业务层不得直接 `process.exit()`。** 业务函数只能返回或抛出结构化错误，由入口统一处理。
5. **stdout/stderr 必须分流。** 机器可读输出只进 stdout；日志、spinner、警告、错误只进 stderr。
6. **新增行为必须有测试。** 安全修复没有测试等于没修。
7. **修复必须可验证。** 每个任务完成后运行该任务列出的命令。
8. **不要优先做 TypeScript 迁移。** TS 迁移是 P2，大面积迁移会干扰 P0/P1 修复。
9. **不要发布 npm。** 本文档只要求修改代码、测试、CI 和发布准备逻辑。真正发布由维护者执行。
10. **不要删除用户数据来证明测试。** 所有 destructive 行为必须使用临时目录 fixture。

### 0.2 标准工作流

每个任务按这个流程执行：

```bash
git status --short
npm ci
npm test
```

然后：

1. 建分支，例如 `fix/p0-path-safety`。
2. 阅读任务指定文件。
3. 新增失败测试，确认测试能暴露问题。
4. 实现最小修复。
5. 运行任务指定测试。
6. 运行通用验证命令。
7. 输出变更摘要、测试结果、剩余风险。

通用验证命令：

```bash
npm run lint
npm test
npm run test:smoke
npm pack --dry-run
```

如果当前仓库脚本不存在某项，先不要创造无关脚本；在任务涉及发布/CI 时再补。

---

## 1. 优先级总览

### P0：必须先修，未完成前不允许发布

- P0-01：封堵 manifest/artifact 路径穿越，阻止删除目标目录外文件。
- P0-02：统一 CLI 错误模型，清除业务层 `process.exit()`。
- P0-03：修复 `--force` 的数据破坏风险，禁止清空非 create-x-app 管理的未知目录。
- P0-04：建立 npm pack 产物端到端测试，防止 main 与 registry 行为脱节。
- P0-05：补 `prepack` / `prepublishOnly` 发布质量闸门。

### P1：重要修复，直接影响安全、跨平台、CI 和 DX

- P1-01：CLI 入口改为懒加载命令，降低冷启动成本。
- P1-02：非交互模式支持 subPrompt answers 和配置文件。
- P1-03：远端模板下载增加 timeout、临时目录安全、完整性校验基础设施。
- P1-04：GitHub preset loader 增加 timeout、schema 校验、可选 hash 校验。
- P1-05：插件安装隔离，默认禁用 lifecycle scripts。
- P1-06：CI 增加 macOS/Windows/Linux 矩阵，并跑完整测试。
- P1-07：spinner 与日志在 CI/非 TTY/JSON 模式下降级。
- P1-08：参数校验 fail fast，不允许非法参数静默 fallback。

### P2：技术债和长期演进

- P2-01：stdout/stderr 彻底分流，所有机器输出支持 `--json`。
- P2-02：补短选项体系，改善 CLI 手感。
- P2-03：`upgrade` 支持 `--cwd`。
- P2-04：增强 `template test`，支持 install/build/lint 验证。
- P2-05：明确 package `main` / `exports` 边界。
- P2-06：README 区分 stable 与 next，避免未发布功能误导用户。
- P2-07：逐步迁移 TypeScript strict，不要和 P0/P1 混做。

---

# 2. P0 任务卡

## P0-01 封堵 manifest/artifact 路径穿越

**严重程度：Critical**  
**目标文件：**

- `src/generator/index.js`
- `src/manifest/validate.js`
- `src/plugins/loader.js`
- `test/unit/generator-safety.test.js` 或新增同等测试文件
- `test/unit/manifest.test.js` 或新增同等测试文件

### 问题

生成器把 manifest 中的 artifact 路径直接拼接到 `targetDir` 后删除或复制。只检查字符串是否非空，不检查：

- `../` 路径穿越
- 绝对路径
- Windows drive path，例如 `C:\Users\...`
- UNC path，例如 `\\server\share`
- NUL 字符
- 混用斜杠的绕过路径，例如 `..\..\file`

这会允许恶意插件通过 artifacts 删除目标目录外文件。

### 目标行为

任何来自 manifest、插件、preset、远端模板的文件路径，在用于读写、复制、删除前，必须满足：

1. 是非空字符串。
2. 不是绝对路径。
3. 不包含 NUL。
4. 不能越过目标根目录。
5. Windows 与 POSIX 路径都必须处理。

### 建议实现

新增统一工具：

```js
// src/utils/safe-path.js
import path from 'node:path'

export function resolveInside(rootDir, candidatePath) {
  if (typeof candidatePath !== 'string' || candidatePath.trim() === '') {
    throw new Error('路径必须是非空字符串')
  }

  if (candidatePath.includes('\0')) {
    throw new Error(`非法路径：包含 NUL 字符：${candidatePath}`)
  }

  if (
    path.isAbsolute(candidatePath) ||
    path.win32.isAbsolute(candidatePath) ||
    candidatePath.startsWith('\\\\')
  ) {
    throw new Error(`非法路径：不允许绝对路径：${candidatePath}`)
  }

  const root = path.resolve(rootDir)
  const target = path.resolve(root, candidatePath)
  const relativePath = path.relative(root, target)

  if (
    relativePath === '' ||
    relativePath.startsWith('..') ||
    path.isAbsolute(relativePath) ||
    path.win32.isAbsolute(relativePath)
  ) {
    throw new Error(`非法路径：越过目标目录：${candidatePath}`)
  }

  return target
}
```

所有危险调用替换为：

```js
await fs.remove(resolveInside(targetDir, artifactPath))
```

manifest 校验也必须提前拒绝非法路径，不要只在生成阶段失败。

### 必须新增测试

1. artifacts 包含 `../../outside.txt` 时，生成失败，outside 文件仍存在。
2. artifacts 包含 `/tmp/outside.txt` 时，manifest 校验失败。
3. artifacts 包含 `C:\\Users\\x\\file` 时，manifest 校验失败。
4. artifacts 包含 `..\\..\\outside.txt` 时，manifest 校验失败。
5. artifacts 包含 `normal/file.txt` 时通过。
6. feature artifacts、extra artifacts、subPrompt artifacts 都覆盖。

### 验收命令

```bash
npm test -- generator-safety
npm test -- manifest
npm test
npm run test:smoke
```

### Codex 执行提示词

```text
只执行 P0-01。请检查 src/generator/index.js、src/manifest/validate.js 和插件 manifest 加载链路。
目标是封堵所有 manifest/artifact/templatePath 路径穿越。新增 src/utils/safe-path.js，所有用户或插件控制的路径在读写删除前必须通过 resolveInside。
先补失败测试，覆盖 ../、..\\、绝对路径、Windows drive path、UNC path、NUL 字符，以及合法相对路径。
不要做无关格式化。完成后运行 npm test -- generator-safety、npm test -- manifest、npm test、npm run test:smoke，并汇报结果。
```

---

## P0-02 统一 CLI 错误模型，移除业务层 process.exit()

**严重程度：Major**  
**目标文件：**

- `bin/cli.js`
- `src/commands/create.js`
- `src/steps/prompts.js`
- `src/steps/env-check.js`
- `src/commands/install.js`
- `src/commands/template.js`
- `src/commands/plugin.js`
- `src/commands/upgrade.js`
- `src/utils/logger.js`
- 新增 `src/errors/cli-error.js`

### 问题

多个业务模块直接调用 `process.exit(1)` 或 `process.exit(0)`。这会导致：

- 测试无法自然捕获错误。
- 顶层无法统一清理资源。
- 所有失败几乎都是 exit code 1。
- Commander 的错误机制和 `parseAsync` 无法发挥作用。
- 非预期异常容易以 stack trace 泄漏给普通用户。

### 目标行为

业务层只能：

- 成功时 return。
- 失败时 throw `CliError` 或普通 Error。

只有 `bin/cli.js` 顶层可以设置 `process.exitCode`。

### 建议实现

```js
// src/errors/cli-error.js
export class CliError extends Error {
  constructor(message, options = {}) {
    super(message, { cause: options.cause })
    this.name = 'CliError'
    this.code = options.code ?? 'E_GENERAL'
    this.exitCode = options.exitCode ?? 1
    this.details = options.details
    this.showStack = options.showStack ?? false
  }
}

export const EXIT_CODES = Object.freeze({
  OK: 0,
  USAGE: 2,
  ENVIRONMENT: 3,
  FILESYSTEM: 4,
  NETWORK: 5,
  INTERNAL: 70,
})
```

入口统一处理：

```js
async function main() {
  try {
    await program.parseAsync(process.argv)
  } catch (error) {
    reportCliError(error, { debug: program.opts().debug })
    process.exitCode = error.exitCode ?? 1
  }
}

main()
```

### 必须新增测试

1. 用户参数错误返回 exit code 2。
2. 环境缺失返回 exit code 3。
3. 文件系统权限或目标目录错误返回 exit code 4。
4. 普通用户模式不输出 stack trace。
5. `--debug` 模式输出 cause/stack。
6. 业务模块测试不需要 mock `process.exit`。

### 验收命令

```bash
npm test -- cli-error
npm test -- prompts
npm test -- env-check
npm run test:smoke
```

### Codex 执行提示词

```text
只执行 P0-02。新增结构化 CliError 和 EXIT_CODES。移除业务层 process.exit 调用，改为 return 或 throw CliError。bin/cli.js 作为唯一设置 process.exitCode 的位置。
保持现有用户可见文案，但错误输出必须可控：普通模式无 stack，--debug 才显示 stack/cause。
补 spawn 集成测试验证 exitCode、stdout/stderr 和 stack trace 行为。不要同时重构命令结构。
```

---

## P0-03 让 --force 不再无保护清空未知非空目录

**严重程度：Major**  
**目标文件：**

- `src/generator/index.js`
- `src/steps/resolver.js`
- `test/unit/generator-safety.test.js`
- `test/integration/create.test.js` 或新增同等测试

### 问题

当前逻辑默认拒绝非空目录，这是正确的；但用户加 `--force` 后仍会直接 `fs.emptyDir(targetDir)`。命令打错路径时可能清空当前项目目录。

### 目标行为

`--force` 不能等价于“无条件删除”。建议规则：

1. 目标目录不存在：允许创建。
2. 目标目录存在且为空：允许使用。
3. 目标目录存在且非空，但包含 create-x-app 元数据文件：允许覆盖。
4. 目标目录存在且非空，且不是 create-x-app 管理目录：默认拒绝。
5. 如确需覆盖未知目录，必须提供显式双确认，例如 `--force --allow-destructive-overwrite`，并优先要求 `--backup`。

### 建议实现

```js
async function isManagedCreateXAppDirectory(targetDir) {
  return fs.pathExists(join(targetDir, '.create-x-app/project.json'))
}

async function ensureTargetDirectoryReady(targetDir, options) {
  if (!await fs.pathExists(targetDir)) return
  if (await isDirectoryEmpty(targetDir)) return

  const managed = await isManagedCreateXAppDirectory(targetDir)

  if (!managed) {
    throw new CliError(
      `拒绝清空非 create-x-app 管理的非空目录：${targetDir}`,
      { code: 'E_UNSAFE_TARGET', exitCode: EXIT_CODES.FILESYSTEM }
    )
  }

  if (!options.force) {
    throw new CliError(
      `目标目录已存在且非空：${targetDir}。如需覆盖，请显式添加 --force`,
      { code: 'E_TARGET_NOT_EMPTY', exitCode: EXIT_CODES.FILESYSTEM }
    )
  }

  await fs.emptyDir(targetDir)
}
```

### 必须新增测试

1. 非空未知目录 + 无 `--force`：失败，不删除文件。
2. 非空未知目录 + `--force`：仍失败，不删除文件。
3. 非空托管目录 + `--force`：允许覆盖。
4. `--dry-run` 不删除任何文件。
5. `--target . --force` 在未知目录中必须拒绝。

### 验收命令

```bash
npm test -- generator-safety
npm run test:smoke
```

### Codex 执行提示词

```text
只执行 P0-03。修复 --force 的破坏性行为。未知非空目录即使传 --force 也必须拒绝清空，除非后续另有显式破坏性选项；本任务先实现默认安全规则。
补测试证明 outside/unknown files 不会被删除。不要修改模板生成逻辑。
```

---

## P0-04 增加 npm pack 产物端到端测试

**严重程度：Critical**  
**目标文件：**

- `package.json`
- `test/smoke/runner.js`
- 新增 `test/packed/runner.js` 或 `scripts/test-packed.js`
- `.github/workflows/ci.yml`
- `.github/workflows/release.yml`

### 问题

源码 smoke 不等于 npm 用户拿到的 tarball smoke。当前最大发布风险是 main 分支、README、CI 与 npm registry 行为不一致。

### 目标行为

CI 必须先 `npm pack`，再在临时目录安装生成的 `.tgz`，通过 `node_modules/.bin/create-x-app` 执行真实用户路径。

### 建议脚本

```js
// scripts/test-packed.js
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { execa } from 'execa'

const root = resolve(import.meta.dirname, '..')
const workDir = await mkdtemp(join(tmpdir(), 'cxa-packed-'))

try {
  const { stdout } = await execa('npm', ['pack', '--json'], { cwd: root })
  const [{ filename }] = JSON.parse(stdout)
  const tarball = join(root, filename)

  await execa('npm', ['init', '-y'], { cwd: workDir })
  await execa('npm', ['install', tarball], { cwd: workDir })

  const bin = join(workDir, 'node_modules/.bin/create-x-app')

  await execa(bin, ['--help'], { cwd: workDir })
  await execa(bin, [
    'packed-smoke',
    '--template', 'node-ts',
    '--pm', 'npm',
    '--features', 'agents,coding-rules',
    '--extras', '',
    '--target', join(workDir, 'out'),
    '--deps', 'baseline',
    '--skip-install',
    '--skip-git',
    '--no-telemetry',
    '--yes',
  ], { cwd: workDir })
} finally {
  await rm(workDir, { recursive: true, force: true })
}
```

如果仓库没有 `execa`，可以用 `node:child_process` 实现，避免新增生产依赖。

### 必须新增测试

1. packed tarball 中两个 bin 入口都可执行。
2. `--help` 包含 README 宣称的核心选项。
3. 非交互创建在 packed install 后成功。
4. `npm pack --dry-run` 输出只包含必要文件。

### 验收命令

```bash
npm run test:packed
npm pack --dry-run
```

### Codex 执行提示词

```text
只执行 P0-04。新增 npm pack 后安装 tarball 的端到端测试，确保测试的是交付物而不是源码。把脚本加入 package.json，并在 CI 和 release workflow 中调用。
测试必须验证 bin 可执行、help 包含核心命令、非交互创建成功。不要修改业务逻辑，除非 packed 测试暴露 packaging 缺陷。
```

---

## P0-05 增加 prepack / prepublishOnly 发布闸门

**严重程度：Major**  
**目标文件：**

- `package.json`
- `.github/workflows/release.yml`

### 问题

本地 `npm publish` 可以绕过 lint/test/smoke/pack 验证。发布治理靠维护者记忆，不是工程保证。

### 目标行为

本地和 CI 发布前都必须跑同一套 check。

### 建议修改

```json
{
  "scripts": {
    "check": "npm run lint && npm test && npm run test:smoke && npm run test:packed && npm pack --dry-run",
    "prepack": "npm run lint && npm test",
    "prepublishOnly": "npm run check"
  },
  "publishConfig": {
    "access": "public",
    "provenance": true
  }
}
```

注意：如果 `prepack` 调用了 `npm pack --dry-run`，会递归触发。不要这么写。

### 验收命令

```bash
npm run check
npm pack --dry-run
```

### Codex 执行提示词

```text
只执行 P0-05。为 package.json 增加 check、prepack、prepublishOnly 和 publishConfig.provenance。避免 prepack 递归调用 npm pack。同步 release workflow 使用 npm run check。
```

---

# 3. P1 任务卡

## P1-01 CLI 入口改为懒加载命令

**严重程度：Major**  
**目标文件：**

- `bin/cli.js`
- `src/commands/*.js`
- `src/plugins/loader.js`
- 新增冷启动测试或 smoke 断言

### 问题

入口文件静态 import 所有命令。`--help`、`--version` 也会加载插件扫描、远端、marketplace 等非核心模块。

### 目标行为

`bin/cli.js` 只负责：

- 创建 Commander program。
- 注册命令和选项。
- 在 action 中动态 import 具体命令。
- 顶层统一错误处理。

### 建议实现

```js
program
  .command('template')
  .description('模板作者工具链')
  .command('lint')
  .option('--template <key>')
  .action(async (options) => {
    applyGlobalLoggerOptions()
    const { templateLintCommand } = await import('../src/commands/template.js')
    return templateLintCommand(options)
  })
```

根命令：

```js
program.action(async (projectNameArg, options) => {
  applyGlobalLoggerOptions(options)
  const { createCommand } = await import('../src/commands/create.js')
  return createCommand(projectNameArg, { ...options, cliVersion: packageJson.version })
})
```

### 必须新增测试

1. `create-x-app --help` 不触发插件扫描。
2. `create-x-app --version` 不触发插件扫描。
3. 命令行为不变。
4. 可选：冷启动基准低于目标阈值，或至少记录耗时。

### 验收命令

```bash
node bin/cli.js --help
node bin/cli.js --version
npm run test:smoke
```

### Codex 执行提示词

```text
只执行 P1-01。重构 bin/cli.js，把命令实现改为 action 内动态 import。入口不得静态加载插件扫描、远端模板、marketplace 等重模块。保持 help 文案和命令行为不变。
补测试证明 --help/--version 不触发插件扫描。
```

---

## P1-02 非交互模式支持 subPrompt answers 和配置文件

**严重程度：Major**  
**目标文件：**

- `bin/cli.js`
- `src/steps/prompts.js`
- `src/presets/loader.js`
- `test/unit/prompts-options.test.js`
- `test/smoke/runner.js`

### 问题

当前非交互模式只能覆盖模板、包管理器、features、extras 等第一层问题。subPrompt 只能使用默认值，无法通过 CLI 或 preset 指定。

### 目标行为

支持以下两种方式之一，推荐两者都支持：

```bash
create-x-app my-app --template electron-app --answers '{"renderer":"react"}' --yes
```

```bash
create-x-app my-app --config ./create-x-app.config.json --yes
```

配置文件示例：

```json
{
  "template": "electron-app",
  "packageManager": "npm",
  "features": ["agents"],
  "extras": [],
  "answers": {
    "renderer": "react"
  }
}
```

### 必须新增测试

1. `--answers` 合法 JSON 覆盖 subPrompt 默认值。
2. `--answers` 非法 JSON 返回 usage 错误。
3. `--config` 文件不存在返回文件系统错误。
4. `--config` 与 CLI 参数冲突时，CLI 参数优先。
5. `--yes` 在所有必需 answer 可解析时不进入 prompt。

### 验收命令

```bash
npm test -- prompts-options
npm run test:smoke
```

### Codex 执行提示词

```text
只执行 P1-02。为 create 命令增加 --answers <json> 和 --config <file>，让非交互模式能覆盖 subPrompt。实现配置合并顺序：默认值 < preset/config < CLI options < --answers。
非法 JSON、未知 answer key、非法 answer value 必须 fail fast。补 prompts-options 和 smoke 测试。
```

---

## P1-03 远端模板下载加 timeout、安全临时目录和完整性校验基础设施

**严重程度：Major**  
**目标文件：**

- `src/remote/template-fetcher.js`
- `src/steps/resolver.js`
- `src/utils/safe-path.js`
- `test/unit/remote-template-fetcher.test.js`

### 问题

远端模板下载依赖 GitHub Contents API，存在：

- 默认 ref 语义不够严格。
- 下载无 timeout。
- 下载无 hash 校验。
- 临时目录使用 `Date.now()`，不是 `fs.mkdtemp()`。
- 没有文件数量和大小上限。

### 目标行为

1. 所有 fetch 有 timeout。
2. 临时目录使用 `mkdtemp`。
3. 下载路径必须通过 `resolveInside`。
4. 支持可选 integrity lock。
5. 限制总文件数和总字节数。

### 建议 CLI 选项

```bash
create-x-app my-app --remote --ref v1.0.2 --strict-remote
create-x-app my-app --remote --ref v1.0.2 --template-integrity sha256-...
```

### 必须新增测试

1. fetch 超时后返回网络错误。
2. 远端文件路径包含 `../` 时失败。
3. 临时目录并发不会碰撞。
4. integrity 不匹配时失败。
5. 超出文件数/大小限制时失败。

### 验收命令

```bash
npm test -- remote-template-fetcher
npm run test:smoke
```

### Codex 执行提示词

```text
只执行 P1-03。加固远端模板下载：fetch timeout、mkdtemp 临时目录、resolveInside 路径安全、可选 integrity 校验、文件数量和大小上限。补 remote-template-fetcher 单测。
不要引入重型依赖。优先使用 AbortController、crypto、fs.promises。
```

---

## P1-04 GitHub preset loader 加 timeout、schema 校验和 hash 校验

**严重程度：Major**  
**目标文件：**

- `src/presets/loader.js`
- `src/manifest/validate.js` 或新增 `src/presets/validate.js`
- `test/unit/presets-loader.test.js`

### 问题

`github:owner/repo/path#ref` 直接拉 raw JSON：没有 timeout、没有 hash、没有大小限制、没有 schema 验证。

### 目标行为

1. fetch timeout 默认 5 秒，可配置。
2. 响应体大小限制，例如 256 KB。
3. JSON schema 校验。
4. 支持 `--preset-integrity sha256-...`。
5. 错误信息必须告诉用户如何修复。

### 验收测试

1. 非法 GitHub preset spec 失败。
2. fetch 超时失败。
3. 非 JSON 失败。
4. 超大响应失败。
5. hash 不匹配失败。
6. 合法 preset 通过并合并配置。

### Codex 执行提示词

```text
只执行 P1-04。加固 src/presets/loader.js：GitHub preset fetch 必须有 AbortController timeout、响应大小上限、JSON parse 错误处理、schema 校验和可选 sha256 integrity 校验。
错误用 CliError，普通用户不看 stack。补单测。
```

---

## P1-05 插件安装隔离，默认禁用 lifecycle scripts

**严重程度：Major**  
**目标文件：**

- `src/commands/install.js`
- `src/marketplace/npm.js`
- `src/plugins/health.js`
- `src/plugins/loader.js`
- `README.md`
- `test/unit/plugin-install.test.js` 或同等测试

### 问题

插件安装使用全局 `npm install -g`，安装第三方包时 lifecycle scripts 可执行任意代码。health check 只 warning，不阻断。

### 目标行为

默认行为：

```bash
create-x-app install cxa-plugin-foo
```

应安装到隔离目录，例如：

```text
~/.create-x-app/plugins/node_modules
```

并默认加 `--ignore-scripts`。

需要执行 scripts 时必须显式：

```bash
create-x-app install cxa-plugin-foo --allow-scripts
```

### 验收测试

1. 默认 install 命令包含 `--ignore-scripts`。
2. 默认不使用 `-g`。
3. `--global` 如保留，必须带高风险警告并要求确认。
4. loader 能扫描隔离目录。
5. risky lifecycle scripts 默认阻断或至少 fail unless `--allow-scripts`。

### Codex 执行提示词

```text
只执行 P1-05。把插件安装从全局 npm 安装改为隔离目录安装，默认 --ignore-scripts。新增 --allow-scripts 作为显式危险开关。更新 plugin loader 扫描隔离目录。
补测试验证 spawn 参数，不要真的安装网络包。
```

---

## P1-06 CI 增加完整跨平台矩阵

**严重程度：Major**  
**目标文件：**

- `.github/workflows/ci.yml`
- `.github/workflows/release.yml`

### 问题

当前主测试偏 Ubuntu，Windows 覆盖不足，macOS 缺失。CLI 涉及路径、shebang、npm、文件系统、大小写敏感性，必须跨平台。

### 目标行为

CI 至少覆盖：

- `ubuntu-latest`
- `windows-latest`
- `macos-latest`
- Node 20 和 22

### 建议片段

```yaml
strategy:
  fail-fast: false
  matrix:
    os: [ubuntu-latest, windows-latest, macos-latest]
    node-version: [20, 22]

runs-on: ${{ matrix.os }}

steps:
  - uses: actions/checkout@v4
  - uses: actions/setup-node@v4
    with:
      node-version: ${{ matrix.node-version }}
      cache: npm
  - run: npm ci
  - run: npm run lint
  - run: npm test
  - run: npm run test:smoke
  - run: npm run test:packed
```

### Codex 执行提示词

```text
只执行 P1-06。更新 GitHub Actions CI，把 lint、unit、smoke、packed e2e 跑在 ubuntu/windows/macos 与 Node 20/22 矩阵上。release workflow 发布前必须执行同一套 check。
注意 Windows shell 兼容性，不要写 Unix-only 命令。
```

---

## P1-07 spinner 与日志在 CI/非 TTY/JSON 模式下降级

**严重程度：Major**  
**目标文件：**

- `src/utils/logger.js`
- 新增 `src/utils/spinner.js`
- `src/steps/env-check.js`
- `src/steps/post-actions.js`
- `src/marketplace/npm.js`
- 所有直接 import `ora` 的文件

### 问题

业务模块直接使用 `ora(...).start()`。在 CI、非 TTY、日志重定向、JSON 输出模式下会制造脏输出。

### 目标行为

1. spinner 统一从工厂创建。
2. spinner 写 stderr，不写 stdout。
3. `process.env.CI` 或非 TTY 时禁用动画。
4. `--json` / `--print-config` 时禁止任何 UI 输出。

### 建议实现

```js
export function createSpinner(text, options = {}) {
  const enabled =
    options.enabled !== false &&
    process.stderr.isTTY &&
    !process.env.CI &&
    !options.json

  return ora({
    text,
    isEnabled: enabled,
    stream: process.stderr,
  })
}
```

### Codex 执行提示词

```text
只执行 P1-07。新增 spinner 工厂，替换所有直接 ora 调用。CI、非 TTY、--json、--print-config 模式下禁用动画。日志和 spinner 必须写 stderr。
补测试覆盖 CI 环境和非 TTY 行为。
```

---

## P1-08 参数校验 fail fast

**严重程度：Major**  
**目标文件：**

- `bin/cli.js`
- `src/marketplace/client.js`
- `src/steps/prompts.js`
- `src/dependencies/strategy.js` 或相关文件
- `test/integration/cli-options.test.js`

### 问题

例如 `--limit foo` 会静默回退默认值。CLI 不应该替用户吞掉错误。

### 目标行为

非法参数必须立即失败，exit code 为 usage error。典型校验：

- `--limit` 必须是 1 到 50 的整数。
- `--pm` 必须是允许列表。
- `--deps` 必须是允许列表。
- `--features` 未知 key 必须失败。
- `--extras` 未知 key 必须失败。
- `--target` 不能是 root/home/system path。

### 建议 parser

```js
function parseLimit(value) {
  const limit = Number(value)
  if (!Number.isInteger(limit) || limit < 1 || limit > 50) {
    throw new CliError('--limit 必须是 1 到 50 的整数', {
      code: 'E_USAGE',
      exitCode: EXIT_CODES.USAGE,
    })
  }
  return limit
}
```

### Codex 执行提示词

```text
只执行 P1-08。把 CLI 参数校验改为 fail fast。不要静默 fallback。非法参数用 CliError + EXIT_CODES.USAGE。
补 spawn 测试验证 exitCode、stderr 和 stdout 为空/不污染。
```

---

# 4. P2 任务卡

## P2-01 stdout/stderr 分流与 --json 一致性

**目标文件：** `src/utils/logger.js`、所有命令模块、smoke/integration 测试。

### 目标行为

- stdout：只输出主结果，例如 JSON、列表数据、配置结果。
- stderr：日志、警告、spinner、错误。
- 所有支持自动化的命令提供 `--json`。
- `--print-config` 输出必须是纯 JSON，不允许混入 banner、提示、表格。

### Codex 执行提示词

```text
只执行 P2-01。梳理 stdout/stderr：机器可读输出只进 stdout，日志/警告/spinner/错误只进 stderr。为 search、list、doctor、upgrade --check、template lint 等命令补 --json 或统一 JSON 输出测试。
```

---

## P2-02 补齐短选项体系

**目标文件：** `bin/cli.js`、README、help snapshot。

建议映射：

```text
-t, --template <key>
-p, --pm <package-manager>
-f, --force
-y, --yes
-D, --debug
-V, --verbose
-l, --limit <number>
```

注意 Commander 通常使用大写 `-V` 表示 version；不要冲突。若已使用 `-V` 版本，则 verbose 使用其他短选项或不提供。

### Codex 执行提示词

```text
只执行 P2-02。为高频选项补短选项，但不得和 Commander 默认 version/help 冲突。同步 README 和 help 测试。
```

---

## P2-03 upgrade 支持 --cwd

**目标文件：** `bin/cli.js`、`src/commands/upgrade.js`、upgrade 测试。

### 目标行为

```bash
create-x-app upgrade --cwd ./packages/app --check
```

### Codex 执行提示词

```text
只执行 P2-03。为 upgrade 命令增加 --cwd <path>，默认仍是 process.cwd()。路径必须 resolveInside 或经过安全检查，不能指向 root/home。补测试。
```

---

## P2-04 增强 template test

**目标文件：** `src/commands/template.js`、README、template 测试。

### 目标行为

```bash
create-x-app template test --template node-ts --install --run lint --run build
```

默认只渲染；显式 opt-in 才安装和执行脚本。

### Codex 执行提示词

```text
只执行 P2-04。增强 template test，支持 --install 和可重复 --run <script>。默认行为保持只渲染。运行脚本必须使用 spawn/execa 参数数组，不允许 shell:true。
```

---

## P2-05 明确 package main / exports 边界

**目标文件：** `package.json`、README。

### 目标行为

如果这是纯 CLI：

```json
{
  "exports": {}
}
```

如果需要公开 API：

```json
{
  "main": "./src/index.js",
  "exports": {
    ".": "./src/index.js",
    "./schemas/manifest": "./schemas/manifest.schema.json"
  }
}
```

### Codex 执行提示词

```text
只执行 P2-05。决定 package 边界：纯 CLI 则 exports 为空；需要公开 API 则新增 src/index.js 并只导出稳定 API。不要让用户 import 内部路径。
```

---

## P2-06 README 区分 stable 与 next

**目标文件：** `README.md`、`CHANGELOG.md`、release 文档。

### 目标行为

默认 README 必须对应 npm latest。未发布功能放到 `docs/next.md` 或明确标注。

### Codex 执行提示词

```text
只执行 P2-06。梳理 README 与 CHANGELOG。README 默认内容必须对应 npm latest；未发布能力移到 docs/next.md 或明确标记为下一版本。不要宣传 registry 包尚不支持的命令。
```

---

## P2-07 TypeScript strict 迁移计划

**目标文件：** 后续单独设计，不要和 P0/P1 混做。

### 分阶段目标

1. 增加 `tsconfig.json`，先允许 JS 检查：`allowJs` + `checkJs`。
2. 为 manifest、preset、config 建立 JSDoc typedef 或 TS 类型。
3. 新文件优先写 TS。
4. 最后迁移命令层和生成器。
5. 开启 `strict`、`noUncheckedIndexedAccess`、`exactOptionalPropertyTypes`。

### Codex 执行提示词

```text
只执行 P2-07 的第一阶段：增加 tsconfig.json，对 JS 启用 checkJs 的最低破坏性配置。不要大面积改 .js 为 .ts。先让类型检查能运行，再逐步修复类型问题。
```

---

# 5. 横向验收清单

Codex 每完成一个任务，必须返回下面格式：

```text
任务编号：P0-xx
修改文件：
- path/to/file.js
- path/to/test.js

实现摘要：
- ...

新增/修改测试：
- ...

已运行命令：
- npm test -- xxx：通过/失败
- npm run test:smoke：通过/失败

剩余风险：
- 没有则写“无已知剩余风险”
```

合并前最终检查：

```bash
git status --short
npm run lint
npm test
npm run test:smoke
npm run test:packed
npm pack --dry-run
```

---

# 6. 安全专项测试矩阵

必须长期保留这些测试场景：

## 路径安全

- `../outside.txt`
- `..\\outside.txt`
- `/tmp/outside.txt`
- `C:\\Users\\name\\file.txt`
- `\\\\server\\share\\file.txt`
- `safe/../unsafe.txt`
- `safe/file.txt`
- 空字符串
- 只包含空格
- 包含 NUL 字符

## 目标目录安全

- 目标目录不存在。
- 目标目录存在且为空。
- 目标目录存在且非空未知。
- 目标目录存在且非空托管。
- `--target .`
- `--target ~`
- `--target /` 或 Windows drive root。

## CLI 参数安全

- 非法 `--limit`。
- 非法 `--pm`。
- 非法 `--deps`。
- 未知 feature。
- 未知 extra。
- 非法 JSON `--answers`。
- 不存在的 `--config`。

## 网络与供应链

- fetch timeout。
- 远端响应非 JSON。
- 远端响应超大。
- hash 不匹配。
- npm plugin metadata 缺失。
- plugin lifecycle scripts 默认阻断。

---

# 7. 建议提交顺序

严格按以下顺序推进：

1. `fix/p0-path-safety`
2. `fix/p0-cli-error-model`
3. `fix/p0-safe-force`
4. `test/p0-packed-artifact-e2e`
5. `chore/p0-publish-guards`
6. `perf/p1-lazy-cli-imports`
7. `feat/p1-noninteractive-answers`
8. `security/p1-remote-template-hardening`
9. `security/p1-preset-loader-hardening`
10. `security/p1-plugin-install-isolation`
11. `ci/p1-cross-platform-matrix`
12. `fix/p1-spinner-ci-mode`
13. `fix/p1-cli-argument-validation`
14. P2 系列小任务

不要先做大重构。不要先做 TypeScript 全量迁移。不要在同一个 PR 中混入 README 大改、格式化和安全修复。

---

# 8. 最小完成标准

如果时间有限，至少完成 P0-01 到 P0-05。达到以下条件后，才可以考虑下一次 npm 发布：

- manifest 路径穿越被测试覆盖并修复。
- 业务层不再直接退出进程。
- `--force` 不能清空未知非空目录。
- `npm pack` 产物安装后通过 smoke。
- `prepublishOnly` 阻止未测试发布。
- README 与实际 npm 版本不再互相矛盾。

最终目标不是让代码“看起来更漂亮”，而是让一个陌生用户通过 `npx create-x-app-cli` 使用时不会遇到文档失真、数据破坏、无意义退出码、CI 不可复现和供应链风险。
