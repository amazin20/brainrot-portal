import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHeadlessGame} from '../scripts/lab-headless.mjs';
import {ACTIVE_FOUNDATION_RUNTIME_FLAGS} from '../src/game/ReleaseIdentity.js';
import {runV8Journey} from '../src/game/LabV8Journey.js';
import {disposeLabLevel} from '../src/game/LabLevelLifecycle.js';
for(let index=30;index<40;index++)test(`Observatory ${index+1}: normal wide-screen route preserves both original travellers`,async()=>{
 const g=await createHeadlessGame();Object.assign(g,{chamberEdition:'foundation',...ACTIVE_FOUNDATION_RUNTIME_FLAGS});await g.selectLevel(index,true);
 const cargo=g.cargo,group=cargo.group,body=g.physics.cargoBody,shape=body.shapes[0],update=g.updatePlaying;let observations=0;
 const row={level:index+1,id:g.firstLevel.id,pass:false};
 g.updatePlaying=function(...args){assert.equal(g.cargo,cargo);assert.equal(cargo.group,group);assert.equal(g.physics.cargoBody,body);assert.equal(body.shapes[0],shape);observations++;return update.apply(this,args);};
 try{
  row.route=await runV8Journey(g,{journeyOptions:{nativeStart:true}});row.state=g.state;row.observations=observations;
  assert.equal(row.route.pass,true);assert.equal(g.state,'won');assert.equal(row.route.resets+row.route.respawns,0);row.pass=true;
 }catch(e){row.failure=String(e.stack||e);throw e;}finally{
  g.updatePlaying=update;disposeLabLevel(g);if(process.env.OPTICS_ROUTE_REPORT)fs.appendFileSync(process.env.OPTICS_ROUTE_REPORT,JSON.stringify(row)+'\n');
 }
});
