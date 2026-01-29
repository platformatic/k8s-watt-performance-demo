module.exports = {
  apps: [{
    name: "tanstack-app",
    script: '.output/server/index.mjs',
    exec_mode: "cluster",
    instances: process.env.WORKERS || 2,
    env: {
      NODE_ENV: "production",
      ...process.env
    }
  }]
}
