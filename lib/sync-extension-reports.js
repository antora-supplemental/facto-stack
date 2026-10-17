'use strict'

const fs = require('node:fs')
const ospath = require('node:path')

const REPORT_DIRS = ['extension-lister', 'link-validator']

function copyDir (src, dest) {
  if (!fs.existsSync(src)) return false
  fs.mkdirSync(dest, { recursive: true })
  for (const name of fs.readdirSync(src)) {
    const from = ospath.join(src, name)
    const to = ospath.join(dest, name)
    if (fs.statSync(from).isDirectory()) copyDir(from, to)
    else fs.copyFileSync(from, to)
  }
  return true
}

/**
 * Some extensions resolve output under playbook.dir; Antora may publish the site under cwd.
 * Copy known report folders into the published site dir when they diverge.
 *
 * @param {object} playbook
 */
function syncExtensionReports (playbook) {
  const relOut = (playbook.output && playbook.output.dir) || 'build/site'
  const fromBase = ospath.resolve(playbook.dir || process.cwd(), relOut)
  const toBase = ospath.resolve(process.cwd(), relOut)
  if (fromBase === toBase) return
  for (const dir of REPORT_DIRS) {
    copyDir(ospath.join(fromBase, dir), ospath.join(toBase, dir))
  }
}

module.exports = { copyDir, syncExtensionReports }
