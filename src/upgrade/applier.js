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

function printDiff(diff) {
  console.log(chalk.gray(`\n--- 当前 ${diff.relativePath}`))
  console.log(chalk.gray(`+++ 模板 ${diff.relativePath}`))

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
        { value: 'overwrite', label: '覆盖为模板版本' },
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

export async function applyDiffs(diffs) {
  const appliedFiles = []
  const skippedFiles = []

  for (const diff of diffs) {
    const action = await selectAction(diff)

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
