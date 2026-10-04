/* Optional street shop, sourced from Notion 외부 이야기 (2026-10-05). */
(function(W){
'use strict';
// The sprite pivot is its left edge; interactions point to the visible center.
const id='shiba-shop',x=-2.68,y=-.596;
const say=(actor,text)=>({type:'say',actor,text}),shiba=text=>say('shiba',text),luna=text=>say('luna',text);
const items=[{id:'wild_dog',label:'와일드 독',price:600},{id:'bitters',label:'비터스',price:300}];
const intro=[luna('…'),shiba('뭘 봐, 시바.'),shiba('아, 뭐야. 너 걔지? 아까 그 바 안에서 일하고 있던 얼빠진 놈.'),luna('네. 맞아요.'),shiba('근데 왜 그렇게 쳐다보는 거야?'),luna('거기서 뭘 하고 계신 건가요?'),shiba('보면 알잖아. 영업하는 중이지.'),luna('무슨 영업이요?'),shiba('뭐… 술도 팔고, 잡동사니도 팔고, 몸에 좋은 것들도 좀 팔고…'),shiba('…너 살 거야? 사지도 않을 거면서 물어보는 거면 저리 가 줬으면 하는데.'),luna('한번 보고 생각해 볼게요.'),{type:'shop-intro-done'},{type:'shop-open'}];
const stockChoice=()=>({type:'shop-choice',stage:'items',actor:'shiba',text:'어떤 걸 살 거야?'});
const allowance=[shiba('뭐야, 너 돈 없어?'),luna('아쉽게도… 소지금이 부족해서요.'),shiba('…어쩔 수 없지.'),shiba('“박용석 바보”라고 외쳐 봐. 그럼 내가 용돈을 줄게.'),luna('무슨 의미가 있나요?'),{type:'shop-choice',stage:'allowance',actor:'shiba',text:'그냥 해 봐.'}];
function needsAllowance(m){const day=m.qa?.shopDay??m.config.day;return [1,2].includes(day)&&Number(state(m).money)<=300;}
function openStock(m,target){return m.story.beginRows(id,target,needsAllowance(m)?allowance:[stockChoice()]);}
function grantAllowance(m){const s=m.story.speech;if(s?.id!==id||s.line?.actor!=='luna'||s.rows[s.index]?.type!=='shop-allowance-grant'||s.allowancePaid)return false;s.allowancePaid=true;const p=state(m),before=Number(p.money)||0;p.money=before+500;if(!m.qa)W.barGame.log('shiba_allowance',{day:m.config.day,before,after:p.money,amount:500});sync(m);return true;}
const revisit=[{type:'shop-choice',stage:'greeting',actor:'shiba',text:'뭐야? 뭐 사러 온 거야?'}];
const quizIntro=[shiba('…너 혹시 올드 패션드 만드냐?'),luna('어떻게 아셨죠?'),shiba('그거 두 개 사 가는 사람이 없어서 그런 건데.'),shiba('그걸로 만들 수 있는 건 올드 패션드밖에 없지.'),luna('맞아요. 부탁받아서요.'),shiba('흠… 너 그 칵테일에 대해선 알고 있어?'),luna('레시피에 대한 것 빼고는 잘 몰라요.'),shiba('아직도 그런 것도 모르면서 칵테일을 만든다고? 미쳤군.'),shiba('시바, 어쩔 수 없지. 선배인 내가 도와줄 수밖에.'),shiba('좋아. 이 술에 대해서 몇 가지 알려 줄 테니 들어 보도록.'),shiba('퀴즈도 낼 건데 못 맞추면 이거 안 팔 거야.'),luna('…억지라고 생각되는데요.'),shiba('어쩌라고. 파는 놈 마음이지.'),luna('…일단 들어 볼게요.')];
const lesson=[shiba('올드 패션드가 왜 올드 패션드인지 알아?'),luna('옛날 방식(Old Fashioned)의 칵테일이어서 그런가요?'),shiba('…그래, 기본은 아나 보네. 맞아. 이 칵테일은 1800년대에 나왔던 칵테일들 중'),shiba('아직도 변하지 않고 옛날 ‘방식’ 그대로 만드는 칵테일이기에 그런 이름을 가졌지.'),shiba('그래서 이 칵테일에는 ‘변하지 않는’ 칵테일의 시초이자 본질이라는 의미가 담겨 있어.'),shiba('세월이 지나도 늘 같은 칵테일. 예전에는 바를 대표하는 칵테일이기도 했지.'),luna('…'),shiba('어디, 잘 들었는지 볼까?')];
function quizRows(item,retry=false){return [...(retry?[shiba('…다시 설명하지.')]:quizIntro),...lesson,{type:'shop-choice',stage:'quiz',item:item.id,actor:'shiba',text:'올드 패션드 뜻이 뭐라고?'}];}
function needsQuiz(p,item){const other={wild_dog:'bitters',bitters:'wild_dog'}[item.id];return !!other&&!p.flags.shiba_old_fashioned_taught&&Number(p.inventory?.[other])>0;}
function owned(p,item){return !!p.flags?.['shiba_bought_'+item.id]||Number(p.inventory?.[item.id])>0;}
function purchase(m,item,quiz=false){const p=state(m);if(owned(p,item)||p.money<item.price)return false;p.money-=item.price;p.flags['shiba_bought_'+item.id]=true;p.inventory||={};p.inventory[item.id]=(Number(p.inventory[item.id])||0)+1;if(quiz)p.flags.shiba_old_fashioned_taught=true;if(!m.qa)W.barGame.log('shiba_purchase',{item:item.id,price:item.price,day:m.config.day,flow:m.config.flow});sync(m);W.outsidePlaytest?.notifyItem?.(m,item.id);return true;}
function state(m){if(m.qa)return m.qa.shopProgress||(m.qa.shopProgress={money:W.LunaBDVendor.balance(),flags:{},inventory:{}});return W.barGame.progress;}
function sync(m){if(m.qa)return;const g=W.barGame,c=W.lunaCampaign;if(c?.session.carry){c.session.carry.money=g.progress.money;c.session.carry.flags={...g.progress.flags};c.session.carry.inventory={...g.progress.inventory};}g.changed();}
function visible(m){return !m.qa&&m.scene==='street'&&!m.level&&m.config.day<=3&&(m.config.day>1||m.config.day===1&&m.config.flow==='out');}
function targets(m){return visible(m)?[{id,nodeName:'shiba',label:'시BAR',x,y}]:[];}
function begin(m,target,first){m.backgroundStory.cancel();return m.story.beginRows(id,target,first?intro:revisit);}
function interact(m,t){if(t.id!==id||!visible(m))return false;m.facing=m.x<x?1:-1;return begin(m,t,!state(m).flags.shiba_shop_met);}
function completeIntro(m){state(m).flags.shiba_shop_met=true;sync(m);}
function choiceView(m){const money=Math.max(0,Number(state(m).money)||0),line=m.story.speech.line,stage=line.stage;if(stage==='allowance')return{money,label:'시BAR 용돈 선택',options:[{id:'shop-allowance-yes',label:'한다'},{id:'shop-allowance-no',label:'안 한다'}]};if(stage==='quiz'){const item=items.find(i=>i.id===line.item);return{money,label:'올드 패션드 퀴즈',options:[{id:'shop-answer-1',label:'옛날 방식의 칵테일',disabled:!item||owned(state(m),item)||money<item.price},{id:'shop-answer-2',label:'옛날 옛적 이야기'},{id:'shop-answer-3',label:'뭘 봐, 시바.'}]};}return {money,label:'시BAR 구매 선택',options:stage==='greeting'?[{id:'shop-yes',label:'네, 맞아요.'},{id:'shop-no',label:'아니요.'}]:[...items.filter(i=>!owned(state(m),i)).map(i=>({id:'shop-buy-'+i.id,label:i.label+' · '+i.price+'원',disabled:money<i.price})),{id:'shop-no',label:'구매하지 않는다.'}]};}
function choose(m,choice){const s=m.story.speech;if(s?.id!==id||!s.choice)return false;const stage=s.line.stage;
 if(stage==='allowance'){if(!['shop-allowance-yes','shop-allowance-no'].includes(choice))return false;s.choice=false;return m.story.beginRows(id,s.target,choice==='shop-allowance-yes'?[luna('박용석 바보!'),{type:'shop-allowance-grant'},shiba('좋아, 잘했어. 자, 여기 500원.'),stockChoice()]:[stockChoice()]);}
 if(stage==='quiz'){const item=items.find(i=>i.id===s.line.item);if(!item||!['shop-answer-1','shop-answer-2','shop-answer-3'].includes(choice))return false;if(choice==='shop-answer-1'){if(!purchase(m,item,true))return false;s.choice=false;return m.story.beginRows(id,s.target,[shiba('정답이다, 바텐더. 자, 가져가도록.'),luna('…? 감사해요.')]);}s.choice=false;return m.story.beginRows(id,s.target,quizRows(item,true));}
 if(choice==='shop-no'){s.choice=false;return m.story.beginRows(id,s.target,[shiba('뭐야. 그럼 꺼져.')]);}
 if(choice==='shop-yes'&&stage==='greeting'){s.choice=false;return m.story.beginRows(id,s.target,[luna('뭘 파는지 볼 수 있나요?'),shiba('…전부 다 보여 주진 못하고 몇 개만 보여 줄게.'),{type:'shop-open'}]);}
 const item=items.find(i=>'shop-buy-'+i.id===choice),p=state(m);if(stage!=='items'||!item||owned(p,item)||p.money<item.price)return false;
 s.choice=false;if(needsQuiz(p,item))return m.story.beginRows(id,s.target,quizRows(item));
 purchase(m,item);return m.story.beginRows(id,s.target,[shiba('너 그거 어디 가서 나한테 샀다고 하면 죽어.'),luna('…네.')]);
}
W.LunaOutsideShop={id,items,openStock,grantAllowance,intro,revisit,visible,targets,interact,begin,completeIntro,choiceView,choose};
})(window);
