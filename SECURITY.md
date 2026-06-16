# 安全政策

`create-x-app` 是一个会在用户本机执行文件复制、依赖安装、Git 初始化和社区插件发现的 CLI 工具。安全问题会直接影响开发者本地环境，因此请谨慎处理漏洞披露。

## 支持版本

| 版本 | 安全支持状态 |
|---|---|
| `1.x` | 支持安全修复 |
| `0.x` | 不再主动维护，除非出现高危且影响范围明确的问题 |

## 报告安全漏洞

请优先通过 GitHub 的私有漏洞报告能力提交安全问题。如果仓库暂未开启该能力，请创建一个不包含利用细节的 Issue，并在标题中标注 `[Security]`，维护者会跟进后续沟通方式。

报告时建议包含：

- 受影响版本。
- 受影响命令或模板。
- 复现步骤。
- 潜在影响范围。
- 是否涉及远程模板、社区插件、依赖安装或文件覆盖。
- 建议修复方向，如果你已经有判断。

请不要在公开 Issue、评论、社交媒体或 npm 包评论中发布可直接利用的攻击细节。

## 处理流程

维护者会按以下流程处理：

1. 确认报告是否属于安全问题。
2. 评估影响范围和严重程度。
3. 制定修复方案并验证。
4. 发布补丁版本。
5. 在必要时补充公开说明或变更记录。

## 安全边界

以下情况通常不视为本项目安全漏洞：

- 用户主动安装不可信的社区插件。
- 用户在生成项目后自行修改模板产物导致的问题。
- npm registry、GitHub、操作系统或包管理器自身的已知问题。
- 需要本机管理员权限才能触发、且不会扩大权限边界的问题。

以下情况会优先处理：

- 远程模板拉取导致的非预期文件覆盖。
- 插件扫描或安装绕过包名约束。
- 依赖安装或脚本执行中出现非预期命令注入。
- `upgrade` 命令修改业务源码或越权写入文件。
- 匿名统计泄露项目名、路径、环境变量或个人身份信息。

## 匿名统计与隐私

匿名统计默认需要用户同意，且只有配置了 `CREATE_X_APP_TELEMETRY_ENDPOINT` 时才会发送网络请求。允许收集的字段仅限：

- 事件名，例如 `create_start`、`create_success`、`generate_failed`。
- 失败阶段，例如 `env_check`、`resolve_template`、`generate`。
- 粗粒度错误类别，例如 `error`、`abort`、`EACCES`。
- 模板 key、CLI 版本、Node.js 版本和 OS 类型。

不得收集或上传：

- 项目名、项目路径、用户名、仓库地址。
- 源码内容、环境变量、密钥或配置文件内容。
- 错误堆栈、完整错误信息或机器本地路径。

用户可通过以下命令显式管理本机配置：

```bash
create-x-app telemetry status
create-x-app telemetry on
create-x-app telemetry off
```

也可在单次运行中使用 `--no-telemetry`。

## 供应链约束

- 远程模板建议配合 `--ref` 使用固定 tag 或 commit；需要强一致时使用 `--strict-remote`。
- 生成项目会写入 `.create-x-app/template-lock.json`，用于记录模板来源、ref、commit 和 CLI 版本。
- `upgrade` 依赖 `.create-x-app/files.json` 的 ownership/hash 判断，不应静默覆盖用户改过的文件。
- 插件包名必须是 `cxa-plugin-*` 或 `@scope/cxa-plugin-*`，且安装前必须通过 npm metadata 预检。
- `plugin doctor` 应报告 manifest 无效、API 不兼容、缺少 license/repository、npm lifecycle 脚本和越界写入风险。
- `--preset github:...` 会从 `raw.githubusercontent.com` 拉取 JSON，团队生产环境应固定 ref 并审查 preset 内容。
