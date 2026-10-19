const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const entries = ['index.html', 'intro.html', 'direction.html', 'simulator.html', 'LUNA_TestTool.html',
  'bar-playtest/index.html', 'bar-playtest/resource-review.html', 'bar-playtest/story-guide.html', 'cutscene-studio/index.html'];
const contractFile = path.join(root, 'docs/architecture/runtime-contract.json');
const contract = {};
for (const file of entries) {
  const html = fs.readFileSync(path.join(root, file), 'utf8');
  for (const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)) {
    if (match[2].trim() && !/type=["']application\//.test(match[1]))
      new vm.Script(match[2], { filename: file + ':inline' });
  }
  contract[file] = [...html.matchAll(/<(script|link)\b[^>]*?\b(?:src|href)=["']([^"']+)["'][^>]*>/g)]
    .filter(m => /\.(js|css)(?:\?|$)/.test(m[2])).map(m => [m[1], m[2].split('?')[0]]);
}
if (process.argv.includes('--record-entrypoints')) {
  fs.writeFileSync(contractFile, JSON.stringify(contract, null, 2) + '\n');
  console.log('Recorded entry-point dependency order. Review the diff before accepting it.');
} else {
  assert.deepEqual(contract, JSON.parse(fs.readFileSync(contractFile, 'utf8')), 'Entry-point load order changed');
}
for (const directory of ['bar-playtest', 'cutscene-studio']) {
  const loose = fs.readdirSync(path.join(root, directory)).filter(name => /\.(js|css|cjs)$/.test(name));
  assert.deepEqual(loose, [], directory + ': keep source/styles/tests in their dedicated folders');
}
let checked = 0;
function walk(dir) {
  for (const entry of fs.readdirSync(path.join(root, dir), { withFileTypes: true })) {
    if (['.git', 'node_modules', 'artifacts', 'archives', 'docs'].includes(entry.name)) continue;
    const file = path.posix.join(dir, entry.name);
    if (entry.isDirectory()) walk(file);
    else if (/\.(js|cjs)$/.test(file)) {
      const source = fs.readFileSync(path.join(root, file), 'utf8');
      new vm.Script(source, { filename: file });
      for (const match of source.matchAll(/require\(['"](\.[^'"]+)['"]\)/g)) {
        require.resolve(path.resolve(root, path.dirname(file), match[1]));
      }
      checked++;
    }
  }
}
walk('');
console.log(`STRUCTURE_OK: ${entries.length} stable entry points, ${checked} valid scripts, clean application roots.`);
