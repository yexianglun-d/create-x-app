import { cancel, isCancel, select } from '@clack/prompts'
import chalk from 'chalk'
import fs from 'fs-extra'

function ensurePromptNotCancelled(value) {
  if (isCancel(value)) {
    cancel('操作已取消')
    process.exit(0)
  }

  return value
}

function formatMigrationStatus(diff) {
  const labels = {
    missing: '缺失文件，可安全补齐',
    template_changed: '模板更新，用户未改动，可安全应用',
    user_modified: '用户已改动，模板未变化，建议跳过',
    conflict: '用户和模板都已改动，需要人工合并',
    untracked: '缺少历史 hash，无法判断 ownership',
  }

  return labels[diff.migrationStatus] ?? diff.migrationStatus
}

export function printDiff(diff) {
  console.log(chalk.gray(`\n--- 当前 ${diff.relativePath}`))
  console.log(chalk.gray(`+++ 模板 ${diff.relativePath}`))
  console.log(chalk.gray(`状态：${formatMigrationStatus(diff)}`))

  for (const operation of diff.operations) {
    if (operation.type === 'add') {
      console.log(chalk.green(`+ ${operation.line}`))
    } else if (operation.type === 'remove') {
      console.log(chalk.red(`- ${operation.line}`))
    } else {
      console.log(chalk.gray(`  ${operation.line}`))
    }
  }

  console.log()
}

async function selectAction(diff) {
  while (true) {
    const action = ensurePromptNotCancelled(await select({
      message: `配置文件 ${diff.relativePath} 存在差异，请选择处理方式`,
      options: [
        { value: 'overwrite', label: diff.safeToApply ? '应用模板版本' : '覆盖为模板版本（需确认风险）' },
        { value: 'skip', label: '跳过' },
        { value: 'view', label: '查看 diff 后决定' },
      ],
      initialValue: 'view',
    }))

    if (action !== 'view') {
      return action
    }

    printDiff(diff)
  }
}

function shouldApplyAutomatically(diff) {
  return diff.safeToApply === true
}

export function summarizeDiffs(diffs) {
  return diffs.reduce((summary, diff) => {
    summary.total += 1
    summary[diff.migrationStatus] = (summary[diff.migrationStatus] ?? 0) + 1

    if (diff.safeToApply) {
      summary.safe += 1
    } else {
      summary.unsafe += 1
    }

    return summary
  }, {
    total: 0,
    safe: 0,
    unsafe: 0,
  })
}

export function printUpgradeSummary(diffs) {
  const summary = summarizeDiffs(diffs)

  console.log(`  差异文件：${summary.total}`)
  console.log(`  可安全应用：${summary.safe}`)
  console.log(`  需要人工确认：${summary.unsafe}`)

  for (const status of ['missing', 'template_changed', 'user_modified', 'conflict', 'untracked']) {
    if (summary[status]) {
      console.log(`  ${formatMigrationStatus({ migrationStatus: status })}：${summary[status]}`)
    }
  }
}

export async function applyDiffs(diffs, options = {}) {
  const appliedFiles = []
  const skippedFiles = []
  const mode = options.mode ?? 'interactive'

  for (const diff of diffs) {
    const action = mode === 'safe'
      ? (shouldApplyAutomatically(diff) ? 'overwrite' : 'skip')
      : await selectAction(diff)

    if (action === 'skip') {
      skippedFiles.push(diff.relativePath)
      continue
    }

    await fs.outputFile(diff.currentPath, diff.expectedContent, 'utf8')
    appliedFiles.push(diff.relativePath)
  }

  return {
    appliedFiles,
    skippedFiles,
  }
}
