'use strict'

const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const { applyPackConfig, mergeAsciiDocPlaybook, normalizePackConfig } = require('../lib/merge-config')
const { HUB_ANTORA_EXTENSIONS } = require('../lib/default-stack')

describe('applyPackConfig', () => {
  it('merges linkValidator overrides', () => {
    const out = applyPackConfig(HUB_ANTORA_EXTENSIONS, {
      linkValidator: { reportEmail: 'dlang@devcentr.org' },
    })
    const lv = out.find((e) => e.require === '@antora-supplemental/link-validator')
    assert.equal(lv.reportEmail, 'dlang@devcentr.org')
  })

  it('omits listed pack members', () => {
    const out = applyPackConfig(HUB_ANTORA_EXTENSIONS, {
      omit: ['@antora-supplemental/extension-lister'],
    })
    assert.ok(!out.some((e) => (typeof e === 'string' ? e : e.require) === '@antora-supplemental/extension-lister'))
  })

  it('enables site-nav-tree with filter default from siteNavTree pack config', () => {
    const out = applyPackConfig(HUB_ANTORA_EXTENSIONS, {
      siteNavTree: { enabled: true, include: ['home', 'docs'] },
    })
    const nav = out.find((e) => e.require === '@antora-supplemental/site-nav-tree')
    assert.equal(nav.enabled, true)
    assert.equal(nav.filter, true)
    assert.deepEqual(nav.include, ['home', 'docs'])
  })
})

describe('normalizePackConfig', () => {
  it('maps Antora-lowercased override keys', () => {
    const out = normalizePackConfig({
      sitenavtree: { enabled: true, include: ['home'] },
      linkvalidator: { reportEmail: 'a@b.c' },
    })
    assert.deepEqual(out.siteNavTree.include, ['home'])
    assert.equal(out.linkValidator.reportEmail, 'a@b.c')
  })
})

describe('mergeAsciiDocPlaybook', () => {
  it('adds default asciidoc extensions when missing', () => {
    const playbook = { asciidoc: { extensions: [], attributes: {} } }
    mergeAsciiDocPlaybook(playbook, { asciidocAttributes: { 'page-context-keyword-base': '/docs/keywords' } })
    assert.ok(playbook.asciidoc.extensions.includes('asciidoctor-kroki'))
    assert.equal(playbook.asciidoc.attributes['page-context-keyword-base'], '/docs/keywords')
  })
})
