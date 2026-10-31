const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const W={barGame:{dialogSpeed:1},LunaOutsideContent:{events:[]}},audio=[];W.window=W;
W.LunaDialogueAudio={reveal:(...args)=>audio.push(args)};
vm.runInNewContext(fs.readFileSync(require('node:path').join(__dirname,'../src/shared/dialogue/dialogue-rhythm.js'),'utf8'),W);
vm.runInNewContext(fs.readFileSync(require('node:path').join(__dirname,'../src/features/outside/events/outside-story.js'),'utf8'),W);
const T=W.LunaOutsideStory,close=(a,b)=>assert(Math.abs(a-b)<1e-8,`${a} != ${b}`);
for(const text of ['가 나','가  나','앞\t뒤','😀 다음','..','...','......','가...나','가.나','가. 나','가.','.','1.5','가\n나','']){
 const t=T.typing(text);
 for(let i=0;i<t.chars.length;i++){
  const prev=t.chars[i-1],gap=prev==='.'&&t.chars[i]==='.'?.3:prev==='.'&&t.chars[i-2]!=='.'?.35:1/55;
  close(t.times[i]-(t.times[i-1]||0),gap);
  assert.equal(T.visible(t,t.times[i]-.00001),i);
  assert.equal(T.visible(t,t.times[i]),i+1);
 }
 assert.equal(T.visible(t,9999),t.chars.length);
}
close(T.typing('가 나').duration,3/55);
close(T.typing('가.나').times[2]-T.typing('가.나').times[1],.35);
close(T.typing('가...나').times[3]-T.typing('가...나').times[2],.3);
close(T.typing('가...나').times[4]-T.typing('가...나').times[3],1/55);
close(T.typing('가.').duration,2/55+.35);
const m={x:0,y:0,updateNear(){}},target={x:0,y:0};m.story=new T.Story(m);m.backgroundStory=new T.BackgroundStories(m);
const rows=[{type:'say',actor:'luna',text:'가 나.다...라.'},{type:'say',actor:'luna',text:'다음'}];
for(const rate of [.5,1,2,4]){
 W.barGame.dialogSpeed=rate;m.story.beginRows('manual',target,rows);audio.length=0;
 m.story.tick(2/55/rate);assert.equal(m.story.view().text,'가 ');
 m.story.tick(2/55/rate);assert.equal(m.story.view().text,'가 나.');const n=audio.length;
 m.story.tick(.349/rate);assert.equal(m.story.view().text,'가 나.');assert.equal(audio.length,n,'pause must not trigger speech audio');
 m.story.tick(.001/rate);assert.equal(m.story.view().text,'가 나.다');
 m.story.advance();assert.equal(m.story.speech.index,0);assert.equal(m.story.view().text,rows[0].text);
 m.story.tick(.01);assert.equal(m.story.view().text,rows[0].text,'full reveal stays visible');
 m.story.advance();assert.equal(m.story.speech.index,1);assert.equal(m.story.view().text,'');m.story.cancel();
}
W.barGame.dialogSpeed=1;
m.backgroundStory.beginRows('auto',target,rows,true);
const duration=T.typing(rows[0].text).duration;m.backgroundStory.tick(duration-.001);assert.equal(m.backgroundStory.speech.index,0);
m.backgroundStory.tick(.001);assert.equal(m.backgroundStory.view().text,rows[0].text);
m.backgroundStory.tick(1.999);assert.equal(m.backgroundStory.speech.index,0);m.backgroundStory.tick(.002);assert.equal(m.backgroundStory.speech.index,1);
const age=m.backgroundStory.speech.elapsed;m.story.beginRows('blocker',target,rows);m.backgroundStory.tick(5);assert.equal(m.backgroundStory.speech.elapsed,age);m.story.cancel();m.backgroundStory.cancel();
// Choices never truncate retained speech, even beyond the former 99-second sentinel.
W.LunaHomeInteractions={choiceView:()=>({options:[]})};
const long='가.'.repeat(300);m.story.beginRows('choice',target,[{type:'say',actor:'luna',text:long},{type:'home-choice',text:''}]);m.story.advance();m.story.advance();assert.equal(m.story.view().text,long);
const scene={rows,index:0,chars:0};T.sceneTyping(scene,4/60);assert.equal(scene.chars,4);T.sceneTyping(scene,.349);assert.equal(scene.chars,4);T.sceneTyping(scene,.001);assert.equal(scene.chars,5);
scene.chars=rows[0].text.length;T.sceneTyping(scene,.1);assert.equal(scene.chars,rows[0].text.length);scene.index=1;scene.chars=0;T.sceneTyping(scene,1/60);assert.equal(scene.chars,1);
console.log('OUTSIDE_TYPING_RHYTHM_OK: exact space/dot boundaries, Unicode, singleton dots, settings, audio pauses, reveal/advance, auto hold, ambient suspension, long choices and scene resets.');
