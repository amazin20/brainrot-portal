/** Finite production-input shortcut probes for the unified 51-room campaign.
 * Actual ordinary controls only. A setup failure or absence of victory is
 * never presented as proof that all shortcuts are closed. Stable room 41 is
 * the castle; the campaign presentation can display it as final room 51. */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import * as THREE from 'three';
import {createHeadlessGame} from './lab-headless.mjs';
import {runV8Journey} from '../src/game/LabV8Journey.js';
import {installPreciseLateAim} from '../src/game/LabLateCampaignAim.js';
import {runPuzzleProgression50} from '../src/game/LabPuzzleProgression50Journey.js';
import {runSiphonObservatory} from '../src/game/LabSiphonObservatoryJourney.js';
import {room15Extract} from '../src/game/LabRoom15Journey.js';
import {room19Ascent,room19Cargo} from '../src/game/LabRoom19Journey.js';
import {runPost35} from '../src/game/LabPostJourneyA.js';
import {runPuzzleProgression44} from '../src/game/LabPuzzleProgression44Journey.js';
import {runPuzzleProgression45} from '../src/game/LabPuzzleProgression45Journey.js';
import {runPuzzleProgression46} from '../src/game/LabPuzzleProgression46Journey.js';
import {runPuzzleProgression48} from '../src/game/LabPuzzleProgression48Journey.js';
import {ACTIVE_FOUNDATION_RUNTIME_FLAGS} from '../src/game/ReleaseIdentity.js';

