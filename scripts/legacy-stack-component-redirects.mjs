/**
 * After Antora build: stub /stack/* HTML that redirects to /home/* (same relative path).
 * Demo formerly used component `stack` at …/facto-stack/stack/…; pages merged into `home`.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const siteDir = path.resolve(__dirname, '..', 'build', 'site')
const homeDir = path.join(siteDir, 'home')
const legacyDir = path.join(siteDir, 'stack')

function redirectPage (targetHref) {
  const esc = targetHref.replace(/"/g, '&quot;')
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta http-equiv="refresh" content="0;url=${esc}">
<link rel="canonical" href="${esc}">
<title>Moved</title>
<script>location.replace(${JSON.stringify(targetHref)})</script>
</head>
<body><p>Moved to <a href="${esc}">${esc}</a>.</p></body>
</html>
`
}

function walkHtml (dir, base, out) {
  if (!fs.existsSync(dir)) return
  for (const name of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, name.name)
    if (name.isDirectory()) {
      walkHtml(full, base, out)
    } else if (name.name.endsWith('.html')) {
      out.push(path.relative(base, full))
    }
  }
}

if (!fs.existsSync(homeDir)) {
  console.warn('legacy-stack-component-redirects: no build/site/home; skipping')
  process.exit(0)
}

const pages = []
walkHtml(homeDir, homeDir, pages)

for (const rel of pages) {
  const homeFile = path.join(homeDir, rel)
  const legacyFile = path.join(legacyDir, rel)
  const relTarget = path.relative(path.dirname(legacyFile), homeFile).split(path.sep).join('/')
  fs.mkdirSync(path.dirname(legacyFile), { recursive: true })
  fs.writeFileSync(legacyFile, redirectPage(relTarget), 'utf8')
}

console.log(`legacy-stack-component-redirects: ${pages.length} stub(s) under build/site/stack/`)
