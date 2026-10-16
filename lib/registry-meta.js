'use strict'

/** Self-register metadata for extension-lister / antora-supplemental registry. */
module.exports = {
  name: 'Facto stack',
  packageName: '@antora-supplemental/facto-stack',
  purpose: 'compose-pack',
  layer: 'chassis',
  chassis: 'chassis',
  pipeline: true,
  asciidoctor: true,
  lifecycleHooks: ['playbookBuilt'],
  processorSubtypes: [],
  informalName: 'Facto stack',
  description:
    'Compose pack: registers the standard Facto Antora + AsciiDoc extension set from one playbook require',
}
