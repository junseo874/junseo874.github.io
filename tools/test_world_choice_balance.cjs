const assert=require('node:assert/strict'),path=require('node:path');
const {chromium}=require('/Users/lee/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async()=>{let browser;try{
 browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
 const page=await browser.newPage({viewport:{width:1280,height:720},reducedMotion:'reduce'});
 await page.setContent('<body style="margin:0"><div id="stage" style="position:relative;width:1280px;height:720px"></div></body>');
 for(const f of ['speech-bubble.css','outside.css','world-choices.css'])await page.addStyleTag({path:path.resolve(__dirname,'../bar-playtest',f)});
 await page.addScriptTag({path:path.resolve(__dirname,'../bar-playtest/world-choices.js')});
 const results=await page.evaluate(()=>{
  const stage=document.querySelector('#stage'),chosen=[],ui=LunaWorldChoices.create(stage,id=>chosen.push(id));
  const options=[{id:'give',label:'150원을 준다.'},{id:'no',label:'주지 않는다.'}];
  let checks=0;
  for(const facing of [-1,1])for(const money of [0,300,123456789])for(const y of [30,680]){
   const view={key:'balance',options,money,head:{x:640,y},facing};ui.update(view);
   const panel=stage.querySelector('.world-choices'),balance=panel.querySelector('.bd-balance'),buttons=[...panel.querySelectorAll('button')];
   const b=balance.getBoundingClientRect(),first=buttons[0].getBoundingClientRect(),side=facing===-1?'right':'left';
   if(panel.dataset.side!==side)throw Error('Side changed');
   if(b.bottom>first.top||first.top-b.bottom>4)throw Error('Balance must sit directly above first choice');
   if(Math.abs(side==='right'?b.left-first.left:b.right-first.right)>.1)throw Error('Balance alignment mismatch');
   if(getComputedStyle(balance).textAlign!==(side==='right'?'left':'right'))throw Error('Incorrect text alignment');
   if(balance.textContent!=='소지금 '+money.toLocaleString('ko-KR')+'원')throw Error('Wrong amount');
   if(panel.getBoundingClientRect().bottom>703)throw Error('Bottom clipping: '+panel.getBoundingClientRect().bottom);
   ui.key(new KeyboardEvent('keydown',{code:'KeyS'}));
   const selected=panel.querySelector('.is-selected').getBoundingClientRect(),marker=panel.querySelector('kbd').getBoundingClientRect();
   if(Math.abs(marker.y+marker.height/2-selected.y-selected.height/2)>1)throw Error('E marker drift');
   ui.update({...view,money:money+1});
   if(panel.querySelector('.is-selected').dataset.choice!=='no')throw Error('Money update reset selection');
   ui.update(null);ui.update({...view,key:'reset-'+checks});checks++;
  }
  ui.update({key:'no-money',options,head:{x:640,y:350},facing:1});
  if(stage.querySelector('.bd-balance'))throw Error('Unexpected balance on free choice');
  ui.update({key:'four',options:[...options,{id:'third',label:'다음에 이야기한다.'},{id:'fourth',label:'돌아간다.'}],money:300,head:{x:640,y:680},facing:1});
  if(stage.querySelector('.bd-balance').getBoundingClientRect().bottom>stage.querySelector('button').getBoundingClientRect().top)throw Error('Four-option header overlap');
  ui.dispose();return checks;
 });
 assert.equal(results,12);console.log('PASS: 12 balance layouts, both alignments, zero/large/updated balance, marker tracking, no-money and four-option choices.');
}finally{await browser?.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
