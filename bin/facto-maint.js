#!/usr/bin/env node
'use strict'

/**
 * Run a maint CLI that facto-stack already depends on, so hub repos do not
 * re-pin each tool in their own package.json just to get a `.bin` shim.
 *
 *   facto-maint orphan-finder --root ./docs --out ./build/orphan-finder
 *   facto-maint nav-drift --root ./docs --require-in-nav
 */
const { spawnSync } = require('node:child_process')
const path = require('node:path')

const TOOLS = {
  'deep-link-contracts': '@antora-supplemental/deep-link-contracts',
  'nav-drift': '@antora-supplemental/nav-drift',
  'orphan-finder': '@antora-supplemental/orphan-finder',
  'playbook-pin-auditor': '@antora-supplemental/playbook-pin-auditor',
  'stale-page': '@antora-supplemental/stale-page',
}

function resolveBin (tool) {
  const pkgName = TOOLS[tool]
  const pkgJsonPath = require.resolve(`${pkgName}/package.json`)
  const pkg = require(pkgJsonPath)
  const bin = typeof pkg.bin === 'string' ? pkg.bin : pkg.bin && pkg.bin[tool]
  if (!bin) throw new Error(`${pkgName} does not declare a "${tool}" bin`)
  return path.join(path.dirname(pkgJsonPath), bin)
}

function main (argv) {
  const [tool, ...args] = argv
  if (!tool || tool === '--help' || tool === '-h' || !TOOLS[tool]) {
    const out = tool && !TOOLS[tool] && !tool.startsWith('-') ? console.error : console.log
    out(`Usage: facto-maint <tool> [args...]\nTools: ${Object.keys(TOOLS).join(', ')}`)
    return tool && !TOOLS[tool] && !tool.startsWith('-') ? 2 : 0
  }
  const result = spawnSync(process.execPath, [resolveBin(tool), ...args], { stdio: 'inherit' })
  return result.status == null ? 1 : result.status
}

if (require.main === module) process.exit(main(process.argv.slice(2)))

module.exports = { TOOLS, main, resolveBin }
