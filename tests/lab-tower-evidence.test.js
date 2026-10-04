import test from 'node:test';
import assert from 'node:assert/strict';
import {validateTowerEvidence,TOWER_CAPTURE,TOWER_COURSE_EXPECTED} from '../scripts/verify-tower.mjs';
import {TOWER_STAGES} from '../src/game/LabTowerLayout.js';
import {KEYSTONE_SPECS} from '../src/game/LabTowerKeystones.js';

// Synthetic data tests the evidence gate itself. It is deliberately not
// presented as gameplay evidence; only the browser observer can create that.
function evidence(){
 const events=TOWER_STAGES.map((stage,index)=>({
  stage:index+1,id:stage.id,deck:stage.deck,branch:stage.branch,
  frame:(index+1)*3000,simulatedSeconds:(index+1)*50,
 }));
 const keystones=Array.from({length:6},(_,deck)=>({
  id:KEYSTONE_SPECS[deck].id,deck,frame:(deck+1)*9000+100,
  simulatedSeconds:(deck+1)*150+25,
 }));
 const route={
  pass:true,level:41,resets:0,respawns:0,stagesCompleted:TOWER_CAPTURE.stages,
  activeInputSeconds:920,maxIdleSeconds:1,maxNoInputSeconds:1,
  teleports:2,shots:8,interactions:12,physicsSteps:115200,
  simulatedSeconds:960,distanceTravelled:1000,stageEvents:events.map(event=>({...event})),
  keystoneEvents:keystones.map(event=>({...event})),
  flings:[{stageId:'exchange',speed:16.4,landing:[5.4,2.05,-33.4]}],
 };
 const observed={
  first:{completedStages:0},last:{completedStages:TOWER_CAPTURE.stages,state:'won'},
  stageEvents:events.map(event=>({...event})),keystoneEvents:keystones.map(event=>({...event})),
  resetCalls:0,respawnCalls:0,cargoResetCalls:0,
  simulatedSeconds:960,physicsSeconds:960,physicsSteps:115200,
  activeSeconds:920,movingSeconds:910,maxIdleSeconds:1,
  distanceMeters:1000,teleports:2,
  courseVisits:structuredClone(TOWER_COURSE_EXPECTED),
 };
 const gameMetrics={
  completedStages:TOWER_CAPTURE.stages,totalStages:TOWER_CAPTURE.stages,
  checkpoints:false,solvedIds:events.map(event=>event.id),
  deckRelays:[true,true,true,true,true,true],
  relayEvents:Array.from({length:6},(_,deck)=>({deck,seconds:(deck+1)*150})),
  keystoneSolved:[true,true,true,true,true,true],
  keystoneEvents:keystones.map(event=>({...event})),
  stageEvents:events.map(event=>({...event})),teleports:2,
 };
 return {route,observed,gameMetrics,errors:[]};
}

test('Tower evidence gate accepts a complete internally consistent 18-wing run',()=>{
 assert.doesNotThrow(()=>validateTowerEvidence(evidence()));
});

for(const [name,change,reason] of [
 ['a wing counted twice',item=>{
  const id=item.observed.stageEvents[0].id;
  item.observed.stageEvents[1].id=id;
  item.route.stageEvents[1].id=id;
  item.gameMetrics.stageEvents[1].id=id;
  item.gameMetrics.solvedIds[1]=id;
 },/counted more than once/],
 ['a missing branch hidden behind a different ID',item=>{
  item.observed.stageEvents[1].branch=item.observed.stageEvents[0].branch;
 },/all three distinct branches/],
 ['an invented puzzle ID',item=>{
  item.observed.stageEvents[4].id='invented-wing';
  item.route.stageEvents[4].id='invented-wing';
  item.gameMetrics.stageEvents[4].id='invented-wing';
  item.gameMetrics.solvedIds[4]='invented-wing';
 },/exact eighteen authored puzzles/],
 ['an authored ID attached to the wrong branch',item=>{
  const first=item.observed.stageEvents[4].id;
  item.observed.stageEvents[4].id=item.observed.stageEvents[5].id;
  item.observed.stageEvents[5].id=first;
 },/identity must match/],
 ['an unpowered deck relay',item=>{
  item.gameMetrics.deckRelays[3]=false;
 },/strictly deep-equal/],
 ['a missing central keystone',item=>{
  item.observed.keystoneEvents.pop();
 },/strictly equal/],
 ['a duplicated central keystone',item=>{
  item.observed.keystoneEvents[1].id=item.observed.keystoneEvents[0].id;
 },/unique identity/],
 ['a central keystone identity swapped between decks',item=>{
  const first=item.observed.keystoneEvents[0].id;
  item.observed.keystoneEvents[0].id=item.observed.keystoneEvents[1].id;
  item.observed.keystoneEvents[1].id=first;
 },/identity must match the authored machine/],
 ['a central keystone before its three wings',item=>{
  item.observed.keystoneEvents[2].simulatedSeconds=400;
 },/follow the three live wings/],
 ['an unsolved central keystone',item=>{
  item.gameMetrics.keystoneSolved[4]=false;
 },/strictly deep-equal/],
 ['an AFK segment',item=>{
  item.route.maxNoInputSeconds=5.1;
 },/AFK segment/],
 ['an unvisited side gallery',item=>{
  item.observed.courseVisits.annex.pop();
 },/physically traverse every annex space/],
 ['an omitted momentum shaft landing',item=>{
  item.observed.courseVisits.shaft.pop();
 },/physically traverse every shaft space/],
 ['fewer than fifteen active minutes',item=>{
  item.observed.activeSeconds=899;
 },/15 minutes/],
 ['no actual portal crossing',item=>{
  item.route.teleports=0;item.observed.teleports=0;item.gameMetrics.teleports=0;
 },/physically traverse portals/],
 ['a hidden reset',item=>{
  item.observed.resetCalls=1;
 },/strictly equal/],
]){
 test(`Tower evidence gate rejects ${name}`,()=>{
  const item=evidence();change(item);
  assert.throws(()=>validateTowerEvidence(item),reason);
 });
}
