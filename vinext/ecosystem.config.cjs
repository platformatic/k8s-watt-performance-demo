module.exports = {
  apps: [{
    name: "vinext-app",
    script: 'vinext',
    args: `start -p ${process.env.PORT} -H ${process.env.HOSTNAME}`,
    exec_mode: "cluster",
    instances: process.env.WORKERS || 2,
    env: {
      ...process.env,
      DATA_DIR: process.env.DATA_DIR || '../next/data'
    }
  }]
}
