const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const C = require('../bar-playtest/src/core/core.js');
const game = ['features/story/story-flow', 'features/bar/guest-service', 'features/crafting/preparation-flow', 'features/crafting/craft-flow', 'features/bar/settlement'];
const campaign = ['features/campaign/cinema-flow', 'features/campaign/day-flow'];
function verify(parts, prototype) {
  const seen = new Set();
  for (const file of parts) {
    const factory = require('../bar-playtest/src/' + file + '.js');
    const methods = Object.getOwnPropertyDescriptors(factory({}).prototype);
    for (const [name, descriptor] of Object.entries(methods)) {
      if (name === 'constructor') continue;
      assert(!seen.has(name), 'Duplicate method: ' + name); seen.add(name);
      const actual = Object.getOwnPropertyDescriptor(prototype, name);
      assert(actual, file + ': missing installed method ' + name);
      for (const flag of ['writable','enumerable','configurable']) assert.equal(actual[flag],descriptor[flag],name);
      for (const kind of ['value','get','set']) assert.equal(actual[kind]?.toString(),descriptor[kind]?.toString(),name);
    }
  }
  return seen.size;
}
const W = {addEventListener(){}};
for (const file of campaign) vm.runInNewContext(fs.readFileSync(root+'/bar-playtest/src/'+file+'.js','utf8'),{window:W});
const main=fs.readFileSync(root+'/bar-playtest/src/features/campaign/campaign.js','utf8');
vm.runInNewContext(main.replace('create: a => new Campaign(a)','prototype: Campaign.prototype'),{window:W,document:{addEventListener(){}}});
const count=verify(game,C.Game.prototype)+verify(campaign,W.LunaCampaign.prototype);
function walk(dir) {
  for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
    const file=path.join(dir,entry.name);
    if(entry.isDirectory())walk(file);
    else if(file.endsWith('.js')){
      const source=fs.readFileSync(file,'utf8');
      assert(!source.includes('sourceMappingURL=data:'),'Inline source map in '+file);
      assert(!/data:image\/[^;]+;base64,[A-Za-z0-9+/=]{4096}/.test(source),'Move embedded atlas data out of source: '+file);
      assert(Buffer.byteLength(source)<160000,'Split oversized feature source: '+file);
    }
  }
}
walk(root+'/bar-playtest/src');
assert(fs.existsSync(root+'/bar-playtest/data/runtime/cinema-assets.js'));
assert(!fs.existsSync(root+'/bar-playtest/src/cinema/assets.js'));
console.log('CODE_BOUNDARIES_OK: '+count+' installed feature methods, no duplicates, descriptor parity, no inline maps/atlases in source');
