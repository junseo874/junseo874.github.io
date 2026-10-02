/* Optional street shop, sourced from Notion 외부 이야기 (2026-10-02). */
(function(W){
'use strict';
// The sprite pivot is its left edge; interactions point to the visible center.
const id='shiba-shop',x=-2.68,y=-.596;
const say=(actor,text)=>({type:'say',actor,text}),shiba=text=>say('shiba',text),luna=text=>say('luna',text);
const items=[{id:'arcade_coupon',label:'오락실 쿠폰 1장',price:50},{id:'wild_dog',label:'와일드 독',price:600},{id:'bitters',label:'비터스',price:300}];
const intro=[luna('…'),shiba('뭘 봐?'),shiba('아, 뭐야. 너 걔지? 아까 그 바 안에서 일하고 있던 얼빠진 놈.'),luna('네. 맞아요.'),shiba('근데 왜 그렇게 쳐다보는 거야?'),luna('거기서 뭘 하고 계신 건가요?'),shiba('보면 알잖아. 영업하는 중이지.'),luna('무슨 영업이요?'),shiba('뭐… 술도 팔고, 잡동사니도 팔고, 몸에 좋은 것들도 좀 팔고…'),shiba('…너 살 거야? 사지도 않을 거면서 물어보는 거면 저리 가 줬으면 하는데.'),luna('아직 저한테 필요한 건 없어 보이네요.'),shiba('그럼 가. 나중에 필요해질 때 물어보라고.'),{type:'shop-intro-done'}];
const revisit=[{type:'shop-choice',stage:'greeting',actor:'shiba',text:'뭐야? 뭐 사러 온 거야?'}];
function state(m){if(m.qa)return m.qa.shopProgress||(m.qa.shopProgress={money:W.LunaBDVendor.balance(),flags:{},inventory:{}});return W.barGame.progress;}
function sync(m){if(m.qa)return;const g=W.barGame,c=W.lunaCampaign;if(c?.session.carry){c.session.carry.money=g.progress.money;c.session.carry.flags={...g.progress.flags};c.session.carry.inventory={...g.progress.inventory};}g.changed();}
function visible(m){return !m.qa&&m.scene==='street'&&!m.level&&m.config.day<=3&&(m.config.day>1||m.config.day===1&&m.config.flow==='out');}
function targets(m){return visible(m)?[{id,nodeName:'shiba',label:'시BAR',x,y}]:[];}
function begin(m,target,first){m.backgroundStory.cancel();return m.story.beginRows(id,target,first?intro:revisit);}
function interact(m,t){if(t.id!==id||!visible(m))return false;m.facing=m.x<x?1:-1;return begin(m,t,!state(m).flags.shiba_shop_met);}
function completeIntro(m){state(m).flags.shiba_shop_met=true;sync(m);}
function choiceView(m){const money=Math.max(0,Number(state(m).money)||0),stage=m.story.speech.line.stage;return {money,label:'시BAR 구매 선택',options:stage==='greeting'?[{id:'shop-yes',label:'네, 맞아요.'},{id:'shop-no',label:'아니요.'}]:[...items.map(i=>({id:'shop-buy-'+i.id,label:i.label+' · '+i.price+'원',disabled:money<i.price})),{id:'shop-no',label:'구매하지 않는다.'}]};}
function choose(m,choice){const s=m.story.speech;if(s?.id!==id||!s.choice)return false;const stage=s.line.stage;
 if(choice==='shop-no'){s.choice=false;return m.story.beginRows(id,s.target,[shiba('뭐야. 그럼 꺼져.')]);}
 if(choice==='shop-yes'&&stage==='greeting'){s.choice=false;return m.story.beginRows(id,s.target,[luna('뭘 파는지 볼 수 있나요?'),shiba('…전부 다 보여 주진 못하고 몇 개만 보여 줄게.'),{type:'shop-choice',stage:'items',actor:'shiba',text:'어떤 걸 살 거야?'}]);}
 const item=items.find(i=>'shop-buy-'+i.id===choice),p=state(m);if(stage!=='items'||!item||p.money<item.price)return false;
 s.choice=false;p.money-=item.price;p.inventory||={};p.inventory[item.id]=(Number(p.inventory[item.id])||0)+1;
 m.story.beginRows(id,s.target,[shiba('너 그거 어디 가서 나한테 샀다고 하면 죽어.'),luna('…네.')]);if(!m.qa)W.barGame.log('shiba_purchase',{item:item.id,price:item.price,day:m.config.day,flow:m.config.flow});sync(m);return true;
}
W.LunaOutsideShop={id,items,intro,revisit,visible,targets,interact,begin,completeIntro,choiceView,choose};
})(window);
