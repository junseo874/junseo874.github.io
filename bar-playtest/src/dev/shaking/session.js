// Simulator navigation only. No campaign, CSV, inventory or save mutation.
function labLeave(action){
 setPause(true);ShakeLabAudio.stop();labTasks=[];
 if(parent!==window)parent.postMessage({type:'luna-shake-practice',action},location.origin);
 else location.href='../../../index.html?dev=1&mode=minigames';
}
function fitLab(){document.documentElement.style.setProperty('--lab-scale',Math.min(innerWidth/1280,innerHeight/720));}
addEventListener('resize',fitLab);fitLab();
$('other').onclick=()=>labLeave('versions');$('other').textContent='버전 선택';
$('home').onclick=()=>labLeave('exit');$('home').textContent='기믹 목록';
$('sMenu').onclick=()=>labLeave('exit');
$('oSnd').options[0].textContent='기존 쉐이킹 사운드 1';$('oSnd').options[1].textContent='기존 쉐이킹 사운드 2';
document.querySelector('.row:has(#oDiff) .d').textContent='회차별 입력 제한 시간';
const query=new URLSearchParams(location.search);
OPT.snd=2;OPT.sfxOn=query.get('sound')!=='0';syncOpt();
function freeze(){if(S.phase!=='tut'&&!S.done)toggleSettings(true);ShakeLabAudio.stop();}
addEventListener('blur',freeze);document.addEventListener('visibilitychange',()=>{if(document.hidden)freeze();});
document.addEventListener('input',()=>{if(!OPT.sfxOn||!OPT.sfx)ShakeLabAudio.stop();});
$('oSfxOn').addEventListener('click',()=>{if(!OPT.sfxOn)ShakeLabAudio.stop();});
// Keep keyboard focus inside the active modal, including during tutorial and results.
addEventListener('keydown',event=>{
 if(event.code!=='Tab')return;
 const modal=!$('settings').hidden?$('settings'):!$('tut').hidden?$('tut'):!$('res').hidden?$('res'):null;
 if(!modal)return;
 const controls=[...modal.querySelectorAll('button,input,select')].filter(el=>el.getClientRects().length);
 const i=controls.indexOf(document.activeElement);event.preventDefault();
 controls[(i+(event.shiftKey?-1:1)+controls.length)%controls.length]?.focus();
},true);
