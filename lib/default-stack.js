'use strict'

/** Default Antora extensions registered when the compose pack loads (hub / fragment profile). */
const HUB_ANTORA_EXTENSIONS = [
  '@antora-supplemental/incremental',
  '@antora/lunr-extension',
  { require: '@antora-supplemental/antora-search-chat', placement: 'dock' },
  '@antora-supplemental/chassis-compose',
  // Valentus 4: light/dark mode, the toggle slots and the --cs-* color-scheme contract live in the chassis.
  { require: '@antora-supplemental/light-dark-mode', toggle: 'placed' },
  { require: '@antora-supplemental/unversioned-component-urls', mode: 'selector' },
  // Multi-component hubs: pack `siteNavTree: { enabled: true, include: [...] }` (filter defaults on).
  { require: '@antora-supplemental/site-nav-tree', filter: true, enabled: false },
  { require: '@antora-supplemental/nav-typology' },
  { require: '@antora-supplemental/nav-typology-diataxis' },
  '@antora-supplemental/build-stack',
  '@antora-supplemental/article-zones',
  '@antora-supplemental/page-edit',
  // Links to the org's other docs sites. Hidden until configured: pack `relatedDocs: { sites: [...] }`,
  // or `relatedDocs: { sites: none }` to state there are none (silences the info hint).
  { require: '@antora-supplemental/related-docs' },
  // Named link registry: warns on literal uses of registered {url-...} links and writes
  // _/link-registry/index.json (outbound URLs -> pages). Pack `linkRegistry: { registry: ./docs/link-registry.adoc }`.
  { require: '@antora-supplemental/link-registry' },
  // Glossary: term pages under glossary/, letter index, whole-word highlights, glossary.json export.
  // Import other sites' terms with pack `glossary: { imports: [https://docs.example.org/glossary.json] }`.
  { require: '@antora-supplemental/glossary' },
  {
    require: '@antora-supplemental/link-validator',
    reportEmail: 'support@devcentr.org',
    softFail403: true,
    failLevel: 'none',
  },
  { require: '@antora-supplemental/linkinator', statusDefault: 'unchecked' },
  { require: '@antora-supplemental/soft-nav-page-toc' },
  { require: '@antora-supplemental/extension-lister', layouts: ['footer'] },
  {
    require: '@antora-supplemental/orphan-finder/extension',
    reportEmail: 'support@devcentr.org',
    failOnUnresolved: false,
  },
  { require: '@antora-supplemental/page-context/antora', component: 'home', path: 'keywords' },
  // Optional diagram chrome for hubs that ship Mermaid / lightbox via supplemental-ui partials.
  // Enable with pack config: `mermaidClient: { enabled: true }`, `diagramLightbox: { enabled: true }`.
  { require: '@antora-supplemental/mermaid-client/antora', enabled: false },
  { require: '@antora-supplemental/diagram-lightbox', enabled: false },
]

/** Demo site: client Mermaid + lightbox instead of nav typology forest extras. */
const DEMO_ANTORA_EXTENSIONS = [
  '@antora-supplemental/incremental',
  '@antora/lunr-extension',
  { require: '@antora-supplemental/antora-search-chat', placement: 'dock' },
  '@antora-supplemental/chassis-compose',
  // Valentus 4: light/dark mode, the toggle slots and the --cs-* color-scheme contract live in the chassis.
  { require: '@antora-supplemental/light-dark-mode', toggle: 'placed' },
  { require: '@antora-supplemental/unversioned-component-urls', mode: 'selector' },
  { require: '@antora-supplemental/site-nav-tree', filter: true },
  { require: '@antora-supplemental/mermaid-client/antora', injectAssets: true },
  { require: '@antora-supplemental/diagram-lightbox', injectAssets: true },
  '@antora-supplemental/article-zones',
  '@antora-supplemental/page-edit',
  // Links to the org's other docs sites. Hidden until configured: pack `relatedDocs: { sites: [...] }`,
  // or `relatedDocs: { sites: none }` to state there are none (silences the info hint).
  { require: '@antora-supplemental/related-docs' },
  // Named link registry: warns on literal uses of registered {url-...} links and writes
  // _/link-registry/index.json (outbound URLs -> pages). Pack `linkRegistry: { registry: ./docs/link-registry.adoc }`.
  { require: '@antora-supplemental/link-registry' },
  // Glossary: term pages under glossary/, letter index, whole-word highlights, glossary.json export.
  // Import other sites' terms with pack `glossary: { imports: [https://docs.example.org/glossary.json] }`.
  { require: '@antora-supplemental/glossary' },
  '@antora-supplemental/build-stack',
  {
    require: '@antora-supplemental/link-validator',
    reportEmail: 'support@devcentr.org',
    softFail403: true,
    failLevel: 'none',
  },
  { require: '@antora-supplemental/linkinator', statusDefault: 'unchecked' },
  { require: '@antora-supplemental/soft-nav-page-toc' },
  { require: '@antora-supplemental/extension-lister', layouts: ['footer'] },
  {
    require: '@antora-supplemental/orphan-finder/extension',
    reportEmail: 'support@devcentr.org',
    failOnUnresolved: false,
  },
  { require: '@antora-supplemental/page-context/antora', component: 'home', path: 'keywords' },
]

