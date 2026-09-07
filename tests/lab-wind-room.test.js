import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createHeadlessGame} from '../scripts/lab-headless.mjs';
import {CAMPAIGN} from '../src/game/LabCampaignLevels.js';
import {receivesFrontAir} from '../src/game/LabWindRoom.js';
import {runV8Journey} from '../src/game/LabV8Journey.js';
import {resolvePortalPlacement} from '../src/game/LabPortals.js';
const V=(...p)=>new THREE.Vector3(...p),g=await createHeadlessGame();
await g.selectLevel(10,false);
test('single-room cleanup adds no campaign entries or new asset dependency',()=>{
 assert.equal(CAMPAIGN.length,20);assert.equal(g.firstLevel.id,'stored-wind');
 assert.deepEqual(g.firstLevel.fixtures.map(f=>f.id).sort(),[31,35]);
 assert.ok(!CAMPAIGN[10].assets.includes(39),'Unrelated cable reel is removed from this room only');
 assert.ok(CAMPAIGN[12].assets.includes(39),'Other rooms retain their winch');
});
test('both existing machines sit on the floor and face the real airflow',()=>{
 const l=g.firstLevel,s=l.state;
 for(const f of l.fixtures){const b=new THREE.Box3().setFromObject(f.art);assert.ok(Math.abs(b.min.y)<1e-5);}
 const front=V(0,0,1).applyQuaternion(s.blower.art.art.quaternion);
 assert.ok(front.dot(s.blower.direction)>.999);
 assert.ok(s.blower.origin.x>new THREE.Box3().setFromObject(s.blower.art.art).max.x);
 assert.ok(V(0,0,1).applyQuaternion(s.flywheel.art.art.quaternion).dot(s.flywheel.normal)>.999);
 assert.ok(Math.abs(s.flywheel.art.pivot.getWorldPosition(V()).y-s.blower.origin.y)<.01);
});
test('front impeller articulation preserves every triangle, source cache and fixed casing',()=>{
 const f=g.firstLevel.state.flywheel.art,base=g.assets.get(31),signature=[];
 base.traverse(o=>signature.push(...o.position.toArray(),...o.quaternion.toArray(),...o.scale.toArray()));
 let total=0;f.art.traverse(o=>{if(o.isMesh)total+=o.geometry.index.count/3;});
 assert.equal(total,f.art.userData.partition.sourceTriangles);assert.ok(f.art.userData.partition.movingTriangles>400);
 f.art.updateWorldMatrix(true,true);const fixed=f.fixed.matrixWorld.clone();f.spin(1.2);f.art.updateWorldMatrix(true,true);
 assert.ok(f.fixed.matrixWorld.equals(fixed));const after=[];base.traverse(o=>after.push(...o.position.toArray(),...o.quaternion.toArray(),...o.scale.toArray()));assert.deepEqual(after,signature);f.spin(0);
});
test('portal walls are flush, nonoverlapping, broad and do not extend behind the locked exit',()=>{
 const l=g.firstLevel;
 for(const p of Object.values(l.panels)){
  const f=p.getFrame();assert.ok(Math.abs(Math.abs(f.center.x)-14)<.03||Math.abs(f.center.z-15)<.03);
  assert.ok(f.center.z-p.width/2> -12||Math.abs(f.normal.z)>.9);
  const shot=resolvePortalPlacement(p.mesh,f.center,{blockers:g.colliders});assert.ok(shot.ok,`${p.name}: ${shot.reason}`);
 }
 const left=Object.values(l.panels).filter(p=>p.getFrame().normal.x>.9).map(p=>[p.getFrame().center.z-p.width/2,p.getFrame().center.z+p.width/2]);
 assert.ok(left[0][0]>left[1][1]||left[1][0]>left[0][1]);
 assert.equal(l.world.surfaces.filter(p=>p.portal&&p.width>=5.5).length,4);
});
test('door is visible from entry without an opaque central billboard',()=>{
 const target=V(0,1.8,-12),origin=V(2,1.8,11),direction=target.clone().sub(origin).normalize();
 const ray=new THREE.Ray(origin,direction),hits=g.colliders.map(c=>ray.intersectBox(c.box,V())).filter(Boolean);
 const nearest=hits.reduce((n,p)=>Math.min(n,p.distanceTo(origin)),Infinity);
 assert.ok(nearest>target.distanceTo(origin)-.7,`Entry sightline blocked at ${nearest}`);
});
test('air on the back, side or behind an obstacle cannot power the receiver',()=>{
 const inlet=V(0,2,0),normal=V(0,0,1),seg=(a,d,length)=>({a:V(...a),direction:V(...d),length});
 assert.ok(receivesFrontAir([seg([0,2,4],[0,0,-1],4)],inlet,normal,1));
 assert.ok(!receivesFrontAir([seg([0,2,-4],[0,0,1],8)],inlet,normal,1));
 assert.ok(!receivesFrontAir([seg([4,2,0],[-1,0,0],8)],inlet,normal,1));
 assert.ok(!receivesFrontAir([seg([0,2,4],[0,0,-1],2)],inlet,normal,1));
});
test('controls alone cannot open the door, power and accumulated work are reset',()=>{
 g.resetRun(true);const l=g.firstLevel,s=l.state;s.clutchControl.action();s['fan-switchControl'].action();
 for(let n=0;n<1200;n++)l.update(1/120);
 assert.equal(s.flywheel.wheel.work,0);assert.equal(s.ratchet.engaged,false);assert.equal(s.door.open,false);
 s.flywheel.wheel.work=71;l.update(1/120);assert.equal(s.door.open,true);
 g.resetRun(true);assert.equal(s.ratchet.engaged,false);assert.equal(s.flywheel.wheel.work,0);assert.equal(s.blower.enabled,false);assert.equal(s.door.open,false);
});
test('blower louvres and casing do not spin, while visible dust obeys on/off',()=>{
 g.resetRun(true);const l=g.firstLevel,f=l.state.blower;
 f.art.art.updateWorldMatrix(true,true);const rotation=f.art.pivot.quaternion.clone();
 f.enabled=true;for(let n=0;n<120;n++){l.update(1/120);l.renderUpdate(1);}
 assert.ok(f.art.pivot.quaternion.equals(rotation));assert.ok(l.readability.dust.visible);
 f.enabled=false;l.update(1/120);l.renderUpdate(1);assert.equal(f.segments.length,0);assert.equal(l.readability.dust.visible,false);
});
test('repositioned existing puzzle is completed with normal input and the same friend',async()=>{
 const r=await runV8Journey(g);assert.ok(r.pass);assert.equal(r.respawns,0);assert.equal(r.resets,0);
 g.physics.dispose();g.portals.dispose();
});
