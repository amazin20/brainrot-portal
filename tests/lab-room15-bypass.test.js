import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createHeadlessGame} from '../scripts/lab-headless.mjs';
import {resolvePortalPlacement} from '../src/game/LabPortals.js';

const V=(...a)=>new THREE.Vector3(...a),game=await createHeadlessGame();
after(()=>{game.physics.dispose();game.portals.dispose();});

function accepts(origin,target,panel){
 const ray=game.portalShots.ray;ray.set(origin,target.clone().sub(origin).normalize());ray.near=0;ray.far=Infinity;
 const hit=game.portalShots.firstHit();if(hit?.object!==panel.mesh)return false;
 const normal=hit.face.normal.clone().applyMatrix3(new THREE.Matrix3().getNormalMatrix(hit.object.matrixWorld)).normalize(),front=panel.getFrame().normal;
 return normal.dot(front)>.15&&ray.ray.direction.dot(front)<-.02&&resolvePortalPlacement(panel.mesh,hit.point,{blockers:game.colliders}).ok;
}

test('ground-floor standing viewpoints cannot place an early portal in the elevated crossing pocket',async()=>{
 await game.selectLevel(14,false);game.scene.updateMatrixWorld(true);
 const level=game.firstLevel,panel=level.panels.crossing,frame=panel.getFrame(),bounds=panel.mesh.userData.portalBounds;
 const orientation=panel.mesh.getWorldQuaternion(new THREE.Quaternion()),right=V(1,0,0).applyQuaternion(orientation),up=V(0,1,0).applyQuaternion(orientation),targets=[];
 // Sample usable portal centres, including all four extremal corners, rather
 // than demanding a sightline to decorative edges that cannot hold a portal.
 for(const x of [-1,0,1])for(const y of [-1,0,1])targets.push(frame.center.clone()
  .addScaledVector(right,x*(bounds.halfWidth-1.20)).addScaledVector(up,y*(bounds.halfHeight-1.60)));
 const free=(x,y,z)=>!game.colliders.some(c=>{
  if(c.enabled===false||(c.walkablePlane&&!c.solidUnderside))return false;const b=c.box;
  if(b.max.y<y+.32||b.min.y>y+2.4-.01)return false;
  const dx=x-THREE.MathUtils.clamp(x,b.min.x,b.max.x),dz=z-THREE.MathUtils.clamp(z,b.min.z,b.max.z);
  return dx*dx+dz*dz<.43*.43;
 });
 let rays=0,accepted=0;const examples=[];
 for(const surface of level.world.surfaces){
  if(surface.portal||surface.normal.y<.99)continue;const c=surface.getFrame().center;if(c.y>2.05)continue;
  for(let x=c.x-surface.width/2+.5;x<=c.x+surface.width/2-.5;x+=1.5)for(let z=c.z-surface.height/2+.5;z<=c.z+surface.height/2-.5;z+=1.5){
   if(!free(x,c.y,z))continue;
   for(const height of [1.4,2.05])for(const target of targets){
    const origin=V(x,c.y+height,z);rays++;
    if(accepts(origin,target,panel)){accepted++;if(examples.length<4)examples.push({floor:surface.name,feet:[x,c.y,z],origin:origin.toArray(),target:target.toArray()});}
   }
  }
 }
 assert.ok(rays>8000,`Insufficient floor-derived viewpoints: ${rays}`);
 assert.equal(accepted,0,`Early crossing portal: ${JSON.stringify(examples)}`);
 assert.ok(accepts(V(-15,19.4,-7.8),frame.center,panel),'The elevated discovery angle must remain open');
});

test('the low cargo throat blocks a standing or jumping player capsule',async()=>{
 await game.selectLevel(14,false);
 for(const jump of [false,true]){
  game.resetRun(true);game.playerPosition.set(-16,2,-8.7);game.previousPlayerPosition.copy(game.playerPosition);game.playerGrounded=true;game.yaw=0;
  // This deliberately posed negative fixture begins inside the freight pocket;
  // it is not evidence that the pocket is reachable before solving the puzzle.
  game.input.getMove=()=>new THREE.Vector2(0,-1);game.input.keys.add('ShiftLeft');
  for(let step=0;step<360;step++){
   if(jump&&step%45===0)game.input.jumpQueued=true;
   game.updatePlayer(1/120);
   assert.ok(game.playerPosition.z> -9.5,`A capsule slipped through the freight throat: ${game.playerPosition.toArray()}`);
  }
 }
});
