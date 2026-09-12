import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createHeadlessGame} from '../scripts/lab-headless.mjs';
import {Room19Flywheel} from '../src/game/LabRoom19Mechanics.js';
import {resolvePortalPlacement} from '../src/game/LabPortals.js';
import {tracePortalRay,rayTouches,V} from '../src/game/LabPuzzleMechanics.js';
const game=await createHeadlessGame();after(()=>{game.physics.dispose();game.portals.dispose();});
test('glass sends the same geometric optical ray across the chamber but stops air at its near pane',async()=>{
 await game.selectLevel(18,false);const origin=V(-7,2.3,-.3),direction=V(1,0,0),receiver=V(5.4,2.3,-.3);
 const light=tracePortalRay(game,origin,direction,{medium:'light'}),air=tracePortalRay(game,origin,direction,{medium:'air'});
 assert.ok(rayTouches(light,receiver));assert.equal(rayTouches(air,receiver),false);assert.ok(air[0].b.x<-3.9);
 assert.ok(game.firstLevel.puzzleGeometry.glass.every(m=>game.colliders.find(c=>c.mesh===m)?.opticallyTransparent));
});
test('flywheel keeps a thirty-second reasoning margin, spends energy under load, and cannot manufacture motion',()=>{
 const values=[];
 for(const hz of [30,60,144]){const w=new Room19Flywheel();for(let i=0;i<hz*35;i++)w.step(24,0,1/hz);const charged=w.energy;for(let i=0;i<hz*30;i++)w.step(0,0,1/hz);assert.ok(w.omega>19);const prior=w.energy;for(let i=0;i<hz*20;i++)w.step(0,4.2,1/hz);assert.ok(w.energy<prior&&w.work>1000);assert.ok(prior<charged);values.push([w.omega,w.angle,w.work]);}
 for(const v of values.slice(1))for(let i=0;i<3;i++)assert.ok(Math.abs(v[i]-values[0][i])<1e-6);
 const cold=new Room19Flywheel();cold.step(0,4.2,1000);assert.equal(cold.energy+cold.work+cold.angle,0);assert.throws(()=>cold.step(0,-1,1),RangeError);
});
test('ground and jump viewpoints cannot acquire the upper air duct, moving receiver, or sealed cargo floor',async()=>{
 await game.selectLevel(18,false);game.scene.updateMatrixWorld(true);let attempts=0;
 const free=(x,z)=>!game.colliders.some(c=>c.enabled!==false&&c.box.max.y>.4&&c.box.min.y<2.4&&x>c.box.min.x-.45&&x<c.box.max.x+.45&&z>c.box.min.z-.45&&z<c.box.max.z+.45);
 for(const name of ['open-air-duct','ferry-receiver','sealed-cradle']){
  const panel=game.firstLevel.panels[name],f=panel.getFrame();
  for(let x=-19;x<=19;x+=2)for(let z=-17;z<=17;z+=2){if(!free(x,z)||(Math.abs(x)<4.6&&Math.abs(z)<4.6))continue;
   for(const y of [1.6,3.4])for(const dx of [-1,0,1])for(const dy of [-.7,0,.7]){
    const origin=V(x,y,z),target=f.center.clone().addScaledVector(f.right,dx).addScaledVector(f.up,dy),ray=game.portalShots.ray;
    ray.set(origin,target.clone().sub(origin).normalize());ray.near=0;ray.far=Infinity;const hit=game.portalShots.firstHit();attempts++;
    if(hit?.object!==panel.mesh)continue;
    const normal=hit.face.normal.clone().applyMatrix3(new THREE.Matrix3().getNormalMatrix(hit.object.matrixWorld)).normalize();
    const accepted=normal.dot(f.normal)>.15&&ray.ray.direction.dot(f.normal)<-.02&&resolvePortalPlacement(panel.mesh,hit.point,{blockers:game.colliders}).ok;
    assert.equal(accepted,false,`Early ${name} from ${origin.toArray()} toward ${target.toArray()}`);
   }
  }
 }
 assert.ok(attempts>5000);
});
