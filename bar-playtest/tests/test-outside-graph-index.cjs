const assert=require('node:assert/strict');
const storage=require('../../tools/dialogue-editor-storage.cjs');
const {Model}=require('../src/dev/dialogue-editor/outside-model.js'),map=require('../src/dev/dialogue-editor/outside-flow-map.js');
(async()=>{
 const s=await storage.snapshot(),m=await new Model(s.files,s.presentation).init();m.refreshChoiceFlows();
 const reference=m.tables.steps,read=m.withReadIndex.bind(m);let scans=0;
 // Count full step-table filters, independent of CPU speed.
 Object.defineProperty(reference,'filter',{configurable:true,value(...args){scans++;return Array.prototype.filter.apply(this,args);}});
 function snapshot(sites){return sites.map(s=>{
  const g=map.graph(m,s.id);
  return {flows:g.flows.map(f=>f.id),first:[...g.first],edges:g.edges,nodes:g.nodes.map(n=>
   [n.id,n.owner,n.title,n.kind,n.rows.map(r=>r.row_id),n.ports.map(p=>[p.c.label,p.dest,p.to])])};
 });}
 function compare(sites){
  scans=0;m.withReadIndex=fn=>fn();const original=snapshot(sites),before=scans;
  scans=0;m.withReadIndex=read;assert.deepEqual(snapshot(sites),original);assert(scans<before);
  return {before,after:scans};
 }
 const result=compare(map.sites);
 assert.throws(()=>m.withReadIndex(()=>{throw Error('cancelled');}));assert.equal(m.readIndex,null);
 const flow=m.flow('newspaper/right'),row=m.rows(flow.id)[0],prev=row.parent_id;
 row.parent_id=m.flow('newspaper/wrong').parent;compare([map.sites.find(s=>s.id==='newspaper')]);row.parent_id=prev;
 delete reference.filter;
 console.log('OUTSIDE_GRAPH_INDEX_OK: '+map.sites.length+' encounters match node/edge/owner/choice data, moved rows observed; whole-table filters '+result.before+' → '+result.after+'.');
})().catch(e=>{console.error(e);process.exitCode=1;});
