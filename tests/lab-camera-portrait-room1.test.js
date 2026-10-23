import test from 'node:test';
import assert from 'node:assert/strict';
import {createHeadlessGame} from '../scripts/lab-headless.mjs';

for(const aiming of [false,true])test(`actual first-room portrait start retains the hero and a clear centre ray, aiming=${aiming}`,async()=>{
 const g=await createHeadlessGame();g.chamberEdition='foundation';g.camera.aspect=390/844;g.camera.updateProjectionMatrix();await g.selectLevel(0,true);
 try{
  const r=g.cameraRig,p=g.playerPosition.clone(),before=p.toArray();
  for(let frame=0;frame<60;frame++){
   r.update({dt:1/60,target:p,yaw:g.yaw,pitch:g.pitch,aiming});
   assert.equal(r.ordinaryPortraitAimClear(g.camera.position),true,'The centre ray intersects the retained hero envelope');
   assert.ok(r.silhouetteFovAt(g.camera.position)<=g.camera.fov+.00001,'The actual wall-limited view clips the hero envelope');
   assert.ok(g.camera.fov<=110,'Ordinary portrait recovery exceeded its lens budget');
   const safe=g.camera.position.clone();r.constrain(r.playerPivot,safe);
   assert.ok(safe.distanceTo(g.camera.position)<1e-7,'The final lens crosses production camera geometry');
  }
  assert.deepEqual(g.playerPosition.toArray(),before);
 }finally{g.firstLevel.dispose();g.physics.dispose();g.portals.dispose();}
});
