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
 assert.equal(CAMPAIGN.length,12);assert.equal(g.firstLevel.id,'stored-wind');
 assert.deepEqual(g.firstLevel.fixtures.map(f=>f.id).sort(),[31,35]);
 assert.ok(!CAMPAIGN[10].assets.includes(39),'Unrelated cable reel is removed from this room only');
 assert.ok(!CAMPAIGN.some(room=>room.assets.includes(39)),'Retired winch rooms are not loaded into the active campaign');
});
test('both existing machines sit on the floor and face the real airflow',()=>{
 const l=g.firstLevel,s=l.state;
 for(const f of l.fixtures){const b=new THREE.Box3().setFromObject(f.art);assert.ok(Math.abs(b.min.y)<1e-5);}
 const front=V(0,0,1).applyQuaternion(s.blower.art.art.quaternion);
 assert.ok(front.dot(s.blower.direction)>.999);
 assert.ok(s.blower.origin.x>new THREE.Box3().setFromObject(s.blower.art.art).max.x);
 assert.ok(V(0,0,1).applyQuaternion(s.flywheel.art.art.quaternion).dot(s.flywheel.normal)>.999);
 assert.ok(Math.abs(s.blower.art.pivot.getWorldPosition(V()).y-s.blower.origin.y)<.01);
});
test('front impeller articulation preserves every triangle, source cache and fixed casing',()=>{
 const f=g.firstLevel.state.blower.art,base=g.assets.get(31),signature=[];
 base.traverse(o=>signature.push(...o.position.toArray(),...o.quaternion.toArray(),...o.scale.toArray()));
 let total=0;f.art.traverse(o=>{if(o.isMesh)total+=o.geometry.index.count/3;});
 assert.equal(total,f.art.userData.partition.sourceTriangles);assert.ok(f.art.userData.partition.movingTriangles>400);
 f.art.updateWorldMatrix(true,true);const fixed=f.fixed.matrixWorld.clone();f.spin(1.2);f.art.updateWorldMatrix(true,true);
 assert.ok(f.fixed.matrixWorld.equals(fixed));const after=[];base.traverse(o=>after.push(...o.position.toArray(),...o.quaternion.toArray(),...o.scale.toArray()));assert.deepEqual(after,signature);f.spin(0);
});
test('painted front intake rim stays out of the moving impeller',()=>{
 const rotor=g.firstLevel.state.blower.art.pivot;
 rotor.traverse(o=>{if(!o.isMesh)return;const p=o.geometry.attributes.position,c=o.geometry.attributes.color,idx=o.geometry.index;
  for(let i=0;i<idx.count;i+=3){let x=0,y=0,paint=0;for(let j=0;j<3;j++){const id=idx.getX(i+j);x+=p.getX(id)/3;y+=p.getY(id)/3;paint+=(.2126*c.getX(id)+.7152*c.getY(id)+.0722*c.getZ(id))/3;}
   assert.ok(Math.hypot(x,y)<.14+1e-6||paint<.18,'White housing was included in moving geometry');
  }
 });
});
test('portal walls are flush, nonoverlapping, broad and do not extend behind the locked exit',()=>{
 const l=g.firstLevel;
 for(const p of Object.values(l.panels)){
  const f=p.getFrame();assert.ok(Math.abs(Math.abs(f.center.x)-14)<.03||Math.abs(f.center.z-15)<.03);
  assert.ok(f.center.z-p.width/2> -12||Math.abs(f.normal.z)>.9);
  const shot=resolvePortalPlacement(p.mesh,f.center,{blockers:g.colliders});assert.ok(shot.ok,`${p.name}: ${shot.reason}`);
 }
 const sides=Object.values(l.panels).filter(p=>Math.abs(p.getFrame().normal.x)>.9);
 for(let i=0;i<sides.length;i++)for(let j=i+1;j<sides.length;j++){const a=sides[i],b=sides[j],af=a.getFrame(),bf=b.getFrame();if(Math.abs(af.center.x-bf.center.x)>.1)continue;assert.ok(af.center.z+a.width/2<bf.center.z-b.width/2||bf.center.z+b.width/2<af.center.z-a.width/2);}
 assert.equal(l.world.surfaces.filter(p=>p.portal&&p.width>=5.5).length,4);
});
test('door is visible from entry without an opaque central billboard',()=>{
 const target=V(0,1.8,-12),origin=V(-1,1.8,8),direction=target.clone().sub(origin).normalize();
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
 g.resetRun(true);const l=g.firstLevel,s=l.state;assert.equal(s.clutchControl,undefined);assert.equal(l.terminals.length,1);s['fan-switchControl'].action();
 for(let n=0;n<1200;n++)l.update(1/120);
 assert.equal(s.flywheel.wheel.work,0);assert.equal(s.ratchet.engaged,false);assert.equal(s.door.open,false);
 s.flywheel.wheel.work=71;l.update(1/120);assert.equal(s.door.open,true);
 g.resetRun(true);assert.equal(s.ratchet.engaged,false);assert.equal(s.flywheel.wheel.work,0);assert.equal(s.blower.enabled,false);assert.equal(s.door.open,false);
});
test('requested round fan produces air; louvred drive receives it without rotating its casing',()=>{
 g.resetRun(true);const l=g.firstLevel,f=l.state.blower,drive=l.state.flywheel;
 assert.equal(f.art.id,31);assert.equal(drive.art.id,35);
 drive.art.art.updateWorldMatrix(true,true);const rotation=drive.art.pivot.quaternion.clone();
 f.enabled=true;for(let n=0;n<120;n++){l.update(1/120);l.renderUpdate(1);}
 assert.ok(f.art.pivot.rotation.z>0);assert.ok(drive.art.pivot.quaternion.equals(rotation));assert.ok(l.readability.dust.visible);
 const speed=f.rotorSpeed;f.enabled=false;l.update(1/120);l.renderUpdate(1);
 assert.ok(f.rotorSpeed>0&&f.rotorSpeed<speed);assert.ok(l.readability.dust.visible,'flow must coast with the fan');
 for(let n=0;n<360;n++){l.update(1/120);l.renderUpdate(1);}
 assert.equal(f.segments.length,0);assert.equal(l.readability.dust.visible,false);
});
test('fan angle and speed do not depend on render frame rate',()=>{
 const values=[];const l=g.firstLevel,f=l.state.blower;
 for(const hz of [30,60,144]){g.resetRun(true);f.enabled=true;for(let n=0;n<hz*2;n++)l.update(1/hz);f.enabled=false;for(let n=0;n<hz;n++)l.update(1/hz);values.push([f.rotorSpeed,f.angle]);}
 for(const a of values)a.forEach((v,i)=>assert.ok(Math.abs(v-values[0][i])<1e-9));
});
test('low graphics reduces particle budget and restart stops both visible and physical flow',()=>{
 const l=g.firstLevel;g.resetRun(true);l.state.blower.enabled=true;
 for(let n=0;n<120;n++)l.update(1/120);
 g.quality={shadows:false};l.renderUpdate(1);assert.equal(l.readability.dust.geometry.instanceCount,99);
 g.quality={shadows:true};l.renderUpdate(1);assert.equal(l.readability.dust.geometry.instanceCount,180);
 g.resetRun(true);assert.equal(l.state.blower.angle,0);assert.equal(l.readability.airflow.strength,0);assert.equal(l.readability.dust.visible,false);
});
test('repositioned existing puzzle is completed with normal input and the same friend',async()=>{
 const r=await runV8Journey(g);assert.ok(r.pass);assert.equal(r.respawns,0);assert.equal(r.resets,0);
 g.physics.dispose();g.portals.dispose();
});
