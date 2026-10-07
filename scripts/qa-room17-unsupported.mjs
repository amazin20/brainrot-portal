import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import * as THREE from 'three';
import {createHeadlessGame} from './lab-headless.mjs';
import {runV8Journey} from '../src/game/LabV8Journey.js';
import {installPreciseLateAim,aimLateSurface} from '../src/game/LabLateCampaignAim.js';

// Every trial starts at the production spawn. Controls are movement, turning,
// normal portal shots, E and jump taps; no actor or portal poses are assigned.
const root=new URL('../',import.meta.url);
const output=new URL('qa/current-room17-unsupported.json',root);
const sourcePaths=[
 'src/game/LabCreativeRoom17.js','src/game/LabCreativeRoom17Journey.js',
 'src/game/LabGame.js','src/game/LabPortals.js','src/game/LabPhysics.js',
 'src/game/LabRampContact.js','src/game/LabSweep.js','src/game/LabKineticMovement.js',
 'src/game/LabCampaignLevels.js','src/game/LabPortalShots.js','src/game/LabCarrySurfaceContact.js',
 'src/game/InputController.js','src/game/LabControls.js','src/game/LabStaticAwareSAP.js',
 'src/game/LabCompanionBehavior.js','src/game/LabPlateContact.js',
 'src/game/LabTileWorldBase.js','src/game/LabResearchArt.js',
 'src/game/LabOpenArchitecture.js','src/game/LabWorkshopKit.js',
 'src/game/LabV8Journey.js','src/game/LabLateCampaignAim.js',
 'src/game/LabRoom21Journey.js','scripts/lab-headless.mjs',
 'scripts/qa-room17-unsupported.mjs',
];
async function sourceHashes(){
 return Object.fromEntries(await Promise.all(sourcePaths.map(async p=>[
  p,createHash('sha256').update(await fs.readFile(new URL(p,root))).digest('hex'),
 ])));
}
export const ROOM17_UNSUPPORTED_REGRESSION=Object.freeze({name:'exact-before-regression',held:false,startX:-4,onset:-3.5,period:6,phase:0,z:0});
export function room17UnsupportedCases(){
 const cases=[{...ROOM17_UNSUPPORTED_REGRESSION}];
 for(const held of [false,true])for(const onset of [-5,-3,-1,1])for(const period of [6,12])for(const phase of [0,3])
  cases.push({name:'midpoint-phase',held,startX:-4,onset,period,phase,z:0});
 for(const held of [false,true])for(const z of [-3,3])
  cases.push({name:'midpoint-boundary-lane',held,startX:-4,onset:-3,period:6,phase:0,z});
 for(const held of [false,true])for(const onset of [-8.5,-7.5,-6.5])for(const phase of [0,3])
  cases.push({name:'departure-edge-coyote',held,startX:-12,onset,period:6,phase,z:0});
 for(const z of [-3,3])
  cases.push({name:'departure-edge-boundary',held:false,startX:-12,onset:-7.5,period:6,phase:0,z});
 assert.equal(cases.length,51);
 return cases;
}
async function save(report){
 await fs.mkdir(new URL('qa/',root),{recursive:true});
 await fs.writeFile(output,JSON.stringify(report,null,2)+'\n');
}
function snapshot(g,frame){
 return{frame,player:g.playerPosition.toArray(),velocity:g.playerVelocity.toArray(),
  grounded:g.playerGrounded,angle:g.firstLevel.beam.angle,tension:g.firstLevel.beam.tension};
}
function prepareOriginalCargo(d,trial){
 const {game:g,level:l}=d;
 d.walk(g.cargo.position.x-1.3,g.cargo.position.z);d.pickup();
 d.walk(-16,13);d.look(new THREE.Vector3(-16,7,0));d.stop();d.wait(.3);
 assert.ok(g.interact()&&!g.heldCube,'Original cargo release failed');d.wait(.8);
 d.walk(-12,12);aimLateSurface(d,1,l.cargoReceiver);d.walk(-11,16);
 // A carried trial must keep the original body on the near shore. Charge an
 // off-cargo point on the same real floor before picking it up. Empty trials
 // reproduce the old direct delivery and leave that original body in the bay.
 const target=trial.held?l.feed.surface.getFrame().center.clone().add(new THREE.Vector3(2.2,0,0))
  :g.cargo.position.clone().setY(l.feed.surface.getFrame().center.y);
 aimLateSurface(d,0,l.feed.surface,target);
 assert.ok(g.portals.ready,'Ordinary preparation did not create a live pair');
 if(trial.held){
  d.wait(.5);assert.equal(g.physics.portalTransports,0,'Off-cargo preparation transported the body');
  d.walk(g.cargo.position.x-1.3,g.cargo.position.z);d.pickup();assert.equal(g.heldCube,g.cargo);
 }else{
  d.until(()=>g.physics.portalTransports>0&&g.cargo.position.x>20,8,'Early original cargo delivery failed');d.wait(1);
  assert.ok(g.cargo.position.y>6&&g.physics.grounded,'Early original cargo did not settle on the far upper gallery');
 }
}
function attemptUnsupportedLanding(d,trial,row){
 const {game:g,level:l}=d;
 if(trial.startX===-4)d.walk(-10,trial.z);
 d.walk(trial.startX,trial.z);g.input.keys.add('ShiftLeft');
 row.setupCompleted=true;row.lowerMinX=l.lowerDock.floor.minX;
 let previousVy=g.playerVelocity.y;
 // Preserve the historical 180-frame tap sequence, then keep its forward
 // input while the last real flight resolves. A deadline is not a landing.
 for(let frame=0;frame<420;frame++){
  if(frame<180&&g.playerPosition.x>trial.onset&&frame%trial.period===trial.phase){g.input.jumpQueued=true;row.jumpRequests++;}
  d.worldMove(1,0);d.frame();
  if(g.playerVelocity.y>4&&previousVy<2)row.realTakeoffs++;
  previousVy=g.playerVelocity.y;
  if(frame%5===0)row.trace.push(snapshot(g,frame));
  assert.equal(l.beam.tension,0,'Attack obtained actual cable support');
  const p=g.playerPosition;
  const lower=g.playerGrounded&&p.x>l.lowerDock.floor.minX-.5&&Math.abs(p.y+1.2)<.35;
  const upper=g.playerGrounded&&p.x>l.upperDock.floor.minX-.5&&Math.abs(p.y-6)<.35;
  if(lower||upper){
   row.unsupportedLanding=true;row.permanentGallery=upper?'upper':'lower';row.landing=p.toArray();break;
  }
  if(frame>=180&&g.playerGrounded&&p.y<-9.5){row.resolvedOnDryFloor=true;row.resolutionFrame=frame;break;}
 }
 d.stop();
 if(!row.unsupportedLanding)assert.ok(row.resolvedOnDryFloor,'Unsupported attack deadline left an unresolved trajectory at '+g.playerPosition.toArray());
}
function attemptJointGoal(d,row){
 const {game:g}=d;
 row.jointGoalAttempted=true;
 // Continue any real landing through the visible ramp's actual low end. A
 // blocked walk here is an error, never evidence that the attack was blocked.
 if(row.permanentGallery==='lower'){d.walk(16,20);d.walk(24,20);d.walk(24,4);}
 d.walk(24,0);
 if(g.state==='playing'&&!g.heldCube){d.walk(g.cargo.position.x-1.25,g.cargo.position.z);d.pickup();d.walk(24,0);}
 d.until(()=>g.state==='won',4,'Unsupported landing did not complete its joint goal attempt');
}

