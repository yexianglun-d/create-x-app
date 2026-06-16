# Presets

Presets let teams reuse a stable project configuration without repeating interactive choices.

## Built-in Presets

```bash
create-x-app my-app --preset company-react
create-x-app api --preset node-service
```

## Local Preset

```bash
create-x-app my-app --preset ./preset.json
```

Example:

```json
{
  "template": "react-vite-ts",
  "pm": "pnpm",
  "features": ["eslint", "prettier", "husky", "agents", "coding-rules", "ai-native"],
  "extras": ["react-router", "tailwind"],
  "deps": "baseline",
  "git": true,
  "install": true
}
```

Explicit CLI options override preset fields:

```bash
create-x-app my-app --preset ./preset.json --pm npm --skip-install
```

## GitHub Preset

```bash
create-x-app my-app --preset github:org/repo/preset.json#main
```

If no path is provided, `preset.json` is used:

```bash
create-x-app my-app --preset github:org/frontend-preset#v1
```

The preset is fetched from `raw.githubusercontent.com`.
