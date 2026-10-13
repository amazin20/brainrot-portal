import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {runRoom25NativeDriver} from '../scripts/lib/room25-native-driver.mjs';
import {assertRoom25Route,assertRoom25CaptureRows,assertRoom25NativeDiagnostic,ROOM25_SOURCE} from '../scripts/lib/room25-native-proof.mjs';
const sourceRoot=path.resolve(process.env.SOURCE_DIR||'../source'),buildRoot=path.resolve(process.env.BUILD_DIR||path.join(sourceRoot,'dist'));
const info=JSON.parse(fs.readFileSync(path.join(buildRoot,'build-info.json'),'utf8'));assert.equal(info.commit,ROOM25_SOURCE.commit);
const journey=info.files.filter(f=>/^assets\/LabRoom25Journey-[A-Za-z0-9_-]+\.js$/.test(f.path));assert.equal(journey.length,1);
const bytes=fs.readFileSync(path.join(buildRoot,journey[0].path));assert.equal(createHash('sha256').update(bytes).digest('hex'),journey[0].sha256);
const {runRoom25}=await import(pathToFileURL(path.join(buildRoot,journey[0].path)).href),{createHeadlessGame}=await import(pathToFileURL(path.join(sourceRoot,'scripts/lab-headless.mjs')).href);

test('Room25 serialized native controller runs the real compiled production journey from normal Foundation Play through cut/recovery/full original win',async()=>{
 const game=await createHeadlessGame();game.chamberEdition='foundation';await game.selectLevel(24,true);const body=game.physics.cargoBody,shape=body.shapes[0],cargo=game.cargo,rows=[];let frames=0,last=null;
 // CPU rehearsal executes the same self-contained function string later sent
 // to Chrome. It is not a generated native movie or accepted browser fixture.
 const serialized=(0,eval)('('+runRoom25NativeDriver.toString()+')');
 try{
  const route=await serialized(game,{runProductionJourney:runRoom25,onFrame:state=>{assert.equal(state.visualFrame,frames++);last=state;if(state.visualFrame%15===0)rows.push({index:rows.length,terminal:false,state});}});
  if(rows.at(-1).state.visualFrame<route.lastVisualFrame)rows.push({index:rows.length,terminal:true,state:last});
  assertRoom25Route(route);assertRoom25CaptureRows(rows,route);assert.equal(game.state,'won');assert.equal(game.cargo,cargo);assert.equal(game.physics.cargoBody,body);assert.equal(body.shapes[0],shape);assert.equal(game.heldCube,cargo);assert.equal(route.observed.postSteps,route.physicsSteps);assert.equal(route.observed.forceSamples,route.physicsSteps);assert.ok(route.observed.motorOffDescendingSteps>20);
  for(const mutation of [r=>r.resets++,r=>r.cargoResets++,r=>r.machineResets++,r=>r.seconds+=1/120,r=>r.physicsSteps--,r=>r.observed.forceSamples--,r=>r.observed.forceCountFinish++,r=>r.observed.motorOffDescendingSteps=0,r=>r.observed.maxHeight=0,r=>r.observed.externalMotorWorkFinish=0,r=>r.observed.maxDampingPower=1,r=>r.observed.twoLegacyPassengerLiftsKinematic=false,r=>r.nativeAccepted=true,r=>r.fullRoomAccepted=true,r=>r.lastState.cargoBodyId++,r=>r.milestones.pop()]){const changed=structuredClone(route);mutation(changed);assert.throws(()=>assertRoom25Route(changed));}
  for(const mutation of [r=>r.pop(),r=>r[0].state.physicsSteps++,r=>r[1].state.seconds+=.01,r=>r.at(-1).state.state='playing',r=>r[0].state.cargoShapeId++]){const changed=structuredClone(rows);mutation(changed);assert.throws(()=>assertRoom25CaptureRows(changed,route));}
  assert.throws(()=>assertRoom25NativeDiagnostic({kind:'actual-room25-required-native-browser-diagnostic',pass:true,nativeRecordingCompleted:false,route}));
  if(process.env.ROOM25_PREP_EVIDENCE_DIR){fs.mkdirSync(process.env.ROOM25_PREP_EVIDENCE_DIR,{recursive:true});fs.writeFileSync(path.join(process.env.ROOM25_PREP_EVIDENCE_DIR,'actual-shared-controller-cpu.json'),JSON.stringify({kind:'actual CPU rehearsal using serialized native controller and frozen compiled production journey',cpuOnly:true,sourceCommit:info.commit,productionJourney:journey[0],route,captureCadenceSamples:rows.length,nativeAccepted:false,publicationAccepted:false,fullRoomAccepted:false},null,2)+'\n');}
 }finally{game.firstLevel.dispose();game.physics.dispose();game.portals.dispose();}
});
test('Room25 native controller refuses a nonplaying start without changing any actor state',async()=>{
 const game=await createHeadlessGame();game.chamberEdition='foundation';await game.selectLevel(24,false);const body=game.physics.cargoBody,position=body.position.clone(),step=game.physics.world.stepnumber;
 try{await assert.rejects(runRoom25NativeDriver(game,{runProductionJourney:runRoom25}),/normal Foundation25 Play required/);assert.equal(game.state,'ready');assert.equal(game.physics.world.stepnumber,step);assert.deepEqual(body.position.toArray(),position.toArray());assert.equal(game.physics.cargoBody,body);}finally{game.firstLevel.dispose();game.physics.dispose();game.portals.dispose();}
});
