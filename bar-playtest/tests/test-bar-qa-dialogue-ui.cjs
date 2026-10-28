const assert=require('node:assert/strict'),rt=require('../../tools/lib/test-runtime.cjs');
(async()=>{const b=await rt.load('playwright').chromium.launch({executablePath:rt.chrome,headless:true,args:['--mute-audio']});try{
 const p=await b.newPage({viewport:{width:1280,height:720}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.goto('http://127.0.0.1:8123/bar-playtest/?dev=1');await p.locator('.updates-confirm').click();
 await p.evaluate(()=>{LunaFocusSettings.setEnabled(false);window.qaTables=JSON.stringify(barData.tables);window.qaCarry=JSON.stringify(lunaCampaign.session.carry);});
 await p.locator('[data-act="day"][data-id="99"]').click();await p.locator('[data-act="start"]').click();
 await p.locator('.choices button').first().waitFor();assert(await p.locator('.qa-launch').isHidden());assert(await p.locator('#qa-lab').isHidden());
 async function choose(text,key=false){const el=p.locator('.choices button').filter({has:p.locator('.choice-label',{hasText:new RegExp('^'+text+'$')})});await el.waitFor();await el.hover();if(key){await el.focus();await p.keyboard.down('KeyE');await p.waitForTimeout(700);await p.keyboard.up('KeyE');}else{await p.mouse.down();await p.waitForTimeout(700);await p.mouse.up();}await p.waitForTimeout(100);assert.equal(await p.evaluate(()=>barGame.error),null);}
 async function nextChoice(){await p.evaluate(()=>{const g=barGame;for(let i=0;i<100&&!g.choice;i++){if(g.pendingTransition){const f=g.pendingTransition;g.pendingTransition=null;g.transition=0;f();}g.transition=0;g.cameraLeft=0;g.cameraMoving=false;if(g.dialogue){g.dialogue.chars=g.dialogue.text.length;g.advance();}else g.pump();}g.changed();});await p.locator('.choices button').first().waitFor();}
 await choose('선택지·알림',true);await choose('선택지 · 돈 받기 / 지불 / 잔액 부족');await nextChoice();await choose('300원 받기',true);
 assert.equal(await p.evaluate(()=>barGame.progress.money),1300);await nextChoice();assert(await p.locator('.choices').getByText('다시 테스트',{exact:true}).isVisible());
 await choose('다시 테스트');await nextChoice();assert.equal(await p.evaluate(()=>barGame.progress.money),1000);assert(await p.locator('[data-act="choice"][disabled]').isVisible());await choose('취소');await nextChoice();await choose('처음으로');
 await choose('코스터·좌석');await choose('다음 항목');await choose('이전 항목');await choose('다음 항목');await choose('2인 · 한 명만 코스터 필요');
 await p.waitForFunction(()=>!!barGame.dialogue);await p.evaluate(()=>{const g=barGame;g.dialogue.chars=g.dialogue.text.length;g.cameraLeft=0;g.cameraMoving=false;g.advance();});await p.waitForFunction(()=>!!barGame.storyCoaster);assert.equal(await p.evaluate(()=>barGame.seats.R.actor),'bubi');
 // Traverse the actual choice graph (not runPreset) to every leaf, including paged poses.
 const coverage=await p.evaluate(()=>{
  const g=barGame,visited=new Set(),leaves=new Set(),queue=[[]];
  function check(rows,context){
   if(!rows.length||rows.length>4)throw Error(context+': expected 1–4 choices, got '+rows.length);
   if(rows.some((r,i)=>Number(r.seq)!==i+1))throw Error(context+': choice slots must be sequential 1–4');
  }
  // Validate every authored preset, not just its navigation entry, and legacy CSV menus.
  for(const preset of LunaBarQAPresets.catalog(barData))for(const step of preset.steps())if(step.type==='qa_menu')check(step.choices.map((r,i)=>({...r,seq:i+1})),preset.id);
  const legacy={};for(const c of barData.tables.bar_choices)if(/t99/.test(c.context))(legacy[c.context]??=[]).push(c);
  for(const [id,rows]of Object.entries(legacy))check(rows,id);
  while(queue.length){const path=queue.shift();lunaQA.startDialogue();for(const seq of path){g.cameraMoving=false;g.cameraLeft=0;g.transition=0;if(!g.choose(seq))throw Error('QA route failed: '+path+' / '+g.error);}
   const key=g.story.scene.id.replace(/_\d+$/,'');if(visited.has(key))continue;visited.add(key);
   check(g.choice.rows,key);
   for(const c of g.choice.rows){const r=c.qaRoute;if(!r)continue;
    if(['run','pose'].includes(r.kind)){leaves.add(r.id);continue;}
    if(!['legacy','legacyScene','root'].includes(r.kind))queue.push([...path,c.seq]);
   }
  }
  // Invalid future content fails explicitly instead of silently dropping the fifth choice.
  let rejected=false;try{g.campaignStep({type:'qa_menu',choices:Array.from({length:5},()=>({}))});}catch(e){rejected=/1~4/.test(e.message);}
  if(!rejected)throw Error('QA must reject five-choice data');
  return{leaves:[...leaves],expected:lunaQA.presets.map(c=>c.id),menus:visited.size};
 });assert.deepEqual(coverage.leaves.sort(),coverage.expected.sort());
 // Single-expression selection uses actual seated actor and dialogue renderer.
 await p.evaluate(()=>lunaQA.startDialogue());await choose('다음 항목');await choose('캐릭터·표정');
 // Follow the paginated actor catalog without changing gameplay directly.
 for(let i=0;i<20&&!await p.locator('.choices').getByText('포트 · 표정 선택',{exact:true}).count();i++)await choose('다음 항목');
 await choose('포트 · 표정 선택');await choose('idle');
 await p.waitForFunction(()=>barGame.dialogue?.actor==='port');assert.equal(await p.evaluate(()=>barGame.dialogue.expression),'idle');await nextChoice();
 await choose('처음으로');await choose('인물 정보');await choose('선택지 · 모든 캐릭터 정보 해금');await nextChoice();await choose('모든 캐릭터 정보 등록·해금');
 await p.locator('.dossier-screen').waitFor();assert.equal(await p.locator('.guest-card:not(.unmet)').count(),12);await p.keyboard.press('Escape');await nextChoice();await choose('처음으로');
 // Standard choices stay inside the game at narrow/wide sizes; no auxiliary panel.
 for(const [width,height] of [[600,760],[1920,1080],[1280,720]]){await p.setViewportSize({width,height});await p.waitForTimeout(200);assert(await p.locator('.choices').evaluate(e=>{const r=e.getBoundingClientRect();return r.left>=0&&r.top>=0&&r.right<=innerWidth&&r.bottom<=innerHeight;}));assert(await p.locator('.qa-launch').isHidden());}
 await p.screenshot({path:'/private/tmp/bar-qa-dialogue-menu.png'});
 await choose('다음 항목');await choose('기존 QA 대사·일반 영업');await choose('개점 · 대사·분기·일반 영업');
 const legacy=await p.evaluate(()=>{const g=barGame;g.cameraMoving=false;return g.choose(1);});assert(legacy);await nextChoice();await choose('메인 허브로');
 assert(await p.locator('.choices').getByText('코스터·좌석',{exact:true}).isVisible(),'authored CSV branch returns to the same dialogue hub');
 assert.equal(await p.evaluate(()=>JSON.stringify(barData.tables)===qaTables),true);assert.equal(await p.evaluate(()=>JSON.stringify(lunaCampaign.session.carry)===qaCarry),true);
 await p.evaluate(()=>{lunaCampaign.session.uninstall();lunaCampaign.session.install({developer:false});lunaCampaign.session.beginCommute(0);lunaQA.tick(0);});
 assert.equal(await p.evaluate(()=>{try{lunaQA.startDialogue();return false;}catch{return true;}}),true);assert.deepEqual(errors,[]);
 console.log('QA_DIALOGUE_OK '+coverage.menus+' menus limited to four slots, preset/legacy limits, real entry/hold choices, money/reset, mixed coaster, all '+coverage.leaves.length+' reachable presets, pose selection, profiles, return loops, viewport and main isolation');
}finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
