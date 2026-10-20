import {runRoom26} from '../../src/game/LabRoom26Journey.js';
import {runRoom27} from '../../src/game/LabRoom27Journey.js';
import {runRoom28} from '../../src/game/LabRoom28Journey.js';
import {runRoom30} from '../../src/game/LabRoom30Journey.js';
import {biosphereRush,biospherePrefix,observeBiosphereAttempt,assertBiosphereAttemptRows,BIOSPHERE_ATTACK_OPEN_SCOPES} from './biosphere-early-attacks.mjs';
const check=(v,m)=>{if(!v)throw Error('Biosphere later attack: '+m);};
const sampledLanding=(r,x0,x1,z0,z1,y)=>r.trajectory.some(s=>s.phase==='target'&&s.grounded&&s.player[0]>=x0&&s.player[0]<=x1&&s.player[2]>=z0&&s.player[2]<=z1&&s.player[1]>y);
function slowApproach(d,x,z){const g=d.game;for(let n=0;n<1200;n++){const dx=x-g.playerPosition.x,dz=z-g.playerPosition.z,length=Math.hypot(dx,dz);if(length<.07&&Math.hypot(g.playerVelocity.x,g.playerVelocity.z)<.35){d.stop();d.wait(.2);return;}const pace=Math.min(.5,length*.35);d.worldMove(dx/Math.max(length,.001)*pace,dz/Math.max(length,.001)*pace);d.frame();}throw Error('ordinary slow rim approach failed');}
const entries=[
 [26,'closed-air-valve-unloaded-shaft-jumps',d=>{
  const g=d.game,p=d.level.panels;d.walk(-12,14);d.aim(1,p['first-shaft'].getFrame().center);d.walk(-12,-6);d.aim(0,p['pressure-intake'].getFrame().center);d.walk(-12,8);
  d.beginTarget('paired real first shaft below closed air valve while original remains at normal ground spawn',!g.heldCube&&!d.level.state.load.loaded()&&!d.level.state.shutter.open);
  return {rush:biosphereRush(d,-12,5.5,480,{jumpEvery:29}),omitted:'released original valve weight'};
 }],
 [26,'upper-loaded-jump-against-unreversed-crossflow',async d=>{
  const g=d.game,p=d.level.panels;await biospherePrefix(d,runRoom26,'crossing streams expose the upper retaining dock');
  d.walk(12,-14);d.walk(7,-14);d.aim(1,p['freight-receiver'].getFrame().center);d.walk(12,-14);d.walk(12,-21);d.walk(-22,-21);d.walk(-22,11.85);d.walk(-20.25,11.85);d.aim(0,p['valve-load'].getFrame().center);d.until(()=>g.cargo.position.y>16,8,'actual original upper recovery');d.wait(1);d.walk(-22,11);d.walk(-22,-21);d.walk(12,-21);d.walk(12,-14);d.walk(7,-14);d.walk(6,g.cargo.position.z);d.pickup();d.walk(7,-14);d.walk(16,-14);d.walk(12,-14);
  d.beginTarget('original recovered but independent upper air still blows toward its unmodified source',g.heldCube&&!d.level.state.load.loaded()&&d.level.state.crossingFlow.reversed);
  return {rush:biosphereRush(d,12,19,600,{jumpEvery:31}),omitted:'independent upper crossing valve reversal'};
 }],
 [27,'wrong-way-belt-held-sprint-and-jumps',d=>{
  const g=d.game,p=d.level.panels;d.walk(-7,16);d.aim(0,p['ground-intake'].getFrame().center);d.walk(4,14);d.aim(1,p['sky-well'].getFrame().center);d.walk(-7,19);d.walk(g.cargo.position.x+1,g.cargo.position.z);d.pickup();d.walk(-7,17);d.walk(-13,17);
  d.beginTarget('actual original held at belt that runs away from the charged mouth',g.heldCube&&d.level.state.conveyors.reversed&&!d.level.state.conveyors.braked);
  return {rush:biosphereRush(d,-13,-16,480,{jumpEvery:37}),omitted:'real belt reversing drum'};
 }],
 [27,'earned-sky-balcony-direct-west-gap',async d=>{
  await biospherePrefix(d,runRoom27,'height is retained on the side street');d.walk(8.8,7);d.beginTarget('original and player retained on first eight metre balcony without final crossing address',d.game.heldCube&&d.game.playerPosition.y>7.9&&d.game.teleportCount===1);
  return {rush:biosphereRush(d,-18,0,480,{jumpEvery:29}),omitted:'upper belt or gravity-post bridge'};
 }],
 [28,'low-tide-pontoon-to-middle-garden-jump',d=>{
  d.walk(3,17);d.pickup();d.walk(21,13);d.walk(21,0);d.walk(18.7,0);d.beginTarget('low physical lagoon float and held original below middle garden',d.game.heldCube&&d.level.state.tides.flow===0&&d.level.state['lagoon-float'].position.y<1);
  return {rush:biosphereRush(d,14,6,480,{jumpEvery:23}),omitted:'water transfer between basins'};
 }],
 [28,'middle-coral-jump-before-return-tide',async d=>{
  await biospherePrefix(d,runRoom28,'the tide changes which coral doorway is usable');d.beginTarget('same original on coral middle float before occupied return tide',d.game.heldCube&&d.game.playerPosition.y>2.8&&d.game.playerPosition.y<3.5&&d.level.state['coral-float'].position.y<3.5);
  return {rush:biosphereRush(d,-22,0,480,{jumpEvery:19}),omitted:'second real return of the finite water volume'};
 }],
 [29,'held-original-in-inverted-source-jumps',d=>{
  const g=d.game;d.walk(-5,11);check(g.interact(),'root gravity ordinary E missed');d.wait(.3);d.walk(g.cargo.position.x+1,g.cargo.position.z);d.pickup();d.walk(-12,8);
  d.beginTarget('inverted source contains held original while player keeps ordinary gravity',g.heldCube&&d.level.state.gravity.source.up&&!d.level.state.gardenLatch.engaged);
  return {rush:biosphereRush(d,-12,8,480,{jumpEvery:29}),omitted:'free original passage through upper root detector'};
 }],
 [29,'closed-garden-shutter-edge-charges',d=>{
  const g=d.game,p=d.level.panels;d.walk(g.cargo.position.x+1,g.cargo.position.z);d.pickup();d.walk(-14,4);d.walk(-18,4);d.walk(-18,18);d.walk(-8,18);d.walk(-8,6);d.walk(15,6);
  d.beginTarget('carried original reaches earned observation ribbon without triggering root detector',g.heldCube&&g.playerPosition.y>5.9&&!d.level.state.gardenLatch.engaged);
  d.look(g.playerPosition.clone().add({x:-3,y:1,z:0}));check(g.interact()&&!g.heldCube,'ordinary ribbon release missed');d.wait(1);d.walk(17,7.5);
  const shots=[];for(const side of[-1,1]){const f=p['garden-return'].getFrame(),point=f.center.clone().addScaledVector(f.right,side*2.75);d.look(point);check(g.firePortal(1),'ordinary edge charge request rejected');d.until(()=>g.portalShots.queue.length===0&&g.portalShots.active.length===0,3,'edge charge unresolved');shots.push({side,valid:g.portalShots.lastImpact?.valid??false,reason:g.portalShots.lastImpact?.reason??null});}
  return {shots,rush:biosphereRush(d,17,-13,480,{jumpEvery:31}),omitted:'free upper-detector weight opening the actual receiver shutter'};
 }],
 [30,'unpaired-first-well-sprint-jump',d=>{
  d.walk(-21,13);d.walk(-25,13);d.walk(-25,-17);d.walk(0,-17);d.beginTarget('normal launch lip reaches thirty six metre first gravity reservoir without a portal pair',d.game.playerPosition.y>51.9&&!d.game.portals.ready&&d.game.teleportCount===0&&!d.game.velocityCompanion?.connected);
  return {rush:biosphereRush(d,0,-35,600,{jumpEvery:43}),omitted:'paired first ballistic outlet and companion stabilizer'};
 }],
 [30,'unturned-final-outlet-real-second-dive',async d=>{
  await biospherePrefix(d,runRoom30,'north-south physical arc reaches the central island');slowApproach(d,49.1,24);d.walk(42,30);d.walk(40,45);slowApproach(d,43.7,45);d.aim(0,d.level.panels['second-well'].getFrame().center);d.aim(1,d.level.panels['sunward-outlet'].getFrame().center);d.walk(42,30);d.walk(60,30);
  d.beginTarget('genuine first flight retained original pair on central island but final outlet was never tilted',d.game.velocityCompanion.connected&&d.game.playerPosition.y>39.8&&d.level.state.tilt.angle===0&&d.game.teleportCount===1);
  return {rush:biosphereRush(d,60,46,600,{jumpEvery:41}),omitted:'physical final outlet angle control'};
 }],
];
const laterImpacts=[[true,true],[true,true,true,true,true],[true,true],[true,true],[],[true,true],[],[false,false],[],[true,true,true,true]];
export const BIOSPHERE_LATE_ATTACKS=Object.freeze(entries.map(([level,name,run],i)=>Object.freeze({id:name,index:level-1,level,name,run,impacts:Object.freeze(laterImpacts[i])})));
/** Direct game API deliberately owns the zero-step native Play guard. */
export async function runBiosphereLateAttack(game,entry){return observeBiosphereAttempt(game,entry,BIOSPHERE_LATE_ATTACKS);}
export function summarizeBiosphereLateAttacks(cases){return {...BIOSPHERE_ATTACK_OPEN_SCOPES,group:'later',edition:'foundation',scope:'Ten specified finite ordinary-input attacks in rooms26–30, actual approached target and withheld mechanical cause only; no exhaustive bypass claim.',cases,counts:{attempts:cases.length,completed:cases.filter(r=>r.completed).length,errors:cases.filter(r=>r.error).length,physicsSteps:cases.reduce((a,r)=>a+r.physicsSteps,0),targetFrames:cases.reduce((a,r)=>a+r.targetFrames,0)}};}
export function assertBiosphereLateAttacks(report){
 assertBiosphereAttemptRows(report,BIOSPHERE_LATE_ATTACKS,'later');for(const r of report.cases){const c=r.final.causes,a=r.attempt.rush;
  if(r.id==='closed-air-valve-unloaded-shaft-jumps')check(!c.loaded&&!c.shutterOpen&&a.max[1]<4&&!r.final.held,'closed air branch supplied an eight metre loaded ascent');
  if(r.id==='upper-loaded-jump-against-unreversed-crossflow')check(!c.loaded&&c.crossingReversed&&r.final.held&&a.max[2]<13,'unreversed crossing delivered the loaded traveller to far dock');
  if(r.id==='wrong-way-belt-held-sprint-and-jumps')check(c.reversed&&!c.braked&&r.final.held&&r.final.teleports===0&&a.min[2]>13,'wrong-way actual belt or same original changed');
  if(r.id==='earned-sky-balcony-direct-west-gap')check(r.final.held&&r.final.player[1]<1&&r.final.teleports===1&&!sampledLanding(r,-25,-9,-6,6,7.9),'unprepared final gap supplied a raised arrival');
  if(r.id==='low-tide-pontoon-to-middle-garden-jump')check(c.flow===0&&c.lagoonY<1&&Math.abs(c.levels[0]+c.levels[1]-6)<1e-8&&a.max[1]<3&&r.final.held,'untransferred water raised the original pontoon');
  if(r.id==='middle-coral-jump-before-return-tide')check(c.coralY<3.5&&Math.abs(c.levels[0]+c.levels[1]-6)<1e-8&&r.final.held&&a.min[0]>-18.4&&a.max[1]<5.3,'middle occupied tide reached final coral summit without returning water');
  if(r.id==='held-original-in-inverted-source-jumps')check(c.sourceUp&&!c.latch&&a.max[1]<3&&r.final.held,'held original or ordinary player tripped upper detector');
  if(r.id==='closed-garden-shutter-edge-charges')check(!c.latch&&c.shutterY===11.4&&r.attempt.shots.length===2&&r.attempt.shots.every(s=>s.valid===false),'edge charge crossed the actual closed detector shutter');
  if(r.id==='unpaired-first-well-sprint-jump')check(r.final.teleports===0&&!c.connected&&a.from[1]>51.9&&a.min[1]<17&&r.final.player[1]<20,'unpaired first reservoir yielded an addressed first flight');
  if(r.id==='unturned-final-outlet-real-second-dive')check(c.tilt===0&&c.connected&&a.from[1]>39.8&&a.max[0]>190&&r.final.teleports===2&&r.final.player[1]<27.5&&!sampledLanding(r,183,218,2,42,27.5),'unturned final ballistic outlet reached the high destination');
 }check(report.counts?.attempts===10&&report.counts.completed===0&&report.counts.errors===0&&report.counts.physicsSteps===report.cases.reduce((a,r)=>a+r.physicsSteps,0)&&report.counts.targetFrames===report.cases.reduce((a,r)=>a+r.targetFrames,0),'actual later summary differs');return report;
}
