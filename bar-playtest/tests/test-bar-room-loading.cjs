const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..'),calls=[],w={navigator:{connection:{saveData:false}},LunaResources:{
 prepare:async group=>assert.equal(group,'bar'),prepareImages:async urls=>calls.push(new Set(urls))
}};
for(const f of ['data/runtime/game-data.js','src/features/bar/bar-guest-art.js','src/features/bar/bar-room-loading.js'])
 vm.runInNewContext(fs.readFileSync(path.join(root,f),'utf8'),{window:w});
(async()=>{
 const d=w.LUNA_DATA,room=w.LunaBarRoomLoading;
 for(let day=0;day<=3;day++){
  await room.prepare(day,d);const urls=calls.at(-1);
  for(const src of urls)assert(fs.statSync(path.join(root,src.split('?')[0])).isFile(),src);
  assert.equal([...urls].some(s=>s.includes('/09.Customers/')),d.tables.random_waves.some(r=>Number(r.day)===day));
  assert(![...urls].some(s=>s.includes('/02.Drink_Serving_Screen_Sheets/')));
 }
 assert(calls[0].has(d.assets.char_chris_Chris_idle_talk_body.src));
 assert(!calls[0].has(d.assets.char_shiba_talk.src)&&calls[2].has(d.assets.char_shiba_talk.src),'respect the day and live pose overrides');
 w.navigator.connection.saveData=true;
 room.anticipate(0,d);await new Promise(r=>setImmediate(r));assert.equal(calls.length,4,'no speculative downloads with data saver');
 await room.prepare(0,d);assert.equal(calls.length,5,'data saver still prepares required images at the door');
 console.log('BAR_ROOM_LOADING_OK: 0–3 room paths, scripted and random guest art, conditional preloading');
})().catch(e=>{console.error(e);process.exitCode=1});
