'use strict'

const userRequire = require('@antora/user-require-helper')

const REGISTER_FUNCTION_WITH_NAMED_PARAMETER_RX = /^(?:(?:function(?: +register)? *|register *)?\( *\w+ *[,)]|\w+ *=>)/

/**
 * Register one Antora extension the same way @antora/site-generator does.
 *
 * @param {import('@antora/site-generator').GeneratorContext} context
 * @param {object|string} spec
 * @param {object} vars playbook + other generator vars
 * @param {string} playbookDir
 */
function registerChildExtension (context, spec, vars, playbookDir) {
  const entry = typeof spec === 'string' ? { require: spec } : { ...spec }
  const { enabled = true, require: request, ...config } = entry
  if (!enabled || !request) return

  const requireContext = {
    dot: playbookDir,
    paths: [playbookDir || '', context.module?.path || ''],
  }

  let register
  try {
    ;({ register } = userRequire(request, requireContext) || {})
    if (typeof register !== 'function') return
  } catch (e) {
    context.getLogger('@antora-supplemental/facto-stack').error?.(
      'Failed to load pack member %s: %s',
      request,
      e.message
    )
    throw e
  }

  const payload = Object.assign({ config }, vars)
  if (register.length) {
    const registerSource = register.toString().replace(/\r?\n/g, ' ')
    if (REGISTER_FUNCTION_WITH_NAMED_PARAMETER_RX.test(registerSource)) {
      register.length === 1 ? register.call(context, context) : register.call(context, context, payload)
    } else {
      register.call(context, payload)
    }
  } else {
    register.call(context, payload)
  }
}

module.exports = { registerChildExtension }
