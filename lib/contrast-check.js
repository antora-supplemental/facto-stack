'use strict'

// Built-in contrast check: after the site is published, run
// @antora-supplemental/contrast-check (antora-ui-chassis) on the output
// directory across every color scheme the paint declares, with the search
// results open (search-results + fixtures states). By default the build fails
// only on WCAG AA errors in dark mode or in a dynamic state; every other
// finding (e.g. light-mode static pages) is reported but does not fail.
//
// Per-site override (facto-stack extension config, key contrastCheck):
//   contrastCheck: false                    # off
//   contrastCheck:
//     failOn: error | warning | none         # default error
//     failScope: dark-and-states | all       # default dark-and-states (which findings can fail)
//     pages: "index.html,**/*.html"          # default: every page up to maxPages
//     maxPages: 20                           # CI budget: ~10-15 s per page per scheme
//     schemes: "light,dark"                  # default: every scheme
//     states: [search-results, fixtures]     # dynamic UI states
//     config: contrast-check.config.json     # suppressions etc. (default: picked up from the playbook dir)
//     suppress: contrast-check.suppress.yaml
//     json: build/contrast-check.json
//     defaultSuppressions: true              # facto's reviewed suppressions (lib/contrast-check.suppress.json)
//     requireBrowser: false                  # true: fail when no Chrome is found (default: true in CI)
// Env: FACTO_CONTRAST_CHECK=0 skips; FACTO_CONTRAST_CHECK_FAIL_ON overrides failOn;
// FACTO_CONTRAST_CHECK_FAIL_SCOPE overrides failScope.

const { spawnSync } = require('node:child_process')
const { existsSync, readFileSync, mkdtempSync, rmSync } = require('node:fs')
const os = require('node:os')
const path = require('node:path')

const DEFAULTS = Object.freeze({
  failOn: 'error',
  failScope: 'dark-and-states',
  maxPages: 20,
  states: ['search-results', 'fixtures'],
})

const CHROMES = [
  '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
]

function normalize (raw) {
  if (raw === false || raw === 'false') return null
  const o = raw && typeof raw === 'object' ? raw : {}
  const pick = (a, b) => (o[a] != null ? o[a] : o[b])
  const cfg = {
    failOn: process.env.FACTO_CONTRAST_CHECK_FAIL_ON || pick('failOn', 'failon') || DEFAULTS.failOn,
    failScope: process.env.FACTO_CONTRAST_CHECK_FAIL_SCOPE || pick('failScope', 'failscope') || DEFAULTS.failScope,
    pages: pick('pages', 'pages'),
    maxPages: pick('maxPages', 'maxpages') || DEFAULTS.maxPages,
    schemes: pick('schemes', 'schemes'),
    states: pick('states', 'states') || DEFAULTS.states,
    config: pick('config', 'config'),
    suppress: pick('suppress', 'suppress'),
    json: pick('json', 'json'),
    requireBrowser: pick('requireBrowser', 'requirebrowser'),
    defaultSuppressions: pick('defaultSuppressions', 'defaultsuppressions'),
  }
  if (o.enabled === false) return null
  if (!['error', 'warning', 'none'].includes(cfg.failOn)) throw new Error(`contrastCheck.failOn must be error, warning or none (got ${cfg.failOn})`)
  if (!['dark-and-states', 'all'].includes(cfg.failScope)) throw new Error(`contrastCheck.failScope must be dark-and-states or all (got ${cfg.failScope})`)
  return cfg
}

const isDark = (f) => f.mode === 'dark' || /dark/i.test(String(f.scheme || ''))

const key = (f) => [f.page, f.scheme, f.rule, f.selector].join('\u0000')

/**
 * Findings that fail the build under cfg (failOn level x failScope).
 * dark-and-states: any dark-mode finding, plus state findings the state itself
 * introduced (a state re-checks the whole page, so a light-mode issue already
 * on the static page is reported, not failed, again).
 */
function gating (findings, cfg) {
  if (cfg.failOn === 'none') return []
  const levels = cfg.failOn === 'warning' ? ['error', 'warning'] : ['error']
  const atLevel = findings.filter((f) => levels.includes(f.level))
  if (cfg.failScope === 'all') return atLevel
  const staticKeys = new Set(findings.filter((f) => !f.state).map(key))
  return atLevel.filter((f) => isDark(f) || (f.state && !staticKeys.has(key(f))))
}

