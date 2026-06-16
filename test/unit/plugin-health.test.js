import assert from 'node:assert/strict'
import test from 'node:test'
import {
  assertPluginInstallAllowed,
  evaluatePluginHealth,
  getPluginCompatibility,
  getRiskyNpmScripts,
} from '../../src/plugins/health.js'

test('plugin health passes trusted plugin metadata', () => {
  const health = evaluatePluginHealth({
    packageName: 'cxa-plugin-demo',
    cxaPlugin: true,
    cxaPluginApi: '>=1.0.0 <2.0.0',
    license: 'MIT',
    repository: 'https://github.com/example/cxa-plugin-demo',
    scripts: {
      test: 'node --test',
    },
    requiresNetwork: false,
    postActions: [],
    writesOutsideTarget: false,
    manifestValid: true,
  })

  assert.equal(health.riskLevel, 'pass')
  assert.equal(health.errors.length, 0)
  assert.equal(health.warnings.length, 0)
  assert.doesNotThrow(() => assertPluginInstallAllowed(health, 'cxa-plugin-demo'))
})

test('plugin health warns about lifecycle scripts and missing trust metadata', () => {
  const health = evaluatePluginHealth({
    packageName: 'cxa-plugin-risky',
    cxaPlugin: true,
    scripts: {
      postinstall: 'node install.js',
    },
    manifestValid: true,
  })

  assert.equal(health.riskLevel, 'warn')
  assert.deepEqual(getRiskyNpmScripts({ postinstall: 'node install.js', test: 'node --test' }), ['postinstall'])
  assert.match(health.warnings.map((check) => check.message).join('\n'), /安装前请审查 npm lifecycle 脚本/)
  assert.doesNotThrow(() => assertPluginInstallAllowed(health, 'cxa-plugin-risky'))
})

test('plugin health blocks incompatible plugin api ranges', () => {
  const compatibility = getPluginCompatibility('>=2.0.0 <3.0.0')
  const health = evaluatePluginHealth({
    packageName: 'cxa-plugin-next',
    cxaPlugin: true,
    cxaPluginApi: '>=2.0.0 <3.0.0',
    manifestValid: true,
  })

  assert.equal(compatibility.status, 'fail')
  assert.equal(health.riskLevel, 'fail')
  assert.throws(
    () => assertPluginInstallAllowed(health, 'cxa-plugin-next'),
    /当前插件 API 1\.0\.0 不满足 >=2\.0\.0 <3\.0\.0/,
  )
})
