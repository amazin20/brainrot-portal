// Authored-room causal negatives from normal Play spawns. Only movement,
// jump, camera, E and projectile inputs change; there are no actor/velocity,
// portal-plane, mechanism-state or victory assignments in these probes.
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createHeadlessGame} from '../lab-headless.mjs';
import {installRoom21Aim} from '../../src/game/LabRoom21Journey.js';

const V=(...p)=>new THREE.Vector3(...p);
const dependencies=['LabExpansionRoomsB.js','LabGame.js','LabPhysics.js','LabPortals.js',
 'LabKineticMovement.js','LabPlateContact.js','LabOpenArchitecture.js','LabResearchArt.js',
 'LabWorkshopKit.js','LabPuzzleMechanics.js','LabLateCampaignMechanisms.js'];
const fingerprint=()=>createHash('sha256').update(dependencies.map(name=>name+'\n'+fs.readFileSync(new URL('../../src/game/'+name,import.meta.url))).join('\n')).digest('hex');
const evidence={scope:'Reusable authored 47,48,50 gameplay regressions using normal Play spawn and real input/controller/Cannon steps. The other two constructive rules live in lab-expansion-b-causal.test.js. No actor or mechanism fixtures.',dependencies,rows:[]};
const reportFile=new URL('../../qa/expansion-b-adversarial.json',import.meta.url);
function save(){fs.mkdirSync(new URL('../../qa/',import.meta.url),{recursive:true});fs.writeFileSync(reportFile,JSON.stringify(evidence,null,2)+'\n');}
function state(g){const l=g.firstLevel;return {player:g.playerPosition.toArray(),cargo:g.cargo.position.toArray(),held:!!g.heldCube,
 playerTeleports:g.teleportCount,cargoTeleports:g.physics.portalTransports,state:g.state,
 fuse:l.fuse?{broken:l.fuse.broken,energy:l.fuse.energy}:undefined,
 press:l.press?{gap:l.press.gap,running:l.press.running,pinned:l.press.pinned,door:l.door.progress,jaw:l.press.body?.position.toArray()}:undefined,
 head:l.head?{angle:l.head.angle,arm:l.head.arm,lit:l.head.lit,clamped:l.head.clamped,kinds:l.head.segments.map(s=>s.kind)}:undefined,
 top:l.top?{angle:l.top.angle,bumper:l.bumper.progress}:undefined,
 shuttle:l.shuttle?{position:l.shuttle.position.toArray(),target:l.shuttle.target,loaded:!!l.clutch.loaded(),berths:[0,1,2].map(i=>l.shuttle.at(i))}:undefined};}
function driver(g,row){
 const oldMove=g.input.getMove,move=new THREE.Vector2(),cargo=g.cargo,body=g.physics.cargoBody;
 g.input.getMove=()=>move.clone();
 const oldReset=g.resetRun,oldRespawn=g.respawn;let resets=0,respawns=0;
 g.resetRun=function(...args){resets++;return oldReset.apply(this,args);};
 g.respawn=function(...args){respawns++;return oldRespawn.apply(this,args);};
 row.samples=[];row.frames=0;row.minPlayerZ=Infinity;row.minCargoZ=Infinity;row.minTopAngle=0;row.maxPlayerY=-Infinity;
 const d={game:g,level:g.firstLevel,
  frame(){if(g.state==='playing')for(let sub=0;sub<2&&g.state==='playing';sub++)g.updatePlaying(1/120);g.updateVisuals(1/60,1);
   row.frames++;row.minPlayerZ=Math.min(row.minPlayerZ,g.playerPosition.z);row.minCargoZ=Math.min(row.minCargoZ,g.cargo.position.z);
   row.maxPlayerY=Math.max(row.maxPlayerY,g.playerPosition.y);row.minTopAngle=Math.min(row.minTopAngle,g.firstLevel.top?.angle||0);
   if(row.frames%30===0)row.samples.push(state(g));
   assert.equal(g.cargo,cargo,'original companion object changed');assert.equal(g.physics.cargoBody,body,'original rigid body changed');
   if(resets||respawns)throw Error('Setup/attack ended in production death or restart at '+g.playerPosition.toArray());
  },
  stop(){move.set(0,0);g.input.keys.clear();},
  worldMove(x,z){const v=V(x,0,z).applyAxisAngle(V(0,1,0),-g.yaw);move.set(v.x,v.z);},
  wait(seconds){d.stop();for(let n=0;n<Math.ceil(seconds*60)&&g.state==='playing';n++)d.frame();},
  until(condition,seconds,label){d.stop();for(let n=0;n<Math.ceil(seconds*60);n++){if(condition())return;d.frame();}if(!condition())throw Error(label+': '+JSON.stringify(state(g)));},
  walk(x,z,seconds=16){let best=Infinity,stuck=0;for(let n=0;n<seconds*60&&g.state==='playing';n++){
   const delta=V(x-g.playerPosition.x,0,z-g.playerPosition.z),distance=delta.length();if(distance<.13){d.stop();return;}
   if(distance<best-.01){best=distance;stuck=0;}else stuck++;delta.normalize().multiplyScalar(Math.min(1,distance*1.5));d.worldMove(delta.x,delta.z);d.frame();
   if(stuck>360)break;
  }d.stop();if(Math.hypot(x-g.playerPosition.x,z-g.playerPosition.z)>.35)throw Error('Setup path blocked toward '+[x,z]+': '+JSON.stringify(state(g)));},
  pickup(){assert.equal(g.interact(),true,'ordinary pickup E failed');assert.ok(g.heldCube,'E did not hold original cargo');d.wait(.5);},
  push(x,z,frames,{jumpEvery=0,sprint=false,everyE=0}={}){if(sprint)g.input.keys.add('ShiftLeft');for(let n=0;n<frames&&g.state==='playing';n++){
   if(jumpEvery&&n%jumpEvery===0)g.input.jumpQueued=true;if(everyE&&n%everyE===0)g.interact();d.worldMove(x,z);d.frame();
  }d.stop();},
  close(){d.stop();row.resets=resets;row.respawns=respawns;row.sameCargo=g.cargo===cargo;row.sameBody=g.physics.cargoBody===body;
   g.input.getMove=oldMove;g.resetRun=oldReset;g.respawn=oldRespawn;}
 };
 installRoom21Aim(d);return d;
}
async function probe(room,name,scenario){
 const g=await createHeadlessGame();g.chamberEdition='foundation';await g.selectLevel(room-1,false);g.resetRun(true);
 const row={room,name,started:new Date().toISOString(),sourceBefore:fingerprint(),initial:state(g)};const d=driver(g,row);
 try{d.wait(.5);await scenario(d,row);row.pass=true;row.outcome='causal-negative-held';return row;}
 catch(error){row.pass=false;row.error=String(error);row.outcome=error instanceof assert.AssertionError?'candidate-or-negative-assertion-failure':'setup-or-driver-failure';throw error;}
 finally{row.final=state(g);d.close();row.sourceAfter=fingerprint();row.sourceStable=row.sourceBefore===row.sourceAfter;row.finished=new Date().toISOString();evidence.rows.push(row);save();g.firstLevel.dispose?.();g.physics.dispose();g.portals.dispose();}
}
function unchangedPair(g){assert.equal(g.teleportCount,0);assert.equal(g.physics.portalTransports,0);assert.equal(g.state,'playing');}

