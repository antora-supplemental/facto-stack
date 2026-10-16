'use strict'

const { OVERRIDE_KEY_BY_REQUIRE, extensionId } = require('./default-stack')

function mergeEntryOverrides (entry, packConfig) {
  const id = extensionId(entry)
  if (!id) return entry
  const key = OVERRIDE_KEY_BY_REQUIRE[id]
  const overrides = key && packConfig[key]
  if (!overrides || typeof overrides !== 'object') return entry
  if (typeof entry === 'string') return { require: entry, ...overrides }
  return { ...entry, ...overrides }
}

function applyPackConfig (stack, packConfig) {
  const omit = new Set(
    (Array.isArray(packConfig.omit) ? packConfig.omit : []).map(String).filter(Boolean)
  )
  return stack
    .map((entry) => mergeEntryOverrides(entry, packConfig))
    .filter((entry) => {
      const id = extensionId(entry)
      return id && !omit.has(id)
    })
}

function mergeAsciiDocPlaybook (playbook, packConfig) {
  const { DEFAULT_ASCIIDOC_ATTRIBUTES, DEFAULT_ASCIIDOC_EXTENSIONS } = require('./default-stack')
  playbook.asciidoc = playbook.asciidoc || {}
  const attrs = { ...DEFAULT_ASCIIDOC_ATTRIBUTES, ...(packConfig.asciidocAttributes || {}) }
  playbook.asciidoc.attributes = { ...attrs, ...(playbook.asciidoc.attributes || {}) }

  const existing = playbook.asciidoc.extensions || []
  const have = new Set(
    existing.map((e) => (typeof e === 'string' ? e : e.require)).filter(Boolean)
  )
  const add = DEFAULT_ASCIIDOC_EXTENSIONS.filter((id) => !have.has(id))
  if (add.length) playbook.asciidoc.extensions = existing.concat(add)
}

module.exports = { applyPackConfig, mergeAsciiDocPlaybook, mergeEntryOverrides }
