'use strict'
// Source-aware sampling. A successful run records one git revision per source,
// not one global hub revision: remote components can change independently.
const { spawnSync } = require('node:child_process')
const { readFileSync, mkdirSync, writeFileSync } = require('node:fs')
const path = require('node:path')
const git = (origin, args) => {
  const r = spawnSync('git', ['--git-dir=' + origin.gitdir, ...(origin.worktree ? ['--work-tree=' + origin.worktree] : []), ...args], { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024, timeout: 30000, env: { ...process.env, GIT_TERMINAL_PROMPT: '0', GCM_INTERACTIVE: 'Never' } })
  return r.status === 0 ? r.stdout.trim() : null
}
const canonical = (url) => {
  const value = String(url || '').replace(/^git@([^:]+):/, 'https://$1/').replace(/^ssh:\/\/(?:[^@/]+@)?/, 'https://')
  try {
    const u = new URL(value)
    if (!['https:', 'http:', 'ssh:'].includes(u.protocol)) return '(local)'
    u.username = ''; u.password = ''; u.search = ''; u.hash = ''
    if (u.hostname === 'github.com') u.pathname = u.pathname.toLowerCase()
    if (u.protocol === 'ssh:') { u.protocol = 'https:'; u.port = '' }
    return u.toString().replace(/\.git$/i, '').replace(/\/$/, '')
  } catch { return '(local)' }
}
function sourceKey (o, readGit = git) {
  const remote = o.gitdir && readGit(o, ['config', '--get', 'remote.origin.url'])
  return [canonical(remote || o.url), o.startPath || ''].join('|')
}
function selectContrastPages (pages, cfg, dir, io = {}) {
  const readGit = io.git || git
  const keys = new Map()
  const sampling = cfg.sampling === false ? false : (cfg.sampling || {})
  if (sampling === false) return { pages: cfg.pages, maxPages: cfg.maxPages }
  const file = path.resolve(dir, sampling.baseline || '.contrast-check-baseline.json')
  let previous = io.previous || { sources: {}, pages: [] }
  if (!io.previous) { try { previous = JSON.parse(readFileSync(file, 'utf8')) } catch {} }
  const sources = {}; const changed = new Set(); const all = []; const layouts = new Map(); const bySource = new Map()
  for (const p of pages) {
    if (!p.out?.path) continue
    const url = p.out.path.replace(/\\/g, '/').replace(/^\//, '')
    all.push(url)
    if (previous.version && !previous.pages?.includes(url)) changed.add(url)
    const layout = p.asciidoc?.attributes?.['page-layout'] || 'default'
    if (!layouts.has(layout) || url < layouts.get(layout)) layouts.set(layout, url)
    const o = p.src?.origin
    if (!o?.gitdir) continue
    if (!keys.has(o)) keys.set(o, sourceKey(o, readGit))
    const key = [keys.get(o), p.src.component || '', p.src.version || ''].join('|')
    if (!bySource.has(key)) bySource.set(key, { origin: o, pages: [] })
    bySource.get(key).pages.push({ p, url })
  }
  let unknown = false
  for (const [key, { origin: o, pages: ps }] of bySource) {
    const head = o.refhash || readGit(o, ['rev-parse', 'HEAD'])
    sources[key] = head
    const base = sampling.baseRef || sampling.baseref || process.env.FACTO_CONTRAST_BASE_REF || previous.sources?.[key]
    if (!base || !head) { unknown = true; continue }
    let resolved = readGit(o, ['rev-parse', '--verify', base + '^{commit}'])
    // Fresh Antora CI caches are shallow. Fetch the saved tree directly instead
    // of quietly missing changed existing pages on every clean Linux runner.
    if (!resolved && /^[a-f0-9]{40,64}$/i.test(base)) {
      readGit(o, ['fetch', '--no-tags', '--depth=1', 'origin', base])
      resolved = readGit(o, ['rev-parse', '--verify', base + '^{commit}'])
    }
    if (!resolved) { unknown = true; continue }
    const diff = readGit(o, ['diff', '--name-only', '--diff-filter=ACDMRT', '-z', base, ...(o.worktree ? [] : [head]), '--'])
    if (diff === null) { unknown = true; continue }
    const paths = new Set(diff.split(/\0|\r?\n/).filter(Boolean))
    if (o.worktree) for (const f of (readGit(o, ['ls-files', '--others', '--exclude-standard', '-z']) || '').split(/\0|\r?\n/).filter(Boolean)) paths.add(f)
    // Includes, attributes and nav changes can affect every page in this source.
    const shared = [...paths].some(f => /(?:^|\/)(?:partials|examples|images)\/|(?:^|\/)(?:antora\.yml|nav\.adoc)$/.test(f))
    for (const { p, url } of ps) {
      const source = [o.startPath, p.src.path || ['modules', p.src.module || 'ROOT', 'pages', p.src.relative].join('/')].filter(Boolean).join('/').replace(/\\/g, '/')
      if (shared || paths.has(source) || !previous.pages?.includes(url) && !sampling.baseRef && !sampling.baseref && !process.env.FACTO_CONTRAST_BASE_REF) changed.add(url)
    }
  }
  // Unknown baseline: broad, deterministic sample plus each discovered layout.
  // Known baseline: changed/new pages are NEVER truncated by maxPages.
  const representatives = [].concat(cfg.pages || []).flatMap(x => String(x).split(',')).filter(Boolean)
  const picked = [...new Set([...changed, ...layouts.values(), ...representatives, ...(unknown ? all.sort().slice(0, cfg.maxPages) : [])])].sort()
  const snapshot = { version: 1, sources, pages: [...new Set(all)].sort() }
  return { pages: picked, maxPages: Number.MAX_SAFE_INTEGER, file, snapshot, changed: changed.size, unknown }
}
function saveBaseline (selection) {
  if (!selection.file) return
  mkdirSync(path.dirname(selection.file), { recursive: true })
  writeFileSync(selection.file, JSON.stringify(selection.snapshot, null, 2) + '\n')
}
module.exports = { selectContrastPages, saveBaseline, sourceKey }
