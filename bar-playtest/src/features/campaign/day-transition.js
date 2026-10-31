/* Presentation only. CampaignDay owns preparation, cancellation and input locks.
   Author-provided copy lives here; these are not spoken dialogue / CSV say rows. */
(function (W) {
  'use strict';
  const quotes = [
    {from:0, to:1, text:'"살아갈 이유가 있는 사람은 거의 어떤 삶의 방식도 견뎌낼 수 있다."', author:'- 프리드리히 니체, 『우상의 황혼』 -'},
    {from:1, to:2, text:'"수동적인 감정은 우리가 그것에 대해 명석하고 판명한 관념을 형성하는 순간,\n수동적인 감정이기를 그친다."', author:'- 바뤼흐 스피노자, 『에티카』 -'},
    {from:2, to:3, text:'"모든 인간은 예나 지금이나 노예와 자유인으로 나뉜다.\n하루의 3분의 2를 자기 자신을 위해 갖지 못하는 사람은 노예이기 때문이다."', author:'- 프리드리히 니체, 『인간적인 너무나 인간적인』 -'}
  ];
  const timing = {shadeIn:.65, blankHold:1.5, quoteIn:.5, authorDelay:.3, authorIn:.7, hold:4, quoteOut:.85, dayIn:.3, rollDelay:.85, rollDuration:.65, prepareDelay:1.55, titleOutDelay:2.3, titleOut:.3, revealDelay:2.7, revealDuration:.9};
  timing.quoteAt=timing.shadeIn+timing.blankHold;
  timing.authorAt=timing.quoteAt+timing.authorDelay;
  const smooth = x => {x=Math.max(0,Math.min(1,x));return x*x*(3-2*x);};
  const esc = s => String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function schedule(from,to) {
    const quote=quotes.find(q=>q.from===from&&q.to===to)||null;
    const dayAt=quote?timing.authorAt+timing.authorIn+timing.hold:.7;
    return {quote,dayAt,rollAt:dayAt+timing.rollDelay,prepareAt:dayAt+timing.prepareDelay,titleOutAt:dayAt+timing.titleOutDelay,revealAt:dayAt+timing.revealDelay};
  }
  function html(from,to,s) {
    const quote=s.quote?'<div class="day-transition-quote" aria-hidden="true"><p class="day-transition-quote-text">'+esc(s.quote.text)+'</p><p class="day-transition-author">'+esc(s.quote.author)+'</p></div>':'';
    return '<div class="day-transition-shade"></div>'+quote+'<div class="day-transition-title" aria-hidden="true"><span>Day</span><span class="day-transition-digits"><span class="day-digit-old">'+esc(from)+'</span><span class="day-digit-new">'+esc(to)+'</span></span></div>';
  }
  function paint(d) {
    const s=d.schedule,t=d.time,reveal=d.revealAt==null?0:smooth((t-d.revealAt)/timing.revealDuration);
    d.host.querySelector('.day-transition-shade').style.opacity=smooth(t/timing.shadeIn)*(1-reveal);
    const quote=d.host.querySelector('.day-transition-quote');
    if(quote){
      const fade=1-smooth((t-s.dayAt)/timing.quoteOut),reduced=W.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      for(const [selector,at,duration,rise] of [['.day-transition-quote-text',timing.quoteAt,timing.quoteIn,12],['.day-transition-author',timing.authorAt,timing.authorIn,10]]){
        const el=quote.querySelector(selector),enter=smooth((t-at)/duration);
        el.style.opacity=enter*fade;
        el.style.transform='translateY('+(reduced?0:(1-enter)*rise)+'px)';
      }
    }
    d.host.querySelector('.day-transition-title').style.opacity=smooth((t-s.dayAt)/timing.dayIn)*(1-smooth((t-s.titleOutAt)/timing.titleOut));
    // quoteOut === rollDelay: the old number stays still until every quote pixel has faded.
    const roll=smooth((t-s.rollAt)/timing.rollDuration),old=d.host.querySelector('.day-digit-old'),next=d.host.querySelector('.day-digit-new');
    old.style.transform='translateY('+(-roll*110)+'%)';old.style.opacity=1-roll;
    next.style.transform='translateY('+((1-roll)*110)+'%)';next.style.opacity=roll;
  }
  const variants=()=>quotes.map(q=>({id:q.from+'-'+q.to,label:q.from+'일차 → '+q.to+'일차',launch:{type:'day-transition',from:q.from,to:q.to}}));
  W.LunaDayTransition={quotes,timing,schedule,html,paint,variants};
})(window);
