import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHeadlessGame} from '../scripts/lab-headless.mjs';
import {SECOND_CHAPTER_EARLY_ATTACKS,observeSecondChapterEarlyAttack} from '../scripts/lib/second-chapter-early-attacks.mjs';

for(const entry of SECOND_CHAPTER_EARLY_ATTACKS.filter(a=>a.level===13))
test(`13 portrait: ${entry.name} reaches its actual target before being blocked`,async()=>{
 const g=await createHeadlessGame();g.chamberEdition='foundation';g.camera.aspect=390/844;g.camera.updateProjectionMatrix();await g.selectLevel(12,true);
 const update=g.updatePlaying;let peakPoweredSouth=6;
 g.updatePlaying=function(dt){update.call(this,dt);if(this.firstLevel.state.optical.receivers[1])peakPoweredSouth=Math.max(peakPoweredSouth,this.firstLevel.state['south-cage'].position.y);};
 try{
  const row=await observeSecondChapterEarlyAttack(g,entry,{nativeStart:true});
  assert.equal(row.pass,true,row.error);assert.equal(row.completed,false);assert.equal(row.error,null);
  for(const key of ['normalSpawn','approachComplete','targetStarted','sameCargo','sameBody','sameGeometry'])assert.equal(row[key],true,key);
  assert.equal(row.resets+row.respawns,0);assert.equal(row.physicsSteps,row.worldStepDelta);assert.equal(row.physicsSteps,row.journey.frames*2);assert.ok(row.targetFrames>=120);
  assert.ok(row.shots.every(s=>s.accepted&&s.impact?.valid&&s.actualSurfaceId===s.expectedSurfaceId&&!s.error),'Every aimed shot must reach the addressed real ceramic');
  const start=row.milestones.find(m=>m.phase==='target'),end=row.final;
  if(entry.name==='release-mirror-during-partial-south-ascent'){
   assert.equal(row.shots.length,5);assert.ok(start.causes.southCage>8&&start.causes.southCage<11.9);
   assert.ok(peakPoweredSouth<11.9,'Extraction must remove the real light before the cage reaches its upper landing');
   assert.equal(end.causes.mirrorLoaded,false);assert.deepEqual(end.causes.opticalReceivers,[false,false]);
   assert.ok(end.causes.southCage<start.causes.southCage-.5);assert.ok(end.cargoTransports>start.cargoTransports);
  }else{
   assert.equal(row.shots.length,4);assert.ok(start.player[1]>11.9);assert.equal(end.causes.mirrorLoaded,false);
   assert.deepEqual(end.causes.opticalReceivers,[true,false]);assert.equal(end.causes.southCage,6);assert.ok(end.cargo[1]<1);assert.equal(end.held,false);
  }
  if(process.env.ROOM13_PORTRAIT_ATTACK_REPORT)fs.appendFileSync(process.env.ROOM13_PORTRAIT_ATTACK_REPORT,JSON.stringify({row,peakPoweredSouth})+'\n');
 }finally{g.updatePlaying=update;g.firstLevel.dispose();g.physics.dispose();g.portals.dispose();}
});