const V=(...p)=>new THREE.Vector3(...p),digest=v=>crypto.createHash('sha256').update(v).digest('hex');
const sourceHashes=()=>Object.fromEntries(fs.readdirSync('src/game',{recursive:true}).filter(f=>fs.statSync(path.join('src/game',f)).isFile()).sort().map(f=>['src/game/'+f,digest(fs.readFileSync('src/game/'+f))]));
export const CAMPAIGN_SHORTCUT_CASES=['empty-direct-sprint','held-direct-sprint','held-corner-jumps','early-release-finish-directed-shots','held-roof-chain'];
const POST35_PREFIX_MILESTONES=[
 'A real portal ray drives only the first sluice',
 'The first actual mechanical latch preserves the later entry return',
 'Both actual latches retain the sluices before the shared air pair is borrowed',
 'The original free companion leaves its sealed bay through the shared floor-to-middle pair',
];
function validPost35Prerequisites(row){
 const p=row.prerequisitePhysics;
 const retained=s=>s?.firstLatched===true&&s?.secondLatched===true&&Number.isFinite(s.firstProgress)&&s.firstProgress>.9&&s.firstProgress<=1.01&&Number.isFinite(s.secondProgress)&&s.secondProgress>.9&&s.secondProgress<=1.01;
 const middle=(s,y0,y1)=>Array.isArray(s?.cargoPosition)&&s.cargoPosition.every(Number.isFinite)&&s.cargoPosition[0]>=-24&&s.cargoPosition[0]<=24&&s.cargoPosition[1]>=y0&&s.cargoPosition[1]<=y1&&s.cargoPosition[2]>-7&&s.cargoPosition[2]<9;
 return row.level===35&&row.id==='post-air-switch'&&row.name==='held-corner-jumps'&&row.shots.length===0&&p?.schema==='post35-causal-prefix-v1'&&p.level===35
  &&p.sourceRoute?.driver==='runPost35'&&p.sourceRoute.path==='src/game/LabPostJourneyA.js'&&p.sourceRoute.route==='latches-before-freight'&&p.sourceRoute.stopAfter==='freight'&&p.sourceRoute.returned===true
  &&JSON.stringify(p.sourceRoute.milestones)===JSON.stringify(POST35_PREFIX_MILESTONES)
  &&p.initial?.firstLatched===false&&p.initial?.secondLatched===false&&Number.isInteger(p.initial.cargoTransports)&&p.initial.cargoTransports>=0
  &&retained(p.freightArrival)&&middle(p.freightArrival,.3,.7)&&p.freightArrival.cargoGrounded===true&&p.freightArrival.held===false&&p.freightArrival.cargoTransports>p.initial.cargoTransports
  &&retained(p.atAttackStart)&&middle(p.atAttackStart,.3,2.5)&&p.atAttackStart.cargoTransportsBefore===p.initial.cargoTransports&&p.atAttackStart.cargoTransportsAfter>p.atAttackStart.cargoTransportsBefore
  &&retained(p.afterAttack)&&p.afterAttack.cargoTransports===p.atAttackStart.cargoTransportsAfter&&p.initial.teleports===0&&p.atAttackStart.teleports===0&&p.afterAttack.teleports===0&&p.afterAttack.sameCompanion===true&&p.afterAttack.sameCargoBody===true&&row.resets===0&&row.respawns===0;
}
function snapshot(g){const l=g.firstLevel;return {player:g.playerPosition.toArray(),cargo:g.cargo.position.toArray(),held:!!g.heldCube,linked:!!g.velocityCompanion?.connected,won:g.state==='won',teleports:g.teleportCount,cargoTransports:g.physics.portalTransports,siphon:l.circuit&&{primed:l.circuit.primed,height:l.circuit.height,returning:l.circuit.returning},rotor:l.puzzleProgression50&&{angle:l.rotor.angle,loadedA:l.rotor.loaded('a'),loadedB:l.rotor.loaded('b')}};}
export async function runCampaignShortcutCase(g,name){
 const l=g.firstLevel,companion=g.cargo,body=g.physics.cargoBody,mesh=g.cargo.group;
 const row={level:g.levelIndex+1,id:l.id,name,outcome:'setup_failure',checkpoints:[],shots:[],milestones:[],attackReached:false};
 const start=performance.now();let d;
 const note=text=>{const point={text,...snapshot(g)};row.checkpoints.push(point);if(typeof process!=='undefined'&&process.env?.PROGRESS==='1')console.log(JSON.stringify({level:row.level,name,text,...point}));};
 function post35Physics(){return {firstLatched:l.isFirstLatched(),secondLatched:l.isLatched(),firstProgress:l.first.progress,secondProgress:l.second.progress,cargoTransports:g.physics.portalTransports,teleports:g.teleportCount,cargoPosition:g.cargo.position.toArray(),playerPosition:g.playerPosition.toArray(),cargoGrounded:!!g.physics.grounded,held:!!g.heldCube,sameCompanion:g.cargo===companion&&g.cargo.group===mesh,sameCargoBody:g.physics.cargoBody===body};}
 function begin(text){row.attackReached=true;row.attackStart=snapshot(g);if(row.prerequisitePhysics){const p=row.prerequisitePhysics;p.atAttackStart={...post35Physics(),cargoTransportsBefore:p.initial.cargoTransports,cargoTransportsAfter:g.physics.portalTransports};}note(text);}
 function drive(x,z,seconds,{jump=false,skirt=false}={}){
  g.input.keys.add('ShiftLeft');
  for(let n=0;n<seconds*60&&g.state==='playing';n++){
   let dx=x-g.playerPosition.x,dz=z-g.playerPosition.z,r=Math.hypot(dx,dz);dx/=Math.max(.001,r);dz/=Math.max(.001,r);
   if(skirt){const sign=Math.floor(n/100)%3-1,angle=sign*.72;[dx,dz]=[dx*Math.cos(angle)-dz*Math.sin(angle),dx*Math.sin(angle)+dz*Math.cos(angle)];}
   if(jump&&n%45===0)g.input.jumpQueued=true;d.worldMove(dx,dz);d.frame();
   if(n%120===0)note('Finite movement sample');
  }d.stop();
 }
 const carrying=()=>!!(g.heldCube||g.velocityCompanion?.connected);
 function collect({required=true}={}){
  for(let n=0;n<540&&!carrying();n++){
   const p=g.cargo.position,dx=p.x-g.playerPosition.x,dz=p.z-g.playerPosition.z,r=Math.hypot(dx,dz);
   if(n%12===0&&g.playerPosition.clone().add(V(0,1.1,0)).distanceTo(p)<(g.kineticMode?3.1:2)){d.stop();g.interact();if(carrying()){d.wait(.2);return true;}}
   const pace=r>1.4?Math.min(1,(r-1.3)*1.8):0;d.worldMove(dx/Math.max(.001,r)*pace,dz/Math.max(.001,r)*pace);d.frame();
  }d.stop();
  // A straight approach can finish against the wrong face of a plinth. Each
  // alternate stance is reached by ordinary movement and can itself be blocked.
  for(const [dx,dz]of [[1.1,0],[-1.1,0],[0,1.1],[0,-1.1]]){
   if(carrying())return true;
   const p=g.cargo.position.clone();
   if(Math.abs(p.y-(g.playerPosition.y+1.1))>2.2)break;
   try{d.walk(p.x+dx,p.z+dz,4);}catch(error){if(!/Blocked walking|Walk timed out/.test(String(error)))throw error;row.checkpoints.push({text:'Alternate physical pickup stance blocked',error:String(error),...snapshot(g)});continue;}
   d.stop();g.interact();d.wait(.3);
  }
  if(carrying())return true;
  if(required)throw Error('Original companion inaccessible after authentic prerequisite setup');
  note('Finite ordinary recovery attempts could not retrieve the released original body; exit attack continues from the observed state');return false;
 }
 function cargoPrerequisites(){
  const n=g.levelIndex+1;
  if(n===15)room15Extract(d);
  else if(n===19){room19Ascent(d);room19Cargo(d);for(const [x,z]of [[0,-6.5],[4,-6.5],[10.1,-6.5],[10.1,-4.6]])d.walk(x,z);}
  else if(n===35){
   const milestoneStart=row.milestones.length;
   row.prerequisitePhysics={schema:'post35-causal-prefix-v1',level:35,initial:post35Physics(),sourceRoute:{driver:'runPost35',path:'src/game/LabPostJourneyA.js',route:'latches-before-freight',stopAfter:'freight',returned:false,milestones:[]}};
   runPost35(d,{route:'latches-before-freight',stopAfter:'freight'});
   row.prerequisitePhysics.sourceRoute.returned=true;
   row.prerequisitePhysics.sourceRoute.milestones=row.milestones.slice(milestoneStart).map(m=>m.name);
   row.prerequisitePhysics.freightArrival=post35Physics();
   for(const [x,z]of [[8,-24.4],[8,-12],[0,-12],[0,-5],[0,0]])d.walk(x,z);
  }
  else if(n===44)runPuzzleProgression44(d,{stopAfter:'returned'});
  else if(n===45){runPuzzleProgression45(d,{stopAfter:'extracted'});d.walk(-25.5,23);for(let i=0;i<180&&g.playerPosition.distanceTo(g.cargo.position)>1.8;i++){d.worldMove(0,-1);d.frame();}d.stop();}
  else if(n===46){runPuzzleProgression46(d,{stopAfter:'settled'});d.walk(3,-22);d.walk(3,g.cargo.position.z);}
  else if(n===48)runPuzzleProgression48(d,{stopAfter:'retrieved'});
  else return;
  row.prerequisitePrefix={level:n,milestones:row.milestones.map(m=>m.name),state:snapshot(g)};
  note('Only the authored prefix needed to make original cargo physically accessible has completed; the remaining route is attacked');
 }
 function roofChain(goal){
  // Axis-aligned extents suggest jump targets; they do not establish a route.
  // The production solver must execute every candidate edge, including any
  // actual wall, slope, moving body, cargo collision or failed landing.
  const supports=[
   ...g.floors.filter(f=>f.enabled!==false).map(f=>({name:f.mesh?.name??'floor',x0:f.minX,x1:f.maxX,z0:f.minZ,z1:f.maxZ,y:f.y})),
   ...g.colliders.filter(c=>c.enabled!==false&&!c.walkablePlane&&c.box).map(c=>({name:c.mesh?.name??'solid roof',x0:c.box.min.x,x1:c.box.max.x,z0:c.box.min.z,z1:c.box.max.z,y:c.box.max.y})),
  ].filter(s=>[s.x0,s.x1,s.z0,s.z1,s.y].every(Number.isFinite)&&s.x1-s.x0>.44&&s.z1-s.z0>.44);
  const inside=(s,p)=>p.x>=s.x0-.05&&p.x<=s.x1+.05&&p.z>=s.z0-.05&&p.z<=s.z1+.05;
  const gap=(s,p)=>Math.hypot(Math.max(0,s.x0-p.x,p.x-s.x1),Math.max(0,s.z0-p.z,p.z-s.z1));
  const seen=new Map(),queue=[];
  for(let i=0;i<supports.length;i++)if(inside(supports[i],g.playerPosition)&&Math.abs(supports[i].y-g.playerPosition.y)<.4){seen.set(i,-1);queue.push(i);}
  let best=queue[0],score=Infinity;
  const maxGap=g.kineticMode?7:3.9;
  for(let q=0;q<queue.length;q++){
   const i=queue[q],a=supports[i],metric=gap(a,goal)+Math.abs(a.y-goal.y)*4;
   if(metric<score){best=i;score=metric;}
   for(let j=0;j<supports.length;j++){
    if(seen.has(j))continue;const b=supports[j],dy=b.y-a.y;
    const dx=Math.max(0,a.x0-b.x1,b.x0-a.x1),dz=Math.max(0,a.z0-b.z1,b.z0-a.z1);
    if(dy>1.58||dy< -8||Math.hypot(dx,dz)>maxGap)continue;
    seen.set(j,i);queue.push(j);
   }
  }
  const route=[];
  while(best!==undefined&&best!==-1){route.unshift(supports[best]);best=seen.get(best);}
  row.roofPlan={candidateOnly:true,maxGap,geometricallyReachable:seen.size,route,executed:[]};
  for(const s of route.slice(1,60)){
   const x=THREE.MathUtils.clamp(g.playerPosition.x,s.x0+.22,s.x1-.22),z=THREE.MathUtils.clamp(g.playerPosition.z,s.z0+.22,s.z1-.22);
   drive(x,z,3,{jump:true});
   const reached=inside(s,g.playerPosition)&&g.playerGrounded&&Math.abs(g.playerPosition.y-s.y)<.4;
   row.roofPlan.executed.push({support:s.name,target:[x,s.y,z],reached,state:snapshot(g)});
   note(reached?'Actual sprint jump reached candidate support '+s.name:'Actual sprint jump was arrested before candidate support '+s.name);
   if(!reached)break;
  }
  drive(goal.x,goal.z,6,{jump:true,skirt:true});
 }
 function shoot(slot,panel,point){
  point??=panel.userData?.getFrame?.().center??panel.userData?.center?.clone()??panel.getFrame?.().center;
  if(!point)throw Error('Missing actual portal aiming point');
  d.look(point);const accepted=g.firePortal(slot);
  for(let n=0;n<240&&(g.portalShots.queue.length||g.portalShots.active.length);n++)d.frame();
  const installed=g.portals.portals[slot],shot={slot,panel:panel.name??panel.mesh?.name,point:point.toArray(),accepted,impact:accepted?g.portalShots.lastImpact:null,installedSurface:installed?.surfaceId,correct:accepted&&installed?.surfaceId===(panel.mesh?.uuid??panel.uuid)};row.shots.push(shot);return shot.correct&&!!shot.impact?.valid;
 }
 try{
 const report=await runV8Journey(g,{onMilestone:m=>row.milestones.push(m),scenario:async controls=>{
   d=controls;installPreciseLateAim(d);const goal=l.goal?.position??l.exitPosition??l.goalPosition;
   if(!goal)throw Error('No actual shared exit position');row.goal=goal.toArray();row.originalStart=snapshot(g);
   if(name==='folded-rift-first-cup-direct-upper-address'){
    runPuzzleProgression50(d,{stopAfter:'gallery-a'});note('Authentic first-cup weight and west-gallery prefix completed');
    begin('Attempt opposite passenger address before opposite freight delivery');
    const stances=[[-12,-15],[-6.5,-15.5],[-12,-7],[-17,-17]];let found=false;
    for(const [x,z]of stances){d.walk(x,z);if(shoot(1,l.rotor.paneB.mesh,l.rotor.paneB.getFrame().center)){found=true;break;}}
    if(!found){d.walk(-12,-19.5);d.until(()=>g.playerGrounded&&g.playerPosition.y< -3.8,6,'Actual service-floor descent');for(const [x,z]of [[-20,-28],[-39.2,-28],[-30,-18]]){d.walk(x,z);if(shoot(1,l.rotor.paneB.mesh,l.rotor.paneB.getFrame().center)){found=true;break;}}}
    if(found){
     row.forbiddenUpperAddressReached=true;note('Actual shot installed onto pane B using only first cup');
     // Return along real service ramp if the search descended, then use the
     // still installed departure/pane A to regain the west inspection gallery.
     if(g.playerPosition.y<0){d.walk(-39.2,-18);d.walk(-39.2,20);d.walk(-30,25);shoot(0,l.departureEntry.mesh,l.departureEntry.getFrame().center);shoot(1,l.rotor.paneA.mesh,l.rotor.paneA.getFrame().center);d.enter(l.departureEntry);d.walk(-12,-9);shoot(1,l.rotor.paneB.mesh,l.rotor.paneB.getFrame().center);}
     shoot(0,l.galleryFeed.surface.mesh,l.galleryFeed.surface.getFrame().center);note('West gallery floor paired with the opposite passenger pane from outside its mouth');
     // The freely usable passenger outlet makes this floor passable to the
     // player, unlike the intended narrow opposite-cup freight outlet. Walk
     // around its live ellipse while reclaiming the original first-cup load.
     const p=g.cargo.position.clone();d.walk(-16,-15);d.walk(-16,-3);d.walk(p.x,-3);d.walk(p.x,-1.95);note('Actual first-cup inspection position reached around the open floor');d.pickup();
     d.walk(p.x,-4);d.walk(-14,-4);d.walk(-14,-5);
     d.until(()=>Math.abs(l.rotor.angle)<.002&&l.rotor.body.angularVelocity.length()<.0005&&l.rotor.cups.every(c=>c.body.angularVelocity.length()<.002&&c.body.velocity.length()<.01),45,'First actual spring return');
     note('Same original cargo removed from first cup; opposite cup never loaded');
     const f=l.galleryFeed.surface.getFrame(),before=g.teleportCount;d.walk(f.center.x,f.center.z+4);g.input.keys.add('ShiftLeft');g.input.jumpQueued=true;
     for(let n=0;n<300&&g.teleportCount===before;n++){const dx=f.center.x-g.playerPosition.x,dz=f.center.z-g.playerPosition.z,r=Math.hypot(dx,dz);d.worldMove(dx/Math.max(.001,r)*Math.min(1,r*1.5),dz/Math.max(.001,r)*Math.min(1,r*1.5));d.frame();}d.stop();note('Actual jump/fall traversal through the early prepared pair');
     if(g.teleportCount>before){
      g.input.keys.add('ShiftLeft');for(let n=0;n<300&&g.state==='playing';n++){const dx=goal.x-g.playerPosition.x,dz=goal.z-g.playerPosition.z,r=Math.hypot(dx,dz);d.worldMove(dx/Math.max(.001,r),dz/Math.max(.001,r));d.frame();if(g.playerGrounded&&g.playerPosition.y>21.9)break;}d.stop();note('Actual exit-side air steering after skipping opposite freight');
      if(g.playerGrounded&&g.playerPosition.y>21.9){d.walk(goal.x,goal.z);d.wait(1);}
     }
    }return;
   }
   if(name==='siphon-header-mouth-observer-without-hydraulics'){
    d.walk(4,19);collect();g.interact();d.wait(.65);
    if(!shoot(0,l.loading.mesh,l.loading.getFrame().center)||!shoot(1,l.drop.mesh,l.drop.getFrame().center))throw Error('Actual siphon freight pair setup did not finish');
    collect();row.setupPortalPairReached=true;begin('Actual lower-floor/high-freight portal pair prepared without hydraulic displacement; original cargo held');
    drive(13,21,8,{jump:true,skirt:true});note('Actual upright observer tries the inclined .9m cargo mouth');return;
   }
   if(name==='siphon-ground-backfaces-and-partition-ends'){
    collect();g.interact();d.wait(.65);begin('Actual back-face passenger projectile shots before any water displacement');
    for(const [x,z]of [[4,19],[28,29],[-28,29],[28,-6],[-28,-6]]){
     drive(x,z,5,{jump:true});shoot(1,l.arrival.mesh,l.arrival.getFrame().center);shoot(0,l.passage.mesh,l.passage.getFrame().center);note('Ground stance attempts upper back faces');
    }return;
   }
   if(name==='siphon-basket-reclaim-before-drained-column'){
    runSiphonObservatory(d,{stopAfter:'upper'});begin('Hydraulic upper deck reached with live column; attempt earlier original cargo recovery');
    for(const [x,z]of [[-13,7],[-23,4],[-23,-14],[-19,-16]])d.walk(x,z);
    for(let n=0;n<6&&!g.heldCube;n++){drive(-16,-20,2,{jump:true,skirt:true});g.interact();d.wait(.5);note('Inspection basket untouched; E at fixed cistern glass');}return;
   }
   if(name!=='empty-direct-sprint'){cargoPrerequisites();collect();}
   if(g.kineticMode&&name==='early-release-finish-directed-shots'){row.effectiveName='linked-finish-directed-shots';row.carryMode='hands-free-stabilizer';}
   begin(name.startsWith('empty')?'Untouched spawn attack without cargo':row.prerequisitePrefix?'Original companion retrieved through the authentic causal prefix; remaining mechanisms omitted':g.kineticMode?'Original companion linked through ordinary E; no launch machinery used':'Original companion picked up through normal E; no machinery used');
   if(name==='held-finish-directed-shots'||name==='early-release-finish-directed-shots'){
    const panels=g.portalPanels.map(p=>({p,point:p.userData.portalFrame?.().center??p.userData.center?.clone()})).filter(s=>s.point);
    const byGoal=[...panels].sort((a,b)=>a.point.distanceTo(goal)-b.point.distanceTo(goal)).slice(0,3),byPlayer=[...panels].sort((a,b)=>a.point.distanceTo(g.playerPosition)-b.point.distanceTo(g.playerPosition)).slice(0,2);
    for(const target of byGoal){if(g.state!=='playing')break;
     // Keep the held-input rejection probe as its own case. The release case
     // genuinely frees the gun using E, fires at the visible geometry, then
     // recovers that same body for the attempted player/cargo exit traversal.
     if(name==='early-release-finish-directed-shots'&&g.heldCube){g.interact();d.wait(.65);note('Original cargo released with E before actual projectile');}
     shoot(1,target.p,target.point);
     for(const entry of byPlayer){if(g.state!=='playing')break;if(entry.p===target.p)continue;if(name==='early-release-finish-directed-shots'&&g.heldCube){g.interact();d.wait(.65);}shoot(0,entry.p,entry.point);if(name==='early-release-finish-directed-shots')collect({required:false});drive(entry.point.x,entry.point.z,3,{jump:true});drive(goal.x,goal.z,4,{jump:true,skirt:true});}
    }
   }else if(name==='held-roof-chain'){
    roofChain(goal);
   }else if(name==='held-corner-jumps'){
    drive(goal.x,goal.z,6,{jump:true});const delta=goal.clone().sub(g.playerPosition),side=V(-delta.z,0,delta.x).normalize();
    for(const sign of [-1,1]){drive(g.playerPosition.x+side.x*sign*8,g.playerPosition.z+side.z*sign*8,3,{jump:true});drive(goal.x,goal.z,6,{jump:true,skirt:true});}
   }else drive(goal.x,goal.z,12,{jump:false});
   note('Finite exit attempt completed');
  }});row.frames=report.frames;row.resets=report.resets;row.respawns=report.respawns;
  if(row.prerequisitePhysics)row.prerequisitePhysics.afterAttack=post35Physics();
  const introductoryPair=g.levelIndex===0&&row.shots.some(s=>s.accepted&&s.correct&&s.panel?.startsWith('near-left'))&&row.shots.some(s=>s.accepted&&s.correct&&s.panel?.startsWith('upper-view'))&&g.teleportCount>=1&&g.physics.portalTransports>=1;
  row.outcome=g.state==='won'?(introductoryPair?'legitimate_introductory_solution':validPost35Prerequisites(row)?'legitimate_post_prerequisite_solution':'bypass_candidate'):'finite_attack_observed';
  if(g.state==='won'&&introductoryPair)row.classification='The opening-room near-left/upper-view connection carries both original actors, matching its authored causal solution.';
  if(g.state==='won'&&row.outcome==='legitimate_post_prerequisite_solution')row.classification='Runtime snapshots verify both mechanical latches, both open gate positions, original free cargo transport into the middle court, unchanged original actors and zero resets. Only the intended retained-door return remained after this genuine prefix.';
 }catch(error){row.error=String(error);row.outcome=row.attackReached?(String(error).includes('unexpected reset')?'production_death':'attack_error'):'setup_failure';}
 finally{row.final=snapshot(g);row.sameCompanion=g.cargo===companion&&g.cargo.group===mesh&&g.physics.cargoBody===body;row.seconds=Number(((performance.now()-start)/1000).toFixed(2));}
 return row;
}

