const { defineConfig } = require('vitest/config');

module.exports = defineConfig({
  test: {
    clearMocks: true,
    environment: 'node',
    globals: true
  }
});
