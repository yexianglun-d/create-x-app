# cxa-plugin-example

`create-x-app` 社区模板插件示例。

## 本地联调

```bash
cd examples/cxa-plugin-example
npm link
create-x-app list
create-x-app my-plugin-app
npm uninstall -g cxa-plugin-example
```

## 发布

```bash
npm publish --access public --otp=<一次性验证码>
```

插件包必须满足：

- 包名使用 `cxa-plugin-*`
- `package.json` 包含 `"cxa-plugin": true`
- 根目录包含 `manifest.json`
- 根目录包含 `template/`
