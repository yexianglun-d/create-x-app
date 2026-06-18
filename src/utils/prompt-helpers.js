import { cancel, isCancel } from '@clack/prompts'

export async function ensurePromptNotCancelled(value, options = {}) {
  if (isCancel(value)) {
    if (options.onCancel) {
      await options.onCancel()
    }

    cancel('操作已取消')
    process.exit(0)
  }

  return value
}
