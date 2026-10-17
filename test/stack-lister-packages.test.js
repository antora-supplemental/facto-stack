'use strict'

const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const { DEMO_ANTORA_EXTENSIONS } = require('../lib/default-stack')
const { injectExtensionListerPackages, stackListerPackages } = require('../lib/stack-lister-packages')

describe('stackListerPackages', () => {
  it('includes demo Antora members and default AsciiDoc extensions', () => {
    const names = stackListerPackages(DEMO_ANTORA_EXTENSIONS)
    assert.ok(names.includes('@antora/lunr-extension'))
    assert.ok(names.includes('@antora-supplemental/site-nav-tree'))
    assert.ok(names.includes('@antora-supplemental/page-edit'))
    assert.ok(names.includes('asciidoctor-kroki'))
    assert.ok(!names.includes('@antora-supplemental/facto-stack'))
  })
})

describe('injectExtensionListerPackages', () => {
  it('passes packages to extension-lister when listMembers is true', () => {
    const out = injectExtensionListerPackages(DEMO_ANTORA_EXTENSIONS, { listMembers: true })
    const lister = out.find((e) => e.require === '@antora-supplemental/extension-lister')
    assert.ok(Array.isArray(lister.packages))
    assert.ok(lister.packages.length > 2)
  })

  it('leaves stack unchanged when listMembers is false', () => {
    const out = injectExtensionListerPackages(DEMO_ANTORA_EXTENSIONS, { listMembers: false })
    const lister = out.find((e) => e.require === '@antora-supplemental/extension-lister')
    assert.equal(lister.packages, undefined)
  })
})
