import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {createHeadlessGame} from './lab-headless.mjs';
import {runV8Journey} from '../src/game/LabV8Journey.js';
import {runExpansionAJourney} from '../src/game/LabExpansionJourneyA.js';
const g=await createHeadlessGame();g.chamberEdition='foundation';
const routes=[],recovery=[],onlyRecovery=process.argv.includes('--recovery-only');
const alternatives=['observe-open-branches','inspect-empty-field','observe-unladen-overspeed','observe-unbalanced-thrust','light-before-damp'];
const hash=async p=>createHash('sha256').update(await fs.readFile(p)).digest('hex');
const sources=['src/game/LabExpansionRoomsA.js','src/game/LabExpansionJourneyA.js','tests/lab-expansion-a.test.js'];
const sourceHashes=Object.fromEntries(await Promise.all(sources.map(async p=>[p,await hash(p)])));
try{
 if(!onlyRecovery)for(let n=42;n<=46;n++)for(const route of ['canonical',alternatives[n-42]]){
  await g.selectLevel(n-1,false);const cargo=g.cargo,body=g.physics.cargoBody.id,uuid=cargo.group.uuid;
  const r=await runV8Journey(g,{journeyOptions:route==='canonical'?{}:{route}});
  assert.equal(g.state,'won');assert.equal(g.cargo,cargo);assert.equal(g.physics.cargoBody.id,body);assert.equal(g.cargo.group.uuid,uuid);
  routes.push({...r,route,originalBody:body,originalUUID:uuid,identityPreserved:true,cargoPortalTransports:g.physics.portalTransports,inductionPasses:g.firstLevel.induction?.passes??null});console.log(`${n} ${route}: ${r.frames} ordinary-input frames / ${r.teleports} player transfers / ${g.physics.portalTransports} cargo transfers`);
 }
 for(const n of [42,45,46]){
  await g.selectLevel(n-1,false);const cargo=g.cargo,body=g.physics.cargoBody.id;
  const r=await runV8Journey(g,{scenario:d=>{
   d.walk(g.cargo.position.x+1.3,g.cargo.position.z);d.pickup();d.walk(n===42?22:n===45?-16:-7,9);
   d.until(()=>g.playerGrounded&&g.playerPosition.y<-3.9,6,'Missed dock did not land on real recovery floor');d.mark('Both original travellers safely reached continuous recovery floor');
   const x=n===42?-4:n===45?-27:-24,low=n===42?39:n===45?29:26,lip=n===42?29.7:n===45?14:13.1,top=n===42?28:n===45?12:11,height=n===46?4:3,right=n===42?0:n===45?-23:-20;
   d.walk(n===42?10:right+3,low);d.walk(right+1.3,low);g.input.jumpQueued=true;
   for(let f=0;f<150;f++){d.worldMove(-1,0);d.frame();if(g.playerPosition.x<right-1&&g.playerGrounded)break;}
   d.stop();d.until(()=>g.playerGrounded&&g.playerPosition.x<right-.6,3,'Actual return incline side entry failed');d.walk(x,low);d.walk(x,lip);g.input.jumpQueued=true;
   for(let f=0;f<180;f++){d.worldMove(0,-1);d.frame();if(g.playerPosition.z<top-.2&&g.playerGrounded&&g.playerPosition.y>height-.01)break;}
   d.stop();d.until(()=>g.playerGrounded&&g.playerPosition.y>height-.01,3,'Actual visible return incline did not recover original travellers');
   assert.equal(g.heldCube,cargo);assert.equal(g.physics.cargoBody.id,body);assert.equal(g.state,'playing');assert.equal(g.teleportCount,0);d.mark('Original held body returned along the real broad ramp using movement and jump');
  }});
  recovery.push({...r,identityPreserved:g.cargo===cargo&&g.physics.cargoBody.id===body});console.log(`${n} genuine miss-and-return: ${r.frames} frames / ${r.resets+r.respawns} resets`);
 }
 for(const [n,route,stopAfter]of [[43,'circulate-then-recover','recovered'],[44,'observe-unladen-overspeed','stabilized']]){
  await g.selectLevel(n-1,false);const body=g.physics.cargoBody.id,cargo=g.cargo;
  const r=await runV8Journey(g,{scenario:d=>{runExpansionAJourney(d,{route,stopAfter});assert.equal(g.state,'playing');}});
  recovery.push({...r,identityPreserved:g.cargo===cargo&&g.physics.cargoBody.id===body});
 }
 const report={created:new Date().toISOString(),edition:'foundation',sourceHashes,routes,recovery,summary:{routes:routes.length,recoveryTrials:recovery.length,allPassed:true,unexpectedResets:routes.concat(recovery).reduce((a,r)=>a+r.resets+r.respawns,0),allOriginalBodiesPreserved:true}};
 await fs.mkdir('qa/runs',{recursive:true});await fs.writeFile(onlyRecovery?'qa/runs/expansion-a-recovery.json':'qa/runs/expansion-a-routes.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report.summary));
}finally{g.physics?.dispose();g.portals?.dispose();}
