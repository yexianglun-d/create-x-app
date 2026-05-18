# create-x-app 发布命令清单

## 1. 安装依赖

```bash
npm install
```

## 2. 运行代码质量检查

```bash
npm run lint
```

## 3. 验证 CLI 基础信息

```bash
node bin/cli.js --help
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
npx create-x-app-cli my-first-project
```

## 10. Git 提交与推送

```bash
git add .
git commit -m "feat: 完成 create-x-app 脚手架开发与发布准备"
git push -u origin main
```
