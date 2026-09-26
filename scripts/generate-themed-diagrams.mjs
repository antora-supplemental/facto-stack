import { execFileSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, join, resolve } from 'node:path'

const imageDir = resolve('examples/docs/modules/ROOT/images/diagrams')
const config = resolve('examples/mermaid-config.json')
const check = process.argv.includes('--check')
const diagrams = [
  {
    name: 'facto-composition',
    title: 'facto-stack composition',
    description: 'Valentus, Lunr, Kroki, STEM, and page context compose the facto-stack documentation stack.',
  },
  {
    name: 'citation-round-trip',
    title: 'Citation round trip',
    description: 'Alice asks Bob to cite a source and Bob returns the resolved citation.',
  },
]
const tools = {
  mmdc: resolve('node_modules/@mermaid-js/mermaid-cli/src/cli.js'),
  adapter: resolve('node_modules/@dev-centr/mermaid-svg-css-vars/bin/mermaid-svg-css-vars.js'),
}
const temporary = mkdtempSync(join(tmpdir(), 'facto-stack-diagrams-'))

const palettes = {
  light: {
    'color.canvas': '#ffffff',
    'color.surface.primary': '#eef2ff',
    'color.surface.secondary': '#f8fafc',
    'color.text.primary': '#172033',
    'color.border.primary': '#5b6475',
    'color.edge': '#475569',
    'color.edge.label': '#334155',
    'color.accent.primary': '#4f46e5',
  },
  dark: {
    'color.canvas': '#111827',
    'color.surface.primary': '#273449',
    'color.surface.secondary': '#1f2937',
    'color.text.primary': '#f8fafc',
    'color.border.primary': '#a5b4c7',
    'color.edge': '#cbd5e1',
    'color.edge.label': '#e2e8f0',
    'color.accent.primary': '#a5b4fc',
  },
}

function manifestFor(name) {
  return {
    $schema: 'https://docs.devcentr.org/themed-svg/schemas/themed-svg-manifest-v1.schema.json',
    schemaVersion: 1,
    namespace: `antora-facto-${name}`,
    source: { kind: 'diagram-generator', uri: `${name}.mmd`, generator: 'mermaid' },
    tokens: Object.keys(palettes.light).map((id) => ({ id })),
    defaultPreset: 'light',
    presets: palettes,
    bindings: [
      { kind: 'presentation', selector: 'svg', attribute: 'color', token: 'color.text.primary' },
      { kind: 'presentation', selector: '.background', attribute: 'fill', token: 'color.canvas' },
      { kind: 'presentation', selector: '.node rect, .node polygon, .node circle, .node ellipse, .actor, .label-container, .entityBox', attribute: 'fill', token: 'color.surface.primary' },
      { kind: 'presentation', selector: '.cluster rect, .edgeLabel rect, .labelBkg', attribute: 'fill', token: 'color.surface.secondary' },
      { kind: 'presentation', selector: '.node rect, .node polygon, .node circle, .node ellipse, .actor, .entityBox', attribute: 'stroke', token: 'color.border.primary' },
      { kind: 'presentation', selector: '.flowchart-link, .messageLine0, .messageLine1, .relationshipLine', attribute: 'stroke', token: 'color.edge' },
      { kind: 'presentation', selector: '.nodeLabel, .cluster-label, .actor, .messageText, .labelText, .edgeLabel', attribute: 'fill', token: 'color.text.primary' },
      { kind: 'presentation', selector: '.edgeLabel', attribute: 'color', token: 'color.edge.label' },
    ],
    fallback: { unresolvedToken: 'error', missingTarget: 'warn' },
  }
}

function escapeXml(value) {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
}

