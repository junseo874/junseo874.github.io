// One place for local QA dependencies; game pages never load this module.
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');

function load(name) {
  const override = process.env[name.toUpperCase().replaceAll('-', '_') + '_MODULE'];
  if (override) return require(override);
  try { return require(name); } catch (error) {
    if (error.code !== 'MODULE_NOT_FOUND') throw error;
  }
  const bundled = path.join(os.homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules', name);
  if (fs.existsSync(bundled)) return require(bundled);
  throw new Error(`Missing test dependency: ${name}. Install it locally or set ${name.toUpperCase()}_MODULE.`);
}

const chrome = process.env.CHROME_PATH ||
  (process.platform === 'darwin' && fs.existsSync('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome')
    ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' : undefined);

module.exports = { load, chrome };
