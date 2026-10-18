/* Runs only in the offline export browser. Never loaded by the game. */
(function(W){'use strict';
const paintProps=['background-color','background-image','background-position','background-size','background-repeat','background-origin','background-clip','border-top-width','border-right-width','border-bottom-width','border-left-width','border-top-style','border-right-style','border-bottom-style','border-left-style','border-top-color','border-right-color','border-bottom-color','border-left-color','border-top-left-radius','border-top-right-radius','border-bottom-left-radius','border-bottom-right-radius','outline-color','outline-width','outline-style','outline-offset','box-shadow','clip-path','color','font-family','font-size','font-weight','font-style','line-height','text-shadow'];
const glyph=/^(?:[＋+−!×✕✖‹›⌄\u2190-\u21ff\u23e9-\u23fa\u25a0-\u25ff\u2713-\u2718]|[EWASDQY]|Shift|SHIFT|Space|SPACE|ESC|Esc|Enter|Tab|Ctrl|Alt)$/;
const transparent=c=>!c||c==='transparent'||/rgba\([^)]*,\s*0(?:\.0*)?\)/.test(c);
const plain=el=>el.id?'#'+el.id:el.tagName.toLowerCase()+[...el.classList].filter(x=>!x.startsWith('__export')).map(x=>'.'+x).join('');
const svgPad=el=>Math.ceil(2+Math.max(0,...[el,...el.querySelectorAll('*')].map(e=>{const s=getComputedStyle(e);return s.stroke==='none'?0:(parseFloat(s.strokeWidth)||0)/2;})));
function visible(el){if(!el.getClientRects().length||el.closest('[hidden]'))return false;const r=el.getBoundingClientRect(),s=getComputedStyle(el);return r.width>0&&r.height>0&&r.right>0&&r.bottom>0&&r.left<innerWidth&&r.top<innerHeight&&s.display!=='none'&&s.visibility!=='hidden'&&+s.opacity>.01;}
function styleOf(el,pseudo){const s=getComputedStyle(el,pseudo);return Object.fromEntries(paintProps.map(k=>[k,s.getPropertyValue(k)]));}
function svgMarkup(el,target=null){
 const copy=el.cloneNode(true),original=[el,...el.querySelectorAll('*')],clones=[copy,...copy.querySelectorAll('*')];
 for(let i=0;i<original.length;i++){
  const src=original[i],dst=clones[i],s=getComputedStyle(src);
  for(const key of ['fill','fill-opacity','stroke','stroke-width','stroke-opacity','stroke-linecap','stroke-linejoin','stroke-dasharray','opacity','color','font-size','font-family','font-weight','text-anchor','dominant-baseline'])dst.style.setProperty(key,s.getPropertyValue(key));
  if(dst.tagName.toLowerCase()==='image'){const href=src.getAttribute('href')||src.getAttribute('xlink:href');if(href)dst.setAttribute('href',new URL(href,document.baseURI).href);}
  if(dst.tagName.toLowerCase()==='text'&&!glyph.test(dst.textContent.trim()))dst.remove();
  if(['foreignobject','script','style'].includes(dst.tagName.toLowerCase()))dst.remove();
  if(target&&src!==el&&!src.closest('defs')&&src.tagName.toLowerCase()!=='defs'&&src!==target&&!src.contains(target)&&!target.contains(src))dst.remove();
 }
 copy.removeAttribute('class');copy.removeAttribute('id');copy.style.position='static';copy.style.transform='none';copy.style.margin='0';copy.style.width='100%';copy.style.height='100%';copy.style.display='block';
 if(target){const r=target.getBoundingClientRect(),m=el.getScreenCTM().inverse(),a=new DOMPoint(r.left,r.top).matrixTransform(m),b=new DOMPoint(r.right,r.bottom).matrixTransform(m),pad=svgPad(target);copy.setAttribute('viewBox',[a.x-pad,a.y-pad,b.x-a.x+pad*2,b.y-a.y+pad*2].join(' '));}
 return new XMLSerializer().serializeToString(copy);
}
function collect(root=document.body,{states=true}={}){
 const parts=[],originals=[];
 function add(el,pseudo='',state='normal'){
  const s=getComputedStyle(el,pseudo),style=styleOf(el,pseudo),source=plain(el)+pseudo;
  let w=pseudo?parseFloat(s.width):el.offsetWidth,h=pseudo?parseFloat(s.height):el.offsetHeight;
  if(pseudo){const bw=parseFloat(s.borderLeftWidth)+parseFloat(s.borderRightWidth),bh=parseFloat(s.borderTopWidth)+parseFloat(s.borderBottomWidth);if(Number.isFinite(w))w=s.boxSizing==='border-box'?Math.max(w,bw):w+bw;if(Number.isFinite(h))h=s.boxSizing==='border-box'?Math.max(h,bh):h+bh;}
  if(!Number.isFinite(w)||!Number.isFinite(h)){const r=el.getBoundingClientRect();w=Number.isFinite(w)?w:r.width;h=Number.isFinite(h)?h:r.height;}
  w=Math.ceil(w);h=Math.ceil(h);if(w<1||h<1||w>2560||h>1440)return;
  if(pseudo&&(s.content==='none'||s.content==='normal'))return;
  let rotation=0;if(pseudo&&s.transform!=='none'){const matrix=new DOMMatrix(s.transform);rotation=Math.atan2(matrix.b,matrix.a)*180/Math.PI;}
  const item={w,h,style,source,state,rotation};
  const hasBorder=['top','right','bottom','left'].some(side=>parseFloat(style['border-'+side+'-width'])>0&&!['none','hidden'].includes(style['border-'+side+'-style'])&&!transparent(style['border-'+side+'-color']));
  if(!transparent(style['background-color'])||style['background-image']!=='none')parts.push({...item,kind:'background'});
  if(hasBorder||parseFloat(style['outline-width'])>0&&!['none','hidden'].includes(style['outline-style'])&&!transparent(style['outline-color']))parts.push({...item,kind:'border'});
  if(style['box-shadow']!=='none'&&!/9999px/.test(style['box-shadow']))parts.push({...item,kind:'shadow'});
  const text=pseudo?s.content.replace(/^["']|["']$/g,''):el.textContent.trim();
  if(glyph.test(text)&&(pseudo||el.matches('kbd,.story-notice-icon,[class*="icon"],[class*="key"],[class*="arrow"],button'))&&!el.querySelector('svg,img'))parts.push({...item,kind:'icon',glyph:text});
 }
 const elements=[root,...root.querySelectorAll('*')].filter(el=>el instanceof HTMLElement&&visible(el)&&!el.closest('.inspector,.qa-lab,.outside-console,#luna-qa,#cutscene-preview-toolbar'));
 for(const el of elements){
  if(el.matches('img')){if(el.currentSrc&&!/resource-(exports|previews)/.test(el.currentSrc))originals.push({src:el.currentSrc,source:plain(el)});continue;}
  if(el.matches('canvas,video,iframe,script,style,link,option'))continue;
  // Scene layers are not UI; their original art remains in the ordinary inventory.
  if(el.matches('body,html,#app,#campaign-root,#outside-root,.world,.stage,.campaign-stage,.bar-scene-layer,.actor,.actor-layer,.vignette,.world-bg,.world-fg'))continue;
  if(el.offsetWidth>=1200&&el.offsetHeight>=650&&!/scrim|shade|overlay|backdrop|tutorial/.test(el.className))continue;
  add(el);add(el,'::before');add(el,'::after');
 }
 for(const svg of root.querySelectorAll('svg'))if(visible(svg)&&!svg.parentElement?.closest('svg')&&!svg.closest('.outside-console,.qa-lab')&&!svg.matches('.stir-clock')){
  const r=svg.getBoundingClientRect(),s=getComputedStyle(svg),w=parseFloat(s.width)||r.width,h=parseFloat(s.height)||r.height;
  if(w<1||h<1||w>1280||h>720)continue;
  parts.push({w:Math.ceil(w),h:Math.ceil(h),source:plain(svg),state:'normal',kind:'icon',svg:svgMarkup(svg),style:{}});
  for(const child of svg.querySelectorAll('g[class],path[class],rect[class],circle[class],ellipse[class],polygon[class],polyline[class]')){
   if(child.closest('defs')||!visible(child))continue;const r=child.getBoundingClientRect(),matrix=svg.getScreenCTM();if(!matrix)continue;
   const pad=svgPad(child),cw=Math.ceil(r.width/Math.hypot(matrix.a,matrix.b)+pad*2),ch=Math.ceil(r.height/Math.hypot(matrix.c,matrix.d)+pad*2);if(cw<1||ch<1||cw>1280||ch>720)continue;
   parts.push({w:cw,h:ch,source:plain(svg)+' / '+plain(child),state:'normal',kind:'icon',svg:svgMarkup(svg,child),style:{}});
  }
 }
 if(states){
  const overrides=[];function rules(list){for(const r of list){if(r.selectorText&&/:hover|:active|:focus-visible/.test(r.selectorText))overrides.push(r.selectorText.replace(/:hover/g,'.__export_hover').replace(/:active/g,'.__export_active').replace(/:focus-visible/g,'.__export_focus')+'{'+r.style.cssText+'}');else if(r.cssRules&&!r.name)rules(r.cssRules);}}
  for(const sheet of document.styleSheets)try{rules(sheet.cssRules);}catch{}
  const tag=document.createElement('style');tag.textContent=overrides.join('\n');document.head.append(tag);
  const done=new Set();for(const el of elements.filter(el=>el.matches('button,kbd,[role="button"],a'))){const key=plain(el);if(done.has(key))continue;done.add(key);
   for(const state of ['hover','active','focus']){el.classList.add('__export_'+state);add(el,'',state);add(el,'::before',state);add(el,'::after',state);for(const child of el.querySelectorAll('kbd,[class*="icon"],[class*="key"]'))add(child,'',state);el.classList.remove('__export_'+state);}
  }tag.remove();
 }
 return {parts,originals};
}
W.UIGraphicSnapshot={collect};
})(window);
