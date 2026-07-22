/*
 * ChatGPT Desktop Wrapper
 * Developer: Stephan Coertzen <coertzen.jfs@gmail.com>
 * License: MIT
 */
const { startApp, ...exportsForTests } = require('./src/main/app');

if (require.main === module) {
  startApp();
}

module.exports = {
  ...exportsForTests,
  startApp
};
