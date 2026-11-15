const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const suites = require('./lib/regression-suites.cjs');
const choice = process.argv[2] || 'smoke';
if (choice === '--list') {
  for (const [name, files] of Object.entries(suites)) console.log(name + '\n  ' + files.join('\n  '));
  process.exit();
}
const files = (choice === 'all' ? [...new Set(Object.values(suites).flat())] : Object.hasOwn(suites, choice) && suites[choice]) || (fs.existsSync(path.resolve(root, choice)) ? [choice] : null);
if (!files) throw Error('Unknown suite. Use node tools/run-tests.cjs --list');
const results = [];
(async () => {
  for (const file of files) {
    const start = Date.now();
    console.log('\nRUN ' + file);
    const result = await new Promise(resolve => {
      const child = spawn(process.execPath, [file], { cwd: root, env: process.env, stdio: 'inherit' });
      let timedOut = false;
      const timeout = setTimeout(() => { timedOut = true; child.kill('SIGTERM'); }, 300000);
      child.on('error', error => { clearTimeout(timeout); resolve({ code: 1, error: error.message }); });
      child.on('exit', (code, signal) => { clearTimeout(timeout); resolve({ code, signal, timedOut }); });
    });
    results.push({ file, ...result, seconds: Math.round((Date.now() - start) / 1000) });
  }
  console.log('\n' + JSON.stringify(results, null, 2));
  process.exitCode = results.some(r => r.code !== 0) ? 1 : 0;
})();
