import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createHeadlessGame} from '../scripts/lab-headless.mjs';
import {resolvePortalPlacement} from '../src/game/LabPortals.js';

const game=await createHeadlessGame(),V=(...values)=>new THREE.Vector3(...values);
after(()=>{game.physics.dispose();game.portals.dispose();});

function accepts(origin,target,panel){
 const ray=game.portalShots.ray;
 ray.set(origin,target.clone().sub(origin).normalize());ray.near=0;ray.far=Infinity;
 const hit=game.portalShots.firstHit();if(hit?.object!==panel.mesh)return false;
 const normal=hit.face.normal.clone().applyMatrix3(new THREE.Matrix3().getNormalMatrix(hit.object.matrixWorld)).normalize();
 return normal.dot(panel.getFrame().normal)>.15&&ray.ray.direction.dot(panel.getFrame().normal)<-.02
  &&resolvePortalPlacement(panel.mesh,hit.point,{blockers:game.colliders}).ok;
}
function clearFeet(point){
 return !game.colliders.some(c=>{
  if(c.enabled===false||(c.walkablePlane&&!c.solidUnderside))return false;
  const b=c.box;if(b.max.y<point.y+.32||b.min.y>point.y+2.4-.01)return false;
  const dx=point.x-THREE.MathUtils.clamp(point.x,b.min.x,b.max.x),dz=point.z-THREE.MathUtils.clamp(point.z,b.min.z,b.max.z);
  return dx*dx+dz*dz<.43*.43;
 });
}
function powerPair(level){
 for(const [index,name] of ['light-intake','light-output'].entries()){
  const frame=level.panels[name].getFrame();game.portals.place(index,frame.center,frame.normal,frame.up);
 }
}
function settle(level,seconds=2){for(let n=0;n<seconds*120;n++)level.update(1/120);}

test('room 20 freight floor destinations cannot be addressed before their respective ascents',async()=>{
 await game.selectLevel(19,false);game.scene.updateMatrixWorld(true);const level=game.firstLevel;
 let rays=0;const visited=new Set();
 for(const [name,maxHeight] of [['upper-pocket',.5],['final-pocket',16.1]]){
  const panel=level.panels[name],f=panel.getFrame(),bounds=panel.mesh.userData.portalBounds,targets=[];
  for(const x of [-1,0,1])for(const y of [-1,0,1])targets.push(f.center.clone()
   .addScaledVector(f.right,x*(bounds.halfWidth-1.2)).addScaledVector(f.up,y*(bounds.halfHeight-1.6)));
  for(const surface of level.world.surfaces){
   const center=surface.getFrame().center;
   if(surface.portal||surface.getFrame().normal.y<.99||center.y>maxHeight)continue;
   const steps=surface.width>30?9:5;
   for(let ix=0;ix<steps;ix++)for(let iz=0;iz<steps;iz++){
    const feet=center.clone().add(V((ix/(steps-1)*2-1)*(surface.width/2-.05),0,(iz/(steps-1)*2-1)*(surface.height/2-.05)));
    if(!clearFeet(feet))continue;visited.add(surface.name);
    for(const height of [1.4,3.3])for(const target of targets){
     rays++;const origin=feet.clone().add(V(0,height,0));
     assert.equal(accepts(origin,target,panel),false,`Early ${name} from ${surface.name}: ${origin.toArray()}`);
    }
   }
  }
 }
 assert.ok(rays>3000&&rays<15000,`Bounded actual floor-view grid expected: ${rays}`);
 assert.ok(visited.has('Shared lower exchange court')&&visited.has('Second observation ledge'));
 assert.ok(accepts(V(-21,9.4,4),level.panels['upper-pocket'].getFrame().center,level.panels['upper-pocket']),'First balcony must have a usable freight aperture');
 assert.ok(accepts(V(-15.2,23.4,-18),level.panels['final-pocket'].getFrame().center,level.panels['final-pocket']),'Final platform must reveal its usable freight aperture');
});

test('room 20 physical weight and an opaque obstruction control the actual optical motors',async()=>{
 await game.selectLevel(19,false);const level=game.firstLevel,s=level.state;
 const originalCargo=game.cargo,originalBody=game.physics.cargoBody;
 // Isolated contact/ray fixture, not a positive route: the original cargo is
 // placed on the real plate, then the actual beam is physically obstructed.
 game.cargo.position.copy(level.panels['mirror-cradle'].getFrame().center).add(V(0,.39,0));
 game.cargo.velocity.set(0,0,0);game.cargo.quaternion.identity();game.heldCube=null;
 powerPair(level);settle(level);
 assert.ok(s.optical.loaded&&s.optical.receivers[1]);
 assert.ok(s['first-cage'].powered&&s['return-cage'].powered&&!s['second-cage'].powered);
 assert.equal(s.funnel.enabled,false,'The live loaded branch must divert the upper air supply');
 const blocker=level.world.box([-9,2,0],[.3,1,1],level.world.materials.wall);
 const collider=game.colliders.find(c=>c.mesh===blocker);settle(level,.15);
 assert.deepEqual(s.optical.receivers,[false,false]);
 for(const name of ['first-cage','second-cage','return-cage'])assert.equal(s[name].powered,false,'Blocked light cannot preserve an invisible progress latch');
 assert.equal(s.funnel.enabled,true);
 collider.enabled=false;settle(level,.15);assert.ok(s.optical.receivers[1],'Removing the obstruction must restore the same real branch');
 game.cargo.position.set(-18,8.42,6);settle(level);
 assert.ok(!s.optical.loaded&&s.optical.receivers[0]&&!s.optical.receivers[1]);
 assert.ok(s['second-cage'].powered&&!s['first-cage'].powered&&!s['return-cage'].powered);
 assert.equal(game.cargo,originalCargo);assert.equal(game.physics.cargoBody,originalBody);
 assert.equal(level.isWon(),false);
});

test('room 20 final suspension cannot lift a player out of an earlier floor or middle-stage jump',async()=>{
 await game.selectLevel(19,false);const level=game.firstLevel,field=level.state.funnel;
 assert.equal(field.enabled,true);
 let samples=0;
 for(const surface of level.world.surfaces){
  const center=surface.getFrame().center;if(surface.getFrame().normal.y<.99||center.y>16.1)continue;
  for(const x of [-1,0,1])for(const z of [-1,0,1]){
   const feet=center.clone().add(V(x*(surface.width/2-.05),0,z*(surface.height/2-.05)));
   for(const jump of [0,1.8]){
    samples++;const acceleration=level.playerAcceleration(feet.clone().add(V(0,jump,0)),V());
    assert.equal(acceleration.lengthSq(),0,`Early funnel force above ${surface.name}: ${feet.toArray()}`);
   }
  }
 }
 assert.ok(samples>100);
 assert.ok(level.playerAcceleration(V(-8,22.7,-18),V()).lengthSq()>1,'The reachable final air lane must still exert real force');
 assert.equal(game.floorHeight(-8,0,22),0,'An offset bay must require leaving the field, not provide a hidden floor under its axis');
});
