'use strict'

const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const { TOOLS, resolveBin } = require('../bin/facto-maint')

describe('facto-maint', () => {
  it('resolves every maint tool from pack dependencies', () => {
    for (const tool of Object.keys(TOOLS)) {
      assert.ok(fs.existsSync(resolveBin(tool)), `${tool} bin exists`)
    }
  })
})
