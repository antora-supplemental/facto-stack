'use strict'

const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const { DEMO_ANTORA_EXTENSIONS, HUB_ANTORA_EXTENSIONS, extensionId } = require('../lib/default-stack')

function indexOfRequire (stack, id) {
  return stack.findIndex((entry) => extensionId(entry) === id)
}

function assertPipelineOrder (stack, label) {
  const zones = indexOfRequire(stack, '@antora-supplemental/article-zones')
  const edit = indexOfRequire(stack, '@antora-supplemental/page-edit')
  const link = indexOfRequire(stack, '@antora-supplemental/linkinator')
  assert.ok(zones >= 0, `${label}: article-zones registered`)
  assert.ok(edit >= 0, `${label}: page-edit registered`)
  assert.ok(link >= 0, `${label}: linkinator registered`)
  assert.ok(zones < edit, `${label}: article-zones before page-edit`)
  assert.ok(edit < link, `${label}: page-edit before linkinator`)
}

describe('default stack extension order', () => {
  it('registers article-zones → page-edit → linkinator on hub profile', () => {
    assertPipelineOrder(HUB_ANTORA_EXTENSIONS, 'hub')
  })

  it('registers article-zones → page-edit → linkinator on demo profile', () => {
    assertPipelineOrder(DEMO_ANTORA_EXTENSIONS, 'demo')
  })
})
