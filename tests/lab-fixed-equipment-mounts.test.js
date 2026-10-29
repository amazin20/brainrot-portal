import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from 'three';
import {createHeadlessGame} from '../scripts/lab-headless.mjs';
import {ACTIVE_FOUNDATION_RUNTIME_FLAGS} from '../src/game/ReleaseIdentity.js';
import {disposeLabLevel} from '../src/game/LabLevelLifecycle.js';
import {gameplayContract,digest} from './helpers/lab-art-contract.js';
import {originalRoom11Contract} from './helpers/lab-early-construction-contract.js';
const V=(...p)=>new THREE.Vector3(...p),fixtures=JSON.parse(fs.readFileSync(new URL('./fixtures/fixed-equipment-original-contracts.json',import.meta.url)));
let g;before(async()=>{g=await createHeadlessGame();Object.assign(g,{chamberEdition:'foundation',...ACTIVE_FOUNDATION_RUNTIME_FLAGS});});after(()=>disposeLabLevel(g));
const mounts=()=>g.colliders.filter(c=>c.mesh.userData.fixedEquipmentMount);
function opaque(hit){
 for(let p=hit.object;p;p=p.parent)if(!p.visible)return false;
 const m=Array.isArray(hit.object.material)?hit.object.material[hit.face?.materialIndex??0]:hit.object.material;
 return m?.visible!==false&&!m?.transparent&&!hit.object.userData.collisionProxy&&!hit.object.userData.fixedEquipmentMount;
}
function hit(p,d,far=1){g.scene.updateMatrixWorld(true);return new THREE.Raycaster(V(...p),V(...d),0,far).intersectObject(g.scene,true).find(opaque);}
function checkRegistries(){
 const rows=mounts();assert.equal(rows.length,6);
 for(const c of rows){
  const m=c.mesh;assert.equal(m.visible,true);assert.notEqual(m.material.visible,false);assert.equal(m.material.transparent,false);
  for(let p=m;p;p=p.parent)assert.equal(p.visible,true);
  assert.equal(g.colliders.filter(n=>n.mesh===m).length,1);assert.equal(c.enabled,true);
  assert.equal(g.cameraBlockers.filter(n=>n===m).length,1);assert.equal(g.aimBlockers.filter(n=>n===m).length,1);assert.equal(g.portalPanels.includes(m),false);
  const b=new THREE.Box3().setFromObject(m);assert.ok(b.min.distanceTo(c.box.min)<1e-6&&b.max.distanceTo(c.box.max)<1e-6);
  const body=g.physics.solids.get(m.uuid)?.body;assert.ok(body);assert.equal(body.mass,0);assert.notEqual(body.collisionFilterMask,0);
  assert.ok(V(body.position.x,body.position.y,body.position.z).distanceTo(b.getCenter(V()))<1e-6);
  const half=body.shapes[0].halfExtents;assert.ok(V(half.x,half.y,half.z).distanceTo(b.getSize(V()).multiplyScalar(.5))<1e-6);
 }
 return rows;
}
for(const f of fixtures.rows)test(`${f.id}: every old gameplay/portal/contact record matches the pre-change source`,async()=>{
 await g.selectLevel(f.index,true);assert.equal(g.firstLevel.id,f.id);let c=gameplayContract(g);
 if(f.index===10)c=originalRoom11Contract(c);
 else{const rows=checkRegistries(),names=new Set(rows.map(r=>r.mesh.name));for(const key of ['colliders','camera','aim'])c[key]=c[key].filter(r=>!names.has(r.mesh?.name??r.name));}
 assert.equal(digest(c),f.sha256,'An original gameplay record changed beyond the precisely identified mount');
});
test('wind service bus reaches the actual floor and remains the same continuous closed upright',async()=>{
 await g.selectLevel(10,true);const rows=g.colliders.filter(c=>c.mesh.name==='Wind test service bus / closed power casing');assert.equal(rows.length,4);
 const c=rows.find(c=>Math.abs(c.mesh.position.z+11.4)<1e-8);assert.ok(c);assert.ok(Math.abs(c.box.min.y)<1e-6);assert.ok(Math.abs(c.box.max.y-6.55)<1e-6);
 for(const dx of [-.10,.10])for(const dz of [-.10,.10]){const h=hit([-11.6+dx,.05,-11.4+dz],[0,-1,0],.12);assert.ok(h&&Math.abs(h.point.y)<.025,'Bus foot floats above real rendered floor');}
 assert.ok(c.box.intersectsBox(rows[0].box));originalRoom11Contract(gameplayContract(g));
});
test('wind output-machine approval rejects altered guards, materials, queries, controls and old room records',async()=>{
 await g.selectLevel(10,true);const contract=gameplayContract(g),golden=fixtures.rows.find(f=>f.index===10).sha256;
 const retained=c=>digest(originalRoom11Contract(c));assert.equal(retained(contract),golden);
 const drawing=[];g.firstLevel.world.root.traverse(m=>{if(m.isMesh&&m.name.startsWith('Wind clutch / '))drawing.push(m);});
 const palette=g.firstLevel.world.materials,checkDrawing=()=>{
  assert.equal(drawing.length,24,'The audited machine owns exactly its guard, fork, rotor, collar and two springs');
  const uses={trim:0,floor:0,accent:0};
  for(const mesh of drawing){
   assert.equal(mesh.visible,true);for(let p=mesh;p;p=p.parent)assert.equal(p.visible,true);
   assert.equal(mesh.material.visible,true);assert.equal(mesh.material.transparent,false);
   const key=Object.keys(uses).find(name=>palette[name]===mesh.material);assert.ok(key,'The machine must reuse its three existing opaque palette materials');uses[key]++;
  }
  assert.deepEqual(uses,{trim:10,floor:2,accent:12});
 };
 checkDrawing();const first=drawing[0],material=first.material,clone=material.clone();
 try{first.visible=false;assert.throws(checkDrawing);first.visible=true;first.material=clone;assert.throws(checkDrawing);}
 finally{first.visible=true;first.material=material;clone.dispose();}
 checkDrawing();
 const shroud=c=>c.colliders.find(r=>r.mesh.name==='Wind clutch / spring-return air shroud');
 const attacks=[
  c=>{shroud(c).box.min.y+=.01;},
  c=>{shroud(c).kinematic=false;},
  c=>{shroud(c).enabled=false;},
  c=>{c.camera.push(structuredClone(c.camera.find(r=>r.name==='Wind clutch / spring-return air shroud')));},
  c=>{c.aim=c.aim.filter(r=>r.name!=='Wind clutch / left enclosure');},
  c=>{c.portalRegistry.push(structuredClone(shroud(c).mesh));},
  c=>{c.terminals.find(t=>t.kind==='drive-clutch').position[0]+=.1;},
  c=>{c.state.outputDrive.stroke=.1;},
  c=>{c.state.flywheel.clutch=true;},
  c=>{c.panels['wind-outlet'].center[1]+=.1;},
  c=>{c.colliders[0].enabled=false;},
 ];
 for(const mutate of attacks){const bad=structuredClone(contract);mutate(bad);assert.throws(()=>assert.equal(retained(bad),golden));}
});
test('both launch standards touch finite rendered rim faces and their own real bearing decks',async()=>{
 await g.selectLevel(42,true);const rows=checkRegistries(),p=g.firstLevel.launch;
 for(const side of ['deck','recovery']){
  const pieces=rows.filter(c=>c.mesh.name.startsWith(`Launch panel / ${side} standard`)),foot=pieces.find(c=>c.mesh.name.endsWith('foot')),shaft=pieces.find(c=>c.mesh.name.endsWith('shaft'));
  assert.equal(pieces.length,3);assert.ok(Math.abs(foot.box.min.y-(side==='deck'?0:-4))<1e-6);
  for(const dx of [-.115,.115])for(const dz of [-.115,.115]){
   const at=[shaft.mesh.position.x+dx,shaft.box.max.y-.4,shaft.mesh.position.z+dz],h=hit(at,[0,1,0],.45);
   assert.ok(h,'A post head misses the finite beam');assert.ok(p.group.children.includes(h.object),'The post meets another object, not its original rim');
   assert.equal(h.object.geometry.parameters.width,.58);assert.ok(h.point.y<shaft.box.max.y&&h.point.y>shaft.box.max.y-.20);
  }
  for(const dx of [-.24,.24])for(const dz of [-.24,.24]){const h=hit([foot.mesh.position.x+dx,foot.box.min.y+.04,foot.mesh.position.z+dz],[0,-1,0],.1);assert.ok(h&&Math.abs(h.point.y-foot.box.min.y)<.025,'Standard foot has no finite rendered deck');}
  assert.ok(pieces[0].box.intersectsBox(pieces[1].box)&&pieces[1].box.intersectsBox(pieces[2].box));
  for(const x of [shaft.box.min.x,shaft.box.max.x])for(const y of [shaft.box.min.y,shaft.box.max.y])for(const z of [shaft.box.min.z,shaft.box.max.z]){const local=p.group.worldToLocal(V(x,y,z));assert.ok(local.z<-.30,'Stand enters the porcelain/flight opening');}
 }
});
test('upper pressure hanger joins the true beam underside and receiver casing, leaving lens and dial clear',async()=>{
 await g.selectLevel(41,true);const rows=checkRegistries();
 for(const side of ['left','right']){
  const pieces=rows.filter(c=>c.mesh.name.startsWith(`Upper pressure receiver / ${side} suspension`)),shoe=pieces.find(c=>c.mesh.name.endsWith('saddle')),plate=pieces.find(c=>c.mesh.name.endsWith('beam plate'));
  assert.equal(pieces.length,3);assert.ok(pieces[0].box.intersectsBox(pieces[1].box)&&pieces[1].box.intersectsBox(pieces[2].box));
  for(const dx of [-.155,.155])for(const dz of [-.185,.185]){const h=hit([plate.mesh.position.x+dx,21.7,plate.mesh.position.z+dz],[0,1,0],.35);assert.ok(h&&Math.abs(h.point.y-21.9)<.02,'Plate misses the actual roof beam');}
  for(const dx of [-.105,.105])for(const dz of [-.135,.135]){const h=hit([shoe.mesh.position.x+dx,17.3,shoe.mesh.position.z+dz],[0,-1,0],.4);assert.ok(h&&h.point.y>=shoe.box.min.y&&h.point.y<=shoe.box.max.y,'Saddle floats over the receiver casing');}
  for(const c of pieces){assert.ok(c.box.min.y>17.02);assert.ok(Math.min(Math.abs(c.box.min.x-33),Math.abs(c.box.max.x-33))>.28,'Hanger covers the central dial');}
 }
 const optical=new THREE.Ray(V(33,9.2,34),V(0,1,0));assert.ok(rows.every(c=>{const h=optical.intersectBox(c.box,V());return !h||h.y>17.02;}));
});
test('hidden, displaced and nonphysical substitutes fail the mount registry contract',async()=>{
 await g.selectLevel(42,true);const m=mounts()[0].mesh,body=g.physics.solids.get(m.uuid).body;
 m.visible=false;assert.throws(checkRegistries);m.visible=true;
 m.position.x+=.1;assert.throws(checkRegistries);m.position.x-=.1;m.updateWorldMatrix(true,false);
 const mask=body.collisionFilterMask;body.collisionFilterMask=0;assert.throws(checkRegistries);body.collisionFilterMask=mask;
 g.aimBlockers.push(m);assert.throws(checkRegistries);g.aimBlockers.pop();checkRegistries();
});
test('level replacement disposes every new casting geometry exactly once and removes its physics/query owner',async()=>{
 for(const index of [41,42]){
  await g.selectLevel(index,true);const rows=checkRegistries(),counts=new Map(rows.map(c=>[c.mesh.geometry,0]));
  for(const geo of counts.keys())geo.addEventListener('dispose',()=>counts.set(geo,counts.get(geo)+1));
  await g.selectLevel(0,true);assert.ok([...counts.values()].every(n=>n===1));
  for(const {mesh}of rows){assert.ok(!g.colliders.some(c=>c.mesh===mesh));assert.ok(!g.aimBlockers.includes(mesh)&&!g.cameraBlockers.includes(mesh));assert.ok(!g.physics.solids.has(mesh.uuid));}
 }
});
