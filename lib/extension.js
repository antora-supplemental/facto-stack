'use strict'

const { profileStack } = require('./default-stack')
const { applyPackConfig, mergeAsciiDocPlaybook } = require('./merge-config')
const { registerChildExtension } = require('./register-child')
const registryMeta = require('./registry-meta')

const PKG = '@antora-supplemental/facto-stack'

/**
 * Antora compose-pack extension.
 *
 * Playbook lists a single require; this module registers the Facto member
 * extensions programmatically so build-stack / extension-lister footers stay
 * depth-1 (pack name only, not every bundled package).
 *
 * Config:
 * - profile: 'hub' (default) | 'demo'
 * - omit: string[] pack member require ids to skip
 * - lunr, linkValidator, linkinator, orphanFinder, pageContextAntora, … per-member overrides
 * - asciidocAttributes: object merged into playbook.asciidoc.attributes
 * - skip: boolean
 */
function register (context, { config = {}, playbook } = {}) {
  if (config.skip) return
  if (!playbook) {
    context.getLogger(PKG).warn?.('facto-stack: playbook missing in generator vars; pack not applied')
    return
  }

  mergeAsciiDocPlaybook(playbook, config)

  const playbookDir = playbook.dir || process.cwd()
  const vars = { playbook }
  const stack = applyPackConfig(profileStack(config.profile === 'demo' ? 'demo' : 'hub'), config)

  const logger = context.getLogger(PKG)
  logger.info?.('Registering %s Antora extensions from %s', stack.length, PKG)

  for (const spec of stack) {
    registerChildExtension(context, spec, vars, playbookDir)
  }
}

module.exports = register
module.exports.register = register
module.exports.registryMeta = registryMeta
