const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const w=new EventTarget(),requests=[],key='luna.dialogue.saved.v1';
w.location={hostname:'127.0.0.1',search:''};w.document=new EventTarget();
let channel;
w.BroadcastChannel=class{constructor(){channel=this;}};
w.fetch=()=>new Promise(resolve=>requests.push(resolve));
vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../src/dev/dialogue-editor/live-data.js'),'utf8'),
 {window:w,URLSearchParams,AbortSignal,console:{warn(){}}});
const data={tables:{}},state=w.LunaDialogueLiveData.attach({g:{},D:data,raw:data,campaign:{session:{}},story:{}});
const hash=n=>String(n).repeat(64),signal=n=>{
 const event=Object.assign(new Event('storage'),{key,newValue:JSON.stringify({revision:hash(n)})});w.dispatchEvent(event);
 channel.onmessage({data:{revision:hash(n)}});
};
const reply=(i,n)=>requests[i]({ok:true,json:async()=>({revision:hash(n),tables:{steps:[],bar_choices:[],bar_choice_groups:[]},story:{opening:[],bar:{},day0Bar:[]}})});
(async()=>{
 const first=state.refresh();w.dispatchEvent(new Event('pageshow'));w.dispatchEvent(new Event('focus'));w.document.dispatchEvent(new Event('visibilitychange'));
 assert.equal(requests.length,1);reply(0,1);await first;assert.equal(requests.length,1);
 signal(1);assert.equal(requests.length,1);
 signal(2);const next=state.refresh();signal(2);signal(3);assert.equal(requests.length,2);
 reply(1,2);await new Promise(setImmediate);assert.equal(requests.length,3,'later save must not be missed');reply(2,3);await next;
 assert.equal(state.revision,hash(3));assert.equal(requests.length,3);
 const inFlight=state.refresh();signal(4);reply(3,4);await inFlight;assert.equal(requests.length,4,'current server reply already includes the new save');
 w.dispatchEvent(Object.assign(new Event('storage'),{key,newValue:'broken'}));channel.onmessage({data:{revision:'fake',tables:{}}});assert.equal(requests.length,4);
 const fail=state.refresh();requests[4]({ok:false,status:503});await fail;assert.equal(state.revision,hash(4));assert(state.error);
 w.dispatchEvent(new Event('focus'));const retry=state.refresh();reply(5,5);await retry;assert.equal(state.revision,hash(5));assert.equal(state.error,'');
 const oldRows=[{text:'before'}],removed=[{text:'deleted branch'}];
 data.sharedStory={'newspaper/intro':oldRows,'editor/test':removed,'native/vendor':[]};
 w.outsidePlaytest={model:{story:{speech:{rows:oldRows}},backgroundStory:{channels:new Map([['voice',{speech:{rows:removed}}]])}}};
 state.receive({revision:hash(6),tables:{steps:[],bar_choices:[],bar_choice_groups:[]},story:{opening:[],bar:{},day0Bar:[]},exterior:{sharedStory:{'newspaper/intro':[{text:'after'}]}}});
 assert.equal(data.sharedStory['editor/test'],undefined);assert(Object.hasOwn(data.sharedStory,'native/vendor'));
 assert.equal(data.sharedStory['newspaper/intro'],oldRows);assert.equal(oldRows[0].text,'after');
 assert.equal(w.outsidePlaytest.model.story.speech.rows[0].text,'before');
 assert.equal(w.outsidePlaytest.model.backgroundStory.channels.get('voice').speech.rows[0].text,'deleted branch');
 console.log('LIVE_SIGNALS_OK: overlapping focus/storage/channel requests coalesced; saves during read and failure recovery preserved.');
})().catch(e=>{console.error(e);process.exitCode=1;});
