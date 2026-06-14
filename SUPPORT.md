# 支持说明

本项目主要通过 GitHub Issue 提供社区支持。为了提高处理效率，请先确认问题类型并提供必要上下文。

## 适合提交 Issue 的问题

- CLI 命令运行失败。
- 模板生成结果不完整或无法构建。
- `--remote`、`--latest`、`upgrade` 或插件命令行为异常。
- README、命令说明、模板文档存在错误。
- 希望新增模板、插件能力或社区市场能力。

## 不适合提交 Issue 的问题

- 与本项目无关的框架使用问题。
- 生成项目后自行改动业务代码导致的问题。
- 公司内部模板设计咨询。
- 不可信第三方插件造成的问题，除非可以证明 CLI 插件机制存在缺陷。

## 提交前自查

建议先执行：

```bash
npx create-x-app-cli --version
node --version
npm --version
npx create-x-app-cli --help
```

如果是生成失败，请尝试添加 `--debug`：

```bash
npx create-x-app-cli my-app --debug
```

## 响应预期

本项目是开源社区项目，不承诺商业 SLA。维护者会优先处理安全问题、可复现 Bug、影响主流程的问题和高质量 PR。
