# 贡献指南

感谢你愿意参与 `create-x-app`。本项目的目标是提供一套可维护、可扩展、适合真实项目启动场景的脚手架 CLI。为了让 Issue、Pull Request 和社区模板长期可维护，请在贡献前阅读本指南。

## 参与方式

你可以通过以下方式参与：

- 报告 Bug：提供可复现命令、环境信息、实际结果和期望结果。
- 提出功能建议：说明目标用户、使用场景、预期交互和可能影响。
- 新增或改进模板：补充 `manifest.json`、模板文件、生成后的运行说明和验证步骤。
- 改进文档：修正文案、补充示例、完善命令说明或插件规范。
- 提交社区插件：使用 `cxa-plugin-*` 或 `@scope/cxa-plugin-*` 包名，并遵守插件约定。

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
node bin/cli.js my-app --skip-install --skip-git --no-telemetry
```

查看命令帮助：

```bash
node bin/cli.js --help
node bin/cli.js upgrade --help
node bin/cli.js search --help
```

代码质量检查：

```bash
npm run lint
```

发布前基础检查：

```bash
npm run lint
node bin/cli.js --help
npm pack --dry-run
```

## 分支与提交

建议使用以下分支命名：

- `feat/<short-name>`：新增能力或模板。
- `fix/<short-name>`：修复缺陷。
- `docs/<short-name>`：文档调整。
- `chore/<short-name>`：工程维护。

提交信息建议遵循 Conventional Commits：

```text
feat: add react dashboard template
fix: handle missing plugin manifest
docs: update marketplace guide
chore: refresh release checklist
```

## Pull Request 要求

提交 PR 前请确认：

- PR 只解决一个明确问题，避免把无关修改混在一起。
- 描述中说明改了什么、为什么改、如何验证。
- 对用户可见行为的变化需要同步更新 README 或相关文档。
- 新增模板必须包含 `manifest.json`，并说明生成后的安装、构建和运行方式。
- 新增 CLI 命令或参数必须同步更新命令参考。
- 不提交密钥、token、`.env`、本地缓存、测试生成项目或临时压缩包。

## 新增模板规范

新增内置模板时，优先遵守以下结构：

```text
templates/<template-key>/
├── manifest.json
├── package.json.ejs
├── README 或模板说明文件
└── template source files
```

`manifest.json` 是模板能力的唯一声明入口，至少需要包含：

- `key`：模板唯一标识。
- `name`：面向用户展示的名称。
- `description`：模板适用场景。
- `framework`：模板框架类型。
- `supportedFeatures` / `defaultFeatures`：支持和默认启用的功能。
- `extras`：模板专属扩展项。
- `requiredPm` / `forbiddenPm`：包管理器约束。
- `requiredEnv` / `optionalEnv`：环境要求。
- `buildScript` / `devScript`：生成后常用脚本。

新增模板时不要把模板选择逻辑硬编码到 `resolver`、`prompts` 或 `validator` 中；项目已经使用 manifest 驱动发现模板。

## 社区插件规范

社区插件包名必须满足以下格式之一：

```text
cxa-plugin-*
@scope/cxa-plugin-*
```

插件包建议结构：

```text
cxa-plugin-example/
├── package.json
├── manifest.json
└── template/
```

`package.json` 需要包含：

```json
{
  "name": "cxa-plugin-example",
  "version": "0.1.0",
  "type": "module",
  "cxa-plugin": true,
  "files": ["manifest.json", "template", "README.md"]
}
```

本地联调示例：

```bash
cd examples/cxa-plugin-example
npm link
create-x-app list
create-x-app my-plugin-app --skip-install --skip-git
npm uninstall -g cxa-plugin-example
```

## Bug 报告信息

报告 Bug 时请尽量提供：

- 使用的命令。
- Node.js 版本：`node --version`。
- npm 版本：`npm --version`。
- 操作系统。
- CLI 版本：`npx create-x-app-cli --version`。
- 是否使用 `--remote`、`--latest`、`--no-cache`、`--debug`。
- 完整错误输出或最小复现仓库。

## 代码风格

- 项目源码使用 ESM，禁止新增 CommonJS `require()`。
- 复用已有工具函数、日志结构、模板 manifest 和包管理器适配层。
- 不为简单逻辑引入重型依赖。
- 遇到 Bug 时优先定位根因，不使用硬编码、吞异常或绕过校验的方式修补。
- 复杂流程需要保持职责清晰，并补充必要注释。

## 安全问题

如果你发现安全漏洞，请不要在公开 Issue 中披露利用细节。请参考 [SECURITY.md](./SECURITY.md)。
