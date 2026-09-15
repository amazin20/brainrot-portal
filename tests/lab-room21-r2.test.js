import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createHeadlessGame} from '../scripts/lab-headless.mjs';
import {runV8Journey} from '../src/game/LabV8Journey.js';
import {room21PrepareSource, room21Freight} from '../src/game/LabRoom21Journey.js';
import {terminalAccessible} from '../src/game/LabPuzzleMechanics.js';
const g=await createHeadlessGame();await g.selectLevel(20,false);
after(()=>{g.physics.dispose();g.portals.dispose();});

test('the same source height is retained without either portal, then descends after ordinary brake release',async()=>{
 await runV8Journey(g,{scenario:d=>{
  room21PrepareSource(d);const source=g.firstLevel.state.sourceDrive;
  const height=source.car.floor.y;d.wait(3);assert.equal(source.car.floor.y,height);assert.equal(source.powered,false);
  d.walk(-10,17.5);d.walk(-24.7,17.5);d.walk(-24.7,16.7);g.interact();assert.equal(source.brake,false);
  d.until(()=>source.car.progress<.01,15,'Unpowered source return');assert(source.car.floor.y<7.2);
 }});
});

test('pneumatic transmission is independent of portal colour and never prepares cargo automatically',async()=>{
 await runV8Journey(g,{scenario:d=>{
  const aim=d.aim;d.aim=(index,point)=>aim(1-index,point);room21PrepareSource(d);
  assert(g.firstLevel.state.sourceDrive.car.progress>.99);
  assert.equal(g.firstLevel.state.freightGuard.loaded,false);assert.equal(g.firstLevel.state.freightHood.open,false);
 }});
});

test('loading freight lowers the physical return bridge, without changing the independent source',async()=>{
 await runV8Journey(g,{scenario:d=>{
  assert.equal(g.firstLevel.state.returnBridge.floor.y,12);room21Freight(d);
  assert(g.firstLevel.state.returnBridge.floor.y<2.6);
  assert.equal(g.firstLevel.state.sourceDrive.car.progress,0);assert.equal(g.firstLevel.state.sourceDrive.brake,false);
 }});
});

for(const x of [5.9,8,10.4,13.5])for(const z of [1.8,4.5,7.2])test(`legal floor pair under closed hood contains carried high-fall trajectory x=${x} z=${z}`,()=>{
 // Explicit contact/trajectory fixture: these initial actor/portal transforms
 // do NOT count as ordinary playthrough evidence or exhaustive bypass proof.
 g.resetRun(true);const level=g.firstLevel;
 assert(g.placeOnPanel(0,level.panels['shared-drop'].mesh,new THREE.Vector3(-10,.025,10)));
 assert(g.placeOnPanel(1,level.panels['freight-cradle'].mesh,new THREE.Vector3(x,7.38,z)));
 g.playerPosition.set(-10,18,10);g.previousPlayerPosition.copy(g.playerPosition);g.playerVelocity.set(0,0,0);g.playerGrounded=false;
 g.heldCube=g.cargo;g.physics.resetCargo({position:new THREE.Vector3(-10,19.06,10.72)});g.cargo.position.set(-10,19.06,10.72);
 const previousMove=g.input.getMove,identity=g.physics.cargoBody.id;let transferred=false,peak=-Infinity;
 g.input.getMove=()=>{
  if(!transferred)return new THREE.Vector2();
  const direction=new THREE.Vector3(14-g.playerPosition.x,0,-5-g.playerPosition.z).normalize().applyAxisAngle(new THREE.Vector3(0,1,0),-g.yaw);
  return new THREE.Vector2(direction.x,direction.z);
 };
 try{
  for(let i=0;i<1200&&g.state==='playing';i++){
   g.updatePlaying(1/120);transferred ||= g.teleportCount>0;
   if(transferred)peak=Math.max(peak,g.playerPosition.y);
  }
  assert(transferred,'A fixture that never crossed is not evidence against the shortcut');
  assert(peak<11.5,`Early floor exit escaped the hood: ${peak}`);
  assert.equal(g.firstLevel.isWon(),false);assert.equal(g.state,'playing');assert.equal(g.physics.cargoBody.id,identity);
 }finally{g.input.getMove=previousMove;}
});

test('far service control cannot be operated from the departure side or through its housing',()=>{
 g.resetRun(true);const t=g.firstLevel.state['freight-hoodControl'];
 for(const position of [[0,7,12.8],[-10,18,12],[17.7,7,-5],[17.7,0,-5]]){
  // Isolated reachability fixture, not a movement proof.
  g.playerPosition.fromArray(position);assert.equal(terminalAccessible(g,t),false);
 }
 g.playerPosition.set(15.9,12,-5);assert.equal(terminalAccessible(g,t),true);
});

test('new mechanism art remains independent from hood and bridge collider bounds',()=>{
 g.resetRun(true);const l=g.firstLevel,h=l.state.freightHood,b=l.state.returnBridge;
 assert(l.preparationArt.userData.colliderIndependent);
 assert.equal(h.mesh.children.length,0);
 const before=new THREE.Box3().setFromObject(h.mesh).getSize(new THREE.Vector3()).toArray();
 for(const p of [0,.2,.7,1]){h.previous=h.progress=p;l.renderUpdate(1);
  const size=new THREE.Box3().setFromObject(h.mesh).getSize(new THREE.Vector3()).toArray();
  assert(size.every((n,i)=>Math.abs(n-before[i])<1e-8), 'Visual translation must not change collider dimensions');
  assert(l.preparationArt.getObjectByName('Retracting freight inspection hood').position.distanceTo(h.mesh.position)<1e-8);
  assert(l.preparationArt.getObjectByName('Counterstroke transfer deck underframe').position.distanceTo(b.group.position)<1e-8);
 }
});