export async function brittleSlowCarry(){return probe(47,'slow-held-and-free-ground-contact-does-not-fracture',d=>{
 const {game:g,level:l}=d;d.walk(-22.25,17);d.pickup();d.walk(-8,9);d.walk(-8,25.5);d.walk(-8,0);d.walk(0,0);
 assert.ok(g.playerPosition.y<.3,'contact attempt must be on the real lower floor');
 d.push(0,-.22,240);assert.ok(g.playerPosition.z<-2.8,'manual attempt did not reach the ceramic face');
 assert.equal(l.fuse.broken,false,'held low-speed original cargo fractured the ceramic');
 d.wait(.8);assert.equal(g.interact(),true);assert.equal(g.heldCube,null);d.push(0,-.2,240);d.wait(1.5);
 assert.equal(l.fuse.broken,false,'slow free ground contact fractured the ceramic');assert.ok(l.fuse.energy<175);unchangedPair(g);
 });}

export async function pressEmptySprint(){return probe(48,'empty-motor-transient-player-sprint-cannot-reach-far-side',d=>{
 const {game:g,level:l}=d;d.walk(-18,9.5);assert.equal(g.interact(),true);assert.equal(l.press.running,true);
 const delta=V(-g.playerPosition.x,0,1.0-g.playerPosition.z).normalize();d.push(delta.x,delta.z,160,{sprint:true,jumpEvery:30});
 d.push(0,-1,240,{sprint:true,jumpEvery:30});d.wait(2);
 assert.ok(g.playerPosition.z>1.3,'observer crossed the unjammed partition during its transient');
 assert.ok(l.press.gap<.2);assert.ok(l.door.progress<.1);assert.equal(l.press.pinned,false);unchangedPair(g);
 });}

export async function topplingLowManual(){return probe(50,'grounded-original-cargo-and-jump-contact-cannot-topple-wall',d=>{
 const {game:g,level:l}=d;d.walk(-22.25,19);d.pickup();d.walk(-23,11);d.walk(-23,-17);d.walk(-15,-17);d.walk(-15,3.25);d.walk(0,3.25);d.walk(0,15.5);
 d.walk(8,15.5);d.walk(8,0);d.walk(0,0);assert.ok(g.playerPosition.y>-.1&&g.playerPosition.y<.3,'manual impact must start on the lower south threshold');
 d.push(0,-1,480,{sprint:true,jumpEvery:35});d.wait(3);
 assert.ok(g.playerPosition.z<-2.8,'manual attempt did not reach the low guard');
 assert.ok(l.top.angle>-.14,'manual held/jump contact crossed the manufactured detent');assert.ok(l.bumper.progress<.05);unchangedPair(g);
 });}

export const EXPANSION_B_NEGATIVES=Object.freeze([
 ['47: slow carried and ground contact preserves real ceramic strength',brittleSlowCarry],
 ['48: an unloaded motor transient cannot carry a sprinting player past the door',pressEmptySprint],
 ['50: held ground/jump impacts cannot topple the structural wall',topplingLowManual],
]);

if(process.argv[1]&&fileURLToPath(import.meta.url)===process.argv[1]){
 const selected=(process.env.ROOMS||'47,48,50').split(',').map(Number);
 for(const [name,run]of EXPANSION_B_NEGATIVES.filter(([name])=>selected.includes(Number(name.slice(0,2)))))try{const r=await run();console.log('PASS',name,r.frames,r.sourceStable);}catch(error){console.error('FAIL',name,String(error));process.exitCode=1;}
 console.log('PROOF',fileURLToPath(reportFile));
}
