const fs=require('fs'),vm=require('vm'),assert=require('assert/strict'),path=require('path');
const root=process.env.LUNA_TEST_ROOT||path.resolve(__dirname,'..'),ctx={window:{}};
vm.runInNewContext(fs.readFileSync(path.join(root,'data.js'),'utf8'),ctx);const d=ctx.window.LUNA_DATA,before=JSON.parse(JSON.stringify(d.assets));
vm.runInNewContext(fs.readFileSync(path.join(root,'item-art-reuse.js'),'utf8'),ctx);
const api=ctx.window.LunaItemArtReuse,ids=[...d.tables.shelf_items.map(i=>i.id),'opener'];let reused=0;
for(const id of ids){const keys=['item_','recipe_item_','inventory_item_'].map(p=>p+id),source=keys.find(k=>before[k]&&!api.temporary(before[k]));for(const key of keys){if(source){assert(!api.temporary(d.assets[key]),key);if(!before[key]||api.temporary(before[key])){assert.equal(d.assets[key].src,before[source].src);assert.equal(d.assets[key].sharedFrom,source);assert.equal(d.assets[key].w,before[source].w);reused++;}else assert.deepEqual(JSON.parse(JSON.stringify(d.assets[key])),before[key]);}else assert.equal(JSON.stringify(d.assets[key]),JSON.stringify(before[key]));}}
assert(reused>30);assert.equal(api.apply(d).length,0);assert.equal(d.assets.recipe_item_gin.src,d.assets.item_gin.src);assert.equal(d.assets.inventory_item_shaker.src,d.assets.item_shaker.src);
assert.equal(d.assets.item_tequila.src,'assets/tequila-registered.png');
assert(!api.temporary(d.assets.item_tequila));
for(const prefix of ['item_','recipe_item_','inventory_item_']){const a=d.assets[prefix+'tequila'];assert.equal(a.src,d.assets.item_tequila.src);assert.equal(a.w,57);assert.equal(a.h,171);assert.deepEqual(Array.from(a.alphaBBox),[9,23,47,170]);assert(fs.existsSync(path.join(root,a.src)));}
// If only another usage has registered art, shelf/inventory still adopt it.
for(const prefix of ['item_','recipe_item_','inventory_item_']){const a=d.assets[prefix+'orange_juice'];assert.equal(a.src,'assets/orange-juice-registered.png');assert(!api.temporary(a));assert.equal(a.w,93);assert.equal(a.h,223);assert.deepEqual(Array.from(a.alphaBBox),[25,56,65,222]);assert(fs.existsSync(path.join(root,a.src)));}
const synthetic={tables:{shelf_items:[{id:'example'}]},assets:{recipe_item_example:{src:'real.png',w:45,h:95,source:'approved'},item_example:{src:'dummy.png',source:'임시'}}};api.apply(synthetic);assert.equal(synthetic.assets.item_example.src,'real.png');assert.equal(synthetic.assets.inventory_item_example.src,'real.png');
console.log('ITEM_ART_REUSE_OK',reused,'usage aliases, dimensions, original registered art preserved, missing/dummy-only unchanged, idempotence');
