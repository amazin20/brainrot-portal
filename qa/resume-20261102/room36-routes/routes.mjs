import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHeadlessGame} from '../../../scripts/lab-headless.mjs';
import {runV8Journey} from '../../../src/game/LabV8Journey.js';
import {ACTIVE_FOUNDATION_RUNTIME_FLAGS} from '../../../src/game/ReleaseIdentity.js';
import {disposeLabLevel} from '../../../src/game/LabLevelLifecycle.js';
const report={kind:'room36-initial-view-ordinary-regression',scope:'Real headless production inputs from zero-step normal spawn; not rendered route or aesthetics proof',pass:false,rows:[]};
const save=()=>fs.writeFileSync(new URL('./routes.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
for(const alternate of [false,true]){
 const g=await createHeadlessGame();Object.assign(g,{chamberEdition:'foundation',...ACTIVE_FOUNDATION_RUNTIME_FLAGS});
 const row={route:alternate?'scout-impact-first':'off-centre-impact',pass:false};report.rows.push(row);save();
 try{
  await g.selectLevel(35,true);assert.equal(g.firstLevel.id,'post-angular-cassette');
  const original={player:g.playerGroup,cargo:g.cargo,group:g.cargo.group,body:g.physics.cargoBody,shape:g.physics.cargoBody.shapes[0]};
  const buffers=[];for(const asset of g.assets.values())asset.traverse(m=>{if(m.isMesh)buffers.push([m,m.geometry,m.material,m.geometry.index,...Object.values(m.geometry.attributes)]);});
  const update=g.updatePlaying;let observations=0;
  g.updatePlaying=function(...args){assert.equal(g.playerGroup,original.player);assert.equal(g.cargo,original.cargo);assert.equal(g.cargo.group,original.group);assert.equal(g.physics.cargoBody,original.body);assert.equal(g.physics.cargoBody.shapes[0],original.shape);observations++;return update.apply(this,args);};
  const result=await runV8Journey(g,{journeyOptions:{nativeStart:true,alternate},onMilestone:m=>console.log(row.route,m.name)});
  assert.equal(result.pass,true);assert.equal(g.state,'won');assert.equal(result.resets,0);assert.equal(result.respawns,0);
  for(const [m,geo,mat,index,...attrs]of buffers){assert.equal(m.geometry,geo);assert.equal(m.material,mat);assert.equal(geo.index,index);assert.deepEqual(Object.values(geo.attributes),attrs);}
  Object.assign(row,{pass:true,state:g.state,physicsSteps:g.physics.world.stepnumber,observations,zeroResets:result.resets+result.respawns===0,sameOriginalOwners:true,assetBuffersUnchanged:true,frames:result.frames,milestones:result.milestones});
 }catch(e){row.error=String(e.stack||e);process.exitCode=1;}
 finally{disposeLabLevel(g);g.physics?.dispose();g.portals?.dispose();save();}
}
report.pass=report.rows.length===2&&report.rows.every(r=>r.pass);save();console.log(JSON.stringify({pass:report.pass,rows:report.rows.map(({milestones,...row})=>row)}));
