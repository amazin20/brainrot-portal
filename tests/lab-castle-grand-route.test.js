import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHeadlessGame} from '../scripts/lab-headless.mjs';
import {ACTIVE_FOUNDATION_RUNTIME_FLAGS} from '../src/game/ReleaseIdentity.js';
import {runV8Journey} from '../src/game/LabV8Journey.js';
import {disposeLabLevel} from '../src/game/LabLevelLifecycle.js';
test('Remastered final castle: all twelve original mechanisms through ordinary input with no reset or debug deletion',async()=>{
 const g=await createHeadlessGame();Object.assign(g,{chamberEdition:'foundation',...ACTIVE_FOUNDATION_RUNTIME_FLAGS});await g.selectLevel(40,true);
 const original={cargo:g.cargo,group:g.cargo.group,body:g.physics.cargoBody,shape:g.physics.cargoBody.shapes[0],player:g.playerGroup},update=g.updatePlaying,clear=g.clearPortals;let observations=0;
 const result={pass:false};g.clearPortals=()=>{throw Error('Pair deletion is unavailable to the player');};
 g.updatePlaying=function(...args){assert.equal(g.cargo,original.cargo);assert.equal(g.cargo.group,original.group);assert.equal(g.physics.cargoBody,original.body);assert.equal(original.body.shapes[0],original.shape);assert.equal(g.playerGroup,original.player);observations++;return update.apply(this,args);};
 try{assert.equal(g.physics.world.stepnumber,0);assert.equal(g.elapsed,0);assert.equal(g.state,'playing');assert.equal(g.firstLevel.completedStages,0);result.route=await runV8Journey(g);result.observations=observations;result.metrics=g.firstLevel.getTowerMetrics();assert.equal(g.state,'won');assert.equal(result.route.pass,true);assert.equal(result.route.resets+result.route.respawns+result.route.cargoResets,0);assert.equal(result.metrics.completedStages,12);assert.equal(result.metrics.checkpoints,false);result.pass=true;}
 catch(e){result.error=String(e.stack||e);throw e;}
 finally{g.updatePlaying=update;g.clearPortals=clear;if(process.env.CASTLE_GRAND_ROUTE_REPORT)fs.writeFileSync(process.env.CASTLE_GRAND_ROUTE_REPORT,JSON.stringify(result,null,2)+'\n');disposeLabLevel(g);}
});
