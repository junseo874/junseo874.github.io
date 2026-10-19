const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),{parse}=require('../tools/audit_engine_lighting.cjs');
const a=parse(),w={},context={window:w};vm.createContext(context);
vm.runInContext(fs.readFileSync(__dirname+'/../outside-wall-lighting.js','utf8'),context);
const fx=w.LunaWallLighting,lights=a.lights.filter(l=>l.active&&l.name.startsWith('Atmospheric'));
assert.equal(lights.length,10);assert.equal(fx.regions.length,lights.length);
for(const l of lights){const matches=fx.regions.filter(r=>r.source===l.name);assert.equal(matches.length,1,l.name+' must be accounted for once');const r=matches[0],floor=r.target==='1F Floor';const points=l.points.map(([x,y])=>floor?[(x+22.25+.13)*100,(-.83-y)*100]:[(x+6.38)*100,(2.21-y)*100]);assert.equal(r.points.length,points.length);points.forEach((p,i)=>p.forEach((v,k)=>assert(Math.abs(v-r.points[i][k])<=.51,l.name+' native-pixel transform')));assert(l.layers.includes(floor?4037846725:1211334403),l.name+' target sorting layer');if(r.falloff)assert(Math.abs(l.falloff*100-r.falloff)<.01,l.name+' falloff');}
const rays=a.sprites.filter(n=>n.name==='CityUpLight'&&n.active);assert.equal(rays.length,5);assert.equal(fx.cityRays.length,rays.length);
for(const n of rays){const r=fx.cityRays.find(r=>r.id===n.id);assert(r);assert(Math.abs(r.rotation-Math.atan2(-n.c,n.d))<1e-8,'exact engine ray angle '+n.id);}
const data={scenes:{street:{nodes:rays.map(n=>({id:n.id,name:n.name}))}}};fx.apply(data);assert(data.scenes.street.nodes.every(n=>Number.isFinite(n.lightRotation)));
console.log('PASS full scene audit: 10/10 atmospheric lights mapped to receivers, source paths/falloffs/layers verified; 5/5 city-ray angles restored. Total engine Light2D inventory:',a.lights.length);
