import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHeadlessGame} from './lab-headless.mjs';
import {runV8Journey} from '../src/game/LabV8Journey.js';
import {ACTIVE_FOUNDATION_RUNTIME_FLAGS} from '../src/game/ReleaseIdentity.js';
import {FOUNDATION_SEQUENCE,foundationDisplayNumber} from '../src/game/LabCampaignSequence.js';

const selected=(process.env.ROOMS||FOUNDATION_SEQUENCE.map(i=>i+1).join(',')).split(',').map(Number);
assert.ok(selected.every(n=>Number.isInteger(n)&&n>=1&&n<=51));
const output=process.env.OUT||'qa/campaign-ordinary/report.json';
fs.mkdirSync(path.dirname(output),{recursive:true});
const report={sourceCommit:process.env.BUILD_COMMIT??null,pass:false,
 scope:'Complete scripted production-input routes with original cargo. Headless physics does not establish WebGL appearance, human puzzle quality, or hardware FPS.',
 runtime:{chamberEdition:'foundation',...ACTIVE_FOUNDATION_RUNTIME_FLAGS},selected,rows:[]};
const save=()=>fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');
const g=await createHeadlessGame();Object.assign(g,report.runtime);
try{
 for(const stableLevel of selected){
  // The continuous castle observes the normal playing spawn; shorter drivers
  // perform their own normal setup before observation.
  await g.selectLevel(stableLevel-1,stableLevel===41);
  const body=g.physics.cargoBody,shape=body.shapes[0],cargo=g.cargo;
  const row={stableLevel,number:foundationDisplayNumber(stableLevel-1),id:g.firstLevel.id,pass:false};
  report.active={...row,phase:'ordinary-route'};save();
  try{
   const result=await runV8Journey(g);
   assert.equal(result.pass,true);assert.equal(g.state,'won');
   assert.equal(g.physics.cargoBody,body);assert.equal(body.shapes[0],shape);assert.equal(g.cargo,cargo);
   assert.equal(result.resets??result.cargoResets??0,0);assert.equal(result.respawns??0,0);
   Object.assign(row,{pass:true,state:g.state,frames:result.frames,steps:result.physicsSteps??null,
    resets:result.resets??result.cargoResets??0,respawns:result.respawns??0,sameOriginal:true,
    milestones:result.milestones??result.events??[]});
   console.log('ORDINARY PASS',row.number,'stable',stableLevel,row.id,row.frames);
  }catch(error){row.error=String(error.stack||error);console.error('ORDINARY FAIL',row.number,row.error);}
  report.rows.push(row);save();
 }
 report.pass=report.rows.length===selected.length&&report.rows.every(row=>row.pass);
 delete report.active;save();if(!report.pass)process.exitCode=1;
}finally{g.firstLevel?.dispose?.();g.physics.dispose();g.portals.dispose();}
