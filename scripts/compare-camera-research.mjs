// Compare ordinary engine routes against exact L. No body, clock or input poses.
// A numeric component bound does not establish raw/quantized hash equality.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';

const [baselineDirectory,output='qa/camera-research-comparison.json']=process.argv.slice(2);
assert.ok(baselineDirectory,'Usage: compare-camera-research.mjs BASELINE_L_WORKTREE OUTPUT');
const baseline=path.resolve(baselineDirectory),candidate=process.cwd();
const head=root=>execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();
assert.equal(head(baseline),'8d2c01eacd86fe9235a35e7ec5f624ba62c3b29e','Compare the retained exact L baseline');
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const protectedFiles=['src/game/LabGame.js','src/game/LabCamera.js','src/game/LabV8Journey.js','src/game/InputController.js','src/game/LabPhysics.js','src/game/LabCreativeRoom17.js','src/game/LabExpansionRoomsB.js','public/models/runtime/model-01-player.glb','public/models/runtime/model-02-cargo.glb'];
const sourceHashes={};
for(const file of protectedFiles){
 const before=fs.readFileSync(path.join(baseline,file)),after=fs.readFileSync(path.join(candidate,file));
 assert.deepEqual(after,before,`Protected source/model changed: ${file}`);sourceHashes[file]=sha(after);
}
const vectors=(name,axes='xyz')=>[...axes].map(axis=>`${name}.${axis}`);
const commonNames=[...vectors('player.position'),...vectors('player.velocity'),'player.facing',...vectors('cargo.position'),...vectors('cargo.velocity'),...vectors('cargo.quaternion','xyzw'),...vectors('cargoBody.position'),...vectors('cargoBody.velocity'),...vectors('cargoBody.angularVelocity'),...vectors('cargoBody.quaternion','xyzw'),'cargoTransports','playerTeleports','grounded','holding'];
const components=(object,axes='xyz')=>[...axes].map(axis=>object[axis]);
async function observe(root,level,options){
 const url=file=>pathToFileURL(path.join(root,file)).href;
 const {createHeadlessGame}=await import(url('scripts/lab-headless.mjs'));
 const {runV8Journey}=await import(url('src/game/LabV8Journey.js'));
 const g=await createHeadlessGame();g.chamberEdition='foundation';await g.selectLevel(level-1,false);
 const cargo=g.cargo,body=g.physics.cargoBody,mesh=g.animator.rig.mesh;
 const row={level,options,sourceCommit:head(root),frames:0,trace:[],actions:[],impacts:[],milestones:[],originalEveryFrame:true};
 const visual=g.updateVisuals,fire=g.firePortal,interact=g.interact;let lastImpact=null;
 g.firePortal=function(index){const result=fire.call(this,index);row.actions.push({frame:row.frames,type:'shot',colour:index,accepted:!!result});return result;};
 g.interact=function(...args){const result=interact.apply(this,args);row.actions.push({frame:row.frames,type:'E',accepted:!!result,held:!!g.heldCube});return result;};
 g.updateVisuals=function(...args){
  const result=visual.apply(this,args);if(!(args[0]>0))return result;
  row.frames++;assert.ok(row.frames<=24000,'Finite ordinary route budget');
  assert.ok(g.cargo===cargo&&g.physics.cargoBody===body&&g.animator.rig.mesh===mesh,'Original actors must persist every visual frame');
  const impact=g.portalShots.lastImpact;if(impact&&impact!==lastImpact){lastImpact=impact;row.impacts.push({frame:row.frames,...impact});}
  const values=[...components(g.playerPosition),...components(g.playerVelocity),g.facing,...components(cargo.position),...components(cargo.velocity),...components(cargo.quaternion,'xyzw'),...components(body.position),...components(body.velocity),...components(body.angularVelocity),...components(body.quaternion,'xyzw'),g.physics.portalTransports,g.teleportCount,+g.playerGrounded,+!!g.heldCube];
  if(level===17)values.push(g.firstLevel.beam.angle,g.firstLevel.beam.omega,g.firstLevel.beam.tension);
  else{const b=g.firstLevel.top.body;values.push(...components(b.position),...components(b.velocity),...components(b.angularVelocity),...components(b.quaternion,'xyzw'),g.firstLevel.top.angle,g.firstLevel.bumper.progress);}
  assert.ok(values.every(Number.isFinite));row.trace.push(values);return result;
 };
 try{
  row.route=await runV8Journey(g,{journeyOptions:options,onMilestone:({name})=>row.milestones.push({name,frame:row.frames})});
  assert.equal(row.route.pass,true);assert.equal(g.state,'won');assert.equal(g.firstLevel.isWon(),true);
  assert.equal(row.route.resets,0);assert.equal(row.route.respawns,0);assert.equal(row.frames,row.route.frames);
  row.final={state:g.state,sameCargo:g.cargo===cargo,sameBody:g.physics.cargoBody===body,samePlayerMesh:g.animator.rig.mesh===mesh,cargoTransports:g.physics.portalTransports,playerTeleports:g.teleportCount};
 }finally{g.updateVisuals=visual;g.firePortal=fire;g.interact=interact;g.firstLevel.dispose?.();g.physics.dispose();g.portals.dispose();}
 return row;
}
const report={scope:'Targeted ordinary-input CPU engine comparison, not native pixels/device/full-campaign acceptance',baselineCommit:head(baseline),candidateCommit:head(candidate),componentTolerance:1e-6,protectedSourceHashes:sourceHashes,cases:[],rawOrQuantizedHashEqualityClaimed:false};
fs.mkdirSync(path.dirname(path.resolve(output)),{recursive:true});
for(const [level,options] of [[17,{alternative:'lower-branch'}],[17,{alternative:'lower-branch',swapColours:true}],[50,{}]]){
 const a=await observe(baseline,level,options),b=await observe(candidate,level,options);
 assert.equal(a.frames,b.frames);assert.deepEqual(a.actions,b.actions);assert.deepEqual(a.milestones,b.milestones);assert.equal(a.impacts.length,b.impacts.length);
 let maximumImpactPositionDelta=0;
 for(let n=0;n<a.impacts.length;n++){
  const {position:p,...before}=a.impacts[n],{position:q,...after}=b.impacts[n];assert.deepEqual(before,after);
  p.forEach((v,i)=>{const delta=Math.abs(v-q[i]);maximumImpactPositionDelta=Math.max(maximumImpactPositionDelta,delta);assert.ok(delta<=1e-6);});
 }
 const names=[...commonNames,...(level===17?['beam.angle','beam.omega','beam.tension']:[...vectors('topBody.position'),...vectors('topBody.velocity'),...vectors('topBody.angularVelocity'),...vectors('topBody.quaternion','xyzw'),'top.angle','bumper.progress'])];
 let maximum={absoluteDelta:0,frame:null,component:null};
 for(let f=0;f<a.frames;f++){
  assert.equal(a.trace[f].length,names.length);assert.equal(b.trace[f].length,names.length);
  for(let i=0;i<names.length;i++){const delta=Math.abs(a.trace[f][i]-b.trace[f][i]);assert.ok(Number.isFinite(delta)&&delta<=1e-6,`${level} frame ${f+1} ${names[i]} delta ${delta}`);if(delta>maximum.absoluteDelta)maximum={absoluteDelta:delta,frame:f+1,component:names[i],baseline:a.trace[f][i],candidate:b.trace[f][i]};}
 }
 const summary={level,options,frames:a.frames,componentsPerFrame:names.length,scalarComparisons:a.frames*names.length,maximumAbsoluteComponentDelta:maximum,maximumImpactPositionDelta,actionsExactlyEqual:true,milestoneNamesAndFramesExactlyEqual:true,impactMetadataExactlyEqual:true,actions:b.actions,milestones:b.milestones,baselineRoute:a.route,candidateRoute:b.route,final:b.final,originalActorsEveryFrame:true};
 report.cases.push(summary);fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(summary));
}
