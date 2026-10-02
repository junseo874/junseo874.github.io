// Day 1 forced corridor encounter. Reuses the street actor and speech layers.
(function(W){
'use strict';
const id='day1-corridor-thug',R=W.LunaResidence.layout,home=R.homeX,npcX=home+.7;
const say=(actor,text)=>({type:'say',actor,text}),n=text=>say(id,text),l=text=>say('luna',text);
const intro=[n('…뭐야, 너.'),l('누구신가요?'),n('여기 사는 사람인데. 너, 그 집에 사는 거야?'),l('어제부터 지내고 있습니다.'),n('하. 그 남자, 세상 무뚝뚝한 척은 다 하더니. 이런 어린 여자나 꼬시고 있었어?'),n('즐길 건 다 즐기면서 살고 있었구만.'),l('무슨 일이신가요?'),n('…별건 아니고. 여기 새로 들어오면 입주 비용을 내야 하는데, 알고 있어?'),l('그런 비용이 있다는 말은 듣지 못했습니다.'),n('그래? 그럼 나한테 500원만 줘. 내가 대신 처리해 줄 테니까.'),{type:'thug-choice',actor:id,text:'입주 비용으로 500원을 건네시겠습니까?'}];
const paid=[n('뭐야. 생각보다 고분고분하잖아?'),n('너, 나랑 같이 살 생각은 없어? 내가 그 남자보단 따뜻하게 대해 줄 수 있는데.'),l('그럴 생각은 없습니다.'),n('칫. 이런 건 또 딱 잘라 거절하네.'),n('뭐, 됐어. 아침부터 돈도 생기고, 오늘은 운이 좋네.'),l('…입주 비용을 처리해 주시는 거 아니었나요?'),n('아, 알아서 한다니까. 넌 가던 길이나 가.'),{type:'thug-action',action:'depart'},l('…')];
const refused=[l('그 돈을 드리기는 어려울 것 같습니다.'),n('하. 이젠 너 같은 애송이까지 날 무시하네.'),{type:'thug-action',action:'punch'},n('큭…!'),l('…?'),n('뭐야… 너, 몸이 왜 이렇게 단단해? 무슨 쇳덩이도 아니고.'),n('칫… 오늘은 그냥 간다. 운 좋은 줄 알아.'),{type:'thug-action',action:'depart'}];
function flags(m){return W.lunaCampaign?.session.active&&!W.lunaCampaign.session.developer?(W.barGame.progress.flags??={}):(m.thugFlags??={});}
function save(m,key,value){flags(m)[key]=value;const c=W.lunaCampaign;if(c?.session.active&&!c.session.developer&&c.session.carry){c.session.carry.flags??={};c.session.carry.flags[key]=value;}}
function visible(m){return !m.qa&&m.scene==='street'&&m.level===1&&m.config.day===1&&m.config.flow==='in'&&!flags(m).day1_thug_done;}
function start(m){m.backgroundStory.cancel();m.facing=1;m.anim='idle';m.animTime=0;W.outsidePlaytest?.clearInput();m.encounter={kind:'thug',stage:'entering',elapsed:0,camera:{x:home+.4,y:R.upperY+.65,w:4.8},cameraReady:false,npcX,alpha:1,hurt:false,target:{id,x:npcX,y:R.upperY}};m.updateNear();}
function rows(m){return flags(m).day1_thug_choice==='pay'?paid:flags(m).day1_thug_choice==='refuse'?refused:intro;}
function action(m,row){const e=m.encounter;if(e?.kind!=='thug')return false;e.stage=row.action;e.elapsed=0;e.from=e.npcX;return true;}
function tick(m,dt){let e=m.encounter;
 if(e?.kind!=='thug'){if(visible(m)&&!m.paused&&!m.transition&&!m.ride&&!m.dialog&&!m.story.blocking&&m.x>=home+.12&&m.x<=R.upperMax){start(m);return true;}return false;}
 e.elapsed+=dt;m.anim='idle';m.animTime+=dt;
 if(e.stage==='entering'&&e.elapsed>=.65&&e.cameraReady){e.stage='active';m.story.beginRows(id,e.target,rows(m));}
 else if(e.stage==='punch'){
  const t=e.elapsed;e.npcX=t<.65?e.from+(m.x+.33-e.from)*Math.min(1,t/.65):m.x+.33+Math.min(1,(t-.85)/.6)*.3;e.target.x=e.npcX;
  if(t>=.85)e.hurt=true;
  if(t>=1.65){e.stage='active';m.story.speech.index++;m.story.seek();}
 }else if(e.stage==='depart'){
  const p=Math.min(1,e.elapsed/1.8);e.npcX=e.from+p*1.7;e.alpha=1-Math.max(0,(p-.65)/.35);e.target.x=e.npcX;
  if(p===1){e.stage='active';m.story.speech.index++;m.story.seek();}
 }else if(e.stage==='active'&&!m.story.speech){e.stage='leaving';e.elapsed=0;e.cameraReady=false;}
 else if(e.stage==='leaving'&&e.cameraReady&&e.elapsed>.4){save(m,'day1_thug_done',true);m.encounter=null;W.outsidePlaytest?.clearInput();m.updateNear();}
 return true;
}
function choiceView(){const money=W.LunaBDVendor.balance();return{label:'입주 비용 선택',money,options:[{id:'thug-pay',label:'500원을 준다.',disabled:money<500},{id:'thug-refuse',label:'주지 않는다.',disabled:false}]};}
function choose(m,choice){const s=m.story.speech;if(s?.id!==id||!s.choice)return false;const pay=choice==='thug-pay';if(!pay&&choice!=='thug-refuse'||pay&&W.LunaBDVendor.balance()<500)return false;s.choice=false;
 if(pay){const g=W.barGame,before=g.progress.money;g.progress.money=before-500;const c=W.lunaCampaign;if(c?.session.active&&c.session.carry)c.session.carry.money=g.progress.money;g.log('corridor_thug_payment',{before,after:g.progress.money,price:500});g.changed();}
 save(m,'day1_thug_choice',pay?'pay':'refuse');m.story.beginRows(id,s.target,pay?paid:refused);return true;
}
function draw(m,sprite,ctx,position){if(!visible(m))return;const e=m.encounter?.kind==='thug'?m.encounter:null,x=e?.npcX??npcX,alpha=e?.alpha??1,y=R.upperY-.24+(e?.stage==='depart'?Math.sin(e.elapsed*16)*.018:0);
 // The right-hand pillar is baked into the building art; clip the NPC behind it.
 ctx.save();ctx.beginPath();ctx.rect(-2048,-2048,position(-13.70,0).x+2048,4096);ctx.clip();
 const sp={asset:'ambient-M2',x:(Math.floor(m.time*3.8)%6)*129,y:0,w:129,h:138,pivot:{x:.5,y:24/138},ppu:100};// Source idle faces left: mirror only to look right, including the exit walk.
 sprite(sp,x,y,1,1,e?.stage==='depart'||m.x>x,alpha);
 // A short pixel-art arm thrust, followed by the forearm held close to the body.
 if(e&&(e.stage==='punch'&&e.elapsed>.58&&e.elapsed<.92||e.hurt)&&alpha>0){const hit=e.stage==='punch'&&e.elapsed<.92,a=position(x-.04,y+.35),b=position(hit?m.x+.07:x-.13,y+(hit?.34:.3));ctx.save();ctx.globalAlpha=alpha;ctx.strokeStyle='#51585c';ctx.lineWidth=8;ctx.lineCap='square';ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();ctx.fillStyle='#77796c';ctx.fillRect(b.x-4,b.y-4,8,8);ctx.restore();}
 ctx.restore();
}
W.LunaOutsideThug={id,intro,paid,refused,visible,start,tick,action,choose,choiceView,draw};
})(window);
