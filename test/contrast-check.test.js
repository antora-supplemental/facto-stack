'use strict'
const { test } = require('node:test')
const assert = require('node:assert/strict')
const { normalize, args, gating, DEFAULTS } = require('../lib/contrast-check')

test('contrast-check is on by default: dark + dynamic states fail, search states', () => {
  const c = normalize(undefined)
  assert.equal(c.failOn, 'error'); assert.equal(c.failScope, 'dark-and-states'); assert.equal(c.maxPages, 20)
  assert.deepEqual(c.states, DEFAULTS.states)
  const a = args('/site', c, '/pb', '/tmp/r.json')
  assert.deepEqual(a.slice(0, 5), ['/site', '--fail-on', 'none', '--max-pages', '20'])
  assert.ok(a.includes('search-results') && a.includes('fixtures') && a.includes('--json=/tmp/r.json'))
  assert.ok(a.some((x) => String(x).endsWith('contrast-check.suppress.json')))
  assert.ok(!a.includes('--schemes'), 'every scheme by default')
})

test('gating: default fails dark and state errors only', () => {
  const F = [
    { level: 'error', scheme: 'light', mode: 'light' },
    { level: 'error', scheme: 'light', mode: 'light', state: 'search-results', selector: '.dropdown' },
    { level: 'error', scheme: 'dark', mode: 'dark' },
    { level: 'warning', scheme: 'dark', mode: 'dark' },
  ]
  assert.equal(gating(F, normalize(undefined)).length, 2)
  assert.equal(gating(F, normalize({ failScope: 'all' })).length, 3)
  assert.equal(gating(F, normalize({ failOn: 'warning' })).length, 3)
  assert.equal(gating(F, normalize({ failOn: 'none' })).length, 0)
  assert.throws(() => normalize({ failScope: 'nope' }))
  const st = [
    { level: 'error', scheme: 'light', mode: 'light', page: '/a', rule: 'r', selector: 'q' },
    { level: 'error', scheme: 'light', mode: 'light', page: '/a', rule: 'r', selector: 'q', state: 'fixtures' },
  ]
  assert.equal(gating(st, normalize(undefined)).length, 0, 'state repeat of a static light finding is report-only')
})

test('contrast-check per-site override and opt-out', () => {
  assert.equal(normalize(false), null)
  assert.equal(normalize({ enabled: false }), null)
  const c = normalize({ failon: 'warning', maxpages: 5, schemes: ['dark'], defaultsuppressions: false })
  const a = args('/s', c, '/pb')
  assert.deepEqual(a.slice(0, 5), ['/s', '--fail-on', 'none', '--max-pages', '5'])
  assert.equal(c.failOn, 'warning')
  assert.ok(a.includes('--schemes') && !a.some((x) => String(x).endsWith('contrast-check.suppress.json')))
})
