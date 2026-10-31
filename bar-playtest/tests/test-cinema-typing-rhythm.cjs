const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.resolve(__dirname,'../..'),W={};W.window=W;
for(const file of ['bar-playtest/src/shared/dialogue/dialogue-rhythm.js','bar-playtest/src/features/outside/events/outside-story.js','cutscene-studio/src/tags.js','bar-playtest/src/cinema/engine.js'])vm.runInNewContext(fs.readFileSync(path.join(root,file),'utf8'),W);
const R=W.LunaDialogueRhythm,T=W.StudioTags,E=W.Engine,near=(a,b)=>assert(Math.abs(a-b)<1e-8,`${a} != ${b}`);
for(const rate of [22,28,55,60])for(const text of ['가.나','가. 나','가...나','..','......','가 나','😀... 네.','마침.','']){
 const timing=R.timing(text,rate),parsed=T.parse(text),legacy={text,cps:1/rate,pauses:[]};
 for(let i=0;i<timing.chars.length;i++){
  const previous=timing.chars[i-1],gap=previous==='.'&&timing.chars[i]==='.'?.3:previous==='.'&&timing.chars[i-2]!=='.'?.35:1/rate;
  near(timing.times[i]-(timing.times[i-1]||0),gap);
  for(const dt of [-.0001,0,.0001]){
   const elapsed=timing.times[i]+dt,n=dt<0?i:i+1;
   assert.equal(T.count(parsed,elapsed,rate),n);
   assert.equal(E.typedCount(legacy,elapsed),timing.chars.slice(0,n).join('').length);
   assert.equal(W.LunaOutsideStory.visible(W.LunaOutsideStory.typing(text,rate),elapsed),n);
  }
 }
 const scene=new E.Scene({W:480,H:270,FLOOR:200}),line=scene.line({text,cps:1/rate,hold:.5,dur:.1});
 near(line.dur,.12+timing.duration+.5);
 assert.equal(E.typedCount(line,line.dur-.5-.12),text.length,'automatic memory lines finish before reading hold');
}
const p=T.parse('[c:#fff]가.[/c][T:0.2]나...[camshake:1]😀.');
near(R.timing(p.text,55,p.pauses).times[2]-2/55,.55);
near(T.triggerTime(p,p.triggers[0],55),R.timing(p.text,55,p.pauses).times[5]);
assert.equal(T.count(p,.55+2/55-.0001,55),2);
assert.equal(T.count(p,.55+2/55,55),3);
near(T.duration(T.parse('가.'),55),2/55+.35);
near(T.duration(T.parse('...'),55),1/55+.6);
const legacy=new E.Scene({W:480,H:270,FLOOR:200}).line({text:'가.[T:0.2]나.',cps:1/55});
assert.equal(E.typedCount(legacy,2/55+.5499),2);
assert.equal(E.typedCount(legacy,2/55+.55),3);
console.log('CINEMA_TYPING_RHYTHM_OK: shared exterior/studio/legacy deadlines, singleton and repeated dots, Unicode, explicit tags, effect triggers, auto duration and terminal holds.');