async function main(){
 const flags=Object.fromEntries(process.argv.slice(2).filter(a=>a.startsWith('--')).map(a=>{const i=a.indexOf('=');return [a.slice(2,i),a.slice(i+1)];}));
 const levels=(flags.levels??'1-40,42-51').split(',').flatMap(t=>t.includes('-')?Array.from({length:+t.split('-')[1]-+t.split('-')[0]+1},(_,i)=>+t.split('-')[0]+i):[+t]);
 const names=flags.cases?.split(',')??CAMPAIGN_SHORTCUT_CASES,out=path.resolve(flags.out??'qa/campaign-shortcuts.json');fs.mkdirSync(path.dirname(out),{recursive:true});
 const report={sourceCommit:process.env.BUILD_COMMIT??null,edition:'foundation',runtime:ACTIVE_FOUNDATION_RUNTIME_FLAGS,generatedAt:new Date().toISOString(),sources:sourceHashes(),harnessSha256:digest(fs.readFileSync(fileURLToPath(import.meta.url))),rows:[],limitations:['Finite player-input probes do not establish absence of every bypass.','Setup failures remain explicit and are not counted as blocked attacks.','Headless physics is not visual or WebGL performance evidence.','Stable source room 41 is the castle and is handled by its continuous route harness.']};
 report.fingerprint=digest(JSON.stringify(report.sources));const save=()=>fs.writeFileSync(out,JSON.stringify(report,null,2)+'\n');save();
 const g=await createHeadlessGame();g.chamberEdition='foundation';Object.assign(g,ACTIVE_FOUNDATION_RUNTIME_FLAGS);
 try{for(const level of levels)for(const name of names){if(level===41)throw Error('Use dedicated castle driver for stable room 41');await g.selectLevel(level-1,false);const row=await runCampaignShortcutCase(g,name);report.rows.push(row);save();console.log(JSON.stringify({level,name,outcome:row.outcome,attackReached:row.attackReached,won:row.final.won,seconds:row.seconds,error:row.error}));}}
 finally{g.firstLevel.dispose?.();g.physics.dispose();g.portals.dispose();report.sourcesAfter=sourceHashes();report.sourceDrift=[...new Set([...Object.keys(report.sources),...Object.keys(report.sourcesAfter)])].filter(p=>report.sources[p]!==report.sourcesAfter[p]);report.harnessSha256After=digest(fs.readFileSync(fileURLToPath(import.meta.url)));report.finished=true;report.summary={total:report.rows.length,attackReached:report.rows.filter(r=>r.attackReached).length,bypassCandidates:report.rows.filter(r=>r.outcome==='bypass_candidate').map(r=>({level:r.level,name:r.name})),setupFailures:report.rows.filter(r=>r.outcome==='setup_failure').length,productionDeaths:report.rows.filter(r=>r.outcome==='production_death').length,attackErrors:report.rows.filter(r=>r.outcome==='attack_error').length};report.pass=report.rows.length===levels.length*names.length&&!report.sourceDrift.length&&report.harnessSha256===report.harnessSha256After&&!report.summary.bypassCandidates.length&&!report.summary.setupFailures&&!report.summary.attackErrors&&report.rows.every(r=>r.attackReached&&r.sameCompanion);save();if(!report.pass)process.exitCode=1;}
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))await main();
