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
 assert.deepEqual(selected.pages.slice().sort(), ['a/index.html','b/index.html','c/index.html'])
 assert.equal(selected.pages[0], 'a/index.html', 'representatives first')
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

test('regression: nav, image, theme and processor changes do not turn 67 source pages into changed pages', () => {
 const origin = { gitdir: '/repo/.git', refhash: 'head', startPath: 'docs' }
 const pages = Array.from({ length: 67 }, (_, i) => ({ ...page(i + '.html','article'), src: { origin, component:'home', path:'modules/ROOT/pages/' + i + '.adoc' } }))
 const previous = { version:1, sources:{'https://github.com/org/repo|docs|home|':'base'}, pages: pages.slice(0,66).map(p=>p.out.path) }
 const paths = ['docs/modules/ROOT/nav.adoc','docs/modules/ROOT/images/new.svg','supplemental-ui/css/theme.css','lib/archive-preprocessor.js','docs/modules/ROOT/pages/1.adoc','docs/modules/ROOT/pages/2.adoc','docs/modules/ROOT/pages/66.adoc']
 const git = (o,a) => a[0] === 'config' ? 'https://github.com/org/repo.git' : a[0] === 'rev-parse' ? 'hash' : a[0] === 'diff' ? paths.join('\0') : ''
 const selected = selectContrastPages(pages,{pages:['5.html'],maxPages:1},__dirname,{git,previous})
 assert.equal(selected.changed,3); assert.equal(selected.direct,3); assert.equal(selected.included,0)
 assert.deepEqual(selected.pages.slice().sort(),['0.html','1.html','2.html','5.html','66.html'])
 assert.deepEqual(selected.pages.slice(0,2),['0.html','5.html'],'layout and configured representatives first')
 assert.deepEqual(selected.contentPages.slice().sort(),['1.html','2.html','66.html'])
 assert.equal(selected.ignored,4); assert.match(selected.reasons['1.html'][0],/^source:/)
 const globalOnly = selectContrastPages(pages,{pages:['5.html']},__dirname,{git:(o,a)=>a[0] === 'diff' ? paths.slice(0,4).join('\0') : git(o,a),previous:{...previous,pages:pages.map(p=>p.out.path)}})
 assert.equal(globalOnly.changed,0); assert.deepEqual(globalOnly.pages.slice().sort(),['0.html','5.html'])
 assert.deepEqual(selectContrastPages(pages.slice().reverse(),{pages:['5.html'],maxPages:1},__dirname,{git,previous}).pages,selected.pages)
})
test('only transitive include dependents selected, with attributes, escaped literals, cycles and cross-source partials', () => {
 const { captureSourceContents } = require('../lib/contrast-pages')
 const origin={gitdir:'/repo/.git',refhash:'head',startPath:'docs'}
 const other={gitdir:'/other/.git',refhash:'head',startPath:'docs'}
 const file=(name,family,contents,o=origin)=>({ ...page(name+'.html','article'),contents:Buffer.from(contents),src:{origin:o,component:o===origin?'home':'other',version:'',family,path:'modules/ROOT/'+family+'s/'+name+'.adoc',relative:name+'.adoc'} })
 const a=file('a','page',':piece: partial$outer.adoc\ninclude::{piece}[]')
 const b=file('b','page','\\include::partial$outer.adoc[]')
 const c=file('c','page','= Untouched')
 const outer=file('outer','partial','include::other::partial$core.adoc[]')
 const core=file('core','partial','include::home::partial$outer.adoc[]',other)
 const files=[a,b,c,outer,core]
 const catalog={getFiles:()=>files,resolveResource:(t)=> t.includes('outer')?outer:t.includes('core')?core:undefined}
 const contents=captureSourceContents(catalog)
 // Mimic Antora composition: rendered contents are deliberately not inspected.
 a.contents=Buffer.from('<html>global navigation changed</html>')
 const git=(o,args)=>args[0]==='config'?'https://github.com/org/'+(o===origin?'repo':'other')+'.git':args[0]==='rev-parse'?'hash':args[0]==='diff'&&o===other?'docs/modules/ROOT/partials/core.adoc\0':''
 const previous={version:1,sources:{'https://github.com/org/repo|docs|home|':'base','https://github.com/org/other|docs|other|':'base'},pages:[a,b,c].map(p=>p.out.path)}
 const s=selectContrastPages([a,b,c],{},__dirname,{git,previous,catalog,contents})
 assert.equal(s.changed,1);assert.equal(s.included,1);assert.ok(s.pages.includes('a.html'));assert.ok(!s.pages.includes('b.html'))
 assert.match(s.reasons['a.html'].join(' '),/include:/);assert.equal(s.snapshot.dependencies['a.html'].length,2)
 const deleted=selectContrastPages([a,b,c],{},__dirname,{git,previous:s.snapshot,catalog:{...catalog,resolveResource:()=>undefined},contents})
 assert.equal(deleted.included,1,'previous-green dependencies cover deleted includes')
})

