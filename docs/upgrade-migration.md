# Upgrade Migration Engine

`create-x-app upgrade` uses metadata written during project generation to avoid silently overwriting user changes.

## Metadata Files

Generated projects contain:

```text
.create-x-app/
├── template-lock.json
├── project.json
└── files.json
```

- `template-lock.json` records template source, ref, commit, CLI version, and selected options.
- `project.json` records project-level choices such as template, features, extras, package manager, dependency strategy, and preset source.
- `files.json` records hashes for files owned by the scaffold at generation time.

## Commands

```bash
create-x-app upgrade --check
create-x-app upgrade --diff
create-x-app upgrade --backup
create-x-app upgrade --apply --backup
create-x-app upgrade --from 1.0.1 --to 1.1.0 --apply
```

## Diff Status

| Status | Meaning | Automatic apply |
|---|---|---|
| `missing` | Managed file is missing locally | Yes |
| `template_changed` | Template changed and local file still matches the tracked hash | Yes |
| `user_modified` | User changed the file but template did not change from the tracked hash | No |
| `conflict` | User and template both changed the file | No |
| `untracked` | No historical hash exists, usually from legacy projects | No |

`--apply` only applies safe changes. Conflicts and untracked files are skipped so users can merge manually.

## Backup

`--backup` writes current versions of affected files to:

```text
.create-x-app/backups/<timestamp>/
```

Use `--backup --apply` before applying safe migrations in maintained projects.
