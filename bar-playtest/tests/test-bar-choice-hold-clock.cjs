const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
// A deterministic frame clock verifies the duration independently of browser load.
for(const input of ['pointer','KeyE','Enter','Space']){
 let now=0,raf=null,commits=0;
 const listeners={},on=(name,fn)=>(listeners[name]??=[]).push(fn);
 const el={isConnected:true,disabled:false,dataset:{id:'1'},classList:{toggle(){}},style:{setProperty(){}},focus(){doc.activeElement=el;},closest(selector){return selector==='[inert]'?null:el;}};
 const doc={activeElement:el,hidden:false,addEventListener:on};
 const root={querySelectorAll:()=>[el],querySelector:()=>el,addEventListener:on};
 const win={addEventListener:on};
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../src/shared/dialogue/choice-hold.js'),'utf8'),{window:win,document:doc,performance:{now:()=>now},requestAnimationFrame:fn=>(raf=fn,1),cancelAnimationFrame:()=>{raf=null;},Set});
 const choice={};win.LunaChoiceHold({root,choice:()=>choice,allowed:()=>true,commit:()=>commits++});
 const event={target:el,code:input,button:0,pointerId:1,preventDefault(){},stopImmediatePropagation(){}};
 const send=name=>listeners[name].forEach(fn=>fn(event));
 const frame=ms=>{now+=ms;const fn=raf;raf=null;fn?.(now);};
 send(input==='pointer'?'pointerdown':'keydown');
 for(let i=0;i<5;i++)frame(50);
 frame(49);assert.equal(commits,0,input+' must not confirm at 299ms');
 frame(2);assert.equal(commits,1,input+' must confirm at the first frame after 300ms');
 frame(50);send(input==='pointer'?'pointerup':'keyup');assert.equal(commits,1,input+' must commit once');
}
console.log('BAR_CHOICE_HOLD_CLOCK_OK: pointer/E/Enter/Space share 300ms and one-shot confirmation');
