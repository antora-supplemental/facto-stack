'use strict'

const { OVERRIDE_KEY_BY_REQUIRE, extensionId } = require('./default-stack')

/** Antora lowercases extension config keys (`siteNavTree` → `sitenavtree`). */
function normalizePackConfig (packConfig = {}) {
  const out = { ...packConfig }
  for (const key of Object.values(OVERRIDE_KEY_BY_REQUIRE)) {
    const lower = key.toLowerCase()
    if (out[lower] != null && out[key] == null) out[key] = out[lower]
  }
  if (packConfig.asciidocattributes && !out.asciidocAttributes) {
    out.asciidocAttributes = packConfig.asciidocattributes
  }
  if (packConfig.footerlistmembers != null && out.footerListMembers == null) {
    out.footerListMembers = packConfig.footerlistmembers
  }
  if (packConfig.localcontentsources != null && out.localContentSources == null) {
    out.localContentSources = packConfig.localcontentsources
  }
  return out
}

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
  const normalized = normalizePackConfig(packConfig)
  const omit = new Set(
    (Array.isArray(normalized.omit) ? normalized.omit : []).map(String).filter(Boolean)
  )
  return stack
    .map((entry) => mergeEntryOverrides(entry, normalized))
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

module.exports = {
  applyPackConfig,
  mergeAsciiDocPlaybook,
  mergeEntryOverrides,
  normalizePackConfig,
}
