/* Optional street shop, sourced from Notion 외부 이야기 (2026-10-05). */
(function(W){
'use strict';
// The sprite pivot is its left edge; interactions point to the visible center.
const id='shiba-shop',x=-2.68,y=-.596;
const say=(actor,text)=>({type:'say',actor,text}),shiba=text=>say('shiba',text),luna=text=>say('luna',text);
const items=[{id:'bitters',label:'비터스',price:300}];
const tuna={id:'tuna_can',label:'참치캔',price:50};
function tunaAvailable(m){return !!W.LunaOutsideNeighborhood?.after(m,2)&&!state(m).flags.boobi_adopted&&!owned(state(m),tuna);}
function tunaOption(m){return tunaAvailable(m)?[{id:'shop-buy-tuna_can',label:'참치캔 구매 · 50원',disabled:state(m).money<50,disabledReason:'돈이 부족합니다.'}]:[];}
const intro=W.LUNA_DATA?.sharedStory?.['shop/intro']||[{"type":"say","actor":"luna","text":"..."},{"type":"say","actor":"shiba","text":"뭘 봐, 시바."},{"type":"say","actor":"shiba","text":"아, 뭐야. 너 걔잖아. 바에서 맥주 가지고 나한테 사기 친 놈."},{"type":"say","actor":"luna","text":"맥주로 사기 친 적 없습니다."},{"type":"say","actor":"shiba","text":"그나저나 왜 쳐다봐, 시바. 구경 났어?"},{"type":"say","actor":"luna","text":"거기서 뭘 하고 계신 건가요?"},{"type":"say","actor":"shiba","text":"보면 몰라? 영업하는 거지."},{"type":"say","actor":"luna","text":"무슨 영업이요?"},{"type":"say","actor":"shiba","text":"술도 팔고, 잡동사니도 팔고, 몸에 좋은 것들도 파는 거지."},{"type":"say","actor":"shiba","text":"안 살 거면 꺼져, 시바. 파리 날리는 데 안 사는 놈까지 기웃거리면 짜증나."},{"type":"say","actor":"luna","text":"한 번 보고 생각해 볼게요."},{"type":"shop-intro-done"},{"type":"shop-open"}];
const stockChoice=()=>({type:'shop-choice',stage:'items',actor:'shiba',text:'전부 다 보여 주긴 싫고, 몇 개만 보여 줄게.'});
const soldOut=()=>[shiba('이제 팔 거 없어. 꺼져, 시바.')];
function hasStock(m){return items.some(item=>!owned(state(m),item))||tunaAvailable(m);}
const allowance=W.LUNA_DATA?.sharedStory?.['shop/allowance']||[{"type":"say","actor":"shiba","text":"뭐야, 너 돈 없어?"},{"type":"say","actor":"luna","text":"일을 시작한 지 얼마 안 되어서요."},{"type":"say","actor":"shiba","text":"... 하. 이 거지를 어쩌면 좋나, 시바."},{"type":"say","actor":"shiba","text":"어쩔 수 없지."},{"type":"say","actor":"shiba","text":"“박용석 바보” 라고 외치면, 내가 돈을 주지."},{"type":"say","actor":"luna","text":"무슨 의미가 있나요?"},{"type":"shop-choice","stage":"allowance","actor":"shiba","text":"물건이랑 돈 떼먹고 튄 놈이야. 같이 욕 할 사람 필요한 거니까 해 봐."}];
function needsAllowance(m){const day=m.qa?.shopDay??m.config.day;return !state(m).flags.shiba_allowance_received&&[1,2].includes(day)&&Number(state(m).money)<=300;}
function openStock(m,target){const p=state(m);return m.story.beginRows(id,target,needsQuiz(p)?quizRows(items[0]):!hasStock(m)?soldOut():needsAllowance(m)?allowance:[stockChoice()]);}
function grantAllowance(m){const s=m.story.speech,p=state(m);if(p.flags.shiba_allowance_received||s?.id!==id||s.line?.actor!=='luna'||s.rows[s.index]?.type!=='shop-allowance-grant'||s.allowancePaid)return false;s.allowancePaid=true;const before=Number(p.money)||0;p.money=before+500;p.flags.shiba_allowance_received=true;if(!m.qa)W.barGame.log('shiba_allowance',{day:m.config.day,before,after:p.money,amount:500});sync(m);return true;}
const revisit=W.LUNA_DATA?.sharedStory?.['shop/revisit']||[{"type":"say","actor":"shiba","text":"살 거 아니면 꺼져, 시바."},{"type":"shop-choice","stage":"greeting","actor":"shiba","text":"살 거 아니면 꺼져, 시바."}];
const quizIntro=W.LUNA_DATA?.sharedStory?.['shop/quizIntro']||[{"type":"say","actor":"shiba","text":"너 혹시 올드 패션드 만들 거냐? 시바."},{"type":"say","actor":"luna","text":"어떻게 아셨죠?"},{"type":"say","actor":"shiba","text":"와일드 독이랑 비터스 구하러 다니는 놈이면 뻔하지."},{"type":"say","actor":"shiba","text":"그 조합이면 올드 패션드가 생각날 수 밖에 없으니까, 시바."},{"type":"say","actor":"luna","text":"손님에게 만들어달라고 부탁을 받아서요."},{"type":"say","actor":"shiba","text":"흠, 너 그 칵테일에 대해서 알고서 만들려고 하는 거야?"},{"type":"say","actor":"luna","text":"레시피 외에는 잘 몰라요."},{"type":"say","actor":"shiba","text":"아직 그런 것도 모르면서 제대로 된 칵테일을 만들 수 있을 것 같아? 시바."},{"type":"say","actor":"shiba","text":"... 조니한테 받은 것도 있으니, 내가 견생 선배로서 친히 알려 주도록 하지."},{"type":"say","actor":"shiba","text":"네 인생에 최고의 행운이 찾아왔다고 생각하도록."},{"type":"say","actor":"luna","text":"... 네."},{"type":"say","actor":"shiba","text":"좋아. 몇 가지 알려 줄 거니까 잘 들어. 마지막에 퀴즈 낼 거다."},{"type":"say","actor":"luna","text":"억지스러운데요."},{"type":"say","actor":"shiba","text":"어쩌라고. 가르치는 놈 마음이지."},{"type":"say","actor":"luna","text":"일단은 들어 볼게요."}];
const lesson=W.LUNA_DATA?.sharedStory?.['shop/lesson']||[{"type":"say","actor":"shiba","text":"올드 패션드가 왜 올드 패션드인지 알아? 시바."},{"type":"say","actor":"luna","text":"옛날 방식 (Old Fashioned) 의 칵테일이어서 그런가요?"},{"type":"say","actor":"shiba","text":"눈치는 있군, 맞아."},{"type":"say","actor":"shiba","text":"이 칵테일이 등장한 1800년대처럼 옛날 방식 그대로 만드는 칵테일이기에 그런 이름을 가졌지."},{"type":"say","actor":"shiba","text":"그래서 이 칵테일은 ‘변하지 않는’ 칵테일의 시초이자 본질이란 의미가 담긴 칵테일이야."},{"type":"say","actor":"shiba","text":"세월이 지나도 늘 같고, 예전에는 바를 대표하는 칵테일이기도 했지."},{"type":"say","actor":"luna","text":"..."},{"type":"say","actor":"luna","text":"되게 이상한 곳에서 유식하시네요."},{"type":"say","actor":"shiba","text":"조용히 해, 확인용 퀴즈 낸다."}];
function quizRows(item,retry=false){return [...(retry?[shiba('멍청한 답 내놓지 말고 제대로 들어.'),shiba('처음부터 다시 설명한다. 제대로 들어, 시바.')]:quizIntro),...lesson,{type:'shop-choice',stage:'quiz',item:item.id,actor:'shiba',text:'올드 패션드 뜻이 뭐라고?'}];}
function needsQuiz(p){return !p.flags.shiba_old_fashioned_taught&&owned(p,items[0])&&owned(p,{id:'wild_dog'});}
function owned(p,item){return !!p.flags?.['shiba_bought_'+item.id]||Number(p.inventory?.[item.id])>0;}
function purchase(m,item){const p=state(m);if(owned(p,item)||p.money<item.price)return false;p.money-=item.price;p.flags['shiba_bought_'+item.id]=true;p.inventory||={};p.inventory[item.id]=1;if(!m.qa)W.barGame.log('shiba_purchase',{item:item.id,price:item.price,day:m.config.day,flow:m.config.flow});sync(m);W.outsidePlaytest?.notifyItem?.(m,item.id);if(item.id==='bitters')W.LunaRestorationNotices?.check(W.barGame,W.lunaCampaign,m);return true;}
function state(m){if(m.qa)return m.qa.shopProgress||(m.qa.shopProgress={money:Math.max(0,Number(W.barGame?.progress.money)||0),flags:{},inventory:{}});return W.barGame.progress;}
function sync(m){if(m.qa)return;const g=W.barGame,c=W.lunaCampaign;if(c?.session.carry){c.session.carry.money=g.progress.money;c.session.carry.flags={...g.progress.flags};c.session.carry.inventory={...g.progress.inventory};}g.changed();}
function visible(m){return !m.qa&&m.scene==='street'&&m.config.day<=3&&m.config.day>=2;}
function targets(m){return !m.level&&visible(m)?[{id,nodeName:'shiba',label:'시BAR',x,y}]:[];}
function entryRows(m,first){return !hasStock(m)?needsQuiz(state(m))?quizRows(items[0]):soldOut():first?intro:revisit;}
function begin(m,target,first){return m.story.beginRows(id,target,entryRows(m,first));}
const tunaReply=()=>[shiba('참치캔? 50원이야. 자, 가져가.'),luna('감사해요.')];
const purchaseReply=()=>[shiba('너 그거 어디 가서 나한테 샀다고 하면 죽어, 시바.'),luna('... 네.')];
const allowanceReply=()=>[luna('박용석 바보!'),{type:'shop-allowance-grant'},shiba('좋아, 잘했어. 자, 여기 500원.'),stockChoice()];
const refuseReply=()=>[shiba('뭐야, 그럼 꺼져.')];
const browseReply=()=>[luna('뭘 파는 지 볼 수 있나요?'),shiba('전부 다 보여 주긴 싫고, 몇 개만 보여 줄게.'),{type:'shop-open'}];
const quizReply=()=>[shiba('정답. 칵테일 뜻은 알고 만들어, 시바.'),luna('감사해요.')];
function preview(m,t){
 if(t.id!==id)return null;
 const p=state(m),alternatives=[refuseReply(),[stockChoice()]];
 if(p.flags.shiba_shop_met)alternatives.push(browseReply());
 if(needsAllowance(m))alternatives.push(allowance,allowanceReply());
 if(tunaAvailable(m)&&p.money>=50)alternatives.push(tunaReply());
 if(needsQuiz(p))alternatives.push(quizRows(items[0]),quizRows(items[0],true),quizReply());
 for(const item of items)if(!owned(p,item)&&p.money>=item.price){
  if(needsQuiz(p,item))alternatives.push(quizRows(item),quizRows(item,true),quizReply());
  else alternatives.push(purchaseReply());
 }
 return {id,rows:entryRows(m,!p.flags.shiba_shop_met),alternatives:alternatives.map(rows=>({id,rows}))};
}
function interact(m,t){if(t.id!==id||m.level||!visible(m))return false;m.facing=m.x<x?1:-1;return begin(m,t,!state(m).flags.shiba_shop_met);}
function completeIntro(m){state(m).flags.shiba_shop_met=true;sync(m);}
function choiceView(m){const money=Math.max(0,Number(state(m).money)||0),line=m.story.speech.line,stage=line.stage;if(stage==='allowance')return{money,label:'시BAR 용돈 선택',options:[{id:'shop-allowance-yes',label:'한다'},{id:'shop-allowance-no',label:'안 한다'}]};if(stage==='quiz'){return{money,label:'올드 패션드 퀴즈',options:[{id:'shop-answer-1',label:'옛날 방식의 칵테일'},{id:'shop-answer-2',label:'옛날 옛적 이야기'},{id:'shop-answer-3',label:'뭘 봐, 시바.'}]};}return {money,label:'시BAR 구매 선택',options:stage==='greeting'?[{id:'shop-yes',label:'한 번 볼게요.'},{id:'shop-no',label:'아니요.'}]:[{id:'shop-no',label:'구매하지 않는다.'},...items.filter(i=>!owned(state(m),i)).map(i=>({id:'shop-buy-'+i.id,label:i.label+' · '+i.price+'원',disabled:money<i.price,disabledReason:'돈이 부족합니다.'}))]};}
function choose(m,choice){const s=m.story.speech;if(s?.id!==id||!s.choice||!m.qa&&!visible(m))return false;const stage=s.line.stage;
 if(choice==='shop-buy-tuna_can'&&stage==='items'){
  if(!tunaAvailable(m)||!purchase(m,tuna))return false;
  return m.story.beginRows(id,s.target,tunaReply());
 }
 if(stage==='allowance'){if(!['shop-allowance-yes','shop-allowance-no'].includes(choice))return false;s.choice=false;return m.story.beginRows(id,s.target,choice==='shop-allowance-yes'?allowanceReply():[stockChoice()]);}
 if(stage==='quiz'){const item=items.find(i=>i.id===s.line.item);if(!item||!needsQuiz(state(m))||!['shop-answer-1','shop-answer-2','shop-answer-3'].includes(choice))return false;if(choice==='shop-answer-1'){state(m).flags.shiba_old_fashioned_taught=true;sync(m);s.choice=false;return m.story.beginRows(id,s.target,quizReply());}s.choice=false;return m.story.beginRows(id,s.target,quizRows(item,true));}
 if(choice==='shop-no'){s.choice=false;return m.story.beginRows(id,s.target,refuseReply());}
 if(choice==='shop-yes'&&stage==='greeting'){s.choice=false;return m.story.beginRows(id,s.target,browseReply());}
 const item=items.find(i=>'shop-buy-'+i.id===choice),p=state(m);if(stage!=='items'||!item||owned(p,item)||p.money<item.price)return false;
 s.choice=false;purchase(m,item);return m.story.beginRows(id,s.target,[...purchaseReply(),...(needsQuiz(p)?quizRows(item):[])]);
}
function withTunaChoice(m){const view=choiceView(m);if(m.story.speech.line.stage==='items')view.options.push(...tunaOption(m));return view;}
W.LunaOutsideShop={id,items,openStock,grantAllowance,intro,revisit,visible,targets,interact,preview,begin,completeIntro,choiceView:withTunaChoice,choose};
})(window);
