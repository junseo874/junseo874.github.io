// Read-only source navigation. Never scan generated tables, inline art, archives or history.
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../..');
const features = require('../../docs/architecture/feature-map.json');
const normalize = value => value.normalize('NFKC').toLowerCase();
function walk(relative) {
  const target = path.join(root, relative);
  if (!fs.statSync(target).isDirectory()) return [relative];
  return fs.readdirSync(target, { withFileTypes: true }).flatMap(entry =>
    entry.isDirectory() ? walk(relative + '/' + entry.name) : [relative + '/' + entry.name]);
}
function outline(text) {
  const symbols = [];
  text.split('\n').forEach((line, index) => {
    const declaration = line.match(/^\s*(?:async\s+)?(?:function|class)\s+([\w$]+)/);
    const method = line.match(/^ {2,4}(?:(?:async|get|set)\s+)?([\w$]+)\s*\(/);
    const name = declaration?.[1] || method?.[1];
    if (name && !['if','for','while','switch','catch','return','constructor'].includes(name)) symbols.push({name, line:index+1});
  });
  return symbols;
}
function find(query, symbols = false) {
  const q = normalize(query);
  const feature = Object.entries(features).find(([key, value]) => [key, ...value.aliases].some(a => normalize(a) === q));
  const roots = feature ? feature[1].paths : ['bar-playtest/src', 'cutscene-studio/src', 'js'];
  const files = [...new Set(roots.flatMap(walk))].filter(f => /\.(?:js|css|cjs|md)$/.test(f)).sort();
  const rows = [];
  for (const file of files) {
    const pathMatch = !!feature || normalize(file).includes(q);
    if (!pathMatch && !/\.(?:js|cjs)$/.test(file)) continue;
    const text = fs.readFileSync(path.join(root,file),'utf8');
    const all = (symbols || !pathMatch) ? outline(text) : [];
    const matches = pathMatch ? all : all.filter(s => normalize(s.name).includes(q));
    if (pathMatch || matches.length) rows.push({file, lines:text.split('\n').length, symbols:matches});
  }
  return {feature:feature?.[0] || null, info:feature?.[1] || null, files:rows};
}
module.exports = {root, features, outline, find};
