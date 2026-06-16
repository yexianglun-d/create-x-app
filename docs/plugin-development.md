# 社区插件开发指南

`create-x-app` 支持通过 npm 包扩展社区模板。插件适合沉淀团队内部模板、垂直业务模板或不适合直接内置到主仓库的实验性模板。

## 包名规范

插件包名必须满足以下格式之一：

```text
cxa-plugin-*
@scope/cxa-plugin-*
```

CLI 会拒绝安装非插件命名的包，并在安装前读取 npm metadata，确认该包声明了 `cxa-plugin: true`。

## 目录结构

最小插件结构：

```text
cxa-plugin-example/
├── package.json
├── manifest.json
└── template/
    ├── package.json.ejs
    └── README.md.ejs
```

`template/` 中的文件会作为项目模板复制到目标项目，并支持 EJS 渲染。

## package.json

```json
{
  "name": "cxa-plugin-example",
  "version": "0.1.0",
  "description": "create-x-app community template plugin example",
  "type": "module",
  "license": "MIT",
  "repository": "https://github.com/your-org/cxa-plugin-example",
  "cxaPluginApi": ">=1.0.0 <2.0.0",
  "cxa-plugin": true,
  "files": ["manifest.json", "template", "README.md"],
  "publishConfig": {
    "access": "public"
  }
}
```

关键要求：

- `cxa-plugin` 必须为 `true`。
- `cxaPluginApi` 建议声明插件兼容的 create-x-app Plugin API semver range。
- `license` 和 `repository` 建议声明完整，安装前风险摘要会展示这些信息。
- `files` 必须包含 `manifest.json` 和 `template`。
- 发布到 npm 后，`create-x-app search` 才能搜索到。

## manifest.json

`manifest.json` 是插件模板的能力声明。CLI 会在扫描插件时执行校验，字段缺失会阻止插件加载。

```json
{
  "key": "example-basic",
  "name": "Example Basic",
  "description": "社区插件示例模板，演示最小插件目录结构",
  "version": "0.1.0",
  "schemaVersion": "1.0",
  "framework": "plugin",
  "cxaPluginApi": ">=1.0.0 <2.0.0",
  "author": "create-x-app",
  "repository": "https://github.com/your-org/cxa-plugin-example",
  "license": "MIT",
  "requiresNetwork": false,
  "postActions": [],
  "writesOutsideTarget": false,
  "requirements": {
    "node": ">=18.0.0",
    "packageManagers": ["npm", "pnpm", "yarn"]
  },
  "requiredPm": null,
  "forbiddenPm": [],
  "requiredEnv": { "node": ">=18.0.0" },
  "optionalEnv": {},
  "supportedFeatures": ["agents", "coding-rules"],
  "defaultFeatures": ["agents", "coding-rules"],
  "features": {
    "husky": {
      "label": "commitlint + Husky",
      "hint": "提交信息校验",
      "default": false,
      "artifacts": [".husky", "commitlint.config.js"]
    },
    "agents": {
      "label": "AGENTS.md",
      "hint": "AI 协作约定",
      "default": true,
      "artifacts": ["AGENTS.md"]
    },
    "coding-rules": {
      "label": "coding-rules.md",
      "hint": "团队代码规范",
      "default": true,
      "artifacts": ["coding-rules.md"]
    }
  },
  "extras": [],
  "subPrompts": [],
  "devScript": "dev",
  "buildScript": null,
  "devPort": null,
  "upgrade": {
    "managedFiles": []
  }
}
```

字段说明：

- `key`：模板唯一标识，不能和内置模板冲突。
- `name`：展示名称，CLI 会显示为 `[插件] <name>`。
- `description`：模板用途说明。
- `version`：模板版本，不要求和 npm 包版本一致，但建议同步。
- `schemaVersion`：manifest schema 版本，当前固定为 `1.0`。
- `framework`：模板类型，可使用 `plugin`、`react`、`node` 等。
- `cxaPluginApi`：插件兼容的 CLI Plugin API semver range，例如 `>=1.0.0 <2.0.0`。
- `author` / `repository` / `license`：插件来源与开源许可证信息，用于安装前风险摘要和 `plugin doctor`。
- `requiresNetwork`：插件生成后动作是否需要额外访问网络。
- `postActions`：插件级生成后动作声明；普通模板文件复制不需要填写。
- `writesOutsideTarget`：插件是否可能写入目标项目目录之外，默认应为 `false`。
- `requirements`：模板必需环境，CLI 会在用户选择该模板后按需检测。
- `optionalEnv`：模板相关但不阻断的环境，例如 Java 后端配套模板可声明 Java 版本。
- `supportedFeatures`：支持的公共功能，例如 `agents`、`coding-rules`。
- `defaultFeatures`：默认启用的功能，必须是 `supportedFeatures` 的子集。
- `features`：功能项的展示文案、默认状态和生成产物，CLI 会用它裁剪未启用文件。
- `extras`：模板专属扩展项。
- `extras[].artifacts` / `extras[].detectDependencies`：用于升级命令识别已启用的模板扩展。
- `subPrompts`：模板专属子问答，目前支持 `select`。

## 本地联调

```bash
cd examples/cxa-plugin-example
npm link
create-x-app list
create-x-app plugin doctor --details
create-x-app my-plugin-app --skip-install --skip-git
npm uninstall -g cxa-plugin-example
```

`create-x-app list` 只展示 manifest 校验通过的插件；`create-x-app plugin doctor` 会同时报告无效插件、API 不兼容、缺少 license/repository、安装脚本风险和 manifest 错误。

## 发布流程

发布前检查：

```bash
cd examples/cxa-plugin-example
npm pack --dry-run
```

发布：

```bash
npm publish --access public
```

发布后验证：

```bash
create-x-app search cxa-plugin-example
create-x-app install cxa-plugin-example
create-x-app list
create-x-app plugin doctor --details
create-x-app my-plugin-app --skip-install --skip-git
create-x-app remove cxa-plugin-example
```

## 常见错误

- 包名不是 `cxa-plugin-*`：CLI 会拒绝安装。
- 缺少 `cxa-plugin: true`：安装前 metadata 预检会失败。
- `cxaPluginApi` 不兼容当前 CLI：安装前检查会阻断安装，已安装插件会在 `plugin doctor` 中标记失败。
- 含 `preinstall` / `install` / `postinstall` / `prepare` 等 npm lifecycle 脚本：安装前风险摘要会警告，需要人工审查。
- 缺少 `manifest.json` 或 `template/`：插件不会进入模板列表，`plugin doctor` 会报告错误。
- `defaultFeatures` 不在 `supportedFeatures` 中：manifest 校验会失败。
- 插件模板 key 和内置模板冲突：插件会被忽略，内置模板优先。
