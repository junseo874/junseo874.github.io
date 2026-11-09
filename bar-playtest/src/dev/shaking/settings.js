
// ───────── 설정 창 · 사운드 탭
function toggleSettings(force){const m=$('settings'),open=force??m.hidden;m.hidden=!open;setPause(open||!$('tut').hidden);if(open)ShakeLabAudio.stop();if(open)$('sBack').focus()}
$('openSet').onclick=()=>toggleSettings(true);$('sClose').onclick=()=>toggleSettings(false);$('sBack').onclick=()=>toggleSettings(false);
$('sMenu').onclick=()=>{toggleSettings(false);R=RECIPES[0];reset()};
document.querySelectorAll('#snav button').forEach(b=>b.onclick=()=>{
  document.querySelectorAll('#snav button').forEach(x=>{x.setAttribute('aria-selected',x===b);x.querySelector('span').textContent=x===b?'›':''});
  document.querySelectorAll('.spane').forEach(p=>p.hidden=p.dataset.pane!==b.dataset.tab)});
const DEF={...OPT};
function syncOpt(){
  OPT.snd=2;
  [['oMusic','music','nMusic'],['oSfx','sfx','nSfx'],['oStreet','street','nStreet']].forEach(([id,k,n])=>{const el=$(id);el.value=OPT[k];el.style.setProperty('--p',OPT[k]+'%');$(n).textContent=OPT[k]+'%'});
  $('oVoice').value=OPT.voice;$('oDiff').value=OPT.diff;$('oSnd').value=OPT.snd;
  [['oBgm','bgm'],['oSfxOn','sfxOn'],['oRing','ring'],['oShake','shake']].forEach(([id,k])=>{$(id).setAttribute('aria-pressed',OPT[k]);$(id).textContent=OPT[k]?'켜짐':'꺼짐'});
  document.querySelectorAll('#sndtabs button').forEach(b=>b.setAttribute('aria-pressed',+b.dataset.s===OPT.snd));
}
[['oMusic','music'],['oSfx','sfx'],['oStreet','street']].forEach(([id,k])=>$(id).addEventListener('input',e=>{OPT[k]=+e.target.value;syncOpt()}));
$('oVoice').onchange=e=>{OPT.voice=e.target.value};$('oDiff').onchange=e=>{OPT.diff=e.target.value};$('oSnd').onchange=e=>{OPT.snd=+e.target.value;syncOpt()};
[['oBgm','bgm'],['oSfxOn','sfxOn'],['oRing','ring'],['oShake','shake']].forEach(([id,k])=>$(id).onclick=()=>{OPT[k]=!OPT[k];syncOpt()});
$('sReset').onclick=()=>{const pane=[...document.querySelectorAll('.spane')].find(p=>!p.hidden).dataset.pane;
  const keys=pane==='sound'?['music','sfx','street','voice','bgm','sfxOn']:pane==='game'?['diff','ring','shake','snd']:[];keys.forEach(k=>OPT[k]=DEF[k]);syncOpt()};
document.querySelectorAll('#sndtabs button').forEach(b=>b.onclick=()=>{OPT.snd=+b.dataset.s;syncOpt();audio();clink(1,1300)});

syncOpt();reset();requestAnimationFrame(loop);

