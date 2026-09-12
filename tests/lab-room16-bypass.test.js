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
 const front=panel.getFrame().normal;
 return normal.dot(front)>.15&&ray.ray.direction.dot(front)<-.02
  &&resolvePortalPlacement(panel.mesh,hit.point,{blockers:game.colliders}).ok;
}

function freeStandingPoint(x,y,z){
 return !game.colliders.some(c=>{
  if(c.enabled===false||(c.walkablePlane&&!c.solidUnderside))return false;
  const b=c.box;if(b.max.y<y+.32||b.min.y>y+2.4-.01)return false;
  const dx=x-THREE.MathUtils.clamp(x,b.min.x,b.max.x),dz=z-THREE.MathUtils.clamp(z,b.min.z,b.max.z);
  return dx*dx+dz*dz<.43*.43;
 });
}

function usableTargets(panel){
 const f=panel.getFrame(),bounds=panel.mesh.userData.portalBounds,result=[];
 for(const x of [-1,0,1])for(const y of [-1,0,1])result.push(f.center.clone()
  .addScaledVector(f.right,x*(bounds.halfWidth-1.2)).addScaledVector(f.up,y*(bounds.halfHeight-1.6)));
 return result;
}

test('room 16 lower courts, island and first light bridge cannot address later destinations early',async()=>{
 await game.selectLevel(15,false);game.scene.updateMatrixWorld(true);
 const level=game.firstLevel,names=['counterweight','upper-rest','last-address'];
 const targets=Object.fromEntries(names.map(name=>[name,usableTargets(level.panels[name])]));
 let rays=0;const floors=new Set();
 const check=(feet,label)=>{
  for(const height of [1.4,3.3])for(const name of names)for(const target of targets[name]){
   rays++;const origin=feet.clone().add(V(0,height,0));
   assert.equal(accepts(origin,target,level.panels[name]),false,
    `Early ${name} from ${label}: ${origin.toArray()} toward ${target.toArray()}`);
  }
 };
 // Derive the grid from current floor faces, including points only 2 cm from
 // their edges. The two eye heights cover ordinary standing and full jumps.
 for(const surface of level.world.surfaces){
  if(surface.portal||surface.getFrame().normal.y<.99||surface.name==='Counterweight basin')continue;
  const center=surface.getFrame().center;if(center.y>7.5)continue;
  for(const x of [-1,0,1])for(const z of [-1,0,1]){
   const feet=center.clone().add(V(x*(surface.width/2-.02),0,z*(surface.height/2-.02)));
   if(!freeStandingPoint(feet.x,feet.y,feet.z))continue;
   floors.add(surface.name);check(feet,surface.name);
  }
 }
 // Explicit adversarial poses on the first powered bridge are essential:
 // a short receiver hood blocked balcony shots but missed these higher ones.
 // Build its real opaque sheet too: a virtual support would incorrectly let
 // downward shots pass through the floor on which the fixture is standing.
 for(const [index,name] of ['source','first-address'].entries()){
  const f=level.panels[name].getFrame();game.portals.place(index,f.center,f.normal,f.up);
 }
 level.state.lightBridge.update();game.scene.updateMatrixWorld(true);
 for(const x of [-20,-14,-8,-2,3.9])for(const z of [-1.2,0,1.2])check(V(x,7.4,z),'first light bridge');
 for(const name of ['Southern return court','First light balcony','Dry crossing island','Descending island return'])assert.ok(floors.has(name));
 assert.ok(rays>=10000&&rays<=30000,`Keep a useful bounded viewpoint grid: ${rays}`);
});

test('room 16 blocks the discovered corner shots while retaining the actual upper service sights',async()=>{
 await game.selectLevel(15,false);game.scene.updateMatrixWorld(true);const p=game.firstLevel.panels;
 for(const [name,origin,target] of [
  ['last-address',[-21.5,1.4,12.5],[21.4,15.7,-11.6]],
  ['last-address',[-18.5,7.4,-2.5],[21.4,15,-11.6]],
  ['last-address',[-20,10.7,-1.2],[21.4,16.4,-11.6]],
  ['counterweight',[4.5,10.7,-2.5],[-1.1,p.counterweight.getFrame().center.y,.7]],
 ])assert.equal(accepts(V(...origin),V(...target),p[name]),false,`Previously open ${name} corner`);
 assert.ok(accepts(V(0,14.8,4.25),p.counterweight.getFrame().center,p.counterweight),'Upper gallery must see the enlarged usable plate');
 assert.ok(accepts(V(-15,14.8,5.8),V(21.4,16.3,-10),p['last-address']),'High slit must expose a usable final portal center');
 assert.ok(accepts(V(-15,14.8,5.8),p.source.getFrame().center,p.source),'Upper return must retain the front side of the source');
});

test('room 16 final light crosses the split source housing and the receiver sill leaves a real gap',async()=>{
 await game.selectLevel(15,false);const level=game.firstLevel;
 for(const x of [-10,-5,0])assert.ok((game.floorHeight(x,-10,16)??-Infinity)<3,'Receiver architecture must not bridge the remaining gap');
 // Geometric routing fixture, not a positive playthrough: placing the pair
 // directly isolates the formerly full-height source backing obstruction.
 for(const [index,name] of ['source','last-address'].entries()){
  const f=level.panels[name].getFrame();game.portals.place(index,f.center,f.normal,f.up);
 }
 level.state.lightBridge.update();
 const crossing=level.state.lightBridge.segments.find(s=>s.direction.x<-.9&&s.a.y>14);
 assert.ok(crossing,'Source must produce the upper westbound sheet');
 assert.ok(crossing.b.x<-12,'The old source wall must not stop light before the receiving bank');
 assert.ok(Math.abs(crossing.a.y-14.8)<.05);
});
