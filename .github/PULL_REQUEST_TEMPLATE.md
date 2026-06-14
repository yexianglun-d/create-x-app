# Pull Request

## 变更内容

请简要说明本 PR 改了什么。

## 变更类型

- [ ] Bug 修复
- [ ] 新功能
- [ ] 新模板或模板增强
- [ ] 插件生态
- [ ] 文档
- [ ] 工程维护

## 验证方式

请列出你实际执行过的命令：

```bash
npm run lint
node bin/cli.js --help
npm pack --dry-run
```

如果变更涉及模板，请补充生成后验证命令：

```bash
node bin/cli.js my-app --skip-git
cd my-app
npm install
npm run build
```

## 兼容性影响

- [ ] 不影响已有命令和模板
- [ ] 影响 CLI 参数或交互流程，已更新 README
- [ ] 影响模板 manifest 或插件规范，已更新文档
- [ ] 影响生成项目结构，已说明迁移影响

## 提交前检查

- [ ] 没有提交密钥、token、`.env` 或本地缓存
- [ ] 没有提交临时生成项目或无关文件
- [ ] 新增依赖有明确必要性
- [ ] 用户可见变化已同步文档
- [ ] 代码保持 ESM，不新增 CommonJS `require()`
