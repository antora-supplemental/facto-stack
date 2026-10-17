'use strict'

const { DEFAULT_ASCIIDOC_EXTENSIONS, profileStack } = require('./default-stack')
const { applyPackConfig, mergeAsciiDocPlaybook, normalizePackConfig } = require('./merge-config')
const { publishMemberFooter } = require('./publish-member-footer')
const { registerChildExtension } = require('./register-child')
const registryMeta = require('./registry-meta')
const { injectExtensionListerPackages } = require('./stack-lister-packages')
const { syncExtensionReports } = require('./sync-extension-reports')

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
 * - siteNavTree: { enabled: true, include, order, … } enables pack site-nav-tree (filter defaults on)
 * - lunr, linkValidator, linkinator, orphanFinder, pageContextAntora, … per-member overrides
 * - asciidocAttributes: object merged into playbook.asciidoc.attributes
 * - skip: boolean
 * - footerListMembers: boolean — demo profile default; publish pack members in build-stack footer keys
 */
function register (context, payload) {
  const { config = {}, playbook: playbookFromPayload } =
    payload && typeof payload === 'object' ? payload : {}
  const playbook =
    playbookFromPayload ||
    (typeof context.getVariables === 'function' ? context.getVariables().playbook : null)
  if (config.skip) return
  if (!playbook) {
    context.getLogger(PKG).warn?.('facto-stack: playbook missing in generator vars; pack not applied')
    return
  }

  const packConfig = normalizePackConfig(config)
  mergeAsciiDocPlaybook(playbook, packConfig)

  const playbookDir = playbook.dir || process.cwd()
  const vars = { playbook }
  const profile = packConfig.profile === 'demo' ? 'demo' : 'hub'
  const listMembers = packConfig.footerListMembers ?? profile === 'demo'
  let stack = applyPackConfig(profileStack(profile), packConfig)
  stack = injectExtensionListerPackages(stack, { listMembers })

  const logger = context.getLogger(PKG)
  logger.info?.('Registering %s Antora extensions from %s', stack.length, PKG)

  for (const spec of stack) {
    registerChildExtension(context, spec, vars, playbookDir)
  }

  if (listMembers) {
    context.on('playbookBuilt', ({ playbook: builtPlaybook }) => {
      publishMemberFooter(builtPlaybook, stack, {
        buildStack: packConfig.buildStack,
        asciidocExtensionIds: DEFAULT_ASCIIDOC_EXTENSIONS,
      })
    })
    context.on('sitePublished', ({ playbook: publishedPlaybook }) => {
      syncExtensionReports(publishedPlaybook || playbook)
    })
  }
}

module.exports = register
module.exports.register = register
module.exports.registryMeta = registryMeta
