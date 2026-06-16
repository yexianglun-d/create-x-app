# Template Authoring

Template authors can validate manifests, render templates, inspect package contents, and create plugin skeletons from the CLI.

## Template Commands

```bash
create-x-app template lint
create-x-app template lint --template react-vite-ts
create-x-app template test --template node-ts
create-x-app template pack
```

- `template lint` validates template manifests.
- `template test` renders templates into a temporary directory using default options.
- `template pack` lists the number of files that would be shipped per template.

## Plugin Skeleton

```bash
create-x-app plugin init cxa-plugin-company
cd cxa-plugin-company
npm pack --dry-run
```

The skeleton is based on `examples/cxa-plugin-example` and contains:

```text
manifest.json
package.json
template/
README.md
```

Before publishing, update package name, repository, license, `cxaPluginApi`, manifest key, and template files.

## AI-native Feature

Templates can expose the optional `ai-native` feature. When selected, generated projects include:

- `.cursor/rules/create-x-app.mdc`
- `CLAUDE.md`
- `.github/copilot-instructions.md`
- `.mcp.example.json`
- `docs/adr/0001-project-conventions.md`
- `docs/prompts/pr-review.md`
- `docs/prompts/commit-message.md`
