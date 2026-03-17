module.exports = {
  apps: [
    {
      name: 'gift-guide',
      script: 'server/index.js',
      cwd: '/opt/gift-guide',
      instances: 1,
      autorestart: true,
      watch: false,
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
};
