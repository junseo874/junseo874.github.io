const assert=require('assert/strict'),root=require('path').resolve(__dirname,'..');
for(const file of ['outside-residence','outside-dialogue-data','outside-ambient','outside-encounters','outside-story','outside'])require(root+'/'+file+'.js');
const {Model}=global.LunaOutside,step=(m,n)=>{for(let i=0;i<n*60;i++)m.tick(1/60);};
const pair='outside_day0_port_pair',poster='outside_day0_shiba_wanted';
assert.deepEqual(Object.keys(global.LUNA_OUTSIDE_DIALOGUES),[pair,poster]);assert.equal(global.LUNA_OUTSIDE_DIALOGUES[pair].length,5);assert.equal(global.LUNA_OUTSIDE_DIALOGUES[poster].length,4);
assert.deepEqual(global.LunaOutsideAmbient.placements.map(p=>p.id),['bar-pair-left','bar-pair-right']);
for(const day of [0,1,2,3])for(const flow of ['in','out']){
 const m=new Model({day,flow});const expected=day===0&&flow==='out';assert.equal(m.targets().some(t=>t.id==='wanted-poster'),expected);assert(!m.targets().some(t=>['poster','experiment','shiba'].includes(t.id)||t.encounter));
 m.x=-.9;step(m,.1);assert.equal(m.backgroundStory.speech?.id,expected?pair:undefined);assert(!m.story.blocking);if(expected){step(m,45);assert(m.backgroundStory.done.has(pair));assert(!m.backgroundStory.speech);step(m,3);assert(!m.backgroundStory.speech);}
 const h=new Model({day,flow,place:'home'});h.x=1.22;step(h,40);assert(!h.story.speech&&!h.backgroundStory.speech);
 for(const place of ['bar','homeDoor']){const lift=new Model({day,flow,place});lift.x=global.LunaResidence.layout.elevatorX;lift.updateNear();assert(lift.interact());assert(lift.ride);assert(!lift.story.speech);step(lift,14);assert(!lift.ride);assert(!lift.story.speech&&!lift.backgroundStory.speech);}
}
let m=new Model({day:0,flow:'out'});const t=m.targets().find(t=>t.id==='wanted-poster');m.x=t.x;m.updateNear();
for(let n=0;n<3;n++){assert(m.interact());assert.equal(m.story.speech.id,poster);assert.equal(m.story.view().title,'지명수배');assert(m.story.view().full.includes('개시바'));const x=m.x;m.tick(.05,{move:1});assert.equal(m.x,x);for(let i=0;m.story.speech&&i<20;i++)m.story.advance();assert(!m.story.speech);}
console.log('OUTSIDE_STORY_OK: Notion 5+4 lines, only day0/out, two NPCs, repeatable poster, all rides silent, TV silent, retired encounters absent');
