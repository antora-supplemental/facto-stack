'use strict'
const { test } = require('node:test')
const assert = require('node:assert/strict')
const { selectContrastPages, sourceKey } = require('../lib/contrast-pages')
const page = (url, layout) => ({ out: { path: url }, asciidoc: { attributes: { 'page-layout': layout } } })
test('unknown baseline takes deterministic broad sample and every layout plus configured representatives', () => {
 const pages = [page('z.html', 'demo'), page('b.html', 'article'), page('a.html', 'article')]
 const cfg = { maxPages: 1, pages: ['extension/index.html'], sampling: { baseline: 'missing-baseline.json' } }
 const a = selectContrastPages(pages, cfg, __dirname)
 const b = selectContrastPages(pages.slice().reverse(), cfg, __dirname)
 assert.deepEqual(a.pages, b.pages)
 assert.ok(a.pages.includes('z.html') && a.pages.includes('extension/index.html'))
 assert.ok(a.maxPages >= a.pages.length)
})
test('explicit legacy opt-out retains configured page cap', () => {
 assert.deepEqual(selectContrastPages([], { sampling: false, pages: ['a.html'], maxPages: 4 }, __dirname), { pages: ['a.html'], maxPages: 4 })
})

test('all changed, renamed and new pages survive the page budget, across platforms', () => {
 const origin = { gitdir: '/repo/.git', worktree: '/repo', startPath: 'docs' }
 const pages = ['a','b','c'].map(n => ({ ...page(n + '/index.html', 'article'), src: { origin, component: 'home', version: '', path: 'modules/ROOT/pages/' + n + '.adoc', relative: n + '.adoc' } }))
 const readGit = (o, a) => a[0] === 'config' ? 'git@github.com:org/repo.git' : a[0] === 'rev-parse' ? 'hash' : a[0] === 'diff' ? 'docs/modules/ROOT/pages/b.adoc' : a[0] === 'ls-files' ? 'docs/modules/ROOT/pages/c.adoc' : null
 const previous = { version: 1, sources: { 'https://github.com/org/repo|docs|home|': 'base' }, pages: ['a/index.html','b/index.html'] }
 const selected = selectContrastPages(pages, { maxPages: 1 }, __dirname, { git: readGit, previous })
 assert.equal(selected.changed, 2)
 assert.deepEqual(selected.pages, ['a/index.html','b/index.html','c/index.html'])
 assert.equal(selected.unknown, false)
})
test('unavailable base falls back broadly rather than selecting no pages', () => {
 const origin = { gitdir: '/repo/.git', refhash: 'head', startPath: 'docs' }
 const pages = [ { ...page('a.html','article'), src: { origin } }, { ...page('b.html','article'), src: { origin } } ]
 const r = selectContrastPages(pages, { maxPages: 2, sampling: { baseRef: 'missing' } }, __dirname, { git: (o,a) => a[0] === 'config' ? 'https://github.com/org/repo.git' : null })
 assert.equal(r.unknown, true); assert.deepEqual(r.pages, ['a.html','b.html'])
})

test('baseline identity never stores credentials from source remotes', () => {
 const { sourceKey } = require('../lib/contrast-pages')
 const key = sourceKey({ gitdir: '/git', startPath: 'docs' }, () => 'https://user:synthetic-test-password@github.com/org/repo.git')
 assert.equal(key, 'https://github.com/org/repo|docs')
 assert.ok(!key.includes('synthetic'))
})

test('new pages remain mandatory even when a saved git base is unavailable', () => {
 const origin = { gitdir: '/repo/.git', refhash: 'head', startPath: 'docs' }
 const pages = ['a','b','z-new'].map(n => ({ ...page(n + '.html', 'article'), src: { origin } }))
 const r = selectContrastPages(pages, { maxPages: 1 }, __dirname, { previous: { version: 1, sources: { 'https://github.com/org/repo|docs||': 'missing' }, pages: ['a.html','b.html'] }, git: (o,a) => a[0] === 'config' ? 'https://github.com/org/repo.git' : null })
 assert.equal(r.unknown, true); assert.ok(r.pages.includes('z-new.html'))
})

test('a fresh shallow CI cache fetches the saved base tree before diffing', () => {
 const o = { gitdir: '/cache/repo.git', refhash: 'head', startPath: 'docs' }
 const base = 'a'.repeat(40)
 let fetched = false
 const pages = ['a','z'].map(n => ({...page(n + '.html','article'), src: { origin:o, path:'modules/ROOT/pages/' + n + '.adoc' }}))
 const git = (origin,args) => {
  if(args[0] === 'config') return 'https://github.com/org/repo.git'
  if(args[0] === 'fetch') { assert.equal(args.at(-1),base); fetched = true; return '' }
  if(args[0] === 'rev-parse') return fetched ? base : null
  if(args[0] === 'diff') return 'docs/modules/ROOT/pages/z.adoc\0'
 }
 const r = selectContrastPages(pages,{ maxPages:1 },__dirname,{ git,previous:{version:1,sources:{'https://github.com/org/repo|docs||':base},pages:['a.html','z.html']} })
 assert.equal(fetched,true);assert.equal(r.unknown,false);assert.equal(r.changed,1);assert.ok(r.pages.includes('z.html'))
})

test('GitHub source identities ignore HTTPS versus SSH and repository casing', () => {
 assert.equal(sourceKey({url:'git@github.com:Org/Repo.git',startPath:'docs'}),sourceKey({url:'https://github.com/org/repo',startPath:'docs'}))
})
