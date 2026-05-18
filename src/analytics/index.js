import { platform } from 'node:os'

const TELEMETRY_ENDPOINT = process.env.CREATE_X_APP_TELEMETRY_ENDPOINT
const TELEMETRY_TIMEOUT_MS = 2000

function buildPayload({ config, cliVersion }) {
  return {
    template: config.template,
    cliVersion,
    nodeVersion: process.version,
    osType: platform(),
  }
}

export async function reportCreateEvent({ config, cliVersion, enabled }) {
  if (!enabled || !TELEMETRY_ENDPOINT) {
    return false
  }

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), TELEMETRY_TIMEOUT_MS)

  try {
    const response = await fetch(TELEMETRY_ENDPOINT, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify(buildPayload({ config, cliVersion })),
      signal: controller.signal,
    })

    return response.ok
  } catch {
    return false
  } finally {
    clearTimeout(timeoutId)
  }
}
