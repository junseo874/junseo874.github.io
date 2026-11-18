/* Five resolved Unity GradeColorSet prefabs, sampled by Unity at 60 Hz.
 * No GIF pixels, inferred animation curves or substitute particle choreography. */
(function(W){'use strict';
 const reference=W.LUNA_SERVE_GRADE_REVEAL,grades=Object.fromEntries(reference.grades.map(g=>[g.id,g]));
 const assets=Object.fromEntries(reference.grades.map(g=>[g.id,{src:g.image,w:1261,h:287}]));
 const timing=Object.freeze({handoff:1.5,reveal:3.4,readable:reference.readable,fade:.45}),bounds=Object.freeze({x:420,y:40,w:440,h:440*287/1261});
 const clamp=x=>Math.max(0,Math.min(1,x)),smooth=x=>{x=clamp(x);return x*x*(3-2*x);};
 function frameAt(t){return Math.min(204,Math.max(0,Math.floor(t*60+1e-5)));}
 function motionAt(t,id='excellent'){const frames=grades[id].frames,f=frameAt(t),a=frames[f].text,b=frames[Math.min(f+1,204)].text,u=clamp(t*60-f);return {sx:a[0]+(b[0]-a[0])*u,sy:a[1]+(b[1]-a[1])*u,opacity:a[2]+(b[2]-a[2])*u};}
 // Continue only the prefab's ambient emitters; do not restart its entrance flash.
 // Wrapped particle tails keep each original particle alive across the ten-second loop.
 function ambientAt(time,id){const a=grades[id].ambient,t=Math.max(0,time-a.start),particles=a.glow[Math.floor(t%a.glowPeriod/a.glowPeriod*a.glow.length)].slice();
  const head=a.head[Math.floor(t*60+1e-5)];if(head)particles.push(...head);
  if(time>=a.emissionStart){const elapsed=time-a.emissionStart,f=a.loop[Math.floor(elapsed%a.period*60+1e-5)%a.loop.length];particles.push(...f.particles);if(elapsed>=a.period)particles.push(...f.tail);}
  return {particles};
 }
 function createPlayback(){let grade='decent',renderer=null,loaded=false,unavailable=false,generation=0,images=new Map(),paint=new WeakMap();
  function dispose(){generation++;renderer?.dispose();renderer=null;images.clear();loaded=false;unavailable=false;paint=new WeakMap();}
  function reset(id){dispose();grade=grades[id]?id:'decent';const gen=generation;const white=document.createElement('canvas');white.width=white.height=1;white.getContext('2d').fillStyle='#fff';white.getContext('2d').fillRect(0,0,1,1);images.set('white',white);Promise.all([...new Set(grades[grade].layers.map(l=>l.texture).filter(Boolean))].map(src=>new Promise(resolve=>{const i=new Image();i.onload=()=>{if(gen===generation)images.set(src,i);resolve();};i.onerror=resolve;i.src=src;}))).then(()=>{if(gen===generation){try{unavailable=!!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;if(!unavailable)renderer=W.LunaGradeEngine.create();}catch(e){unavailable=true;console.warn('Grade GPU unavailable:',e.message);}loaded=true;}});}
  function draw(canvas,image,time,reduced=false,scene={}){const ctx=canvas.getContext('2d'),frame=frameAt(time),key=[canvas.width,canvas.height,!!image,reduced].join('|');if(time>=timing.reveal&&paint.get(canvas)===key)return;
   canvas.dataset.time=time.toFixed(3);canvas.dataset.frame=frame;canvas.dataset.grade=grade;canvas.dataset.source=grades[grade].prefab;canvas.dataset.lettering=assets[grade].src;canvas.dataset.engine='Unity '+reference.unityVersion;canvas.dataset.ambient=String(time>=timing.reveal);
   const m=motionAt(time,grade);if(!reduced&&!unavailable&&loaded&&image&&time>=0){try{renderer ||= W.LunaGradeEngine.create();renderer.draw(canvas,grades[grade],time<timing.reveal?grades[grade].frames[frame]:ambientAt(time,grade),m,image,time,scene.background,scene.carbonation,images);return;}catch(e){canvas.dataset.renderError=e.message;unavailable=true;console.warn('Grade renderer:',e.message);renderer?.dispose();renderer=null;}}
   ctx.clearRect(0,0,canvas.width,canvas.height);if(time<0)return;const r=grades[grade].imageRect,originY=bounds.y+(r[1]+r[3])*bounds.w/r[2];ctx.save();ctx.scale(canvas.width/1280,canvas.height/720);ctx.translate(640,originY);ctx.scale(m.sx,m.sy);ctx.translate(-640,-originY);ctx.globalAlpha=m.opacity;ctx.imageSmoothingQuality='high';if(image)ctx.drawImage(image,bounds.x,bounds.y,bounds.w,bounds.h);else{ctx.fillStyle='#ffe0a0';ctx.textAlign='center';ctx.font='18px LunaPixel';ctx.fillText('– 제조완료 –',640,62);ctx.font='48px LunaPixel';ctx.fillText(grade.toUpperCase(),640,124);}ctx.restore();if(time>=timing.reveal){paint.set(canvas,key);renderer?.dispose();renderer=null;}
  }
  return {reset,dispose,draw,invalidate:c=>paint.delete(c),get ready(){return loaded;}};
 }
 W.LunaServeGrade={assets,timing,bounds,frameAt,motionAt,ambientAt,createPlayback,controlsOpacity:t=>smooth((t-timing.handoff-timing.readable)/timing.fade)};
})(window);
