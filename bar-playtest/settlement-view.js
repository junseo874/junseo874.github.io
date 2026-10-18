(function(W){
'use strict';
const number=n=>Math.round(Number(n)||0).toLocaleString();
const amount=(n,sign=false)=>`${sign&&n>0?'+':n<0?'−':''}${number(Math.abs(n))}<small>G</small>`;
const button=(text,action,primary=false)=>`<button data-act="${action}" class="${primary?'shift-primary':'shift-secondary'}">${text}${primary?'<span aria-hidden="true">→</span>':''}</button>`;
function html({g,main=false,challenge=false,gameover=false}){
 const s=g.dailySettlement;if(!s)return '';
 const L=(ko,en)=>g.lang==='en'?en:ko,paid=s.status==='paid',failed=s.shortfall>0,t=s.totals;
 const title=gameover?L('오늘은 문을 닫습니다','The bar closes tonight'):paid?L('정산 완료','Settlement complete'):L('영업 정산','End of shift');
 const footer=gameover?button(main?L('타이틀로','Title'):L('시작 화면으로','Session setup'),'setup')+button(L('오늘 다시 시작','Retry this day'),'retryDay',true):paid&&!main?(challenge?button(L('같은 챌린지 재도전','Replay challenge'),'retryDay'):'')+button(L('확인','Done'),'setup',true):button(failed?L('정산 확인','Confirm settlement'):main?L('정산하고 퇴근하기','Settle & head home'):L('정산하기','Settle up'),'confirmSettlement',true);
 const warning=gameover?L('유지비를 지불하지 못했습니다. 오늘 영업부터 다시 도전할 수 있어요.','Upkeep could not be paid. You can retry this day.'):failed?L('유지비가 부족합니다. 정산을 확인하면 영업이 종료됩니다.','Insufficient funds. Confirming settlement ends this run.'):'';
 const breakdown=[['sale',L('판매','Sales')],['tip',L('팁','Tips')],...(t.refund?[['refund',L('환불·배상','Refunds')]]:[])];
 return `<div class="shift-shade"><section class="end-shift ${failed?'shift-shortfall':''}" role="dialog" aria-modal="true" aria-labelledby="shift-title" aria-describedby="shift-note" data-shift-status="${gameover?'failed':paid?'paid':'pending'}"><header class="shift-header"><div><span class="shift-eyebrow">DAY ${String(s.day).padStart(2,'0')} / ${gameover?'BAR CLOSED':'CLOSING TIME'}</span><h1 id="shift-title">${title}</h1></div><span class="shift-stamp" aria-hidden="true">${gameover?'!':paid?'✓':'—'}</span></header><div class="shift-body">${gameover?'':`<section class="shift-income"><div><span>${L('오늘 영업 수입','Tonight’s earnings')}</span><small>${L('제공한 칵테일','Drinks served')} <b>${g.transactions.length}</b>${L('잔','')}</small></div><strong data-shift-value="income" class="${t.net<0?'negative':''}">${amount(t.net,true)}</strong></section><div class="shift-breakdown">${breakdown.map(([key,label])=>`<div><span>${label}</span><strong data-shift-value="${key}">${amount(key==='refund'?-t[key]:t[key])}</strong></div>`).join('')}</div>`}<div class="shift-ledger"><div><span>${L('정산 전 소지금','Balance before upkeep')}</span><strong data-shift-value="before">${amount(s.balanceBefore)}</strong></div><div><span>${L('오늘 유지비','Daily upkeep')}${!main&&s.source==='web_test'?'<small class="shift-test">TEST</small>':''}</span><strong data-shift-value="upkeep">${amount(-s.upkeep)}</strong></div></div><section class="shift-balance"><div><span>${failed?L('부족한 금액','Amount needed'):paid?L('정산 후 소지금','Closing balance'):L('정산 후 예상 소지금','Expected closing balance')}</span><small>${failed?L('소지금은 차감되지 않습니다.','No funds will be deducted.'):paid?L('유지비 지불을 완료했습니다.','Upkeep has been paid.'):L('유지비를 제외한 금액입니다.','After deducting daily upkeep.')}</small></div><strong data-shift-value="result">${amount(failed?s.shortfall:paid?s.balanceAfter:s.projectedBalance)}</strong></section><p id="shift-note" class="shift-note ${failed?'is-warning':''}">${warning|| (paid?L('오늘의 영업을 마쳤습니다.','Tonight’s shift is complete.'):main?L('정산 후 집으로 돌아갑니다.','Head home after settling up.'):L('확인하면 유지비가 한 번 차감됩니다.','Confirm to deduct daily upkeep once.'))}</p></div><footer class="shift-footer">${footer}</footer></section></div>`;
}
function current(){if(W.barGame?.overlay||W.lunaCampaign?.blocking||W.outsidePlaytest?.active)return null;return document.querySelector('.end-shift');}
let focusedSettlement=null,focusedStatus=null;
function sync(){const p=current();if(!p)return;const owner=W.barGame.dailySettlement,status=p.dataset.shiftStatus;
 if(owner!==focusedSettlement||status!==focusedStatus||!p.contains(document.activeElement))p.querySelector('.shift-primary')?.focus({preventScroll:true});
 focusedSettlement=owner;focusedStatus=status;
}
// These are completion dialogs, not dismissible overlays. Keep game shortcuts
// from changing the scene behind them; Tab still reaches every available action.
W.addEventListener('keydown',e=>{const p=current();if(!p)return;e.stopImmediatePropagation();const buttons=[...p.querySelectorAll('button:not(:disabled)')];if(e.code==='Tab'){e.preventDefault();const i=buttons.indexOf(document.activeElement);buttons[(i+(e.shiftKey?-1:1)+buttons.length)%buttons.length]?.focus();return;}if(['Escape','Space','Enter','KeyE'].includes(e.code)){e.preventDefault();if(!e.repeat&&e.code!=='Escape')(p.contains(document.activeElement)?document.activeElement:p.querySelector('.shift-primary'))?.click();}},true);
W.LunaSettlementView={html,sync};
})(window);
