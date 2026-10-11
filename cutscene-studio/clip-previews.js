(function(W){'use strict';
const paths={
 state:'<path d="m12 3 9 9-9 9-9-9ZM3 12h18"/>',
 camera:'<rect x="3" y="6" width="12" height="12" rx="2"/><path d="m15 10 6-4v12l-6-4"/>',
 dialogue:'<path d="M5 4h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-8l-5 4v-4H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z"/><path d="M7 9h10M7 13h6"/>',
 audio:'<path d="M4 9h4l5-4v14l-5-4H4ZM17 8a6 6 0 0 1 0 8M20 5a10 10 0 0 1 0 14"/>',
 fx:'<path d="m12 3 2.4 6.6L21 12l-6.6 2.4L12 21l-2.4-6.6L3 12l6.6-2.4ZM20 2v4M18 4h4"/>',
 gate:'<rect x="3" y="3" width="18" height="18" rx="4"/><path d="M16 7H9v10h7M9 12h6"/>',
 image:'<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8" cy="8" r="1.5"/><path d="m3 18 6-6 4 4 3-5 5 7"/>'
};
const labels={state:'오브젝트 키',camera:'카메라',dialogue:'대사',audio:'사운드',fx:'화면 효과',gate:'입력 대기',image:'이미지'};
const thumbnails=new WeakMap();
function thumbnail(s){
 let cache=thumbnails.get(s.im);if(!cache){cache=new Map();thumbnails.set(s.im,cache);}const key=[s.x,s.y,s.w,s.h].join(':');if(cache.has(key))return cache.get(key);
 const out=document.createElement('canvas');out.width=out.height=96;const g=out.getContext('2d');g.imageSmoothingEnabled=false;
 // Trim transparent sheet padding, never neighbouring frames; opaque backgrounds retain their aspect ratio.
 const probe=document.createElement('canvas'),k=Math.min(256/s.w,256/s.h);probe.width=Math.max(1,Math.ceil(s.w*k));probe.height=Math.max(1,Math.ceil(s.h*k));const pg=probe.getContext('2d');pg.imageSmoothingEnabled=false;pg.drawImage(s.im,s.x,s.y,s.w,s.h,0,0,probe.width,probe.height);
 let x=0,y=0,w=s.w,h=s.h;
 try{const pixels=pg.getImageData(0,0,probe.width,probe.height).data;let left=probe.width,top=probe.height,right=-1,bottom=-1;for(let j=0;j<probe.height;j++)for(let i=0;i<probe.width;i++)if(pixels[(j*probe.width+i)*4+3]>8){left=Math.min(left,i);right=Math.max(right,i);top=Math.min(top,j);bottom=Math.max(bottom,j);}if(right>=left){x=left/probe.width*s.w;y=top/probe.height*s.h;w=(right-left+1)/probe.width*s.w;h=(bottom-top+1)/probe.height*s.h;}}catch{/* Unreadable remote pixels still get a first-frame thumbnail. */}
 const scale=Math.min(90/w,90/h);g.drawImage(s.im,s.x+x,s.y+y,w,h,(96-w*scale)/2,(96-h*scale)/2,w*scale,h*scale);cache.set(key,out);return out;
}
function markup(c){const type=paths[c.type]?c.type:'image';return '<span class="clip-preview" aria-hidden="true" data-preview-kind="'+type+'"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">'+paths[type]+'</svg>'+(['move','visual','background'].includes(c.type)?'<canvas width="96" height="96"></canvas>':'')+'</span>';}
function source(c,project,data,images){
 const first=c.actionKeys?.[0];if(first)c=first.source.startsWith('native:')?{...c,animation:first.source.slice(7),assetId:null}:{...c,assetId:first.source};
 const assetId=c.assetId||(c.type==='move'?project.actors[c.actor]?.assetId:null),a=W.StudioMedia.assets.get(assetId);
 if(a){if(a.kind==='audio')return null;if(a.sheet){const sheet=W.Sprites.get(a.sheet),f=sheet?.frames[a.from||0];return f?{im:sheet.img,x:f.sx,y:f.sy,w:f.sw,h:f.sh}:null;}return {im:W.StudioMedia.getImage(a.id),x:0,y:0,w:a.fw,h:a.fh};}
 if(c.type!=='move')return null;
 let sp,url;
 if(c.actor==='luna')sp=(data.animations[c.animation]||data.animations.idle).frames[0];
 else if(c.actor==='samho'){if(c.animation&&c.animation!=='idle'){sp={x:0,y:0,w:84,h:81};url='../bar-playtest/assets/outside/samho-run.png';}else sp=data.scenes.street.nodes.find(n=>n.name==='Samho')?.sprite;}
 else if(c.actor==='bubi'){sp={x:0,y:0,w:47,h:34};url='../bar-playtest/assets/outside/bubi-cat-idle.png';}
 if(!sp)return null;url=url||'../bar-playtest/'+data.assets[sp.asset]?.src;return {im:images.get(url),x:sp.x,y:sp.y,w:sp.w,h:sp.h};
}
function paint(root,project,data,images){
 const clips=new Map(project.clips.map(c=>[c.id,c]));
 for(const canvas of root.querySelectorAll('.clip-preview canvas')){const c=clips.get(canvas.closest('[data-clip]').dataset.clip),s=source(c,project,data,images);if(!s?.im)continue;
  const draw=()=>{if(!canvas.isConnected||!s.im.naturalWidth||!s.w||!s.h)return;const g=canvas.getContext('2d');g.clearRect(0,0,96,96);g.drawImage(thumbnail(s),0,0);canvas.parentElement.classList.add('has-image');canvas.parentElement.dataset.previewKind='first-frame';};
  if(s.im.complete)draw();else s.im.addEventListener('load',draw,{once:true});
 }
}
W.StudioClipPreviews={markup,paint,labels};
})(window);
