const path = require('node:path')
const fs = require('node:fs')

// Find the actual server build file (has hash in filename)
const serverBuildDir = path.join(__dirname, 'build/server/assets')
const serverBuildFile = fs.readdirSync(serverBuildDir)
  .find(f => f.startsWith('server-build-') && f.endsWith('.js'))

module.exports = {
  apps: [{
    name: "react-router-app",
    script: 'react-router-serve',
    args: path.join(serverBuildDir, serverBuildFile),
    exec_mode: "cluster",
    instances: process.env.WORKERS || 2,
    env: {
      ...process.env
    }
  }]
}
