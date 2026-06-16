import assert from 'node:assert/strict'
import test, { mock } from 'node:test'
import {
  getPluginPackageMetadata,
  isPluginPackageName,
  normalizePluginPackageName,
  searchMarketplacePlugins,
} from '../../src/marketplace/client.js'

test('plugin package name validation accepts scoped and unscoped plugin packages', () => {
  assert.equal(isPluginPackageName('cxa-plugin-admin'), true)
  assert.equal(isPluginPackageName('@scope/cxa-plugin-admin'), true)
  assert.equal(isPluginPackageName('react'), false)
  assert.throws(() => normalizePluginPackageName('react'), /插件包名必须/)
})

test('searchMarketplacePlugins filters non-plugin packages and includes metadata', async () => {
  mock.method(globalThis, 'fetch', async (url) => {
    if (String(url).includes('/downloads/')) {
      return {
        ok: true,
        async json() {
          return { downloads: 12 }
        },
      }
    }

    return {
      ok: true,
      async json() {
        return {
          objects: [
            {
              package: {
                name: 'cxa-plugin-admin',
                version: '0.1.0',
                description: 'Admin',
                date: '2026-06-01T00:00:00.000Z',
                license: 'MIT',
                links: {
                  repository: 'https://github.com/example/cxa-plugin-admin',
                },
              },
            },
            { package: { name: 'react', version: '18.0.0' } },
          ],
        }
      },
    }
  })

  const plugins = await searchMarketplacePlugins('admin')

  assert.deepEqual(plugins, [{
    name: 'cxa-plugin-admin',
    version: '0.1.0',
    description: 'Admin',
    weeklyDownloads: 12,
    updatedAt: '2026-06-01T00:00:00.000Z',
    license: 'MIT',
    repository: 'https://github.com/example/cxa-plugin-admin',
  }])
})

test('getPluginPackageMetadata includes trust and risk metadata', async () => {
  mock.method(globalThis, 'fetch', async (url) => {
    if (String(url).includes('/downloads/')) {
      return {
        ok: true,
        async json() {
          return { downloads: 8 }
        },
      }
    }

    return {
      ok: true,
      async json() {
        return {
          name: 'cxa-plugin-safe',
          description: 'Safe plugin',
          time: { modified: '2026-06-02T00:00:00.000Z' },
          'dist-tags': { latest: '0.1.0' },
          versions: {
            '0.1.0': {
              name: 'cxa-plugin-safe',
              version: '0.1.0',
              description: 'Safe plugin latest',
              license: 'MIT',
              repository: {
                type: 'git',
                url: 'git+https://github.com/example/cxa-plugin-safe.git',
              },
              cxaPluginApi: '>=1.0.0 <2.0.0',
              scripts: {
                postinstall: 'node audit.js',
              },
              'cxa-plugin': true,
            },
          },
        }
      },
    }
  })

  const metadata = await getPluginPackageMetadata('cxa-plugin-safe')

  assert.equal(metadata.name, 'cxa-plugin-safe')
  assert.equal(metadata.weeklyDownloads, 8)
  assert.equal(metadata.license, 'MIT')
  assert.equal(metadata.repository, 'git+https://github.com/example/cxa-plugin-safe.git')
  assert.equal(metadata.cxaPluginApi, '>=1.0.0 <2.0.0')
  assert.equal(metadata.scripts.postinstall, 'node audit.js')
  assert.equal(metadata.isCxaPlugin, true)
})

test('getPluginPackageMetadata rejects non-plugin package metadata', async () => {
  mock.method(globalThis, 'fetch', async () => ({
    ok: true,
    async json() {
      return {
        name: 'cxa-plugin-invalid',
        'dist-tags': { latest: '0.1.0' },
        versions: { '0.1.0': {} },
      }
    },
  }))

  await assert.rejects(
    () => getPluginPackageMetadata('cxa-plugin-invalid'),
    /不是有效的 create-x-app 插件包/,
  )
})
