(function(root){
'use strict';
// Two travelling-note views and the original generated-node round-trip view.
const MODES=['fall','path','cross'],WINDOW=.18,PERFECT=.075,LEAD=1.8,BEAT=.6;
const PATTERN=[0,1,0,0,1,0,1,1,0,1,0,0,1,1,0];
const comboTier=combo=>combo>=10?2:combo>=5?1:0;
const motionSpeed=tier=>[1,1.25,1.5][tier];
const noteSpeed=tier=>[1,1.25,1.5][tier];
const keys={KeyA:0,ArrowLeft:0,KeyD:1,ArrowRight:1};
const normalizeMode=mode=>mode==='drum'?'path':MODES.includes(mode)?mode:'fall';
function updatePath(s,rng){
 // Reuse the original geometry/pattern generator with a tempo-scaled clock,
 // leaving elapsed/craft time in real seconds.
 const path={...s,elapsed:s.rhythm.trackTime};root.LunaCore.MIX.updatePath(path,rng);
 for(const key of ['beatTime','beatIndex','patternTurn','patternIndex','nodes','pathPoint'])s[key]=path[key];
}
function pathInput(s,key){
 if(!['Space','MouseLeft'].includes(key))return false;
 if(!s.started){s.started=true;return true;}
 if(s.completed)return false;
 const node=root.LunaCore.MIX.nearest(s),ok=!!node;
 if(node&&!node.fixed)s.nodes=s.nodes.filter(n=>n.id!==node.id);
 feedback(s,ok,s.rhythm.notes[s.attempts],PERFECT+.001);
 const effect=s.shakeEffects.at(-1);effect.x=node?.x??s.pathPoint[0];effect.y=node?.y??s.pathPoint[1];
 return true;
}
function init(s,mode='fall'){
 mode=normalizeMode(mode);
 s.rhythm={mode:MODES.includes(mode)?mode:'fall',clock:0,trackTime:0,uiAge:0,playing:true,combo:0,tier:0,tierAge:1,best:0,extraPresses:0,serial:0,doneAge:0,
  notes:Array.from({length:s.targetStacks},(_,i)=>({id:i,lane:PATTERN[i%PATTERN.length],time:LEAD+i*BEAT,status:null}))};
 s.motionAge=null;
}
function feedback(s,ok,note,delta=0){
 const r=s.rhythm;r.combo=ok?r.combo+1:0;r.best=Math.max(r.best,r.combo);r.playing=ok;const nextTier=comboTier(r.combo);if(nextTier!==r.tier){r.tier=nextTier;r.tierAge=0;}
 if(note){note.status=ok?'hit':'miss';s.attempts++;s.success+=ok?1:0;s.outcomes.push(ok);}else r.extraPresses++;
 if(!ok)s.failures++;
 s.hit=true;s.beatSuccess=ok;s.message=ok?(Math.abs(delta)<=PERFECT?'PERFECT':'GOOD'):'MISS';s.feedbackLeft=.42;
 s.hitEffect={x:1,y:2,ok,age:0};s.shakeEffects.push({...s.hitEffect,id:++r.serial,lane:note?.lane??0});
 if(s.attempts>=s.targetStacks)s.completed=true;
}
function expire(s){if(s.rhythm.mode==='path')return;for(const n of s.rhythm.notes)if(!n.status&&(s.rhythm.trackTime-n.time)/noteSpeed(s.rhythm.tier)>WINDOW+1e-8)feedback(s,false,n);}
function input(s,key){
 if(s.rhythm.mode==='path')return pathInput(s,key);
 const lane=keys[key];if(lane==null&&key!=='Space')return false;
 if(!s.started){s.started=true;return true;}
 if(key==='Space')return false;
 expire(s);if(s.completed)return true;
 const n=s.rhythm.notes.find(n=>!n.status),delta=n?(s.rhythm.trackTime-n.time)/noteSpeed(s.rhythm.tier):Infinity;
 if(n&&Math.abs(delta)<=WINDOW+1e-8)feedback(s,n.lane===lane,n,delta);
 else feedback(s,false,null);
 return true;
}
function visual(s,dt){const r=s.rhythm;r.uiAge+=dt;r.tierAge+=dt;if(r.playing&&!s.completed){r.clock+=dt*motionSpeed(r.tier);const clip=[1,2,3,0,5,6,7,4];s.motionFrame=clip[Math.floor(r.clock/.125)%clip.length];}}
function attach(g,getMode=()=> 'fall'){
 const next=g.nextGimmick.bind(g),hit=g.gimmickInput.bind(g),tick=g.tickGimmick.bind(g),end=g.endGimmick.bind(g);
 g.nextGimmick=function(){const out=next();if(this.gimmick?.type==='shake'&&!this.gimmick.rhythm)init(this.gimmick,getMode());return out;};
 g.gimmickInput=function(key){const s=this.gimmick;if(!s?.rhythm)return hit(key);if(this.screen!=='gimmick'||this.isPaused()||s.completed||this.remix?.hold)return false;const out=input(s,key);if(out)this.changed();return out;};
 g.tickGimmick=function(dt){const s=this.gimmick;if(!s?.rhythm)return tick(dt);if(this.isPaused())return;
  root.LunaCore.MIX.visual(s,dt);
  if(s.completed){s.rhythm.doneAge+=dt;if(s.rhythm.doneAge>=.7&&!this.remix?.hold)this.endGimmick();return;}
  if(!s.started)return;s.elapsed+=dt;this.craft.elapsed+=dt;s.rhythm.trackTime+=dt*noteSpeed(s.rhythm.tier);if(s.rhythm.mode==='path')updatePath(s,this.rng);else expire(s);
 };
 g.endGimmick=function(){if(this.gimmick?.rhythm&&!this.gimmick.completed)return false;return end();};
 return {select(mode){const s=g.gimmick;if(!MODES.includes(mode)||!s?.rhythm||s.started||g.isPaused())return false;const age=s.rhythm.uiAge;init(s,mode);s.rhythm.uiAge=age;g.changed();return true;}};
}
const names={fall:['세로 2레인','Falling lanes'],path:['왕복 노드','Round-trip nodes'],cross:['중앙 교대','Meet in the middle']};
const pathAt=(x,y)=>[102+x*90,32+y*90];
function pathStage(s){
 const m=root.LunaCore.MIX,r=s.rhythm,nearest=s.started&&!s.completed?m.nearest(s):null;
 const nodes=[...s.nodes,...m.points.map(([x,y],i)=>({x,y,id:'fixed:'+i,fixed:true}))];
 const route=m.points.map(p=>pathAt(...p).join(',')).join(' ');
 let html='<polyline class="rhythm-path-route" points="'+route+'"/>';
 html+=nodes.map(n=>{const [x,y]=pathAt(n.x,n.y);return '<g data-path-node="'+n.id+'" class="rhythm-path-node '+(nearest?.id===n.id?'in-range':'')+'" transform="translate('+x+' '+y+')"><circle class="path-range" r="'+(m.radius*90)+'"/><circle class="path-core" r="'+(n.fixed?8:6)+'"/></g>';}).join('');
 for(const e of s.shakeEffects){const [x,y]=pathAt(e.x,e.y),t=Math.min(1,e.age/.5);html+='<g class="rhythm-burst '+(e.ok?'hit':'miss')+'" transform="translate('+x+' '+y+')" opacity="'+(1-t)+'" style="color:'+(e.ok?'#c7f5ff':'#df7e8d')+'"><circle r="'+(15+t*40)+'"/>'+(e.ok?'':'<path d="M-7 -7L7 7M-7 7L7 -7"/>')+'</g>';}
 if(s.started&&!s.completed)for(let i=1;i<=4;i++){const time=Math.max(0,r.trackTime-m.delay-i*.035),index=Math.floor(time),t=time-index,a=m.points[m.route[index%6]],b=m.points[m.route[(index+1)%6]],p=pathAt(a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t);html+='<circle class="rhythm-path-trail" cx="'+p[0]+'" cy="'+p[1]+'" r="'+(8-i)+'" opacity="'+(.36-i*.06)+'"/>';}
 const [x,y]=pathAt(...s.pathPoint);return html+'<circle class="rhythm-path-marker" data-path-marker cx="'+x+'" cy="'+y+'" r="9"/>';
}
function stage(s){
 if(s.rhythm.mode==='path')return pathStage(s);
 const r=s.rhythm,mode=r.mode,color=l=>l?'#eddbab':'#8ee8ff',label=l=>l?'D':'A';
 const pos=n=>{const t=(n.time-r.trackTime)/LEAD;return mode==='fall'?[n.lane?290:150,345-t*320]:[220+(n.lane?1:-1)*t*210,215];};
 const pulse=s.started&&!s.completed?(1-(r.trackTime%BEAT)/BEAT):0;
 const target=(x,y)=>'<g class="rhythm-target" transform="translate('+x+' '+y+')"><circle class="target-halo" r="44" opacity="'+(.12+pulse*.13).toFixed(2)+'"/><circle class="target-orbit" r="35"/><circle class="target-face" r="26"/><path class="target-ticks" d="M0 -39v5M0 39v-5M-39 0h5M39 0h-5"/><circle class="target-center" r="3"/></g>';
 let lines=mode==='fall'?'<path class="rhythm-track" d="M150 18V370M290 18V370"/><path class="rhythm-rail" d="M104 25V359M196 25V359M244 25V359M336 25V359"/><path class="rhythm-judge" d="M79 345H361"/>'+target(150,345)+target(290,345):'<path class="rhythm-track" d="M12 215H428"/><path class="rhythm-rail" d="M15 181H425M15 249H425"/>'+target(220,215);
 const marks=mode==='fall'?Array.from({length:9},(_,i)=>'<path d="M214 '+(42+i*33)+'h12"/>').join(''):Array.from({length:13},(_,i)=>'<path d="M'+(22+i*33)+' 269v4"/>').join('');
 lines+='<g class="rhythm-ruler">'+marks+'</g>';
 if(mode!=='fall')lines+='<g class="rhythm-direction">'+'<path d="M148 153l6 5-6 5M292 153l-6 5 6 5"/>'+'</g>';
 let speedFx='';
 if(r.tier&&!s.completed){
  const count=r.tier===2?8:4;
  for(let i=0;i<count;i++){
   const phase=(r.trackTime*.7+i*.173)%1,fade=Math.sin(phase*Math.PI)*.28;
   if(mode==='fall'){const x=[25,60,380,415][i%4];const y=25+phase*340;speedFx+='<path d="M'+x+' '+y.toFixed(2)+'v-'+(18+r.tier*12)+'" opacity="'+fade.toFixed(3)+'"/>';}
   else {const y=i%2?285:145,x=i%4<2?10+phase*210:430-phase*210,dx=i%4>=2?30:-30;speedFx+='<path d="M'+x.toFixed(2)+' '+y+'h'+dx+'" opacity="'+fade.toFixed(3)+'"/>';}
  }
 }
 const notes=r.notes.filter(n=>!n.status&&n.time-r.trackTime<=LEAD+.12).map(n=>{const [x,y]=pos(n),body=mode==='fall'?'<rect x="-43" y="-15" width="86" height="30" rx="3"/>':n.lane?'<path d="M0 -24L24 0L0 24L-24 0Z"/>':'<circle r="22"/>';
  const tail=r.tier&&!s.completed?'<path class="rhythm-note-tail" d="'+(mode==='fall'?'M0 -19v-'+(28*r.tier):'M'+((n.lane?1:-1)*27)+' 0h'+((n.lane?1:-1)*28*r.tier))+'"/>':'';
  return '<g data-rhythm-note="'+n.id+'" transform="translate('+x.toFixed(2)+' '+y.toFixed(2)+')" style="color:'+color(n.lane)+'">'+tail+'<g class="note-aura">'+body+'</g><g class="note-body">'+body+'</g><path class="note-shine" d="'+(mode==='fall'?'M-34 -10H34':n.lane?'M-13 -4L0 -17L13 -4':'M-13 -10Q0 -23 13 -10')+'"/><text y="6">'+label(n.lane)+'</text></g>';}).join('');
 let fx='';for(const e of s.shakeEffects.filter(e=>e.age<.5)){
  const x=mode==='fall'?(e.lane?290:150):220,y=mode==='fall'?345:215,t=e.age/.5,alpha=1-t,c=e.ok?(s.message==='PERFECT'?'#ecfbff':'#8eddeb'):'#df7e8d';
  let spark='';if(e.ok)for(let i=0;i<8+r.tier*4;i++){const angle=i*Math.PI*2/(8+r.tier*4)+e.id*.45,d=28+60*t,dx=Math.cos(angle)*d,dy=Math.sin(angle)*d;spark+='<path d="M'+dx.toFixed(2)+' '+dy.toFixed(2)+'l'+(Math.cos(angle)*7*(1-t)).toFixed(2)+' '+(Math.sin(angle)*7*(1-t)).toFixed(2)+'"/>';}
  fx+='<g class="rhythm-burst '+(e.ok?'hit':'miss')+'" transform="translate('+x+' '+y+')" opacity="'+alpha+'" style="color:'+c+'"><circle r="'+(27+t*61)+'"/><circle class="burst-inner" r="'+(22+t*27)+'"/>'+spark+(e.ok?'<circle class="burst-core" r="'+(22*(1-t))+'"/>':'<path d="M-9 -9L9 9M-9 9L9 -9"/>')+'</g>';
 }
 return lines+'<g class="rhythm-speed-lines">'+speedFx+'</g>'+notes+fx;
}
// Driven by the paused game clock, not CSS time; only the combo display emits flames.
function comboFire(r){
 if(!r.tier)return '';
 const hot=r.tier===2,t=r.uiAge*(hot?4.5:3),outer=hot?'#ff773a':'#eca75f',inner=hot?'#ffd975':'#ffe6a2';let flames='';
 for(let i=0;i<(hot?7:4);i++){
  const x=16+i*(hot?10:17),wave=Math.sin(t+i*1.9),height=(hot?40:24)+(i%3)*5+wave*5,w=hot?12:10,tip=x+Math.sin(t*1.2+i)*7,y=76-height;
  flames+='<path class="combo-flame" fill="'+outer+'" opacity="'+(hot?.48:.34)+'" d="M'+(x-w)+' 78 Q'+(x-w-5)+' 65 '+(x-4)+' 55 Q'+(x+7)+' '+(y+15)+' '+tip+' '+y+' Q'+(x+20)+' '+(y+20)+' '+(x+w)+' 62 Q'+(x+w+7)+' 79 '+(x-w)+' 78Z"/>';
  flames+='<path fill="'+inner+'" opacity=".52" d="M'+(x-5)+' 78 Q'+(x-10)+' 65 '+x+' '+(y+17)+' Q'+(x+2)+' 61 '+(x+6)+' 71 L'+(x+5)+' 78Z"/>';
 }
 let sparks='';for(let i=0;i<(hot?7:3);i++){const p=(r.uiAge*(hot?.75:.5)+i*.173)%1,x=12+i*11+Math.sin(i+r.uiAge*2)*5;sparks+='<circle cx="'+x.toFixed(2)+'" cy="'+(71-p*64).toFixed(2)+'" r="'+(hot?1.5:1)+'" fill="'+inner+'" opacity="'+((1-p)*.8).toFixed(2)+'"/>';}
 const burst=r.tierAge<.65?'<ellipse class="combo-ignition" cx="45" cy="57" rx="'+(22+r.tierAge*55)+'" ry="'+(17+r.tierAge*40)+'" fill="none" stroke="'+inner+'" stroke-width="1" opacity="'+(1-r.tierAge/.65)+'"/>':'';
 return flames+sparks+burst;
}
function popup(s,L){const show=!s.started&&s.rhythm.uiAge<4,alpha=Math.min(1,s.rhythm.uiAge/.2,Math.max(0,(4-s.rhythm.uiAge)/.65));return '<div class="rhythm-intro" '+(!show?'hidden':'')+' style="opacity:'+alpha.toFixed(3)+'"><button data-act="gimmickInput" class="rhythm-start"><kbd>SPACE</kbd><span>'+L('쉐이킹 시작','Start shaking')+'</span></button></div>';}
function board(s,L){
 const r=s.rhythm,mode=r.mode;
 return '<section class="mix-board rhythm-board" data-rhythm-mode="'+mode+'"><nav class="rhythm-modes" aria-label="'+L('쉐이킹 방식','Shaking style')+'">'+MODES.map((id,i)=>'<button data-act="shakeMode" data-id="'+id+'" aria-pressed="'+(mode===id)+'" '+(s.started?'disabled':'')+'><small>0'+(i+1)+'</small>'+L(...names[id])+'</button>').join('')+'</nav>'+
 '<div class="rhythm-score"><div class="rhythm-combo-wrap"><svg class="rhythm-combo-fire" viewBox="0 0 100 100" aria-hidden="true"></svg><b data-rhythm-combo>'+r.combo+'</b><span>COMBO</span><small class="rhythm-heat-label" data-rhythm-heat></small></div><span data-rhythm-count>'+s.attempts+' <em>/ '+s.targetStacks+'</em></span><div class="rhythm-verdict" data-rhythm-verdict></div></div>'+
 '<svg class="rhythm-stage" '+(mode==='path'?'data-shake-surface':'')+' viewBox="0 0 440 410" role="img" aria-label="'+(mode==='path'?L('이동점이 노드와 겹칠 때 클릭 또는 Space','Click or press Space when the marker overlaps a node'):L('노드가 판정선에 닿으면 A 또는 D','Press A or D when notes reach the target'))+'">'+stage(s)+'</svg>'+
 '<div class="rhythm-bottom"><div class="rhythm-progress">'+r.notes.map(n=>'<i data-rhythm-result="'+n.id+'" class="'+(n.status||'')+'"></i>').join('')+'</div><div class="rhythm-pads">'+(mode==='path'?'<button data-act="rhythmHit" data-id="Space" '+(s.completed?'disabled':'')+' aria-label="'+L('클릭 또는 Space로 노드 맞히기','Hit a node with click or Space')+'"><kbd>SPACE</kbd></button>':[0,1].map(l=>'<button data-act="rhythmHit" data-id="'+(l?'KeyD':'KeyA')+'" '+(s.completed?'disabled':'')+' class="rhythm-pad lane-'+l+'" aria-label="'+L(l?'오른쪽 입력 D':'왼쪽 입력 A',l?'Right input D':'Left input A')+'"><kbd>'+(l?'D':'A')+'</kbd><span aria-hidden="true">'+(l?'◆':'●')+'</span></button>').join(''))+'</div></div>'+popup(s,L)+'<div class="rhythm-count-in" data-rhythm-count-in></div><div class="rhythm-finish" data-rhythm-finish hidden></div></section>';
}
function sync(host,g){const s=g.gimmick;if(!s?.rhythm)return;const board=host.querySelector('.rhythm-board');if(!board)return;const L=(a,b)=>g.lang==='ko'?a:b,r=s.rhythm;
 board.dataset.comboTier=r.tier;board.dataset.noteSpeed=noteSpeed(r.tier);board.dataset.motionSpeed=motionSpeed(r.tier);board.querySelector('.rhythm-combo-fire').innerHTML=comboFire(r);board.querySelector('[data-rhythm-heat]').textContent=r.tier===2?'HEAT II':r.tier===1?'HEAT I':'';
 board.querySelector('.rhythm-stage').innerHTML=stage(s);board.querySelector('[data-rhythm-combo]').textContent=r.combo;
 board.querySelector('[data-rhythm-count]').innerHTML=s.attempts+' <em>/ '+s.targetStacks+'</em>';
 const verdict=board.querySelector('[data-rhythm-verdict]'),last=s.shakeEffects.at(-1),age=last?.age??1,impact=s.beatSuccess?Math.max(0,1-age/.28):0;
 verdict.textContent=s.feedbackLeft?s.message:'';verdict.classList.toggle('miss',!s.beatSuccess);verdict.style.opacity=String(Math.min(1,s.feedbackLeft/.16));
 const surge=r.tier&&r.tierAge<.7?Math.sin(Math.PI*r.tierAge/.7):0;const screen=host.querySelector('.shake-screen');screen.dataset.rhythmTier=r.tier;screen.style.setProperty('--rhythm-surge',surge.toFixed(3));
 board.style.setProperty('--rhythm-impact',impact.toFixed(3));board.style.setProperty('--rhythm-heat',Math.min(1,r.combo/10).toFixed(3));
 const intro=board.querySelector('.rhythm-intro');intro.hidden=s.started||r.uiAge>=4;intro.style.opacity=String(Math.min(1,r.uiAge/.2,Math.max(0,(4-r.uiAge)/.65)));
 const count=board.querySelector('[data-rhythm-count-in]');count.textContent=r.mode!=='path'&&s.started&&s.elapsed<LEAD?String(3-Math.floor(s.elapsed/BEAT)):'';
 const finish=board.querySelector('[data-rhythm-finish]');finish.hidden=!s.completed;finish.textContent=s.success===s.targetStacks&&!r.extraPresses?'ALL CLEAR':L('쉐이킹 완료','SHAKE COMPLETE');
 board.querySelectorAll('[data-rhythm-result]').forEach(el=>{el.className=r.notes[Number(el.dataset.rhythmResult)].status||'';});
 host.querySelector('.shake-screen').dataset.rhythmPlaying=String(r.playing&&!s.completed);
}
const api={MODES,WINDOW,PERFECT,normalizeMode,updatePath,comboTier,motionSpeed,noteSpeed,init,input,expire,visual,attach,board,sync};root.LunaShakeRhythm=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window==='undefined'?globalThis:window);