function normalizeAccessibility(path, diagram) {
  let svg = readFileSync(path, 'utf8')
    .replace(/<title(?:\s[^>]*)?>[\s\S]*?<\/title>/i, '')
    .replace(/<desc(?:\s[^>]*)?>[\s\S]*?<\/desc>/i, '')
  svg = svg.replace(/<svg\b([^>]*)>/i, (whole, attributes) => {
    let normalized = attributes.replace(/\srole="[^"]*"/i, '').replace(/\saria-labelledby="[^"]*"/i, '')
    normalized += ` role="img" aria-labelledby="${diagram.name}-title ${diagram.name}-desc"`
    return `<svg${normalized}><title id="${diagram.name}-title">${escapeXml(diagram.title)}</title><desc id="${diagram.name}-desc">${escapeXml(diagram.description)}</desc>`
  })
  writeFileSync(path, svg, 'utf8')
}

function assertSafeSvg(path, mode) {
  const svg = readFileSync(path, 'utf8')
  const required = [
    /xmlns="http:\/\/www\.w3\.org\/2000\/svg"/,
    /\bviewBox="[^"]+"/,
    /\bpreserveAspectRatio="[^"]+"/,
    /\brole="img"/,
    /<title(?:\s[^>]*)?>[^<]+<\/title>/,
    /<desc(?:\s[^>]*)?>[^<]+<\/desc>/,
    /\baria-labelledby="[^"]+"/,
  ]
  if (required.some((pattern) => !pattern.test(svg))) throw new Error(`${basename(path)} fails the accessibility contract`)
  if (/<(?:script|foreignObject|iframe|object|embed|audio|video)\b/i.test(svg)) throw new Error(`${basename(path)} contains active content`)
  if (/\son[a-z]+\s*=/i.test(svg)) throw new Error(`${basename(path)} contains an event handler`)
  if (/\b(?:href|src)\s*=\s*["'](?:https?:|\/\/|data:)/i.test(svg)) throw new Error(`${basename(path)} contains an external resource`)
  if (mode === 'standalone-adaptive' && !/prefers-color-scheme:\s*dark/.test(svg)) throw new Error(`${basename(path)} lacks a dark preset`)
  if (mode === 'host' && !svg.includes('--themed-svg-')) throw new Error(`${basename(path)} lacks host variables`)
}

try {
  const mermaidConfig = JSON.parse(readFileSync(config, 'utf8'))
  if (mermaidConfig.htmlLabels !== false || mermaidConfig.flowchart?.htmlLabels !== false) {
    throw new Error('Mermaid global and flowchart htmlLabels must both be false')
  }

  for (const diagram of diagrams) {
    const source = join(imageDir, `${diagram.name}.mmd`)
    const manifestPath = join(imageDir, `${diagram.name}.theme.json`)
    const manifest = `${JSON.stringify(manifestFor(diagram.name), null, 2)}\n`
    if (check) {
      if (!existsSync(manifestPath) || readFileSync(manifestPath, 'utf8') !== manifest) throw new Error(`${basename(manifestPath)} is stale`)
    } else {
      writeFileSync(manifestPath, manifest, 'utf8')
    }

    const raw = join(temporary, `${diagram.name}.raw.svg`)
    const secondRaw = join(temporary, `${diagram.name}.second.raw.svg`)
    const renderArgs = ['-i', source, '-c', config, '-b', 'transparent']
    execFileSync(process.execPath, [tools.mmdc, ...renderArgs, '-o', raw], { stdio: 'inherit' })
    execFileSync(process.execPath, [tools.mmdc, ...renderArgs, '-o', secondRaw], { stdio: 'inherit' })
    normalizeAccessibility(raw, diagram)
    normalizeAccessibility(secondRaw, diagram)
    if (readFileSync(raw, 'utf8') !== readFileSync(secondRaw, 'utf8')) throw new Error(`${basename(source)} is not deterministic`)

    const adaptive = join(imageDir, `${diagram.name}.svg`)
    const host = join(imageDir, `${diagram.name}.host.svg`)
    execFileSync(process.execPath, [
      tools.adapter,
      '--manifest', manifestPath,
      '--dual-output',
      ...(check ? ['--check'] : []),
      raw,
      '--output', adaptive,
      '--host-output', host,
    ], { stdio: 'inherit' })
    assertSafeSvg(adaptive, 'standalone-adaptive')
    assertSafeSvg(host, 'host')
  }
} finally {
  rmSync(temporary, { recursive: true, force: true })
}
