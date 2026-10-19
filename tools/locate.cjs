// Small, focused source index; intentionally excludes generated data and artwork.
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const query = (process.argv[2] || '').toLowerCase();
const roots = ['bar-playtest/src', 'cutscene-studio/src', 'js'];
function walk(dir) {
  return fs.readdirSync(path.join(root, dir), { withFileTypes: true }).flatMap(entry =>
    entry.isDirectory() ? walk(dir + '/' + entry.name) : [dir + '/' + entry.name]);
}
const files = roots.flatMap(walk).filter(file => /\.(js|css)$/.test(file) && file.toLowerCase().includes(query));
if (!query) {
  console.log('Usage: node tools/locate.cjs <outside|crafting|settings|audio|campaign|...>');
  console.log('Feature map: docs/architecture/README.md');
} else {
  for (const file of files) {
    const lines = fs.readFileSync(path.join(root, file), 'utf8').split('\n');
    console.log(`${file} (${lines.length} lines)`);
    if (files.length <= 3 && file.endsWith('.js')) {
      lines.forEach((line, i) => {
        const match = line.match(/^\s*(?:async\s+)?(?:function|class)\s+([\w$]+)/);
        if (match) console.log(`  ${i + 1}: ${match[1]}`);
      });
    }
  }
}
