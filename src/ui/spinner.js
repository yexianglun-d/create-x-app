import { spinner } from '@clack/prompts'

function shouldUseInteractiveSpinner() {
  return Boolean(process.stderr.isTTY && !process.env.CI && process.env.TERM !== 'dumb')
}

export function createStatusSpinner() {
  if (shouldUseInteractiveSpinner()) {
    const interactiveSpinner = spinner()
    let active = false

    return {
      start(message) {
        active = true
        interactiveSpinner.start(message)
      },
      message(message) {
        if (active) {
          interactiveSpinner.message(message)
        }
      },
      stop(message) {
        if (!active) {
          return
        }

        active = false
        interactiveSpinner.stop(message)
      },
    }
  }

  let active = false

  return {
    start() {
      active = true
    },
    message() {},
    stop(message) {
      if (!active) {
        return
      }

      active = false

      if (message) {
        console.error(message)
      }
    },
  }
}