const DEFAULT_ASCIIDOC_EXTENSIONS = [
  '@antora-supplemental/asciidoctor-emoji-literals',
  'asciidoctor-emoji',
  'asciidoctor-kroki',
  '@antora-supplemental/page-context',
]

const DEFAULT_ASCIIDOC_ATTRIBUTES = {
  stem: 'latexmath',
  'kroki-server-url': 'https://kroki.io',
  'kroki-fetch-diagram': true,
  'page-context-active': '',
  'page-context-keyword-base': '/home/keywords',
}

/** Map playbook pack config keys → extension require id for deep-merge overrides. */
const OVERRIDE_KEY_BY_REQUIRE = {
  '@antora-supplemental/incremental': 'incremental',
  '@antora/lunr-extension': 'lunr',
  '@antora-supplemental/antora-search-chat': 'searchChat',
  '@antora-supplemental/chassis-compose': 'softNavContext',
  '@antora-supplemental/light-dark-mode': 'lightDarkMode',
  '@antora-supplemental/unversioned-component-urls': 'unversionedComponentUrls',
  '@antora-supplemental/site-nav-tree': 'siteNavTree',
  '@antora-supplemental/nav-typology': 'navTypology',
  '@antora-supplemental/nav-typology-diataxis': 'navTypologyDiataxis',
  '@antora-supplemental/build-stack': 'buildStack',
  '@antora-supplemental/article-zones': 'articleZones',
  '@antora-supplemental/page-edit': 'pageEdit',
  '@antora-supplemental/related-docs': 'relatedDocs',
  '@antora-supplemental/link-registry': 'linkRegistry',
  '@antora-supplemental/glossary': 'glossary',
  '@antora-supplemental/link-validator': 'linkValidator',
  '@antora-supplemental/linkinator': 'linkinator',
  '@antora-supplemental/soft-nav-page-toc': 'softNavPageToc',
  '@antora-supplemental/extension-lister': 'extensionLister',
  '@antora-supplemental/orphan-finder/extension': 'orphanFinder',
  '@antora-supplemental/page-context/antora': 'pageContextAntora',
  '@antora-supplemental/mermaid-client/antora': 'mermaidClient',
  '@antora-supplemental/diagram-lightbox': 'diagramLightbox',
}

function extensionId (entry) {
  if (typeof entry === 'string') return entry
  if (entry && typeof entry.require === 'string') return entry.require
  return null
}

/** Pack member is registered (not disabled via `enabled: false`). */
function isEnabledEntry (entry) {
  return !(entry && typeof entry === 'object' && entry.enabled === false)
}

function profileStack (profile) {
  if (profile === 'demo') return DEMO_ANTORA_EXTENSIONS
  return HUB_ANTORA_EXTENSIONS
}

module.exports = {
  DEFAULT_ASCIIDOC_ATTRIBUTES,
  DEFAULT_ASCIIDOC_EXTENSIONS,
  DEMO_ANTORA_EXTENSIONS,
  HUB_ANTORA_EXTENSIONS,
  OVERRIDE_KEY_BY_REQUIRE,
  extensionId,
  isEnabledEntry,
  profileStack,
}
