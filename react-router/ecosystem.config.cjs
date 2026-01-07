const path = require('node:path')
const fs = require('node:fs')

module.exports = {
  apps: [{
    name: "react-router-app",
    script: './server.js',
    exec_mode: "cluster",
    instances: process.env.WORKERS || 2,
    env: {
      ...process.env
    }
  }]
}