export function createRoom17UnsupportedResult(trial=ROOM17_UNSUPPORTED_REGRESSION){
 return{...trial,outcome:'running',setupCompleted:false,unsupportedLanding:false,
  jointGoalAttempted:false,resolvedOnDryFloor:false,jumpRequests:0,realTakeoffs:0,trace:[]};
}
// Reusable ordinary-input regression for the room's tests. A caller may pass
// its row so an exception after a genuine landing preserves that evidence.
export function runRoom17UnsupportedAttempt(d,trial=ROOM17_UNSUPPORTED_REGRESSION,row=createRoom17UnsupportedResult(trial)){
 installPreciseLateAim(d);prepareOriginalCargo(d,trial);attemptUnsupportedLanding(d,trial,row);
 if(!row.unsupportedLanding){row.outcome='blocked-before-permanent-landing';return row;}
 attemptJointGoal(d,row);row.outcome='unsupported-landing-full-win';return row;
}

export async function runRoom17UnsupportedQa(){
const report={created:new Date().toISOString(),kind:'ordinary-input room17 unsupported landing attacks',
 workflowSha:process.env.GITHUB_SHA??null,sourceBefore:await sourceHashes(),cases:[],summary:null};
let g;
try{
 g=await createHeadlessGame();g.chamberEdition='foundation';
 for(const trial of room17UnsupportedCases()){
  await g.selectLevel(16,false);
  const cargo=g.cargo,body=g.physics.cargoBody.id;
  const row=createRoom17UnsupportedResult(trial);
  try{
   row.route=await runV8Journey(g,{scenario:d=>runRoom17UnsupportedAttempt(d,trial,row)});
  }catch(error){
   row.outcome=row.unsupportedLanding?'continuation-error-after-unsupported-landing':'setup-error';
   row.error=error.stack;
  }
  row.won=g.state==='won';row.originalCargo=g.cargo===cargo;row.originalBody=g.physics.cargoBody.id===body;
  row.playerTeleports=g.teleportCount;row.cargoPortalTransports=g.physics.portalTransports;
  row.finalPlayer=g.playerPosition.toArray();row.finalCargo=g.cargo.position.toArray();
  row.finalBeam={angle:g.firstLevel.beam.angle,tension:g.firstLevel.beam.tension};
  row.pass=row.outcome==='blocked-before-permanent-landing'&&row.setupCompleted&&row.resolvedOnDryFloor&&row.jumpRequests>0&&row.realTakeoffs>0&&!row.won
   &&row.originalCargo&&row.originalBody&&row.route?.resets===0&&row.route?.respawns===0&&row.playerTeleports===0;
  report.cases.push(row);await save(report);
  console.log(JSON.stringify({case:report.cases.length,held:row.held,startX:row.startX,onset:row.onset,
   period:row.period,phase:row.phase,z:row.z,outcome:row.outcome,pass:row.pass}));
 }
}catch(error){report.error=error.stack;}
finally{
 report.sourceAfter=await sourceHashes();
 report.sourceStable=JSON.stringify(report.sourceBefore)===JSON.stringify(report.sourceAfter);
 report.changedSources=sourcePaths.filter(p=>report.sourceBefore[p]!==report.sourceAfter[p]);
 report.summary={cases:report.cases.length,expectedCases:51,
  unsupportedLandings:report.cases.filter(r=>r.unsupportedLanding).length,
  fullBypasses:report.cases.filter(r=>r.won).length,
  setupOrContinuationErrors:report.cases.filter(r=>r.error).length,
  allOriginalBodiesPreserved:report.cases.every(r=>r.originalCargo&&r.originalBody),
  allRouteResetsZero:report.cases.every(r=>r.route?.resets===0&&r.route?.respawns===0),
  sourceStable:report.sourceStable,
  pass:report.cases.length===51&&report.cases.every(r=>r.pass)&&report.sourceStable&&!report.error};
 await save(report);console.log(JSON.stringify(report.summary));
 g?.physics?.dispose();g?.portals?.dispose();
}
return report;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const report=await runRoom17UnsupportedQa();process.exitCode=report.summary.pass?0:1;
}
