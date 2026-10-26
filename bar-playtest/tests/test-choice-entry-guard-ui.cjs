const assert=require('node:assert/strict'),r=require('../../tools/lib/test-runtime.cjs');
(async()=>{const browser=await r.load('playwright').chromium.launch({executablePath:r.chrome,headless:true,args:['--mute-audio']});try{
 const p=await browser.newPage();await p.goto('http://127.0.0.1:8123/bar-playtest/?dev=1');await p.locator('.updates-confirm').click();
 const results=await p.evaluate(()=>{
  const checks=[];let now=10000,commits=0;const original=performance.now.bind(performance);
  Object.defineProperty(performance,'now',{configurable:true,value:()=>now});
  const host=document.createElement('div');document.body.append(host);
  const ui=LunaWorldChoices.create(host,()=>commits++);
  const key=(code,repeat=false)=>ui.key({code,repeat,preventDefault(){},stopImmediatePropagation(){}});
  const next=(key,rejectUnavailable)=>({key,rejectUnavailable,entryGuardMs:rejectUnavailable?500:0,head:{x:640,y:350},options:[{id:'a',label:'첫 번째'},{id:'b',label:'두 번째'}]});
  try{for(const external of [true]){
   now+=2000;const started=now,view=next('first-'+external,external);ui.update(view);
   key('KeyE');checks.push(commits===0);
   key('KeyS');checks.push(host.querySelector('.is-selected').dataset.choice==='b');
   now=started+499;ui.update({...view,money:500,head:{x:650,y:355}});for(const code of ['KeyE','Enter','Space'])key(code);host.querySelector('button').click();checks.push(commits===0);
   now=started+500;key('KeyE',true);checks.push(commits===0);key('KeyE');checks.push(commits===1);
   commits=0;now+=1000;ui.update(next('second-'+external,external));key('KeyE');checks.push(commits===0);
   now+=500;key('KeyE');checks.push(commits===1);
   commits=0;ui.update(null);ui.update(next('second-'+external,external));key('KeyE');checks.push(commits===0);
   host.querySelector('button').click();checks.push(commits===0);now+=500;host.querySelector('button').click();checks.push(commits===1);commits=0;
   ui.update(null);
  }ui.update(next('cinema',false));key('KeyE');checks.push(commits===1);
  }finally{ui.dispose();host.remove();Object.defineProperty(performance,'now',{configurable:true,value:original});}
  return checks;
 });
 assert(results.every(Boolean),JSON.stringify(results));console.log('CHOICE_ENTRY_GUARD_OK: exterior 499/500ms boundary for E/Enter/Space/click; no cinema delay; held keys, navigation, refresh and reopen.');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
