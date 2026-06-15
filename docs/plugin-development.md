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
  "cxa-plugin": true,
  "files": ["manifest.json", "template", "README.md"],
  "publishConfig": {
    "access": "public"
  }
}
```

关键要求：

- `cxa-plugin` 必须为 `true`。
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
create-x-app my-plugin-app --skip-install --skip-git
npm uninstall -g cxa-plugin-example
```

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
create-x-app my-plugin-app --skip-install --skip-git
create-x-app remove cxa-plugin-example
```

## 常见错误

- 包名不是 `cxa-plugin-*`：CLI 会拒绝安装。
- 缺少 `cxa-plugin: true`：安装前 metadata 预检会失败。
- 缺少 `manifest.json` 或 `template/`：插件扫描会报错。
- `defaultFeatures` 不在 `supportedFeatures` 中：manifest 校验会失败。
- 插件模板 key 和内置模板冲突：插件会被忽略，内置模板优先。
