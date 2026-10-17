'use strict'

const { DEFAULT_ASCIIDOC_EXTENSIONS, extensionId, isEnabledEntry } = require('./default-stack')

function stackListerPackages (stack) {
  const names = new Set()
  for (const entry of stack) {
    if (!isEnabledEntry(entry)) continue
    const id = extensionId(entry)
    if (id) names.add(id)
  }
  for (const id of DEFAULT_ASCIIDOC_EXTENSIONS) names.add(id)
  return [...names]
}

function injectExtensionListerPackages (stack, { listMembers = false } = {}) {
  if (!listMembers) return stack
  const packages = stackListerPackages(stack)
  return stack.map((entry) => {
    const id = extensionId(entry)
    if (id !== '@antora-supplemental/extension-lister') return entry
    const base = typeof entry === 'string' ? { require: entry, layouts: ['footer'] } : { ...entry }
    return { ...base, packages }
  })
}

module.exports = { injectExtensionListerPackages, stackListerPackages }
