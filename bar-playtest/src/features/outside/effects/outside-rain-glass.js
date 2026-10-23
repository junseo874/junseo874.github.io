/* The engine's WindowRainLayer, adapted to the browser's scene clock and canvas.
   The scene is captured before this pass; DOM dialogue/menu UI remains outside
   the optical pass just as Unity's Screen Space Overlay UI does. */
(function(W){
'use strict';
const layers=new WeakMap();
function reset(layer){layer.simulation=null;layer.lastTime=null;layer.cameraMotion=new W.LunaRainSimulation.Motion();layer.subjectMotion=new W.LunaRainSimulation.Motion();layer.referenceHeight=0;layer.windTime=0;layer.renderer?.clear();}
function draw(ctx,model,options={}){
 // An explicit owner is the conversation lifetime, not the current DOM canvas.
 // Preserve both simulation and GPU trail textures across settings/cutscene remounts.
 const canvas=ctx.canvas,key=options.owner||canvas;let layer=layers.get(key);
 if(model.scene!=='street'||model.qa){if(layer?.simulation)reset(layer);return false;}
 const raining=!!W.LunaOutsideRain?.enabled(model),owner=options.owner||model,time=Number(model.time)||0;
 if(!layer){if(!raining)return false;layer={renderer:null,error:null};layers.set(key,layer);reset(layer);}
 layers.set(canvas,layer);
 if(layer.owner!==owner||(layer.lastTime!==null&&time<layer.lastTime)){reset(layer);layer.owner=owner;}
 if(!layer.simulation){if(!raining)return false;layer.simulation=new W.LunaRainSimulation.Simulation();layer.simulation.prewarm(8);layer.lastTime=time;}
 if(layer.error)return false;
 try{
  if(layer.renderer?.lost){layer.renderer.dispose();layer.renderer=null;}
  if(!layer.renderer)layer.renderer=new W.LunaRainRenderer.Renderer();
  const reduced=!!W.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const dt=reduced?0:Math.min(4/30,Math.max(0,time-layer.lastTime));layer.lastTime=time;
  const cam=options.camera||{x:0,y:0,w:4.8};
  if(!layer.referenceHeight)layer.referenceHeight=cam.w*720/1280;
  layer.cameraMotion.sample(cam.x,cam.y,layer.referenceHeight,dt);
  layer.subjectMotion.sample(model.x||0,model.y||0,layer.referenceHeight,dt);
  layer.windTime+=dt;
  const motion=layer.cameraMotion,noise=W.LunaRainSimulation.noise;
  const gust=(noise(layer.windTime*.35,3.1)-.45)*2*22;
  const force={x:-14+gust-(motion.vx*1.1+motion.ax*.3)*270,y:-(motion.vy*1.1+motion.ay*.3)*270};
  layer.simulation.step(dt,raining?1:0,force,motion.moving||layer.subjectMotion.moving);
  layer.renderer.maps(layer.simulation,dt);
  const image=layer.renderer.render(options.source||canvas);
  if(image){ctx.save();ctx.globalAlpha=1;ctx.globalCompositeOperation='source-over';ctx.imageSmoothingEnabled=!!options.smoothPresentation;ctx.imageSmoothingQuality='low';ctx.drawImage(image,0,0,1280,720);ctx.restore();}
  return !!image;
 }catch(error){if(!layer.error){layer.error=error.message;console.warn('Window rain renderer unavailable:',error);}return false;}
}
W.LunaRainGlass={draw,inspect:canvas=>layers.get(canvas)||null};
})(typeof window==='undefined'?globalThis:window);
