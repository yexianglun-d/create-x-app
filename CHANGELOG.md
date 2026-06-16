# 更新记录

本项目的变更记录遵循“面向用户可理解”的原则，重点记录发布版本中的能力变化、修复和迁移影响。

## [Unreleased]

### Added

- 恢复 `node:test` 单元测试、模板集成测试、CLI smoke 测试和 GitHub Actions CI。
- 新增插件 manifest 校验、插件安装前 npm metadata 预检和插件开发文档。
- 新增主包与示例插件的 GitHub Actions 发布 workflow。
- 新增非交互创建参数：`--template`、`--pm`、`--features`、`--extras`、`--yes`、`--cwd`、`--target`、`--print-config`。
- 新增 `schemas/manifest.schema.json`，并为模板 manifest 补齐 `schemaVersion`、`features` 和 `upgrade.managedFiles` 声明。
- 新增远程模板 `--ref` 和 `--strict-remote`，支持按 tag / sha / branch 固定拉取。
- 生成项目新增 `.create-x-app/template-lock.json`，记录模板来源、ref、commit、CLI 版本和选择项。
- 新增插件健康度检查、安装前风险摘要和 `create-x-app plugin doctor`。
- 新增 manifest `requirements` 字段，用于声明模板级环境需求。
- 新增 `--deps` 依赖版本策略，支持 `baseline`、`latest-patch`、`latest-minor`、`latest-major` 和 `latest`。

### Changed

- 模板 ESLint 配置迁移到 ESLint 9 flat config 体系。
- README 和发布文档补充真实插件市场验证流程。
- 非空目标目录默认不再清空，必须显式使用 `--force`；新增 `--dry-run` 用于预览生成计划且不写入文件。
- 生成器、问答、配置校验和 upgrade diff 改为读取 manifest 中的 feature artifacts、extra metadata 和 managed files。
- 远程模板缓存按 `template + ref + commit` 分离，避免不同 ref 复用同一缓存目录。
- 插件扫描改为跳过无效 manifest，避免单个坏插件阻断主模板列表。
- 环境检测拆分为 CLI 运行环境检测和模板环境检测，避免无关模板工具提示。
- `--latest` 降级为兼容别名，等价于 `--deps latest`；默认依赖策略保持模板 baseline。

### Fixed

- 修复选择 Husky 时 `--skip-install` 仍会触发依赖安装和 Husky 初始化的问题。
- 修复生成后 next steps 固定展示不存在文档的问题，改为按实际生成文件输出。
- Husky hook 权限设置改为 Node `chmod`，Windows 环境不再执行无效 chmod。

## [1.0.1] - 2026-05-18

### Fixed

- 修复 `chrome-ext` 模板中 lint 脚本指向不存在目录的问题。
- 验证发布后生成的 `chrome-ext` 项目可以完成 `npm install`、`npm run build` 和 `npm run lint`。

### Added

- 新增 `examples/cxa-plugin-example` 示例插件，用于本地联调社区插件机制。

## [1.0.0] - 2026-05-18

### Added

- 发布稳定版 `create-x-app-cli@1.0.0`。
- 完成匿名统计同意机制，支持 `--no-telemetry` 单次关闭。
- 完成社区模板市场命令：`search`、`install`、`list`、`remove`。
- 支持 `cxa-plugin-*` 和 `@scope/cxa-plugin-*` 社区模板插件。

### Verified

- `npm run lint`
- `node bin/cli.js --help`
- `node bin/cli.js upgrade --help`
- `node bin/cli.js search --help`
- `npm pack --dry-run`
- `npx -y create-x-app-cli --version`
- `npx -y create-x-app-cli cxa-smoke --skip-install --skip-git --no-telemetry`

## [0.3.0] - 2026-05-18

### Added

- 新增 `--remote`，支持从 GitHub 拉取远端模板。
- 新增 `--no-cache`，支持强制刷新远端模板缓存。
- 新增 `--latest`，支持生成时刷新 npm 依赖版本。
- 新增 `upgrade` 命令，用于升级脚手架管理的配置文件。
- 新增插件系统基础能力，支持内置模板与社区插件统一注册。

## [0.2.0] - 2026-04-22

### Added

- 完成 manifest 驱动模板体系。
- 新增配置校验层和包管理器适配层。
- 扩展到 8 套内置模板：
  - `react-vite-ts`
  - `node-ts`
  - `java-fullstack`
  - `react-admin`
  - `electron-app`
  - `chrome-ext`
  - `monorepo`
  - `mobile-h5`

### Changed

- 模板选择、功能项、包管理器限制和构建脚本统一由 `manifest.json` 声明。
- `monorepo` 模板锁定 `pnpm`，并通过 Corepack 增强兼容性。

## [0.1.1] - 2026-04

### Added

- 发布早期可用版本，包含基础 CLI 主流程和三套初始模板。
