/* Larger flying vehicles share the supplied traffic sheet and its pixel renderer. */
(function(W){
'use strict';
const travelRate=.75;
const flightBounds = Object.freeze({left:-24,right:10});
const flightSpan = flightBounds.right-flightBounds.left;
const routes = Object.freeze([
  {id:'lower',direction:1,duration:112*flightSpan/29,phase:31+5*112/29,y:2.55,width:1.9},
  {id:'upper',direction:-1,duration:124*flightSpan/29,phase:52,y:7.5,width:1.61}
]);
// In front of the middle-city displays, behind street/residence foreground. Opaque blue-toned shading,
// never from letting buildings show through the hull or LED panel.
const depth = Object.freeze({parallaxX:.9,alpha:1});
function vehicles(m) {
  if(!m||m.qa||m.scene!=='street')return [];
  const time=Math.max(0,Number(m.time)||0);
  return routes.map(r=>{
    // Wrap only beyond the world edge, with no idle/despawn interval. The camera never controls this clock.
    const clock=time*travelRate+r.phase,cycle=Math.floor(clock/r.duration),age=clock-cycle*r.duration;
    return {id:r.id+':'+cycle,direction:r.direction,
      x:r.direction===1?flightBounds.left+age/r.duration*flightSpan:flightBounds.right-age/r.duration*flightSpan,
      y:r.y,width:r.width,
      alpha:1,sprite:r.id==='lower'?'carrier':'screen'};
  });
}
function draw(ctx,m,cam,position,images){
 const image=images?.get(W.LUNA_OUTSIDE_DATA?.streetVehicleSheet);
 if(!image)return;
 for(const v of vehicles(m)){
  const p=position(v.x+(cam.x+7.85)*(1-depth.parallaxX),v.y);
  W.LunaOutsideTraffic.paint(ctx,image,v,p,v.width*1280/cam.w);
 }
}
W.LunaOutsideAdCarrier={vehicles,travelRate,routes,flightBounds,depth,draw};
})(typeof window==='undefined'?globalThis:window);
