/** Dense CPU observer of the production Room 17 landing/restore frames.
 * Ordinary journey only. No body/velocity, collider, clock or win assignments.
 * Projections use the animated original player GLB vertices, not a box actor.
 * Blocker rays model LabCamera semantics; they are not rendered-pixel proof.
 */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import * as THREE from 'three';
import {createHeadlessGame} from '../lab-headless.mjs';
import {runV8Journey} from '../../src/game/LabV8Journey.js';

const names=['FootL','FootR','Body','Head'];
const V=()=>new THREE.Vector3();
const rounded=x=>Math.round(x*1e6)/1e6;

export async function observeRoom17CameraRestore({route='upper-branch',swapColours=false,width=854,height=480,windowFrames=180,traceCollisions=true}={}){
 const g=await createHeadlessGame();g.chamberEdition='foundation';
 await g.selectLevel(16,false);g.camera.aspect=width/height;g.camera.updateProjectionMatrix();
 const cargo=g.cargo,body=g.physics.cargoBody,rig=g.cameraRig;
 const row={route,swapColours,width,height,restoreWindowFrames:windowFrames,frames:0,originalEveryFrame:true,landingFrame:null,samples:[],milestones:[],actions:[],portalImpacts:[],error:null};
 const physicalHash=createHash('sha256'),ray=new THREE.Raycaster();
 // isCameraBlocker reads its rig's ray direction for portal-back filtering.
 // A separate context supplies THIS diagnostic ray without changing the rig.
 const blockerContext=Object.create(g);blockerContext.cameraRig=Object.create(rig);blockerContext.cameraRig.raycaster=ray;blockerContext.cameraRig.clipDirection=V();
 const mesh=g.animator.rig.mesh,skin=mesh.geometry.getAttribute('skinIndex'),weights=mesh.geometry.getAttribute('skinWeight');
 const vertices=Object.fromEntries(names.map(n=>[n,[]]));
 for(let i=0;i<skin.count;i++){
  let selected=0;for(let k=1;k<4;k++)if(weights.getComponent(i,k)>weights.getComponent(i,selected))selected=k;
  const bone=mesh.skeleton.bones[skin.getComponent(i,selected)].name.replace(/^Lab/,'');
  const part=bone==='Chest'?'Body':bone;if(vertices[part])vertices[part].push(i);
 }
 for(const name of names)assert.ok(vertices[name].length>0,`Original GLB needs actual ${name} skin vertices`);
 row.originalSkinnedRegions=Object.fromEntries(names.map(n=>[n,vertices[n].length]));
 let currentCollision=null,collisionFrame=null;
 const intersect=rig.raycaster.intersectObjects,constrain=rig.constrain;
 rig.raycaster.intersectObjects=function(...args){
  const hits=intersect.apply(this,args);
  if(currentCollision){
   const hit=hits.find(h=>!rig.clipsPortalHit(h.point)&&rig.isBlocker(h.object,h));
   if(hit&&!currentCollision.firstBlocker){
    const box=g.colliderForMesh(hit.object)?.box??new THREE.Box3().setFromObject(hit.object);
    currentCollision.firstBlocker={name:hit.object.name,type:hit.object.type,collisionProxy:!!hit.object.userData.collisionProxy,point:hit.point.toArray(),distance:hit.distance,bounds:{min:box.min.toArray(),max:box.max.toArray()}};
   }
  }
  return hits;
 };
 rig.constrain=function(origin,position){
  const observe=traceCollisions&&row.landingFrame!==null&&row.frames+1<=row.landingFrame+windowFrames;
  const item=observe?{kind:position===this.desired?'desired':position===this.camera.position?'final-camera':'escape-candidate',origin:origin===this.playerPivot?'player-pivot':'focus',requestedDistance:origin.distanceTo(position)}:null;
  currentCollision=item;
  const result=constrain.call(this,origin,position);currentCollision=null;
  if(item&&result){item.safeDistance=origin.distanceTo(position);collisionFrame??=[];if(collisionFrame.length<24)collisionFrame.push(item);}
  return result;
 };
 function probe(point){
  const p=point.clone().project(g.camera),delta=point.clone().sub(g.camera.position),distance=delta.length();
  ray.set(g.camera.position,delta.normalize());ray.near=0;ray.far=Math.max(0,distance-.06);
  const hit=ray.intersectObjects(g.cameraBlockers,true).find(h=>!rig.clipsPortalHit(h.point)&&g.isCameraBlocker.call(blockerContext,h.object,h));
  return {point:point.toArray(),ndc:p.toArray(),inFrustum:Math.abs(p.x)<1&&Math.abs(p.y)<1&&p.z> -1&&p.z<1,clearCameraBlockerLine:!hit,firstBlocker:hit?{name:hit.object.name,type:hit.object.type,collisionProxy:!!hit.object.userData.collisionProxy,point:hit.point.toArray(),distance:hit.distance}:null};
 }
 function snapshot(){
  g.scene.updateMatrixWorld(true);mesh.skeleton.update();
  const parts={};
  for(const name of names){
   const min=V().set(Infinity,Infinity,Infinity),max=V().set(-Infinity,-Infinity,-Infinity),point=V();let outsideVertices=0;
   for(const index of vertices[name]){
    mesh.getVertexPosition(index,point);point.applyMatrix4(mesh.matrixWorld).project(g.camera);min.min(point);max.max(point);
    if(Math.abs(point.x)>=1||Math.abs(point.y)>=1||point.z<=-1||point.z>=1)outsideVertices++;
   }
   parts[name]={joint:probe(g.animator.bones[name].getWorldPosition(V())),skinNdcMin:min.toArray(),skinNdcMax:max.toArray(),outsideSkinVertices:outsideVertices,skinInFrustum:outsideVertices===0};
  }
  return {frame:row.frames,afterLanding:row.landingFrame===null?null:row.frames-row.landingFrame,player:g.playerPosition.toArray(),playerVelocity:g.playerVelocity.toArray(),cargo:g.cargo.position.toArray(),inputView:{yaw:g.yaw,pitch:g.pitch},camera:{position:g.camera.position.toArray(),fov:g.camera.fov,yaw:rig.yaw,pitch:rig.pitch,distance:rig.distance,distanceToPivot:g.camera.position.distanceTo(rig.playerPivot),focus:rig.focus.toArray(),desired:rig.desired.toArray(),obstructed:rig.obstructed,avoidanceActive:rig.avoidanceActive,avoidance:rig.avoidance.toArray(),rampFraming:rig.rampFraming},parts,collisionHits:collisionFrame??[]};
 }
 const originalUpdate=g.updateVisuals,fire=g.firePortal,interact=g.interact;
 g.firePortal=function(index){const result=fire.call(this,index);row.actions.push({frame:row.frames,type:'portal-shot',colour:index,accepted:result});return result;};
 g.interact=function(...args){const result=interact.apply(this,args);row.actions.push({frame:row.frames,type:'E',accepted:!!result,holding:!!g.heldCube});return result;};
 let preceding=[],lastImpact=null;
 g.updateVisuals=function(...args){
  collisionFrame=null;const result=originalUpdate.apply(this,args);if(!(args[0]>0))return result;
  row.frames++;assert.ok(row.frames<=12000,'Finite camera audit frame budget');row.originalEveryFrame&&=g.cargo===cargo&&g.physics.cargoBody===body;
  const impact=g.portalShots.lastImpact;
  if(impact&&impact!==lastImpact){lastImpact=impact;row.portalImpacts.push({frame:row.frames,...impact});}
  const values=[...g.playerPosition.toArray(),...g.playerVelocity.toArray(),...g.cargo.position.toArray(),...g.cargo.velocity.toArray(),...g.cargo.quaternion.toArray(),g.firstLevel.beam.angle,g.firstLevel.beam.omega,g.firstLevel.beam.tension,g.physics.portalTransports];
  physicalHash.update(JSON.stringify(values.map(rounded))+'\n');
  if(row.landingFrame!==null&&row.frames<=row.landingFrame+windowFrames)row.samples.push(snapshot());
  else if(row.landingFrame===null&&g.playerPosition.x>9&&Math.abs(g.playerPosition.z)<1){preceding.push(snapshot());if(preceding.length>24)preceding.shift();}
  return result;
 };
 try{
  row.journey=await runV8Journey(g,{journeyOptions:{route,swapColours},onMilestone:({name})=>{
   if(name.startsWith('observer leaves the live')){row.landingFrame=row.frames;row.samples.push(...preceding,snapshot());preceding=[];}
   row.milestones.push({name,frame:row.frames,player:g.playerPosition.toArray(),cargo:g.cargo.position.toArray(),beamAngle:g.firstLevel.beam.angle,beamTension:g.firstLevel.beam.tension,inputView:{yaw:g.yaw,pitch:g.pitch},camera:{position:g.camera.position.toArray(),distance:rig.distance,obstructed:rig.obstructed}});
  }});
  row.won=g.state==='won'&&g.firstLevel.isWon();
 }catch(error){row.error=error.stack;row.won=false;}
 finally{
  row.physicalSequenceQuantized1e6Sha256=physicalHash.digest('hex');
  row.final={state:g.state,sameOriginalCargo:g.cargo===cargo,sameOriginalBody:g.physics.cargoBody===body,cargoTransports:g.physics.portalTransports};
  const restore=row.samples.filter(s=>s.afterLanding!==null&&s.afterLanding>=0);
  row.summary={denseRestoreFrames:restore.length,parts:Object.fromEntries(names.map(name=>[name,{jointOutside:restore.filter(s=>!s.parts[name].joint.inFrustum).length,skinOutside:restore.filter(s=>!s.parts[name].skinInFrustum).length,blockedJoint:restore.filter(s=>!s.parts[name].joint.clearCameraBlockerLine).length,firstSkinOutside:restore.find(s=>!s.parts[name].skinInFrustum)?.afterLanding??null,lastSkinOutside:restore.findLast(s=>!s.parts[name].skinInFrustum)?.afterLanding??null}])),minimumCameraDistanceToPivot:Math.min(...restore.map(s=>s.camera.distanceToPivot)),maximumCameraDistanceStep:Math.max(0,...restore.slice(1).map((s,i)=>Math.abs(s.camera.distanceToPivot-restore[i].camera.distanceToPivot))),minimumPitch:Math.min(...restore.map(s=>s.inputView.pitch)),maximumPitch:Math.max(...restore.map(s=>s.inputView.pitch)),cameraCollisionFrames:restore.filter(s=>s.collisionHits.length>0).length};
  g.updateVisuals=originalUpdate;g.firePortal=fire;g.interact=interact;rig.constrain=constrain;rig.raycaster.intersectObjects=intersect;
  g.firstLevel.dispose?.();g.physics.dispose();g.portals.dispose();
 }
 return row;
}

export function assertRoom17RestoreVisible(row){
 assert.equal(row.error,null);assert.equal(row.won,true);assert.equal(row.originalEveryFrame,true);assert.equal(row.final.sameOriginalBody,true);assert.equal(row.final.sameOriginalCargo,true);assert.equal(row.final.cargoTransports,2);
 assert.equal(row.journey.resets+row.journey.respawns,0);assert.equal(row.frames,row.journey.frames);assert.equal(row.summary.denseRestoreFrames,row.restoreWindowFrames+1);
 for(const name of names){assert.equal(row.summary.parts[name].skinOutside,0,`${name} animated original GLB leaves restore frustum: ${JSON.stringify(row.summary.parts[name])}`);assert.equal(row.summary.parts[name].blockedJoint,0,`${name} joint blocked during restore`);}
}
