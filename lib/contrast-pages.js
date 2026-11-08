'use strict'
// Compare original source revisions, never rendered HTML or global chrome.
const { spawnSync } = require('node:child_process')
const { readFileSync, mkdirSync, writeFileSync } = require('node:fs')
const path = require('node:path')
const git = (origin, args) => {
  const r = spawnSync('git', [...(origin.worktree ? ['-C', origin.worktree] : ['--git-dir=' + origin.gitdir]), ...args], { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024, timeout: 30000, env: { ...process.env, GIT_TERMINAL_PROMPT: '0', GCM_INTERACTIVE: 'Never' } })
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
// Keep raw contents before Antora replaces page.contents with rendered HTML.
function captureSourceContents (catalog) {
  return new Map((catalog.getFiles ? catalog.getFiles() : catalog.getPages()).filter(f => ['page', 'partial', 'example'].includes(f.src?.family)).map(f => [f, String(f.src.contents || f.contents || '')]))
}
function includedFiles (page, catalog, contents) {
  if (!catalog || !contents) return []
  const found = new Set(); const seen = new Set()
  const visit = (file, inherited) => {
    if (seen.has(file)) return
    seen.add(file)
    const text = contents.get(file) || ''
    const attrs = { ...inherited }
    for (const m of text.matchAll(/^:([\w-]+):[ \t]*(.*)$/gm)) attrs[m[1]] = m[2].trim()
    for (const m of text.matchAll(/^include::([^\r\n[]+)\[/gm)) {
      let target = m[1]
      for (let i = 0; i < 5; i++) target = target.replace(/\{([\w-]+)\}/g, (s, k) => attrs[k] ?? s)
      if (/\{|^[a-z]+:\/\//i.test(target)) continue
      let dependency
      try {
        dependency = /[$:@]/.test(target)
          ? catalog.resolveResource(target, file.src, 'page')
          : catalog.getByPath({ component: file.src.component, version: file.src.version, path: path.posix.join(path.posix.dirname(file.src.path), target) })
      } catch { continue }
      if (dependency) { found.add(dependency); visit(dependency, attrs) }
    }
  }
  const component = catalog.getComponent?.(page.src?.component)?.versions?.find(v => v.version === page.src.version)
  visit(page, { ...component?.asciidoc?.attributes, ...page.asciidoc?.attributes, partialsdir: 'partial$', examplesdir: 'example$' })
  return [...found]
}
function selectContrastPages (pages, cfg, dir, io = {}) {
  const readGit = io.git || git
  const keys = new Map()
  const sampling = cfg.sampling === false ? false : (cfg.sampling || {})
  if (sampling === false) return { pages: cfg.pages, maxPages: cfg.maxPages }
  const file = path.resolve(dir, sampling.baseline || '.contrast-check-baseline.json')
  let previous = io.previous || { sources: {}, pages: [] }
  if (!io.previous) { try { previous = JSON.parse(readFileSync(file, 'utf8')) } catch {} }
  const sources = {}; const changed = new Set(); const direct = new Set(); const included = new Set(); const all = []; const layouts = new Map(); const bySource = new Map(); const changes = new Map(); const reasons = {}; const ignored = new Set(); const dependencies = {}
  const addReason = (url, why) => { const list = reasons[url] ||= []; if (!list.includes(why)) list.push(why) }
  const identity = f => { const o = f.src?.origin; if (!o?.gitdir) return null; if (!keys.has(o)) keys.set(o, sourceKey(o, readGit)); return [keys.get(o), f.src.component || '', f.src.version || ''].join('|') }
  const sourcePath = f => [f.src?.origin?.startPath, f.src?.path || ['modules', f.src?.module || 'ROOT', 'pages', f.src?.relative].join('/')].filter(Boolean).join('/').replace(/\\/g, '/')
  for (const p of pages) {
    if (!p.out?.path) continue
    const url = p.out.path.replace(/\\/g, '/').replace(/^\//, '')
    all.push(url)
    const layout = p.asciidoc?.attributes?.['page-layout'] || 'default'
    if (!layouts.has(layout) || url < layouts.get(layout)) layouts.set(layout, url)
    const o = p.src?.origin
    if (!o?.gitdir) continue
    const key = identity(p)
    if (!bySource.has(key)) bySource.set(key, { origin: o, pages: [] })
    bySource.get(key).pages.push({ p, url })
    if (previous.version && !previous.pages?.includes(url)) { changed.add(url); direct.add(url); addReason(url, 'new source page') }
  }
  for (const f of io.contents?.keys() || []) {
    const key = identity(f); if (key && !bySource.has(key)) bySource.set(key, { origin: f.src.origin, pages: [] })
  }
  let unknown = false
  for (const [key, { origin: o, pages: ps }] of bySource) {
    const head = o.refhash || readGit(o, ['rev-parse', 'HEAD'])
    sources[key] = head
    const base = sampling.baseRef || sampling.baseref || process.env.FACTO_CONTRAST_BASE_REF || previous.sources?.[key]
    if (!base || !head) { unknown = true; continue }
    let resolved = readGit(o, ['rev-parse', '--verify', base + '^{commit}'])
    // Fresh Antora CI caches may be shallow; fetch the saved tree explicitly.
    if (!resolved && /^[a-f0-9]{40,64}$/i.test(base)) {
      readGit(o, ['fetch', '--no-tags', '--depth=1', 'origin', base])
      resolved = readGit(o, ['rev-parse', '--verify', base + '^{commit}'])
    }
    if (!resolved) { unknown = true; continue }
    const diff = readGit(o, ['diff', '--name-only', '--no-renames', '--diff-filter=ACDMRT', '-z', base, ...(o.worktree ? [] : [head]), '--'])
    if (diff === null) { unknown = true; continue }
    const paths = new Set(diff.split(/\0|\r?\n/).filter(Boolean))
    if (o.worktree) for (const f of (readGit(o, ['ls-files', '--others', '--exclude-standard', '-z']) || '').split(/\0|\r?\n/).filter(Boolean)) paths.add(f)
    changes.set(key, paths)
    const repo = keys.get(o).split('|')[0]
    const ownPaths = new Set([...bySource.values()].filter(g => keys.get(g.origin).split('|')[0] === repo).flatMap(g => g.pages.map(({ p }) => sourcePath(p))))
    for (const f of paths) if (!ownPaths.has(f) && !/(?:^|\/)(?:partials|examples)\//.test(f)) ignored.add(keys.get(o).split('|')[0] + ':' + f)
    for (const { p, url } of ps) if (paths.has(sourcePath(p))) { changed.add(url); direct.add(url); addReason(url, 'source: ' + sourcePath(p)) }
  }
  // Follow includes transitively across modules/components/sources. Retain last
  // green dependencies too, so deleted or retargeted includes remain covered.
  for (const { pages: ps } of bySource.values()) for (const { p, url } of ps) {
    const current = includedFiles(p, io.catalog, io.contents).map(f => ({ source: identity(f), path: sourcePath(f) })).filter(f => f.source)
    dependencies[url] = current
    for (const dep of [...current, ...(previous.dependencies?.[url] || [])]) if (changes.get(dep.source)?.has(dep.path)) {
      changed.add(url); if (!direct.has(url)) included.add(url); addReason(url, 'include: ' + dep.path)
    }
  }
  const representatives = [].concat(cfg.pages || []).flatMap(x => String(x).split(',')).map(x => x.trim()).filter(Boolean)
  for (const [layout, url] of layouts) addReason(url, 'representative layout: ' + layout)
  for (const url of representatives) addReason(url, 'representative extension/config')
  const fallback = unknown ? all.slice().sort().slice(0, cfg.maxPages ?? 20) : []
  for (const url of fallback) addReason(url, 'unknown baseline: broad fallback')
  const picked = [...new Set([...changed, ...layouts.values(), ...representatives, ...fallback])].sort()
  const snapshot = { version: 2, sources, pages: [...new Set(all)].sort(), dependencies }
  return { pages: picked, maxPages: Number.MAX_SAFE_INTEGER, file, snapshot, changed: changed.size, direct: direct.size, included: included.size, representatives: new Set([...layouts.values(), ...representatives]).size, ignored: ignored.size, reasons, unknown }
}
function saveBaseline (selection) {
  if (!selection.file) return
  mkdirSync(path.dirname(selection.file), { recursive: true })
  writeFileSync(selection.file, JSON.stringify(selection.snapshot, null, 2) + '\n')
}
module.exports = { selectContrastPages, saveBaseline, sourceKey, captureSourceContents, includedFiles }