// Shared fixture for the ordering, grouping and carry-over tests.
function site (names, { previousPages, diff = [], log = '', pending, groups } = {}) {
 const origin = { gitdir: '/repo/.git', refhash: 'head', startPath: 'docs' }
 const pages = names.map(n => ({ ...page(n + '/index.html', n === 'index' ? 'home' : 'article'), src: { origin, component: 'home', version: '', path: 'modules/ROOT/pages/' + n + '.adoc' } }))
 const previous = { version: 2, sources: { 'https://github.com/org/repo|docs|home|': 'base' }, pages: previousPages || pages.map(p => p.out.path), ...(pending ? { pending } : {}) }
 const git = (o, a) => a[0] === 'config' ? 'https://github.com/org/repo.git' : a[0] === 'rev-parse' ? 'hash' : a[0] === 'diff' ? diff.map(n => 'docs/modules/ROOT/pages/' + n + '.adoc').join('\0') : a[0] === 'log' ? log : ''
 return { pages, previous, git, groups }
}
const pick = (s, cfg = {}) => selectContrastPages(s.pages, { pages: ['index/index.html'], ...cfg, sampling: { ...cfg.sampling, ...(s.groups === undefined ? {} : { groups: s.groups }) } }, __dirname, { git: s.git, previous: s.previous })

test('order: representatives, group representative, carry-over, then most recently changed', () => {
 const names = ['index', 'a', 'b', 'c', 'changelog-details/one', 'changelog-details/two']
 // git log -z --name-only --format=@%ct: newest commit first
 const log = ['@300', '', 'docs/modules/ROOT/pages/c.adoc', 'docs/modules/ROOT/pages/changelog-details/two.adoc', '@200', '', 'docs/modules/ROOT/pages/a.adoc', 'docs/modules/ROOT/pages/changelog-details/one.adoc', '@100', '', 'docs/modules/ROOT/pages/b.adoc'].join('\0')
 const s = site(names, { diff: ['a', 'b', 'c', 'changelog-details/one', 'changelog-details/two'], log, pending: ['b/index.html', 'gone/index.html'] })
 const r = pick(s)
 assert.deepEqual(r.pages, ['a/index.html', 'index/index.html', 'changelog-details/two/index.html', 'b/index.html', 'c/index.html'])
 assert.equal(r.carried, 1, 'pending pages that no longer exist are dropped')
 assert.deepEqual(r.groups['**/changelog-details/**'], { representative: 'changelog-details/two/index.html', covered: ['changelog-details/one/index.html'] })
 assert.ok(!r.pages.includes('changelog-details/one/index.html'))
 assert.deepEqual(r.contentPages, ['changelog-details/two/index.html', 'b/index.html', 'c/index.html'], 'representatives keep the full audit')
 assert.match(r.reasons['b/index.html'].join(' '), /carried over/)
 assert.deepEqual(pick(s, { sampling: { contentOnly: false } }).contentPages, [])
})

test('groups can be configured or turned off', () => {
 const names = ['index', 'x', 'notes/p', 'notes/q', 'changelog-details/one', 'changelog-details/two']
 const diff = ['notes/p', 'notes/q', 'changelog-details/one', 'changelog-details/two']
 const off = pick(site(names, { diff, groups: false }))
 assert.equal(off.covered, 0); assert.ok(off.pages.includes('changelog-details/one/index.html') && off.pages.includes('changelog-details/two/index.html'))
 const notes = pick(site(names, { diff, groups: ['notes/**'] }))
 assert.equal(notes.covered, 1); assert.ok(notes.pages.includes('changelog-details/one/index.html') && notes.pages.includes('changelog-details/two/index.html'))
})

