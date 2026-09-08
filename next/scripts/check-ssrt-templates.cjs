'use strict'

/**
 * Verifies that the given components compile into SSR templates without
 * bailouts. It runs the same Babel + compiler plugin pipeline as the ssrt-next
 * Turbopack loader (flight mode) with bailout diagnostics enabled, which the
 * loader itself does not expose. Used by the Dockerfile for the SSRT arm so a
 * page that silently falls back to plain rendering fails the image build.
 */
const fs = require('node:fs')
const path = require('node:path')

const babel = require('next/dist/compiled/babel/core')
const packages = require('next/dist/compiled/babel-packages')
const compilerPlugin = require.resolve('@platformatic/ssrt-babel-plugin-react-compiler')

const files = process.argv.slice(2)

if (files.length === 0) {
  console.error('usage: node scripts/check-ssrt-templates.cjs <component-file>...')
  process.exit(2)
}

let failed = false

for (const file of files) {
  const summaries = []
  const errors = []

  babel.transformSync(fs.readFileSync(file, 'utf8'), {
    filename: path.resolve(file),
    babelrc: false,
    configFile: false,
    compact: false,
    presets: [
      [packages.presetReact(), { runtime: 'automatic' }],
      [packages.presetTypescript(), { allowNamespaces: true }]
    ],
    plugins: [
      [
        compilerPlugin,
        {
          outputMode: 'ssr',
          // Errors are collected through the logger instead of panicking so
          // the report lists every problem in the file at once.
          panicThreshold: 'none',
          environment: {
            enableFlightJsxTemplateCompilation: true,
            enableJsxTemplateBailoutDiagnostics: true
          },
          logger: {
            logEvent (_filename, event) {
              if (event.kind === 'JsxTemplateSummary') {
                summaries.push(event)
              } else if (event.kind === 'CompileError') {
                errors.push(event)
              }
            }
          }
        }
      ]
    ]
  })

  const templated = summaries.reduce((sum, s) => sum + s.templatedElements, 0)
  const bailed = summaries.reduce((sum, s) => sum + s.bailedElements, 0)
  const status = errors.length > 0 || summaries.length === 0 || bailed > 0 ? 'FAIL' : 'OK'

  console.log(`${status} ${file}: functions=${summaries.length} templated=${templated} bailed=${bailed} errors=${errors.length}`)

  for (const s of summaries) {
    if (s.bailedElements > 0) {
      console.log(`  bailout in ${s.fnName || '<anonymous>'} at line ${s.fnLoc.start.line}: ${s.bailedElements} element(s)`)
    }
  }

  for (const e of errors) {
    console.log(`  compile error: ${e.detail?.reason || e.detail?.description || JSON.stringify(e.detail)}`)
  }

  if (status === 'FAIL') {
    failed = true
  }
}

process.exit(failed ? 1 : 0)
