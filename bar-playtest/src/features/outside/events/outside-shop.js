/* Street shop: the shared CSV owns the lines, while this module owns prices and rewards. */
(function(W){
'use strict';
// The sprite pivot is its left edge; interactions point to the visible center.
const id='shiba-shop',x=()=>W.LunaNpcScene?.shift('shop',-2.68)??-2.68,y=-.596;
const say=(actor,text)=>({type:'say',actor,text}),shiba=text=>say('shiba',text),luna=text=>say('luna',text);
const items=[{id:'bitters',label:'비터스',price:300}];
const tuna={id:'tuna_can',label:'참치캔',price:50};
function tunaAvailable(m){return !!W.LunaOutsideNeighborhood?.after(m,2)&&!state(m).flags.boobi_adopted&&!owned(state(m),tuna);}
function tunaOption(m){return tunaAvailable(m)?[{id:'shop-buy-tuna_can',label:'참치캔 구매 · 50원',disabled:state(m).money<50,disabledReason:'돈이 부족합니다.'}]:[];}
const script=key=>W.LUNA_DATA.sharedStory['shop/'+key];
const intro=script('intro');
const stockChoice=()=>{const line={type:'shop-choice',stage:'items',actor:'shiba'};return {...line,text:W.LunaOutsideAuthoring.prompt(line)};};
const soldOut=()=>[shiba('이제 팔 거 없어. 꺼져, 시바.')];
function hasStock(m){return items.some(item=>!owned(state(m),item))||tunaAvailable(m);}
const allowance=script('allowance');
function needsAllowance(m){const day=m.qa?.shopDay??m.config.day;return !state(m).flags.shiba_allowance_received&&[1,2].includes(day)&&Number(state(m).money)<=300;}
function openStock(m,target){const p=state(m);return m.story.beginRows(id,target,needsQuiz(p)?quizRows(items[0]):!hasStock(m)?soldOut():needsAllowance(m)?allowance:[stockChoice()]);}
function grantAllowance(m){const s=m.story.speech,p=state(m);if(p.flags.shiba_allowance_received||s?.id!==id||s.rows[s.index]?.type!=='shop-allowance-grant'||s.allowancePaid)return false;s.allowancePaid=true;const before=Number(p.money)||0;p.money=before+500;p.flags.shiba_allowance_received=true;if(!m.qa)W.barGame.log('shiba_allowance',{day:m.config.day,before,after:p.money,amount:500});sync(m);return true;}
const revisit=script('revisit');
const quizIntro=script('quizIntro');
const lesson=script('lesson');
function quizRows(item,retry=false){return [...(retry?script('quizRetry'):quizIntro),...lesson,{type:'shop-choice',stage:'quiz',item:item.id,actor:'shiba',text:'올드 패션드 뜻이 뭐라고?'}];}
function needsQuiz(p){return !p.flags.shiba_old_fashioned_taught&&owned(p,items[0])&&owned(p,{id:'wild_dog'});}
function owned(p,item){return !!p.flags?.['shiba_bought_'+item.id]||Number(p.inventory?.[item.id])>0;}
function purchase(m,item){const p=state(m);if(owned(p,item)||p.money<item.price)return false;p.money-=item.price;p.flags['shiba_bought_'+item.id]=true;p.inventory||={};p.inventory[item.id]=1;if(!m.qa)W.barGame.log('shiba_purchase',{item:item.id,price:item.price,day:m.config.day,flow:m.config.flow});sync(m);W.outsidePlaytest?.notifyItem?.(m,item.id);if(item.id==='bitters')W.LunaRestorationNotices?.check(W.barGame,W.lunaCampaign,m);return true;}
function state(m){if(m.qa)return m.qa.shopProgress||(m.qa.shopProgress={money:Math.max(0,Number(W.barGame?.progress.money)||0),flags:{},inventory:{}});return W.barGame.progress;}
function sync(m){if(m.qa)return;const g=W.barGame,c=W.lunaCampaign;if(c?.session.carry){c.session.carry.money=g.progress.money;c.session.carry.flags={...g.progress.flags};c.session.carry.inventory={...g.progress.inventory};}g.changed();}
function visible(m){return !m.qa&&m.scene==='street'&&m.config.day<=3&&m.config.day>=2;}
function targets(m){return !m.level&&visible(m)?[{id,nodeName:'shiba',label:'시BAR',x:x(),y}]:[];}
function entryRows(m,first){return !hasStock(m)?needsQuiz(state(m))?quizRows(items[0]):soldOut():first?intro:revisit;}
function begin(m,target,first){return m.story.beginRows(id,target,entryRows(m,first));}
const tunaReply=()=>[shiba('참치캔? 50원이야. 자, 가져가.'),luna('감사해요.')];
const purchaseReply=()=>script('purchased');
const allowanceReply=()=>[...script('allowanceYes'),stockChoice()];
const refuseReply=stage=>script(stage==='greeting'?'noBrowse':'noStockPurchase');
const browseReply=()=>[...script('browse'),{type:'shop-open'}];
const quizReply=()=>script('quizCorrect');
function preview(m,t){
 if(t.id!==id)return null;
 const p=state(m),alternatives=[refuseReply('items'),[stockChoice()]];
 if(p.flags.shiba_shop_met)alternatives.push(browseReply(),refuseReply('greeting'));
 if(needsAllowance(m))alternatives.push(allowance,allowanceReply());
 if(tunaAvailable(m)&&p.money>=50)alternatives.push(tunaReply());
 if(needsQuiz(p))alternatives.push(quizRows(items[0]),quizRows(items[0],true),quizReply());
 for(const item of items)if(!owned(p,item)&&p.money>=item.price){
  if(needsQuiz(p,item))alternatives.push(quizRows(item),quizRows(item,true),quizReply());
  else alternatives.push(purchaseReply());
 }
 return {id,rows:entryRows(m,!p.flags.shiba_shop_met),alternatives:alternatives.map(rows=>({id,rows}))};
}
function interact(m,t){if(t.id!==id||m.level||!visible(m))return false;m.facing=m.x<x()?1:-1;return begin(m,t,!state(m).flags.shiba_shop_met);}
function completeIntro(m){state(m).flags.shiba_shop_met=true;sync(m);}
function choiceView(m){const money=Math.max(0,Number(state(m).money)||0),line=m.story.speech.line,stage=line.stage;if(stage==='allowance')return{money,label:'시BAR 용돈 선택',options:[{id:'shop-allowance-yes',label:'한다'},{id:'shop-allowance-no',label:'안 한다'}]};if(stage==='quiz'){return{money,label:'올드 패션드 퀴즈',options:[{id:'shop-answer-1',label:'옛날 방식의 칵테일'},{id:'shop-answer-2',label:'옛날 옛적 이야기'},{id:'shop-answer-3',label:'뭘 봐, 시바.'}]};}return {money,label:'시BAR 구매 선택',options:stage==='greeting'?[{id:'shop-yes',label:'한 번 볼게요.'},{id:'shop-no',label:'아니요.'}]:[{id:'shop-no',label:'구매하지 않는다.'},...items.filter(i=>!owned(state(m),i)).map(i=>({id:'shop-buy-'+i.id,label:i.label+' · '+i.price+'원',disabled:money<i.price,disabledReason:'돈이 부족합니다.'}))]};}
function choose(m,choice){const s=m.story.speech;if(s?.id!==id||!s.choice||!m.qa&&!visible(m))return false;const stage=s.line.stage;
 if(choice==='shop-buy-tuna_can'&&stage==='items'){
  if(!tunaAvailable(m)||!purchase(m,tuna))return false;
  return m.story.beginRows(id,s.target,tunaReply());
 }
 if(stage==='allowance'){if(!['shop-allowance-yes','shop-allowance-no'].includes(choice))return false;s.choice=false;return m.story.beginRows(id,s.target,choice==='shop-allowance-yes'?allowanceReply():[stockChoice()]);}
 if(stage==='quiz'){const item=items.find(i=>i.id===s.line.item);if(!item||!needsQuiz(state(m))||!['shop-answer-1','shop-answer-2','shop-answer-3'].includes(choice))return false;if(choice==='shop-answer-1'){state(m).flags.shiba_old_fashioned_taught=true;sync(m);s.choice=false;return m.story.beginRows(id,s.target,quizReply());}s.choice=false;return m.story.beginRows(id,s.target,quizRows(item,true));}
 if(choice==='shop-no'){s.choice=false;return m.story.beginRows(id,s.target,refuseReply(stage));}
 if(choice==='shop-yes'&&stage==='greeting'){s.choice=false;return m.story.beginRows(id,s.target,browseReply());}
 const item=items.find(i=>'shop-buy-'+i.id===choice),p=state(m);if(stage!=='items'||!item||owned(p,item)||p.money<item.price)return false;
 s.choice=false;purchase(m,item);return m.story.beginRows(id,s.target,[...purchaseReply(),...(needsQuiz(p)?quizRows(item):[])]);
}
function withTunaChoice(m){const view=choiceView(m);if(m.story.speech.line.stage==='items')view.options.push(...tunaOption(m));return view;}
W.LunaOutsideShop={id,items,openStock,grantAllowance,intro,revisit,visible,targets,interact,preview,begin,completeIntro,choiceView:withTunaChoice,choose};
})(window);
