# create-x-app 发布命令清单

## 推荐方式：GitHub Actions 自动发布

主包发布使用 `.github/workflows/release.yml`：

```bash
git tag -a v1.0.2 -m "create-x-app-cli v1.0.2"
git push origin v1.0.2
```

推送 `v*` tag 后，GitHub Actions 会执行：

- `npm ci`
- `npm run lint`
- `npm test`
- `npm run test:integration`
- `npm run test:smoke`
- `npm pack --dry-run`
- `windows-smoke` job 在 Windows 上执行 CLI smoke 和单模板渲染测试
- `npm publish --provenance --access public`
- 创建或更新 GitHub Release

要求仓库配置 Secret：

```text
NPM_TOKEN
```

示例插件发布使用 `.github/workflows/plugin-release.yml`，可通过 GitHub Actions 手动触发，也可推送：

```bash
git tag -a cxa-plugin-example-v0.1.0 -m "cxa-plugin-example v0.1.0"
git push origin cxa-plugin-example-v0.1.0
```

示例插件 workflow 会先检查 npm registry 是否已存在同版本，发布后应验证：

```bash
npm view cxa-plugin-example version
npx create-x-app-cli search cxa-plugin-example
npx create-x-app-cli install cxa-plugin-example
npx create-x-app-cli list
npx create-x-app-cli plugin doctor --details
npx create-x-app-cli my-plugin-app --template example-basic --skip-install --skip-git --no-telemetry --yes
npx create-x-app-cli remove cxa-plugin-example
```

---

## 备用方式：本地手动发布

## 1. 安装依赖

```bash
npm install
```

## 2. 运行代码质量检查

```bash
npm run lint
npm test
npm run test:smoke
npm run test:integration
```

## 3. 验证 CLI 基础信息和作者工具链

```bash
node bin/cli.js --help
node bin/cli.js upgrade --help
node bin/cli.js template lint --template node-ts
node bin/cli.js template test --template node-ts
node bin/cli.js template pack --template node-ts
```

## 4. 预览 npm 打包内容

如果本机 npm 缓存权限正常：

```bash
npm pack --dry-run
```

如果本机 npm 缓存目录存在权限问题，可使用临时缓存目录：

```bash
npm pack --dry-run --cache /tmp/create-x-app-npm-cache
```

## 5. 确认当前发布信息

当前包信息：

- 包名：`create-x-app-cli`
- 版本：`1.0.1`
- 许可证：`MIT`
- 作者：`赵铁柱`

## 6. 登录 npm

```bash
npm login
```

## 7. 确认当前 npm 身份

```bash
npm whoami
```

## 8. 正式发布

```bash
npm publish --access public
```

如果 npm 账号启用了 2FA：

```bash
npm publish --access public --otp=<一次性验证码>
```

## 9. 发布后验证

```bash
npx -y create-x-app-cli --version
npx -y create-x-app-cli my-first-project --skip-install --skip-git --no-telemetry
npx -y create-x-app-cli my-preset-project --preset company-react --skip-install --skip-git --no-telemetry
```

## 10. 示例插件本地手动发布

当前示例插件包名为 `cxa-plugin-example`。如果 `npm view cxa-plugin-example version` 返回 404，可发布：

```bash
cd examples/cxa-plugin-example
npm pack --dry-run
npm publish --access public
```

如果 npm 账号启用了 2FA：

```bash
npm publish --access public --otp=<一次性验证码>
```

## 11. Git 提交与推送

```bash
git add .
git commit -m "feat: harden create-x-app ecosystem"
git push -u origin main
```
