import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'fs-extra'
import { join } from 'node:path'
import { createTempDir, removeTempDir } from '../helpers/project.js'
import { fetchRemoteTemplateSource } from '../../src/remote/template-fetcher.js'
import { resolveTemplateSource } from '../../src/steps/resolver.js'

function createJsonResponse(value) {
  return {
    ok: true,
    async json() {
      return value
    },
  }
}

function createFileResponse(content) {
  return {
    ok: true,
    async arrayBuffer() {
      return Buffer.from(content)
    },
  }
}

function createErrorResponse(status = 404, statusText = 'Not Found') {
  return {
    ok: false,
    status,
    statusText,
  }
}

async function captureConsoleOutput(callback) {
  const originalLog = console.log

  console.log = () => {}

  try {
    return await callback()
  } finally {
    console.log = originalLog
  }
}

test('fetchRemoteTemplateSource pins requests and cache entries by ref', async () => {
  const cacheDir = await createTempDir('cxa-remote-cache-')
  const requestedUrls = []

  try {
    const source = await fetchRemoteTemplateSource('node-ts', {
      cacheDir,
      noCache: true,
      ref: 'v1.2.3',
      fetchImpl: async (url) => {
        requestedUrls.push(url)

        if (url.includes('/commits/')) {
          return createJsonResponse({ sha: 'abcdef1234567890' })
        }

        if (url.includes('/contents/templates/node-ts')) {
          return createJsonResponse([
            {
              type: 'file',
              name: 'manifest.json',
              download_url: 'https://download.test/manifest.json',
            },
          ])
        }

        return createFileResponse('{"key":"node-ts"}\n')
      },
    })

    assert.equal(source.type, 'github')
    assert.equal(source.ref, 'v1.2.3')
    assert.equal(source.commit, 'abcdef123456')
    assert.equal(source.cacheHit, false)
    assert.equal(await fs.pathExists(join(source.templatePath, 'manifest.json')), true)
    assert.equal(requestedUrls.some((url) => url.includes('/commits/v1.2.3')), true)
    assert.equal(requestedUrls.some((url) => url.includes('ref=v1.2.3')), true)
    assert.equal(source.templatePath.includes('v1.2.3'), true)
  } finally {
    await removeTempDir(cacheDir)
  }
})

test('resolveTemplateSource falls back unless strict remote is enabled', async () => {
  const failingFetch = async () => createErrorResponse()

  const fallback = await captureConsoleOutput(() => resolveTemplateSource('node-ts', {
    remote: true,
    ref: 'missing-ref',
    fetchImpl: failingFetch,
  }))

  assert.equal(fallback.source.type, 'builtin')
  assert.match(fallback.source.fallbackReason, /404 Not Found/)

  await assert.rejects(
    () => captureConsoleOutput(() => resolveTemplateSource('node-ts', {
      remote: true,
      ref: 'missing-ref',
      strictRemote: true,
      fetchImpl: failingFetch,
    })),
    /strict remote/,
  )
})
