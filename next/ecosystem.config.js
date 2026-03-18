const path = require('node:path')

module.exports = {
  apps: [{
    name: "nextjs-app",
    script: 'next',
    args: `start -p ${process.env.PORT} -H ${process.env.HOSTNAME}`,
    exec_mode: "cluster",
    instances: process.env.WORKERS || 2,
    env: {
      ...process.env
    }
  }]
}
