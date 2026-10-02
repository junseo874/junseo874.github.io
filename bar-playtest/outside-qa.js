/* Isolated Day 99 runtime stage; no city/home background or prerendered cinema. */
(function(W){
'use strict';
const labels=Object.fromEntries(W.LunaOutsideContent.events.map(e=>[e.id,e.label]));
let liftLogo=null;
const scenes={commute2:'2일차 출근길 · 삼호',commute3:'3일차 출근길 · 삼호',workshop:'포트 작업장 · 대화',night0:'0일차 집·테라스 · 크리스',night1:'1일차 테라스 · 조니의 재료 단서',ending:'3일차 테라스 · 마지막 대화'};
function catalog(){return [
 ...Object.keys(W.LUNA_OUTSIDE_DIALOGUES).map(id=>{const e=W.LunaOutsideEncounters.cases.find(c=>c.id===id);return{id,label:labels[id]||(e?.kind==='pair'?'NPC끼리 대화':'NPC와 대화')+' · '+id.replace('demo_out_',''),source:id,auto:!!W.LunaOutsideContent.events.find(c=>c.id===id)?.auto,encounter:e,note:W.LunaOutsideContent.events.find(e=>e.id===id)?.persistent?'모든 일차 · 출근길/퇴근길':'노션 외부 이야기 · 0일차 퇴근길'};}),
 ...[{id:'shop:first',label:'시BAR · 첫 대화',shop:true,first:true},{id:'shop:repeat',label:'시BAR · 재방문·구매 선택',shop:true,first:false}].map(c=>({...c,note:'1일차 퇴근길부터 · QA 구매는 본편 소지금에 영향 없음'})),
 ...Object.entries(scenes).filter(([id])=>W.LUNA_CAMPAIGN_DATA.scenes[id]?.length).map(([key,label])=>({id:'runtime:'+key,label,scene:key,note:'대사 원문 + QA 접근·카메라 스테이징 (완성 컷씬 아님)'})),
 ...[['lift-up','엘리베이터 · 탑승·상승'],['lift-down','엘리베이터 · 하강'],['lift-call','엘리베이터 · 빈 승강기 호출'],['lift-logo','0일차 첫 상승 · 로고 타이밍'],['home-in','집 문 · 입장 전환'],['home-out','집 문 · 퇴장 전환'],['bar-in','바 입구 · 안내'],['sofa','소파 · 상호작용'],['terrace','테라스 문 · 상호작용']].map(([id,label])=>({id,label,physical:true,note:'실제 이동·전환 로직 / 본편 일차 전환 없이 반복'}))
 ];}
function init(m,options){if(m.config.day!==99){m.qa=null;return;}const c=catalog().find(c=>c.id===options.qaCase)||catalog()[0];m.qa={caseId:c.id,activation:options.qaActivation||'source',triggered:false,inRange:false,done:false,runtime:null,camera:null,people:[],events:[]};m.scene='street';m.level=0;m.x=-1.15;m.y=-.7;m.elevatorY=W.LunaResidence.layout.elevatorBottom;m.facing=1;m.notionCommuteSeen=true;
 const r=W.LunaResidence.layout;
 if(c.id.startsWith('lift-')){m.x=r.elevatorX-.8;if(c.id==='lift-down'){m.level=1;m.y=r.upperY;m.elevatorY=r.elevatorTop;}if(c.id==='lift-call')m.elevatorY=r.elevatorTop;}
 if(c.id==='home-in'){m.level=1;m.y=r.upperY;m.x=r.homeX-.7;m.elevatorY=r.elevatorTop;}
 if(c.id==='home-out'){m.scene='home';m.level=1;m.x=-.9;}
 if(c.id==='sofa'||c.id==='terrace'){m.scene='home';m.level=1;m.x=c.id==='sofa'?1.85:2.65;}
 const rows=c.shop?W.LunaOutsideShop.intro:c.source?W.LUNA_OUTSIDE_DIALOGUES[c.source]:c.scene?W.LUNA_CAMPAIGN_DATA.scenes[c.scene]:[];
 const ids=[...new Set(rows.filter(r=>r.actor&&!['luna','narrator','sign'].includes(r.actor)).map(r=>r.actor))];m.qa.people=ids.map((id,i)=>({id,name:W.LunaOutsideEncounters.actor(id)?.name||rows.find(r=>r.actor===id)?.who||W.barGame?.name(id)||id,x:.1+i*.65,y:-.7,kind:['M1','M2','W1'][i%3]}));
}
function target(m){const c=catalog().find(c=>c.id===m.qa.caseId),r=W.LunaResidence.layout;let id='qa-event',x=0,y=-.7;
 if(c.id.startsWith('lift-')){id='elevator';x=r.elevatorX;y=m.level?r.upperY:-.7;}
 if(c.id==='home-in'||c.id==='home-out'){id=m.scene==='home'?'exit':'home';x=m.scene==='home'?-1.581:r.homeX;y=m.scene==='home'?-.7:r.upperY;}
 if(c.id==='bar-in'){id='bar';x=1.0086;}
 if(c.id==='sofa'){id='sofa';x=2.557;}
 if(c.id==='terrace'){id='terrace';x=3.364;}
 return{id,x,y,label:c.label,qa:true};}
function isAuto(m){const c=catalog().find(c=>c.id===m.qa.caseId);return !c.physical&&(m.qa.activation==='proximity'||m.qa.activation==='source'&&c.auto);}
function targets(m){return isAuto(m)?[]:[target(m)];}
function begin(m){const c=catalog().find(c=>c.id===m.qa.caseId),t=target(m);m.story.cancel();m.backgroundStory.cancel();m.qa.done=false;m.qa.triggered=true;m.qa.events.push({event:'begin',time:m.time,id:c.id});
 if(c.shop){m.qa.shopProgress={money:W.LunaBDVendor.balance(),flags:{},inventory:{}};W.LunaOutsideShop.begin(m,t,c.first);return;}
 const automatic=isAuto(m),rows=(c.source?W.LUNA_OUTSIDE_DIALOGUES[c.source]:W.LUNA_CAMPAIGN_DATA.scenes[c.scene]).flatMap(r=>r.cinemaAfter==='terrace-memory'?[r,...W.LUNA_CAMPAIGN_DATA.scenes.terraceMemory]:[r]).map(r=>({...r,type:r.type||'say'}));
 const start=()=>{m.qa.runtime=null;m.story.beginRows(c.id,{...t,qa:true},rows,automatic);};
 if(automatic){start();return;}
 m.qa.camera={x:-.2,y:-.12,w:3.6};m.qa.runtime={elapsed:0,from:m.x,to:-.65,start};
}
function interact(m,t){if(!m.qa||t.id!=='qa-event')return false;begin(m);return true;}
function tick(m,dt){const q=m.qa;if(!q)return false;
 if(q.runtime){const r=q.runtime;r.elapsed+=dt;const p=Math.min(1,r.elapsed/.65);m.x=r.from+(r.to-r.from)*(p*p*(3-2*p));m.facing=m.x<0?1:-1;m.anim=p<1?'walk':'idle';m.animTime+=dt;m.time+=dt;if(p===1)r.start();return true;}
 if(q.triggered&&!q.done&&!m.story.speech&&!m.ride){q.done=true;q.camera=null;q.events.push({event:'complete',time:m.time,id:q.caseId});}
 const t=target(m),distance=Math.abs(m.x-t.x);if(distance>1.45)q.inRange=false;
 if(isAuto(m)&&distance<.95&&!q.inRange&&!m.story.speech&&!m.dialog){q.inRange=true;begin(m);}
 return false;
}
function anchor(m,actor,t){const p=m.qa.people.find(p=>p.id===actor);return actor==='luna'?{x:m.x,y:m.y+.38}:p?{x:p.x,y:p.y+(p.id==='samho'?.65:p.id==='shiba'?.3:.33)}:{x:t.x,y:t.y+.7};}
function draw({m,ctx,position,sprite,data,player}){const q=m.qa,c=catalog().find(c=>c.id===q.caseId),r=W.LunaResidence.layout;
 ctx.fillStyle='#09111b';ctx.fillRect(0,0,1280,720);
 const floor=(y,left=-100,right=100)=>{const a=position(left,y),b=position(right,y);ctx.fillStyle='#152938';ctx.fillRect(a.x,a.y,b.x-a.x,720);ctx.fillStyle='#68a6ac';ctx.fillRect(a.x,a.y,b.x-a.x,2);for(let x=-40;x<40;x++){const p=position(x,y);ctx.fillStyle='#223d4b';ctx.fillRect(p.x,p.y+2,1,720);}};
 floor(-.974);if(m.level||m.ride)floor(r.upperY-.274,r.upperMin,r.elevatorX-.4);
 const box=(x,y,w,h,label)=>{const p=position(x,y),end=position(x+w,y+h);ctx.fillStyle='#173642';ctx.fillRect(p.x,end.y,end.x-p.x,p.y-end.y);ctx.strokeStyle='#6fc5cd';ctx.lineWidth=1;ctx.strokeRect(p.x,end.y,end.x-p.x,p.y-end.y);ctx.fillStyle='#b7dfde';ctx.font='15px sans-serif';ctx.textAlign='center';ctx.fillText(label,(p.x+end.x)/2,end.y-12);};
 if(c.id.startsWith('lift-')){data.scenes.street.nodes.filter(n=>n.name==='Elevator Line'||n.name==='Elevator').forEach(n=>sprite(n.sprite,n.x,n.y+(n.name==='Elevator'?m.elevatorY-r.elevatorBottom:0),n.sx,n.sy));}
 else if(c.physical){const t=target(m);box(t.x-.25,t.y-.274,.5,.9,t.label);}
 else if(W.LunaOutsideContent.events.some(e=>e.id===c.source&&e.kind==='object')){const e=W.LunaOutsideContent.events.find(e=>e.id===c.source),n=data.scenes.street.nodes.find(n=>n.name===e.node);if(n)sprite(n.sprite,0,-.45,1,1);}
 for(const p of q.people){if(p.id==='shiba'){const a=data.animations.shiba;sprite(a.frames[Math.floor(m.time*a.fps)%a.frames.length],p.x,-.6);continue;}if(p.id==='samho'){const n=data.scenes.street.nodes.find(n=>n.name==='Samho');sprite({...n.sprite,x:(m.time%4<.3?Math.floor(m.time*10)%3:0)*84},p.x,p.y,1,1,W.LunaOutsideAmbient.faceTarget(p.x,m.x));continue;}
 const original=W.LunaOutsideEncounters.actor(p.id),kind=original?.kind||p.kind,sp={asset:'ambient-'+kind,x:(Math.floor(m.time*3.5)%6)*129,y:0,w:129,h:138,pivot:{x:.5,y:24/138},ppu:100};const partner=c.encounter?.kind==='pair'?q.people.find(other=>other.id!==p.id&&c.encounter.members.includes(other.id)):null;sprite(sp,p.x,-.974,1,1,W.LunaOutsideAmbient.faceTarget(p.x,partner?.x??m.x));const at=position(p.x,-.2);ctx.fillStyle='#a0bdc9';ctx.font='12px sans-serif';ctx.textAlign='center';ctx.fillText(p.name+(original?'':' · 외부 포즈 임시'),at.x,at.y);}
 player();
 if(c.id.startsWith('lift-'))data.scenes.street.nodes.filter(n=>n.name==='Elevator Fore'||n.name==='Elevator Door').forEach(n=>sprite(n.sprite,n.x,n.y+m.elevatorY-r.elevatorBottom,n.sx,n.sy));
 if(c.id==='lift-logo'&&m.ride&&m.ride.time>3&&m.ride.time<10){ctx.save();ctx.globalAlpha=Math.min(1,(m.ride.time-3)/1.5,(10-m.ride.time)/1.5);if(!liftLogo){liftLogo=new Image();liftLogo.src='assets/campaign/title-logo.png';}if(liftLogo.complete&&liftLogo.naturalWidth){const width=340,height=width*liftLogo.naturalHeight/liftLogo.naturalWidth;ctx.drawImage(liftLogo,640-width/2,210-height/2,width,height);}ctx.restore();}
 ctx.fillStyle='#8cb4c3';ctx.font='15px sans-serif';ctx.textAlign='left';ctx.fillText('QA 99 / 가상 스테이지',24,100);ctx.fillStyle='#c5e6e6';ctx.fillText(c.label,24,124);ctx.fillStyle='#7993a3';ctx.font='12px sans-serif';ctx.fillText((isAuto(m)?'범위 접근 자동 재생':'접근 후 E')+' · Esc 설정 · Tab으로 QA 대상 변경',24,145);
}
W.LunaOutsideQA={catalog,init,targets,target,tick,interact,anchor,draw};
})(typeof window==='undefined'?globalThis:window);
