/* Small blockout stage: original character sheets, shared bubble skin and punctuation clock. */
(function(W){
'use strict';
const names={luna:'루나',chris:'크리스','home-chris':'크리스',tom:'톰',johnny:'조니',yuna:'유나',boobi:'부비',shiba:'개시바',repair:'수리공',neighbor:'옆집 아저씨',guard:'갱단 경비',boss:'갱단 보스',gangmate:'갱단원','street-newspaper':'신문 읽는 남자','street-believer':'기신교 신도','day1-corridor-thug':'복도 불량배','day2-corridor-thug':'옆집 아저씨'};
const A=W.LunaOutsideAmbient,D=W.LUNA_OUTSIDE_DATA;
const kinds={...A.roleKinds,'street-newspaper':'M2','street-believer':'M1','luna':'luna','shiba':'shiba'};
Object.assign(kinds,Object.fromEntries(A.placements.map(p=>[p.id,p.kind])),{'street-beggar':'M2','street-beggar-witness':'M1','resident-left':'M2','resident-right':'W1','commute-pair-left':'M1','commute-pair-right':'M2','reopening-pair-left':'M1','reopening-pair-right':'W1','trade-smuggler':'M1','contract-smuggler':'M1','trade-samho':'samho','contract-samho':'samho',samho:'samho','day2-thug-information':'Neighbor'});
Object.assign(names,{'street-beggar':'노숙자','street-beggar-witness':'근처 행인','resident-left':'주민 1','resident-right':'주민 2','store-pair-left':'행인 1','store-pair-right':'행인 2','bar-pair-left':'행인 1','bar-pair-right':'행인 2','commute-pair-left':'행인 1','commute-pair-right':'행인 2','reopening-pair-left':'행인 1','reopening-pair-right':'행인 2','trade-smuggler':'밀수업자','contract-smuggler':'밀수업자','trade-samho':'삼호','contract-samho':'삼호',samho:'삼호',tv:'TV',sign:'전단지',port:'포트',aili:'아일리'});
const catalog=[{id:'luna',name:'루나',animations:['idle','walk','run']},{id:'shiba',name:'개시바',animations:['idle']},...Object.entries(A.sheets).map(([id,s])=>({id,name:s.label,animations:['idle']}))];
catalog.push({id:'samho',name:'삼호',animations:['idle']});
const label=id=>names[id]||id||'연출';
function create({onComplete,onChoice}){
 const $=id=>document.getElementById(id),canvas=$('actors'),ctx=canvas.getContext('2d'),images=new Map();let state=null,start=0,ended=false,popupUntil=0;
 W.LunaExteriorTextbox.attach($('speech'));
 const choiceUI=W.LunaWorldChoices.create($('preview-choices'),id=>onChoice(state.choices.find(c=>c.id===id)),{inputScope:$('preview-stage')});
 function updateChoices(){const box=$('preview-choices'),scale=$('preview-stage').clientWidth/1280;box.style.transform='scale('+scale+')';choiceUI.update(state?.choices?.length?{key:state.key,options:state.choices.map(c=>({...c,disabledReason:c.reason})),rejectUnavailable:true,entryGuardMs:500,head:{x:980,y:270},facing:1}:null);}
 new ResizeObserver(updateChoices).observe($('preview-stage'));
 $('preview-stage').addEventListener('keydown',e=>{if(!e.defaultPrevented)choiceUI.key(e);});
 function image(src){if(!images.has(src)){const im=new Image();im.src=src;images.set(src,im);}return images.get(src);}
 function sprite(kind,anim,t){t=Math.max(0,t);if(kind==='luna'||kind==='shiba'||kind==='samho'){const a=D.animations[kind==='shiba'?'shiba':kind==='samho'?'samhoIdle':anim]||D.animations.idle,sp=a.frames[Math.floor(t*a.fps)%a.frames.length];return{...sp,src:D.assets[sp.asset].src};}const sheet=A.sheets[kind];return sheet?{x:Math.floor(t*sheet.frames/.75)%sheet.frames*129,y:0,w:129,h:138,foot:114,src:sheet.src}:null;}
 function show(payload){state=payload;start=performance.now();ended=false;const row=payload.row,text=row['text.ko']||'';state.timing=W.LunaDialogueRhythm.timing(text,55);state.cast=[...new Set(payload.rows.map(r=>r.actor).filter(Boolean))];if(!state.cast.includes('luna'))state.cast.unshift('luna');if(state.cast.length>5)state.cast=[row.actor,...state.cast.filter(a=>a!==row.actor)].slice(0,5);
  $('speech').hidden=!text;$('speaker').textContent=row.who||label(row.actor);W.LunaExteriorTextbox.mountText($('speech-text'),text);W.LunaExteriorTextbox.revealText($('speech-text'),payload.animate?0:Array.from(text).length);
  const speakerIndex=state.cast.indexOf(row.actor),x=state.cast.length<=1?50:23+Math.max(0,speakerIndex)*54/(state.cast.length-1);$('speech').style.left=Math.max(26,Math.min(74,x))+'%';
  $('stage-caption').textContent=payload.castNote||'화자·배치 확인용 / 본편 배경과 이동 연출은 생략';
  updateChoices();
  $('notice').hidden=true;
  if(row.action?.includes('grant-gear'))notice('아이템 획득','기어 부품 획득!');else if(row.action?.includes('grant-emblem'))notice('아이템 획득','기신교의 엠블럼 획득!');else if(row.action==='wild-dog-grant')notice('재료 획득','와일드 독 추가!','wild_dog');else if(row.type==='shop-allowance-grant')notice('수입','+500원');else if(row.action==='repair')notice('목표 달성','엘리베이터 수리!');
 }
 function notice(title,text,item){const el=$('notice');el.replaceChildren();const src=state?.assets?.['recipe_item_'+item]?.src||state?.assets?.['item_'+item]?.src;if(src){const img=document.createElement('img');img.src=src;img.alt='';el.append(img);}const box=document.createElement('div'),small=document.createElement('small'),strong=document.createElement('div');small.textContent=title+' · 미리보기';strong.textContent=text;box.append(small,strong);el.append(box);el.hidden=false;popupUntil=performance.now()+2800;}
 function draw(now){requestAnimationFrame(draw);if(!state||document.hidden)return;const t=(now-start)/1000;ctx.clearRect(0,0,1000,480);ctx.fillStyle='#06090d';ctx.fillRect(0,0,1000,480);ctx.strokeStyle='#15232d';ctx.lineWidth=1;for(let x=0;x<1000;x+=80){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,480);ctx.stroke();}for(let y=60;y<480;y+=60){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(1000,y);ctx.stroke();}ctx.strokeStyle='#385260';ctx.strokeRect(80,80,150,320);ctx.strokeRect(720,135,170,265);ctx.beginPath();ctx.moveTo(0,400);ctx.lineTo(1000,400);ctx.stroke();
  const selected=state.row.actor;for(const [i,actor]of state.cast.entries()){const cfg=state.profiles?.[actor]||{},kind=cfg.kind||kinds[actor],x=state.cast.length===1?500:230+i*(540/(state.cast.length-1)),flip=cfg.facing==='left'?false:cfg.facing==='right'?true:x<500;const sp=sprite(kind,cfg.animation||'idle',t*(cfg.speed??1));
   ctx.save();ctx.translate(x,400);if(sp){const im=image(sp.src);if(im.complete&&im.naturalWidth){const scale=kind==='shiba'?3:kind==='luna'?3:2.4,foot=sp.foot??(kind==='luna'?80:sp.h);ctx.imageSmoothingEnabled=false;ctx.scale(flip?-1:1,1);ctx.drawImage(im,sp.x,sp.y,sp.w,sp.h,-sp.w*scale/2,-foot*scale,sp.w*scale,sp.h*scale);}}
   else{ctx.strokeStyle='#58707c';ctx.beginPath();ctx.arc(0,-128,22,0,Math.PI*2);ctx.stroke();ctx.strokeRect(-25,-104,50,82);ctx.fillStyle='#78929e';ctx.font='12px sans-serif';ctx.textAlign='center';ctx.fillText('시트 미등록',0,-158);}
   ctx.restore();ctx.textAlign='center';ctx.font=(actor===selected?'bold ':'')+'16px sans-serif';ctx.fillStyle=actor===selected?'#8be3e8':'#869ba7';ctx.fillText(label(actor),x,433);if(actor===selected){ctx.strokeStyle='#65b2be';ctx.beginPath();ctx.ellipse(x,402,44,7,0,0,Math.PI*2);ctx.stroke();}}
  if(state.animate){const count=W.LunaDialogueRhythm.visible(state.timing,t);W.LunaExteriorTextbox.revealText($('speech-text'),count);if(!ended&&!(state.choices?.length)&&t>=state.timing.duration+1.2){ended=true;onComplete();}}
  if(now>popupUntil)$('notice').hidden=true;
 }
 requestAnimationFrame(draw);return{show,notice,catalog,label,end(){if(state){state.animate=false;state.choices=[];}choiceUI.update(null);$('speech').hidden=true;},stop(){if(state)state.animate=false;}};
}
W.LunaOutsideEditorPreview={create,catalog,label,kinds};
})(window);
