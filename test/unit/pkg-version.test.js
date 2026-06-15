import assert from 'node:assert/strict'
import test, { mock } from 'node:test'
import { getLatestVersions } from '../../src/utils/pkg-version.js'

test('getLatestVersions returns latest versions and null for failures', async () => {
  mock.method(globalThis, 'fetch', async (url) => {
    if (String(url).includes('missing-package')) {
      return { ok: false }
    }

    return {
      ok: true,
      async json() {
        return { version: '1.2.3' }
      },
    }
  })

  const versions = await getLatestVersions(['react', 'react', 'missing-package'], {
    timeout: 100,
  })

  assert.deepEqual(versions, {
    react: '1.2.3',
    'missing-package': null,
  })
})
