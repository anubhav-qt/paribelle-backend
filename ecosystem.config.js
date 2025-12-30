module.exports = {
  apps: [
    {
      name: 'marketplace-backend',
      script: 'dist/src/main.js',
      cwd: __dirname,
      instances: 'max',
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
};
