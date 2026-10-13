const {chromium}=require('/Users/lee/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert=require('node:assert/strict');
const BASE=process.env.LUNA_TEST_URL||'http://127.0.0.1:8123/bar-playtest/';
(async()=>{const b=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--mute-audio']});try{
 const p=await b.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));
 const harness=async page=>{await page.route('**/bgm-harness',r=>r.fulfill({contentType:'text/html',body:'<!doctype html><body><button>Play</button><script src="bgm.js"></script><script>window.barBgm=new LunaBarBgm()</script>'}));await page.goto(BASE+'bgm-harness');};
 const ready=async(page,index)=>page.waitForFunction(i=>barBgm.index===i&&barBgm.status==='playing'&&!barBgm.fade&&barBgm.audio.currentTime>0,index);
 await harness(p);assert.equal(await p.evaluate(()=>barBgm.index),-1);await p.locator('button').click();await ready(p,0);
 const durations=[174.947,211.61,253.71,125.98];
 for(const i of [0,2,3,0]){await ready(p,i);assert(Math.abs(await p.evaluate(()=>barBgm.audio.duration)-durations[i])<.2);await p.evaluate(()=>barBgm.next());}
 await ready(p,2);
 const outgoing=await p.evaluate(()=>{const volume=barBgm.audio.volume;barBgm.setLocation('street');barBgm.applyVolume();return {before:volume,after:barBgm.audio.volume};});assert.equal(outgoing.after,outgoing.before);
 await p.waitForTimeout(300);
 const fade=await p.evaluate(()=>({index:barBgm.index,gain:barBgm.locationGain,status:barBgm.status}));assert.equal(fade.index,2);assert(fade.gain>0&&fade.gain<1);assert.equal(fade.status,'fading');
 await ready(p,1);assert.equal(await p.evaluate(()=>barBgm.audio.loop),true);
 assert(Math.abs(await p.evaluate(()=>barBgm.audio.volume)-.18)<1e-9,'Street BGM should be 60% of the saved volume');
 assert(Math.abs(await p.evaluate(()=>barBgm.audio.duration)-durations[1])<.2);
 await p.evaluate(()=>barBgm.setLocation('home'));await ready(p,2);
 assert.equal(await p.evaluate(()=>barBgm.audio.volume),.3,'Home music must retain its original volume');
 const before=await p.evaluate(()=>barBgm.audio.currentTime);await p.evaluate(()=>barBgm.setLocation('home'));await p.waitForTimeout(180);assert(await p.evaluate(t=>barBgm.audio.currentTime>t,before));
 // A quick return cancels the old destination and retains the home track.
 await p.evaluate(()=>barBgm.setLocation('street'));await p.waitForTimeout(200);await p.evaluate(()=>barBgm.setLocation('home'));await ready(p,2);assert(await p.evaluate(t=>barBgm.audio.currentTime>t,before));
 await p.evaluate(()=>{barBgm.setVolume(.4);barBgm.setTransitionGain(.5);});assert.equal(await p.evaluate(()=>barBgm.audio.volume),.2);
 await p.evaluate(()=>barBgm.setLocation('bar'));await ready(p,0);assert.equal(await p.evaluate(()=>barBgm.audio.volume),.2);assert.equal(await p.evaluate(()=>barBgm.audio.loop),false);
 assert.deepEqual(await p.evaluate(()=>JSON.parse(localStorage.getItem('luna.bar.playtest.bgm.v1'))),{enabled:true,volume:.4});
 await p.evaluate(()=>{barBgm.setEnabled(false);barBgm.setLocation('street');});await p.waitForTimeout(1000);assert(await p.evaluate(()=>barBgm.audio.paused));
 await p.evaluate(()=>barBgm.setEnabled(true));await ready(p,1);
 assert(Math.abs(await p.evaluate(()=>barBgm.audio.volume)-.12)<1e-9,'Street mix must multiply user volume and cinema fade');
 await p.evaluate(()=>{barBgm.setLocation('home');barBgm.setLocation('bar');barBgm.setLocation('street');});await ready(p,1);
 assert.equal(await p.locator('audio').count(),1);
 const routes=await p.evaluate(()=>{
  const probe={location:'bar',setLocation(v){this.location=v;}},out={active:true,model:{scene:'street'}},route=(c,o=out)=>{LunaBarBgm.prototype.syncLocation.call(probe,c,o);return probe.location;};
  return [route({doorTransition:{direction:'out',revealAt:null}}),route({doorTransition:{direction:'out',revealAt:1}}),route({doorTransition:{direction:'in',revealAt:null}}),route({doorTransition:{direction:'in',revealAt:1}}),route({view:'scene',dialog:{background:'terrace'}}),route({view:'options',resumeView:'scene',dialog:{background:'terrace'}}),route({view:'scene',dialog:{background:'johnny-memory'}})];
 });assert.deepEqual(routes,['bar','street','street','bar','home','home','bar']);
 // Real app: home -> terrace -> home is one continuous Track 3; doors switch zones.
 await p.goto(BASE+'?dev=1');if(await p.locator('.updates-close').count())await p.locator('.updates-close').click();else await p.keyboard.press('KeyA');await ready(p,0);
 await p.evaluate(async()=>{Object.assign(outsidePlaytest.config,{day:1,flow:'in',place:'home'});await outsidePlaytest.start();});await ready(p,2);
 const time=await p.evaluate(()=>barBgm.audio.currentTime);
 await p.evaluate(()=>lunaCampaign.scene('night0','테라스','terrace',()=>{}));await p.waitForFunction(()=>!lunaCampaign.memoryTransition);await ready(p,2);assert(await p.evaluate(t=>barBgm.audio.currentTime>t,time));
 await p.evaluate(()=>{lunaCampaign.dialog=null;lunaCampaign.screen('developer');const m=outsidePlaytest.model;m.story.cancel();m.backgroundStory.cancel();m.x=-1.581;m.updateNear();});
 await p.keyboard.press('KeyE');await p.waitForFunction(()=>outsidePlaytest.model.scene==='street');await ready(p,1);
 await p.evaluate(()=>{outsidePlaytest.model.scene='home';outsidePlaytest.snapCamera();});await ready(p,2);
 await p.evaluate(()=>{outsidePlaytest.exit(true);lunaCampaign.screen('developer');});await ready(p,0);
 const barTime=await p.evaluate(()=>barBgm.audio.currentTime);
 await p.evaluate(()=>{barGame.overlay='settings';lunaCampaign.render(true);});await p.waitForTimeout(200);assert(await p.evaluate(t=>barBgm.audio.currentTime>t,barTime));
 assert.deepEqual(errors,[]);
 // A missing track must not fall through to another location's music or retry forever.
 const broken=await b.newPage();let loads=0;
 await broken.route('**/assets/audio/*.m4a',r=>{loads++;return r.abort();});await harness(broken);await broken.evaluate(()=>barBgm.setLocation('street'));await broken.locator('button').click();await broken.waitForFunction(()=>barBgm.status==='error');assert.equal(loads,1);await broken.waitForTimeout(250);assert.equal(loads,1);
 await broken.unroute('**/assets/audio/*.m4a');await broken.evaluate(()=>{barBgm.setEnabled(false);barBgm.setEnabled(true);});await ready(broken,1);
 console.log('PASS: all four real tracks decode; bar 1→3→4 loop; street 2/home 3; fade out/in, rapid return, mute/volume, cinema gain, one persistent audio, real home/terrace/door routing, bounded missing-file retry.');
}finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
