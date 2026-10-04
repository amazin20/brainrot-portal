import assert from 'node:assert/strict';
import * as THREE from 'three';
import {playerFixture,wall} from './adversarial-core-cases.mjs';
import {LabPhysics} from '../../src/game/LabPhysics.js';

const H=1/120,V=(...p)=>new THREE.Vector3(...p);
/** Explicit isolated geometry: initial actors and planes are fixture setup.
 * Every subsequent approach, pickup, release and clear uses production input,
 * controller and rigid-body simulation. No post-setup actor state writes. */
export function releaseFixture(){
 const g=playerFixture();g.physics=new LabPhysics({gravity:-19.5});
 const source=wall(g,0,5,-.01,20,10,.02),destination=wall(g,20.1,5,0,.2,10,10),floor=wall(g,0,3.7,3,40,.2,40);
 g.floors.push({minX:-20,maxX:20,minZ:-17,maxZ:23,y:3.8,mesh:floor});
 for(const c of g.colliders)g.physics.addStaticBox(c.mesh.uuid,c.box);
 g.portals.place(0,V(0,5,.02),V(0,0,1));g.portals.place(1,V(19.98,5,0),V(-1,0,0));g.portalSurfaceIds=[source.uuid,destination.uuid];
 g.cargo={position:V(0,4.86,.45),velocity:V(),quaternion:new THREE.Quaternion(),group:new THREE.Group()};g.physics.createCargo({position:g.cargo.position});
 g.playerPosition.set(0,3.8,1.3);g.previousPlayerPosition.copy(g.playerPosition);g.playerGrounded=true;g.facing=Math.PI;
 g.animator.triggerInteraction=()=>{};g.companionAnimator={trigger(){}};g.audio.pickup=()=>{};g.firstLevel.cargoOnAnyPad=()=>false;g.firstLevel.getLaunch=()=>null;
 return g;
}
export function releaseStep(g){g.updatePlayer(H);g.updateCubes(H);}
export function releaseSnapshot(g){return {player:g.playerPosition.toArray(),cargo:g.cargo.position.toArray(),velocity:g.physics.cargoBody.velocity.toArray(),quaternion:g.physics.cargoBody.quaternion.toArray(),bodyId:g.physics.cargoBody.id,held:!!g.heldCube,playerTeleports:g.teleportCount,cargoTransports:g.physics.portalTransports};}
export function approachReleaseThroat(g,depth=.7){
 assert.ok(g.interact()&&g.heldCube,'Initial front-side pickup must succeed');
 let ticks=0;for(;ticks<1200;ticks++){
  const error=g.playerPosition.z-depth;
  if(Math.abs(error)<.008&&Math.abs(g.playerVelocity.z)<.05)break;
  g.move.set(0,THREE.MathUtils.clamp(-error*1.5,-1,1));releaseStep(g);
 }
 assert.ok(ticks<1200,'Ordinary movement must reach the requested throat depth');g.move.set(0,0);
 for(let i=0;i<30;i++)releaseStep(g);
 assert.equal(g.teleportCount,0,'The owner must remain before its actual portal crossing');assert.equal(g.physics.portalTransports,0);
 assert.ok(g.cargo.position.z<.02,'The actual grip must put the original box centre behind the aperture plane');
 return ticks+30;
}
export function runReleaseAttempt({depth=.7,clearDelayTicks=0,clearFirst=false,directClear=false}={}){
 const g=releaseFixture();try{
  const initial=releaseSnapshot(g),ticks=approachReleaseThroat(g,depth),before=releaseSnapshot(g),bodyId=g.physics.cargoBody.id;
  if(directClear){g.clearPortals();}else if(clearFirst){g.clearPortals();g.interact();}else{g.interact();}
  const afterRelease=releaseSnapshot(g);
  if(clearDelayTicks!==null&&!directClear&&!clearFirst){for(let i=0;i<clearDelayTicks;i++)releaseStep(g);g.clearPortals();}
  const afterClear=releaseSnapshot(g);let minimumZ=Infinity;
  for(let i=0;i<120;i++){releaseStep(g);minimumZ=Math.min(minimumZ,g.cargo.position.z);}
  return {depth,clearDelayTicks,clearFirst,directClear,initial,ticks,before,afterRelease,afterClear,minimumZ,after:releaseSnapshot(g),sameBody:g.physics.cargoBody.id===bodyId};
 }finally{g.physics.dispose();g.portals.dispose();}
}
