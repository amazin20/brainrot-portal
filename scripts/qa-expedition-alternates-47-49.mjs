/** Distinct constructive routes and finite failed preparations, from normal
 * Play spawns. The route writes only ordinary controller/camera/E/projectile
 * inputs. Cargo/player poses, velocities, portal frames and puzzle flags are
 * owned exclusively by the unmodified production simulation. */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import * as THREE from 'three';
import {createHeadlessGame} from './lab-headless.mjs';
import {runV8Journey} from '../src/game/LabV8Journey.js';
import {installRoom21Aim} from '../src/game/LabRoom21Journey.js';

const V=(...p)=>new THREE.Vector3(...p),sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const file=fileURLToPath(import.meta.url),output=process.env.OUT||'qa/expedition-alternates-47-49.json';
const sourceFiles=[];function visit(dir){for(const entry of fs.readdirSync(dir,{withFileTypes:true})){const relative=dir+'/'+entry.name;if(entry.isDirectory())visit(relative);else if(entry.isFile())sourceFiles.push(relative);else throw Error('Unsupported source input: '+relative);}}visit('src');visit('public');sourceFiles.push(...['index.html','package.json','package-lock.json','vite.config.js'].filter(p=>fs.existsSync(p)));sourceFiles.sort();
const sourceHashes=()=>Object.fromEntries(sourceFiles.map(p=>[p,sha(fs.readFileSync(p))]));
const sourceBefore=sourceHashes(),harnessBefore=sha(fs.readFileSync(file));
const report={scope:'Finite distinct-route search in authored rooms 47,48,49 on the repaired exact source. Headless production controller/Cannon simulation; no browser rendering or exhaustive route claim.',
 policy:'Only normal movement, jump/sprint, yaw/pitch, E and projectile inputs. Existing pairs remain live or are re-aimed through ordinary shots. One initial normal Play reset precedes instrumentation; no actor/body/velocity/portal/mechanism/victory fixtures or later resets.',
 source:{commit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),modifiedTrackedInputs:execFileSync('git',['diff','--name-only','HEAD','--','src','public','index.html','package.json','package-lock.json','vite.config.js'],{encoding:'utf8'}).trim().split('\n').filter(Boolean),sourceInputsSha256:sha(JSON.stringify(sourceBefore)),sourceInputFiles:sourceFiles.length,harnessSha256:harnessBefore},rows:[],constraints:{
  47:['The real free cargo must exceed 175 J contact energy at the ceramic; held and low floor contact do not fracture it.','The cargo outlet is 1.8×1.1 m, so the upright player cannot follow its high-speed transport.','The permanent observer incline must bring the player to the original cargo after the fracture.'],
  48:['Door displacement follows a running real jaw with gap >0.68 m; an empty closing stroke does not preserve an opening.','The 0.55 m cheek slot blocks carried cargo; the cargo aperture must deliver a free original body into the bed.','The far pawl preserves the measured gap and opens the real hood before bed access.'],
  49:['A portal segment and an actual reflected segment must illuminate the receiver.','The real load lever arm sets the continuous mirror angle; the clamp can preserve that angle before the optical pair exists.']}};