function args (site, cfg, playbookDir, jsonFile) {
  const list = (v) => (Array.isArray(v) ? v.join(',') : String(v))
  // The CLI never fails on its own; facto applies failOn x failScope to the JSON report.
  const a = [site, '--fail-on', 'none', '--max-pages', String(cfg.maxPages)]
  if (cfg.pages) a.push('--pages', list(cfg.pages))
  if (cfg.schemes) a.push('--schemes', list(cfg.schemes))
  for (const s of [].concat(cfg.states || [])) a.push('--state', s)
  if (cfg.config) a.push('--config', path.resolve(playbookDir, cfg.config))
  if (cfg.defaultSuppressions !== false && cfg.defaultSuppressions !== 'false') a.push('--suppress', path.join(__dirname, 'contrast-check.suppress.json'))
  for (const s of [].concat(cfg.suppress || [])) a.push('--suppress', path.resolve(playbookDir, s))
  if (jsonFile) a.push(`--json=${jsonFile}`)
  return a
}

function registerContrastCheck (context, rawConfig, logger) {
  if (process.env.FACTO_CONTRAST_CHECK === '0') return
  const cfg = normalize(rawConfig)
  if (!cfg) return
  context.on('sitePublished', ({ playbook, publications }) => {
    const dir = (playbook && playbook.dir) || process.cwd()
    const out = (playbook && playbook.output && playbook.output.dir) || './build/site'
    const pub = [].concat(publications || []).find((p) => p && p.resolvedPath)
    // Antora resolves a dot-relative output.dir against the playbook dir and a bare one against the cwd.
    const site = pub ? pub.resolvedPath : /^\.{1,2}[\\/]/.test(out) ? path.resolve(dir, out) : path.resolve(out)
    if (!existsSync(site)) { logger.warn?.('contrast-check: output dir %s not found; skipped', site); return }
    let bin
    try { bin = path.join(path.dirname(require.resolve('@antora-supplemental/contrast-check')), '..', 'bin', 'contrast-check.js') } catch {
      logger.warn?.('contrast-check: @antora-supplemental/contrast-check is not installed; skipped'); return
    }
    const env = { ...process.env }
    if (!env.CONTRAST_CHECK_CHROME) { const c = CHROMES.find(existsSync); if (c) env.CONTRAST_CHECK_CHROME = c }
    if (!env.CONTRAST_CHECK_CHROME && !env.CONTRAST_CHECK_CHANNEL) {
      const must = cfg.requireBrowser != null ? cfg.requireBrowser === true || cfg.requireBrowser === 'true' : !!env.CI
      const msg = 'contrast-check: no Chrome/Chromium found (set CONTRAST_CHECK_CHROME)'
      if (must) throw new Error(msg)
      logger.warn?.(msg + '; skipped'); return
    }
    logger.info?.('contrast-check: %s (fail-on %s, scope %s, states %s, max-pages %s)', site, cfg.failOn, cfg.failScope, [].concat(cfg.states).join(','), cfg.maxPages)
    const tmp = cfg.json ? null : mkdtempSync(path.join(os.tmpdir(), 'facto-cc-'))
    const jsonFile = cfg.json ? path.resolve(dir, cfg.json) : path.join(tmp, 'report.json')
    try {
      const r = spawnSync(process.execPath, [bin, ...args(site, cfg, dir, jsonFile)], { cwd: dir, env, stdio: 'inherit' })
      if (r.status !== 0) throw new Error(`contrast-check: exited with ${r.status ?? r.signal}`)
      const { findings = [] } = JSON.parse(readFileSync(jsonFile, 'utf8'))
      const bad = gating(findings, cfg)
      const rest = findings.length - bad.length
      if (rest) logger.warn?.('contrast-check: %d finding(s) reported only (outside fail scope %s / level %s)', rest, cfg.failScope, cfg.failOn)
      if (bad.length) {
        for (const f of bad.slice(0, 50)) logger.error?.('contrast-check: %s %s %s%s %s | %s', f.level, f.rule, f.scheme, f.state ? ' [' + f.state + ']' : '', f.page, f.selector)
        throw new Error(`contrast-check: ${bad.length} failure(s) at or above '${cfg.failOn}' in scope '${cfg.failScope}' (override with facto-stack config contrastCheck)`)
      }
    } finally { if (tmp) rmSync(tmp, { recursive: true, force: true }) }
  })
}

module.exports = { registerContrastCheck, normalize, args, gating, DEFAULTS }