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

test('contrast-check gates merged multi-scheme findings that include dark', () => {
  const F = [{ level: 'error', schemes: ['light/light', 'dark/dark'], rule: 'focus-not-visible' }, { level: 'error', schemes: ['light/light'], rule: 'x' }]
  assert.equal(gating(F, normalize(undefined)).length, 1)
})

test('contrast-check summary line counts unexempted errors and exempted findings', () => {
  const { summaryLine } = require('../lib/contrast-check')
  const F = [{ level: 'error', scheme: 'light', mode: 'light' }, { level: 'warning', scheme: 'light', mode: 'light' }, { level: 'warning', scheme: 'light', mode: 'light' }]
  const s = summaryLine(F, [], [{}, {}, {}], normalize(undefined), 'build/contrast-check/report.json')
  assert.match(s, /3 finding\(s\) reported only .*: 1 unexempted error\(s\), 2 unexempted warning\(s\); 3 exempted by suppressions; report build\/contrast-check\/report\.json/)
  assert.ok(args('/s', normalize(undefined), '/pb').join(' ').includes('--exempted summary'))
})
test('total audit guard is validated and passed to the source CLI', () => {
 assert.equal(normalize(undefined).maxDurationMs,600000)
 assert.ok(args('/s',normalize({maxdurationms:1234}),'/pb').join(' ').includes('--max-duration-ms 1234'))
 for(const n of [0,-1,'bad',Infinity]) assert.throws(()=>normalize({maxDurationMs:n}),/maxDurationMs/)
})