test('carryOver saves pending pages plus the pages a pending group representative stood in for', () => {
 const { carryOver } = require('../lib/contrast-pages')
 const names = ['index', 'a', 'b', 'changelog-details/one', 'changelog-details/two']
 const r = pick(site(names, { diff: ['a', 'b', 'changelog-details/one', 'changelog-details/two'] }))
 const rep = r.groups['**/changelog-details/**'].representative
 const other = r.groups['**/changelog-details/**'].covered[0]
 assert.deepEqual(carryOver(r, [rep, 'b/index.html']), [rep, other, 'b/index.html'])
 assert.deepEqual(r.snapshot.pending, [rep, other, 'b/index.html'])
 assert.equal(r.snapshot.version, 3)
 assert.deepEqual(carryOver(r, []), [])
})

test('regression: a budget stop never drops pages; the next run audits the carried pages first', () => {
 const { carryOver } = require('../lib/contrast-pages')
 const names = ['index', ...Array.from({ length: 30 }, (_, i) => 'p' + String(i).padStart(2, '0'))]
 const first = pick(site(names, { diff: names.slice(1) }))
 assert.equal(first.pages.length, 31, 'two representatives plus every changed page')
 // The audit reached the representatives and five changed pages before the budget.
 const pending = first.pages.slice(7)
 carryOver(first, pending)
 // Next run: two new edits plus the saved pending list.
 const second = pick({ ...site(names, { diff: ['p00', 'p01'] }), previous: { ...first.snapshot, sources: { 'https://github.com/org/repo|docs|home|': 'base' } } })
 assert.deepEqual(second.pages.slice(2, 2 + pending.length), pending, 'carry-over comes right after the representatives')
 assert.ok(second.pages.includes('p00/index.html') && second.pages.includes('p01/index.html'))
})

test('a source added since the last green run needs no broad fallback; an unusable base falls back for that source only', () => {
 const origin = { gitdir: '/repo/.git', refhash: 'head', startPath: 'docs' }
 const added = { gitdir: '/added/.git', refhash: 'head', startPath: 'docs' }
 const mk = (n, o, c) => ({ ...page(n + '.html', 'article'), src: { origin: o, component: c, version: '', path: 'modules/ROOT/pages/' + n + '.adoc' } })
 const pages = [mk('a', origin, 'home'), mk('b', origin, 'home'), mk('n1', added, 'new'), mk('n2', added, 'new')]
 const git = (o, a) => a[0] === 'config' ? 'https://github.com/org/' + (o === added ? 'added' : 'repo') + '.git' : a[0] === 'rev-parse' ? 'hash' : a[0] === 'diff' ? '' : ''
 const previous = { version: 2, sources: { 'https://github.com/org/repo|docs|home|': 'base' }, pages: ['a.html', 'b.html'] }
 const r = selectContrastPages(pages, { maxPages: 20 }, __dirname, { git, previous })
 assert.equal(r.unknown, false); assert.deepEqual(r.unknownSources, [])
 assert.deepEqual(r.pages.slice().sort(), ['a.html', 'n1.html', 'n2.html'])
 const broken = selectContrastPages(pages, { maxPages: 1 }, __dirname, { git: (o, a) => o === origin && a[0] === 'rev-parse' ? null : git(o, a), previous: { ...previous, sources: { ...previous.sources, 'https://github.com/org/added|docs|new|': 'base' }, pages: previous.pages.concat(['n1.html', 'n2.html']) } })
 assert.equal(broken.unknown, true); assert.deepEqual(broken.unknownSources, ['https://github.com/org/repo|docs|home|'])
 assert.ok(broken.reasons['a.html'].some(x => /broad fallback/.test(x)))
 assert.ok(!broken.pages.includes('n1.html'), 'the healthy source contributes no fallback pages')
})
