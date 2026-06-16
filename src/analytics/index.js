import { platform } from 'node:os'

const TELEMETRY_ENDPOINT = process.env.CREATE_X_APP_TELEMETRY_ENDPOINT
const TELEMETRY_TIMEOUT_MS = 2000

export function getErrorCategory(error) {
  if (!error) {
    return 'unknown'
  }

  if (error.name === 'AbortError') {
    return 'abort'
  }

  if (error.code && typeof error.code === 'string') {
    return error.code
  }

  if (error.constructor?.name && error.constructor.name !== 'Error') {
    return error.constructor.name
  }

  return 'error'
}

export function buildAnalyticsPayload({
  event,
  config,
  cliVersion,
  stage = null,
  errorCategory = null,
}) {
  const payload = {
    event,
    template: config?.template ?? null,
    cliVersion,
    nodeVersion: process.version,
    osType: platform(),
  }

  if (stage) {
    payload.stage = stage
  }

  if (errorCategory) {
    payload.errorCategory = errorCategory
  }

  return payload
}

export async function reportAnalyticsEvent({
  event,
  config,
  cliVersion,
  enabled,
  stage,
  error,
  errorCategory = error ? getErrorCategory(error) : null,
}) {
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
      body: JSON.stringify(buildAnalyticsPayload({
        event,
        config,
        cliVersion,
        stage,
        errorCategory,
      })),
      signal: controller.signal,
    })

    return response.ok
  } catch {
    return false
  } finally {
    clearTimeout(timeoutId)
  }
}

export async function reportCreateEvent({ config, cliVersion, enabled }) {
  return reportAnalyticsEvent({
    event: 'create_success',
    config,
    cliVersion,
    enabled,
  })
}
