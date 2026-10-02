(function(W){
'use strict';
const id='bd-vendor',cost=500,x=5.65,y=-.7,nodeName='ambient-bd-vendor';
const say=(actor,text)=>({type:'say',actor,text});
const rows=[say('luna','안녕하세요.'),say(id,'손님이야? 이번에 새로 구한 BD 칩이 있는데, 한번 볼래?'),say(id,'비용은 500원이야.'),{type:'bd-choice',actor:id,text:'비용은 500원이야.'}];
function visible(m){return !m.qa&&m.scene==='street'&&!m.level&&m.config.day>=0&&m.config.day<=3;}
function balance(){return Math.max(0,Number(W.barGame?.progress.money)||0);}
function targets(m){return visible(m)?[{id,label:'BD 칩 판매상',nodeName,x,y}]:[];}
function interact(m,t){if(t.id!==id||!visible(m))return false;m.backgroundStory.cancel();m.facing=m.x<x?1:-1;return m.story.beginRows(id,t,rows);}
function choiceView(){const money=balance();return {money,options:[{id:'buy',label:'구매한다. · 500원',disabled:money<cost},{id:'leave',label:'구매하지 않는다.',disabled:false}]};}
function choose(m,choice){const story=m.story,s=story.speech;if(s?.id!==id||!s.choice)return false;
 if(choice==='leave'){story.cancel();return true;}
 if(choice!=='buy'||balance()<cost||!W.lunaCampaign?.playBDCinema)return false;
 // Consume the choice before notifying the UI: repeat clicks cannot charge twice.
 s.choice=false;const g=W.barGame,before=g.progress.money;g.progress.money=before-cost;
 const c=W.lunaCampaign;if(c.active&&c.session.carry)c.session.carry.money=g.progress.money;
 g.log('bd_purchase',{price:cost,before,after:g.progress.money,day:m.config.day,flow:m.config.flow});
 story.beginRows(id,s.target,[say(id,'크크, 후회하지 않을 거야. 귀한 걸 구했거든.'),{type:'bd-cinema'}]);g.changed();return true;
}
function watch(m){m.story.cancel();W.lunaCampaign?.playBDCinema(m);}
function apply(data){if(data.scenes.street.nodes.some(n=>n.name===nodeName))return;data.scenes.street.nodes.push({id:nodeName,go:nodeName,name:nodeName,x,y:-.94,z:0,sx:1,sy:1,active:true,ancestry:['Ambient'],layer:9,order:1,flip:true,bdVendor:true,ambient:{fps:3.4,phase:1},sprite:{asset:'ambient-M1',x:0,y:0,w:129,h:138,pivot:{x:.5,y:24/138},ppu:100}});}
W.LunaBDVendor={id,cost,x,y,rows,visible,targets,interact,choiceView,choose,watch,balance,apply};if(W.LUNA_OUTSIDE_DATA)apply(W.LUNA_OUTSIDE_DATA);
})(window);
