'use strict'

const { extensionId, isEnabledEntry } = require('./default-stack')

/** Subset of @antora-supplemental/build-stack homes (build-stack does not export lib/ paths). */
const DEFAULT_PACKAGE_HOME = {
  '@antora/lunr-extension': 'https://gitlab.com/antora/antora-lunr-extension',
  '@antora-supplemental/antora-search-chat': 'https://github.com/antora-supplemental/antora-search-chat',
  '@antora-supplemental/incremental': 'https://github.com/antora-supplemental/antora-incremental',
  '@antora-supplemental/build-stack': 'https://github.com/antora-supplemental/build-stack',
  '@antora-supplemental/diagram-lightbox': 'https://github.com/antora-supplemental/antora-diagram-engines',
  '@antora-supplemental/extension-lister': 'https://github.com/antora-supplemental/extension-lister',
  '@antora-supplemental/link-validator': 'https://github.com/antora-supplemental/link-validator',
  '@antora-supplemental/linkinator': 'https://github.com/antora-supplemental/linkinator',
  '@antora-supplemental/mermaid-client': 'https://github.com/antora-supplemental/antora-diagram-engines',
  '@antora-supplemental/orphan-finder': 'https://github.com/antora-supplemental/orphan-finder',
  '@antora-supplemental/page-context': 'https://github.com/antora-supplemental/page-context',
  '@antora-supplemental/soft-nav-page-toc': 'https://github.com/antora-supplemental/soft-nav-page-toc',
  '@antora-supplemental/chassis-compose':
    'https://github.com/antora-supplemental/antora-ui-chassis/tree/main/packages/chassis-compose',
  '@antora-supplemental/site-nav-tree': 'https://github.com/antora-supplemental/site-nav-tree',
  '@antora-supplemental/unversioned-component-urls':
    'https://github.com/antora-supplemental/antora-unversioned-component-urls',
  '@antora-supplemental/asciidoctor-emoji-literals':
    'https://github.com/antora-supplemental/asciidoctor-emoji-literals',
  'asciidoctor-kroki': 'https://github.com/Mogztter/asciidoctor-kroki',
  'asciidoctor-emoji': 'https://github.com/asciidoctor/asciidoctor-emoji',
}

function mergeMaps (base, extra) {
  if (!extra || typeof extra !== 'object') return { ...base }
  return { ...base, ...extra }
}

function displayName (id) {
  if (id.startsWith('@antora-supplemental/')) return id.slice('@antora-supplemental/'.length)
  if (id.startsWith('@antora/')) return id.slice('@antora/'.length)
  return id
}

function packageHome (id, homeMap) {
  if (homeMap[id]) return homeMap[id]
  if (id.startsWith('@')) return `https://www.npmjs.com/package/${encodeURIComponent(id)}`
  return `https://www.npmjs.com/search?q=${encodeURIComponent(id)}`
}

function linksHtml (ids, homeMap) {
  return ids
    .map((id) => {
      const label = displayName(id)
      const href = packageHome(id, homeMap)
      return `<a href="${href}" target="_blank" rel="noopener">${label}</a>`
    })
    .join(' · ')
}

/**
 * After build-stack runs (playbook depth-1 only), publish member extension links for demo footers.
 *
 * @param {object} playbook
 * @param {Array<object|string>} stack resolved pack member specs
 * @param {object} [packConfig]
 */
function publishMemberFooter (playbook, stack, packConfig = {}) {
  const keys = playbook.site.keys || (playbook.site.keys = {})
  const homeMap = mergeMaps(DEFAULT_PACKAGE_HOME, packConfig.buildStack?.package_home)
  const antoraIds = stack.filter(isEnabledEntry).map(extensionId).filter(Boolean)
  if (antoraIds.length) keys.build_stack_antora_html = linksHtml(antoraIds, homeMap)
  if (Array.isArray(packConfig.asciidocExtensionIds) && packConfig.asciidocExtensionIds.length) {
    keys.build_stack_asciidoc_html = linksHtml(packConfig.asciidocExtensionIds, homeMap)
  }
}

module.exports = { publishMemberFooter, linksHtml, DEFAULT_PACKAGE_HOME }
