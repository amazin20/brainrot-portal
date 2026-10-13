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
import {ACTIVE_FOUNDATION_RUNTIME_FLAGS} from '../src/game/ReleaseIdentity.js';

const V=(...p)=>new THREE.Vector3(...p),digest=v=>crypto.createHash('sha256').update(v).digest('hex');
const sourceHashes=()=>Object.fromEntries(fs.readdirSync('src/game',{recursive:true}).filter(f=>fs.statSync(path.join('src/game',f)).isFile()).sort().map(f=>['src/game/'+f,digest(fs.readFileSync('src/game/'+f))]));
export const CAMPAIGN_SHORTCUT_CASES=['empty-direct-sprint','held-direct-sprint','held-corner-jumps','early-release-finish-directed-shots'];
function snapshot(g){const l=g.firstLevel;return {player:g.playerPosition.toArray(),cargo:g.cargo.position.toArray(),held:!!g.heldCube,won:g.state==='won',teleports:g.teleportCount,cargoTransports:g.physics.portalTransports,siphon:l.circuit&&{primed:l.circuit.primed,height:l.circuit.height,returning:l.circuit.returning},rotor:l.puzzleProgression50&&{angle:l.rotor.angle,loadedA:l.rotor.loaded('a'),loadedB:l.rotor.loaded('b')}};}
export async function runCampaignShortcutCase(g,name){
 const l=g.firstLevel,companion=g.cargo,body=g.physics.cargoBody,mesh=g.cargo.group;
 const row={level:g.levelIndex+1,id:l.id,name,outcome:'setup_failure',checkpoints:[],shots:[],milestones:[],attackReached:false};
 const start=performance.now();let d;
 const note=text=>{const point={text,...snapshot(g)};row.checkpoints.push(point);if(typeof process!=='undefined'&&process.env?.PROGRESS==='1')console.log(JSON.stringify({level:row.level,name,text,...point}));};
 function begin(text){row.attackReached=true;row.attackStart=snapshot(g);note(text);}
 function drive(x,z,seconds,{jump=false,skirt=false}={}){
  g.input.keys.add('ShiftLeft');
  for(let n=0;n<seconds*60&&g.state==='playing';n++){
   let dx=x-g.playerPosition.x,dz=z-g.playerPosition.z,r=Math.hypot(dx,dz);dx/=Math.max(.001,r);dz/=Math.max(.001,r);
   if(skirt){const sign=Math.floor(n/100)%3-1,angle=sign*.72;[dx,dz]=[dx*Math.cos(angle)-dz*Math.sin(angle),dx*Math.sin(angle)+dz*Math.cos(angle)];}
   if(jump&&n%45===0)g.input.jumpQueued=true;d.worldMove(dx,dz);d.frame();
   if(n%120===0)note('Finite movement sample');
  }d.stop();
 }
 function collect(){
  for(let n=0;n<540&&!g.heldCube;n++){
   const p=g.cargo.position,dx=p.x-g.playerPosition.x,dz=p.z-g.playerPosition.z,r=Math.hypot(dx,dz);
   if(n%12===0&&g.playerPosition.clone().add(V(0,1.1,0)).distanceTo(p)<2){d.stop();g.interact();if(g.heldCube){d.wait(.2);return;}}
   const pace=r>1.4?Math.min(1,(r-1.3)*1.8):0;d.worldMove(dx/Math.max(.001,r)*pace,dz/Math.max(.001,r)*pace);d.frame();
  }d.stop();if(!g.heldCube)throw Error('Original companion inaccessible before prerequisite mechanism');
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
   if(name!=='empty-direct-sprint')collect();
   begin(name.startsWith('empty')?'Untouched spawn attack without cargo':'Original companion picked up through normal E; no machinery used');
   if(name==='held-finish-directed-shots'||name==='early-release-finish-directed-shots'){
    const panels=g.portalPanels.map(p=>({p,point:p.userData.portalFrame?.().center??p.userData.center?.clone()})).filter(s=>s.point);
    const byGoal=[...panels].sort((a,b)=>a.point.distanceTo(goal)-b.point.distanceTo(goal)).slice(0,3),byPlayer=[...panels].sort((a,b)=>a.point.distanceTo(g.playerPosition)-b.point.distanceTo(g.playerPosition)).slice(0,2);
    for(const target of byGoal){if(g.state!=='playing')break;
     // Keep the held-input rejection probe as its own case. The release case
     // genuinely frees the gun using E, fires at the visible geometry, then
     // recovers that same body for the attempted player/cargo exit traversal.
     if(name==='early-release-finish-directed-shots'&&g.heldCube){g.interact();d.wait(.65);note('Original cargo released with E before actual projectile');}
     shoot(1,target.p,target.point);
     for(const entry of byPlayer){if(g.state!=='playing')break;if(entry.p===target.p)continue;if(name==='early-release-finish-directed-shots'&&g.heldCube){g.interact();d.wait(.65);}shoot(0,entry.p,entry.point);if(name==='early-release-finish-directed-shots')collect();drive(entry.point.x,entry.point.z,3,{jump:true});drive(goal.x,goal.z,4,{jump:true,skirt:true});}
    }
   }else if(name==='held-corner-jumps'){
    drive(goal.x,goal.z,6,{jump:true});const delta=goal.clone().sub(g.playerPosition),side=V(-delta.z,0,delta.x).normalize();
    for(const sign of [-1,1]){drive(g.playerPosition.x+side.x*sign*8,g.playerPosition.z+side.z*sign*8,3,{jump:true});drive(goal.x,goal.z,6,{jump:true,skirt:true});}
   }else drive(goal.x,goal.z,12,{jump:false});
   note('Finite exit attempt completed');
  }});row.frames=report.frames;row.resets=report.resets;row.respawns=report.respawns;
  const introductoryPair=g.levelIndex===0&&row.shots.some(s=>s.accepted&&s.correct&&s.panel?.startsWith('near-left'))&&row.shots.some(s=>s.accepted&&s.correct&&s.panel?.startsWith('upper-view'))&&g.teleportCount>=1&&g.physics.portalTransports>=1;
  row.outcome=g.state==='won'?(introductoryPair?'legitimate_introductory_solution':'bypass_candidate'):'finite_attack_observed';
  if(g.state==='won'&&introductoryPair)row.classification='The opening-room near-left/upper-view connection carries both original actors, matching its authored causal solution.';
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
 finally{g.firstLevel.dispose?.();g.physics.dispose();g.portals.dispose();report.sourcesAfter=sourceHashes();report.sourceDrift=Object.keys(report.sources).filter(p=>report.sources[p]!==report.sourcesAfter[p]);report.harnessSha256After=digest(fs.readFileSync(fileURLToPath(import.meta.url)));report.finished=true;report.summary={total:report.rows.length,attackReached:report.rows.filter(r=>r.attackReached).length,bypassCandidates:report.rows.filter(r=>r.outcome==='bypass_candidate').map(r=>({level:r.level,name:r.name})),setupFailures:report.rows.filter(r=>r.outcome==='setup_failure').length,productionDeaths:report.rows.filter(r=>r.outcome==='production_death').length,attackErrors:report.rows.filter(r=>r.outcome==='attack_error').length};report.pass=report.rows.length===levels.length*names.length&&!report.sourceDrift.length&&report.harnessSha256===report.harnessSha256After&&!report.summary.bypassCandidates.length&&report.rows.every(r=>r.sameCompanion);save();if(!report.pass)process.exitCode=1;}
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))await main();
