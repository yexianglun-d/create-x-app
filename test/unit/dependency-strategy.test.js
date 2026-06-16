import assert from 'node:assert/strict'
import test from 'node:test'
import { resolveDependencyVersion } from '../../src/generator/index.js'

const metadata = {
  latest: '2.0.0',
  versions: [
    '1.2.3',
    '1.2.4',
    '1.3.0',
    '1.3.1',
    '2.0.0',
  ],
}

test('latest-patch only upgrades within the same minor line', () => {
  assert.equal(resolveDependencyVersion('^1.2.3', metadata, 'latest-patch'), '1.2.4')
})

test('latest-minor only upgrades within the same major line', () => {
  assert.equal(resolveDependencyVersion('~1.2.3', metadata, 'latest-minor'), '1.3.1')
})

test('latest-major and latest use npm latest when newer', () => {
  assert.equal(resolveDependencyVersion('^1.2.3', metadata, 'latest-major'), '2.0.0')
  assert.equal(resolveDependencyVersion('^1.2.3', metadata, 'latest'), '2.0.0')
})

test('dependency strategy keeps baseline for non-semver ranges and older latest', () => {
  assert.equal(resolveDependencyVersion('workspace:*', metadata, 'latest'), null)
  assert.equal(resolveDependencyVersion('^2.0.0', metadata, 'latest'), null)
})