function save(){fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');}
function state(g){const l=g.firstLevel;return {player:g.playerPosition.toArray(),cargo:g.cargo.position.toArray(),held:!!g.heldCube,state:g.state,cargoBodyId:g.physics.cargoBody.id,playerTeleports:g.teleportCount,cargoTransports:g.physics.portalTransports,
 fuse:l.fuse?{broken:l.fuse.broken,energy:l.fuse.energy}:undefined,press:l.press?{running:l.press.running,pinned:l.press.pinned,gap:l.press.gap,loaded:l.press.loaded(),door:l.door.progress,hood:l.roof.progress}:undefined,
 head:l.head?{angle:l.head.angle,arm:l.head.arm,lit:l.head.lit,clamped:l.head.clamped,door:l.door.progress,trayLoaded:l.tray.loaded(),rayKinds:l.head.segments.map(s=>s.kind)}:undefined};}
function driver(g,row){
 const move=new THREE.Vector2(),cargo=g.cargo,body=g.physics.cargoBody,old={move:g.input.getMove,reset:g.resetRun,respawn:g.respawn,cargoReset:g.physics.resetCargo};
 let resets=0,respawns=0,cargoResets=0;g.input.getMove=()=>move.clone();
 g.resetRun=function(...a){resets++;return old.reset.apply(this,a);};g.respawn=function(...a){respawns++;return old.respawn.apply(this,a);};g.physics.resetCargo=function(...a){cargoResets++;return old.cargoReset.apply(this,a);};
 const d={game:g,level:g.firstLevel,
  frame(){for(let sub=0;sub<2&&g.state==='playing';sub++)g.updatePlaying(1/120);g.updateVisuals(1/60,1);row.frames++;
   assert.equal(g.cargo,cargo,'Original companion replaced');assert.equal(g.physics.cargoBody,body,'Original rigid body replaced');assert.equal(resets+respawns+cargoResets,0,'Production death/reset during attempted route');
   if(row.frames%120===0)row.samples.push({frame:row.frames,...state(g)});
  },stop(){move.set(0,0);g.input.keys.clear();},worldMove(x,z){const v=V(x,0,z).applyAxisAngle(V(0,1,0),-g.yaw);move.set(v.x,v.z);},
  wait(seconds){d.stop();for(let n=0;n<seconds*60&&g.state==='playing';n++)d.frame();},
  until(condition,seconds,label){d.stop();for(let n=0;n<seconds*60;n++){if(condition())return;d.frame();}assert.ok(condition(),label+': '+JSON.stringify(state(g)));},
  walk(x,z,seconds=16){let best=Infinity,stuck=0;for(let n=0;n<seconds*60&&g.state==='playing';n++){const delta=V(x-g.playerPosition.x,0,z-g.playerPosition.z),distance=delta.length();if(distance<.13){d.stop();return;}if(distance<best-.01){best=distance;stuck=0;}else stuck++;delta.normalize().multiplyScalar(Math.min(1,distance*1.5));d.worldMove(delta.x,delta.z);d.frame();if(stuck>360)break;}d.stop();assert.ok(g.state==='won'||Math.hypot(x-g.playerPosition.x,z-g.playerPosition.z)<.35,'Finite path blocked toward '+[x,z]+': '+JSON.stringify(state(g)));},
  pickup(){assert.ok(g.interact()&&g.heldCube,'Ordinary pickup E failed');d.wait(.5);},
  mark(label){row.events.push({label,frame:row.frames,...state(g)});},
  close(){d.stop();row.resets=resets;row.respawns=respawns;row.cargoResets=cargoResets;row.sameOriginalCargo=g.cargo===cargo;row.sameOriginalBody=g.physics.cargoBody===body;g.input.getMove=old.move;g.resetRun=old.reset;g.respawn=old.respawn;g.physics.resetCargo=old.cargoReset;}
 };installRoom21Aim(d);return d;
}
function collect(d){if(d.game.heldCube)return;for(const [x,z]of [[1.25,0],[-1.25,0],[0,1.25],[0,-1.25]]){const p=d.game.cargo.position.clone();try{d.walk(p.x+x,p.z+z,6);}catch{continue;}if(d.game.playerPosition.distanceTo(d.game.cargo.position)<2.2&&d.game.interact()&&d.game.heldCube){d.wait(.5);return;}}throw Error('Original cargo is not physically reachable from attempted side');}
function release(d){d.stop();d.wait(.2);assert.ok(d.game.interact()&&!d.game.heldCube,'Ordinary cargo release E failed');d.wait(.65);}
function finish47(d){d.walk(-8,9);d.walk(-8,25.5);d.walk(6,18);d.walk(6,0);d.walk(0,0);collect(d);d.walk(0,-21);d.until(()=>d.game.state==='won',3,'Both original travellers missed goal');}
function setup47(d){const l=d.level;d.walk(-8,9);d.walk(-8,25.5);d.walk(0,25.5);d.walk(0,12);d.walk(-8,7);d.aim(0,l.well.surface.getFrame().center);d.walk(-8,0);d.walk(0,0);d.aim(1,l.outlet.getFrame().center);d.walk(8,0);d.walk(8,25.5);d.walk(-8,25.5);d.walk(-8,8);d.walk(-12,8.1);}
function setup48(d){const l=d.level;d.walk(-11,13);d.aim(1,l.mouth.getFrame().center);d.aim(0,l.feed.surface.getFrame().center.clone().add(V(-.6,0,-.05)));}
function deliver48(d){const g=d.game;collect(d);d.walk(-17,18.3);release(d);d.until(()=>g.physics.portalTransports>0,5,'Cargo feed did not cross');assert.ok(g.portals.ready,'Original delivery pair must remain live');d.until(()=>g.physics.grounded,3,'Original cargo did not settle in bed');}
function run48Motor(d){const g=d.game,l=d.level;d.walk(-18,9.5);assert.ok(g.interact(),'Press control missed');d.until(()=>l.press.running&&l.press.gap>.68&&l.press.gap<3&&l.door.progress>.95,5,'Original cargo did not arrest jaw');d.mark('Original free body arrests actual running jaw');d.walk(0,7);d.walk(0,-1);d.walk(8,-10.5);assert.ok(g.interact(),'Far pawl E missed');assert.ok(l.press.pinned,'Far pawl did not preserve real stroke');d.until(()=>l.roof.progress>.95,3,'Physical inspection hood stayed shut');d.mark('Far pawl opens real inspection hood');}
const routes=[
 {room:47,name:'prestage-original-free-cargo-before-pair-then-physical-shove',difference:'Cargo is parked loose on the upper balcony before portals exist, then a walking capsule pushes it off the lip; no held edge release supplies the launch.',run(d){
  const g=d.game,l=d.level;collect(d);d.walk(-16,12);release(d);assert.ok(g.cargo.position.y>12&&g.cargo.position.z>8.3&&!g.portals.ready,'Cargo staging did not leave a safe unpaired original body on the balcony');d.mark('Original free cargo staged on acceleration balcony before any portal pair');
  setup47(d);d.walk(g.cargo.position.x-1.35,g.cargo.position.z);for(let n=0;n<180&&g.cargo.position.x<-16.2;n++){d.worldMove(.35,0);d.frame();}d.stop();d.wait(1.5);assert.ok(Math.abs(g.cargo.position.x+16)<.65,'Finite lateral walking shove did not align original body with gravity aperture');d.mark('Actual lateral walking contact aligns free cargo above gravity entry');const p=g.cargo.position.clone();d.walk(p.x-2.5,p.z+2.5);d.walk(p.x,p.z+2.5);d.walk(p.x,p.z+1.25);assert.ok(!g.heldCube,'Push launch requires free cargo');const before=g.physics.portalTransports;
  for(let n=0;n<240&&g.physics.portalTransports===before;n++){d.worldMove(0,-.55);d.frame();if(g.playerPosition.z<8.6){d.stop();break;}}
  d.stop();d.until(()=>g.physics.portalTransports>before,6,'Finite walking shove did not send free cargo into gravity aperture');d.until(()=>l.fuse.broken,5,'Shoved gravity cargo did not fracture real ceramic');assert.ok(l.fuse.energy>=175);d.mark('Walking contact sends original loose cargo through gravity pair and fractures ceramic');finish47(d);
 }},
 {room:48,name:'staged-free-cargo-before-opening-feed-aperture',nativeAlternative:'staged-cargo',expectedComplete:true,difference:'Original free cargo rests on a solid unpaired feed floor before the entry portal is fired; creating the pair itself starts the real gravity delivery, with no held release into an already active hole.',run(d){
  const g=d.game,l=d.level;d.walk(-11,13);d.aim(1,l.mouth.getFrame().center);collect(d);d.walk(-17,18.3);release(d);d.until(()=>g.physics.grounded,3,'Original staged cargo did not rest on unpaired solid floor');assert.ok(!g.portals.ready&&g.physics.portalTransports===0);d.mark('Original free cargo settles on closed solid feed floor before entry aperture exists');d.walk(-11,13);d.aim(0,l.feed.surface.getFrame().center.clone().add(V(-.6,0,-.05)));d.until(()=>g.physics.portalTransports>0,5,'Creating the ordinary entry pair did not deliver staged original cargo');assert.ok(g.portals.ready,'Original staged delivery pair must remain live');d.until(()=>g.physics.grounded,3,'Staged cargo did not settle in real jaw bed');d.mark('Opening actual paired aperture delivers pre-staged free cargo through gravity');run48Motor(d);d.walk(8,-1);d.walk(0,-1);collect(d);d.walk(8,-1);d.walk(6,-12);d.walk(0,-21);d.until(()=>g.state==='won',3,'Both original travellers missed goal');
 }},
 {room:48,name:'reuse-original-freight-pair-for-loose-return-after-pawl',difference:'The delivery pair stays live during the jaw stroke; after the far pawl latches, the same original cargo is physically pushed back through its mouth and recovered from the original feed floor.',run(d){
  const g=d.game,l=d.level;setup48(d);deliver48(d);run48Motor(d);d.walk(8,-1);d.walk(0,-1);collect(d);d.walk(0,-1);d.walk(0,-4.6);const before=g.physics.portalTransports;
  for(let n=0;n<90&&g.physics.portalTransports===before;n++){d.worldMove(0,-.4);d.frame();if(n===12){assert.ok(g.interact()&&!g.heldCube,'Moving ordinary reverse release failed');d.mark('Moving release supplies original hand momentum toward retained cargo mouth');}}
  d.stop();d.until(()=>g.physics.portalTransports>before,4,'Finite reverse moving release did not return original cargo through retained mouth');d.mark('Original cargo returns through retained delivery pair, without another shot');
  d.walk(0,-1);d.walk(0,7);d.walk(-17,18);collect(d);d.walk(0,7);d.walk(0,-1);d.walk(8,-1);d.walk(6,-12);d.walk(0,-21);d.until(()=>g.state==='won',3,'Both travellers missed goal');
 }},
 {room:48,name:'motor-first-closed-jaw-late-free-load-retract-and-repress',difference:'The initial powered jaw stroke finishes before original cargo is delivered; ordinary retraction and reapplication must create the load-bearing gap from this different physical starting condition.',run(d){
  const g=d.game,l=d.level;setup48(d);d.walk(-18,9.5);assert.ok(g.interact(),'Motor first E missed');d.until(()=>l.press.gap<.2,5,'Empty initial stroke did not close');d.mark('Real empty jaw closes before original cargo delivery');deliver48(d);d.mark('Same original free cargo delivered into already powered closed bed');
  d.walk(-18,9.5);assert.ok(g.interact(),'Ordinary motor retraction E missed');d.until(()=>!l.press.running&&l.press.gap>3.1,5,'Loaded retraction did not restore usable bed');d.mark('Ordinary retraction prepares original late-delivered cargo for new stroke');run48Motor(d);d.walk(8,-1);d.walk(0,-1);collect(d);d.walk(8,-1);d.walk(6,-12);d.walk(0,-21);d.until(()=>g.state==='won',3,'Both original travellers missed goal');
 }},
 {room:49,name:'cargo-first-unlit-clamp-then-unloaded-optical-pair',nativeAlternative:'unlit-mirror',expectedComplete:true,difference:'Cargo torque and mechanical clamping occur before any optical pair. The original cargo is removed and parked, then light is redirected using the retained physical mirror angle.',run(d){
  const g=d.game,l=d.level;collect(d);d.walk(-5.1,18);d.walk(-4.68,18);release(d);d.until(()=>Math.abs(l.head.angle-Math.PI/4)<.03,10,'Real cargo torque did not converge without light');assert.ok(!l.head.lit&&!g.portals.ready);d.mark('Free original cargo rotates live mirror before optical portals exist');
  d.walk(7,10.3);assert.ok(g.interact(),'Unlit clamp E missed');assert.ok(l.head.clamped&&!l.head.lit);d.mark('Mechanical clamp freezes actual mirror angle while lens remains unlit');collect(d);d.walk(10,18);release(d);assert.ok(!l.tray.loaded());const frozen=l.head.angle;d.wait(2);assert.ok(Math.abs(l.head.angle-frozen)<1e-10&&!l.head.lit);d.mark('Original cargo removed and parked; unloaded unlit mirror preserves mechanical angle');
  d.walk(-12,18);d.aim(0,l.input.getFrame().center);d.walk(-12,3);d.aim(1,l.outlet.getFrame().center);d.until(()=>l.head.lit,3,'Stored real angle did not reflect later beam');assert.ok(!l.tray.loaded());d.mark('Later optical pair opens exit while original cargo is away from unloaded tray');d.walk(13,22);collect(d);d.walk(8,6);d.walk(8,-7);d.walk(0,-7);d.walk(0,-22);d.until(()=>g.state==='won',3,'Both original travellers missed goal');
 }}
];
const g=await createHeadlessGame();g.chamberEdition='foundation';
try{
 for(const route of routes.filter(r=>(process.env.ROOMS||'47,48,49').split(',').map(Number).includes(r.room)&&(!process.env.KIND||r.name.includes(process.env.KIND)))){
  await g.selectLevel(route.room-1,false);if(!route.nativeAlternative)g.resetRun(true);const row={room:route.room,name:route.name,difference:route.difference,expectedComplete:!!route.expectedComplete,initial:state(g),originalBodyId:g.physics.cargoBody.id,originalCargoUUID:g.cargo.group.uuid,sourceBefore:sha(JSON.stringify(sourceHashes())),frames:0,events:[],samples:[]};const d=route.nativeAlternative?null:driver(g,row),originalCargo=g.cargo,originalBody=g.physics.cargoBody;
  try{if(route.nativeAlternative){row.driver='runV8Journey';row.journeyOptions={alternative:route.nativeAlternative};row.actualRoute=await runV8Journey(g,{journeyOptions:row.journeyOptions,onMilestone:mark=>row.events.push({label:mark.name,...state(g)})});row.frames=row.actualRoute.frames;row.resets=row.actualRoute.resets;row.respawns=row.actualRoute.respawns;row.cargoResets=row.actualRoute.resets;row.sameOriginalCargo=g.cargo===originalCargo;row.sameOriginalBody=g.physics.cargoBody===originalBody;}else{d.wait(.5);await route.run(d);}row.complete=g.state==='won';row.outcome=row.complete?'complete-distinct-ordinary-input-route':'finite-attempt-incomplete';}
  catch(error){row.error=String(error);row.complete=false;row.outcome=/Production death\/reset|Original.*replaced/.test(row.error)?'production-reset-or-identity-failure':'finite-preparation-or-physical-constraint';}
  finally{d?.close();row.sameOriginalCargo=g.cargo===originalCargo;row.sameOriginalBody=g.physics.cargoBody===originalBody;row.final=state(g);row.sourceAfter=sha(JSON.stringify(sourceHashes()));row.sourceStable=row.sourceBefore===row.sourceAfter;row.seconds=row.frames/60;report.rows.push(row);save();console.log(JSON.stringify({room:row.room,name:row.name,outcome:row.outcome,frames:row.frames,error:row.error,final:row.final}));}
 }
}finally{
 const sourceAfter=sourceHashes();report.source.afterSha256=sha(JSON.stringify(sourceAfter));report.source.changedFiles=sourceFiles.filter(p=>sourceBefore[p]!==sourceAfter[p]);report.source.stable=report.source.changedFiles.length===0;report.source.harnessAfterSha256=sha(fs.readFileSync(file));report.source.harnessStable=report.source.harnessSha256===report.source.harnessAfterSha256;
 report.summary={attempts:report.rows.length,completeDistinctRoutes:report.rows.filter(r=>r.complete).length,completeRooms:[...new Set(report.rows.filter(r=>r.complete).map(r=>r.room))],finiteIncomplete:report.rows.filter(r=>!r.complete).length,resetOrIdentityFailures:report.rows.filter(r=>r.outcome==='production-reset-or-identity-failure').length,allOriginalBodiesPreserved:report.rows.every(r=>r.sameOriginalCargo&&r.sameOriginalBody)};
 report.pass=report.source.stable&&report.source.harnessStable&&report.summary.resetOrIdentityFailures===0&&report.summary.allOriginalBodiesPreserved&&report.rows.every(r=>r.sourceStable&&(!r.expectedComplete||r.complete));
 save();g.firstLevel.dispose?.();g.physics.dispose();g.portals.dispose();console.log('SUMMARY',JSON.stringify(report.summary),'SOURCE_STABLE',report.source.stable);if(!report.pass)process.exitCode=1;
}
