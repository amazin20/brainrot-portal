import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {SingularityKit} from '../src/game/LabSingularityKit.js';
import {buildCastleImpulseBranch} from '../src/game/LabCastleImpulseBranch.js';
import {LabPhysics} from '../src/game/LabPhysics.js';
import {makePortalFrame,orientedBoxFitsPortal,resolvePortalPlacement,uprightCapsuleFitsPortal} from '../src/game/LabPortals.js';

const V=(...v)=>new THREE.Vector3(...v);
function fixture(){
 const game={scene:new THREE.Scene(),colliders:[],floors:[],cameraBlockers:[],aimBlockers:[],portalPanels:[],cargo:new THREE.Object3D(),heldCube:null,playerPosition:V(0,0,0),playerGrounded:true,
  markPortalSurface(mesh,center,normal,halfWidth,halfHeight){Object.assign(mesh.userData,{portalable:true,center:center.clone(),normal:normal.clone(),portalUp:Math.abs(normal.y)>.9?V(0,0,-1):V(0,1,0),portalBounds:{halfWidth,halfHeight}});this.portalPanels.push(mesh);}};
 const k=new SingularityKit(game),def={id:'impulse',at:[47,54,26],w:46,d:44,h:15,entry:'w'},room=k.room(def),machines=new Map();let finish;
 const branch=buildCastleImpulseBranch({game,k,room,standing:()=>false,plate:()=>null,sign:()=>null,base:r=>k.floor(r.b.x0,r.b.x1,r.b.z0,r.b.z1,r.def.at[1]),register:(id,machine)=>machines.set(id,machine),goal:(id,p,predicate,proof)=>{finish={id,p,predicate,proof};return()=>{};}});
 game.scene.updateMatrixWorld(true);
 return{game,k,room,branch,machines,finish,dispose(){branch.cell.dispose();k.dispose();game.physics?.dispose();}};
}

test('Castle impulse module provides real original-cargo portal carriers and a cargo-only horizontal throat',()=>{
 const f=fixture();try{
  const{branch,game}=f,{intake,outlet}=branch.panels;
  for(const panel of [intake,outlet])assert.equal(resolvePortalPlacement(panel.mesh,panel.center,{blockers:game.colliders}).ok,true,panel.mesh.name);
  assert.equal(intake.mesh.userData.portalBackingIds.length,1);
  const aperture=makePortalFrame(outlet.center,outlet.normal,outlet.frame().up,outlet.mesh.userData.portalSize);
  assert.equal(uprightCapsuleFitsPortal(aperture,2.4,.43),false);
  for(let i=0;i<16;i++)assert.equal(orientedBoxFitsPortal(aperture,aperture.position,new THREE.Quaternion().setFromAxisAngle(V(0,1,0),i*Math.PI/8),.39),true,'Normal carried yaw must not require a hidden cargo rotation');
  assert.deepEqual(branch.targets.drop,[39,63,13.1]);assert.deepEqual(branch.targets.receiver,[41,54.16,42]);
  assert.equal(f.machines.get('impulse').state,branch.state);assert.equal(f.finish.id,'impulse');assert.equal(f.finish.predicate(),false);
 }finally{f.dispose();}
});

test('Castle impulse aiming slit passes the real outlet ray while excluding either physical traveller',()=>{
 const f=fixture();try{
  const target=f.branch.panels.outlet.center,origin=V(...f.room.P(3,-10,1.55)),direction=target.clone().sub(origin).normalize(),ray=new THREE.Raycaster(origin,direction,0,origin.distanceTo(target)+.01);
  const hits=ray.intersectObjects(f.game.aimBlockers,false);
  assert.equal(hits[0]?.object,f.branch.panels.outlet.mesh,JSON.stringify(hits.slice(0,3).map(h=>({name:h.object.name,distance:h.distance}))));
  const slit=f.branch.parts.filter(p=>p.name.includes('aiming slit'));
  assert.equal(slit.length,4);
  const frontWest=f.branch.parts.find(p=>p.name==='Castle impulse front aiming wall west'),frontEast=f.branch.parts.find(p=>p.name==='Castle impulse front aiming wall east');
  const a=frontWest.userData.collider.box,b=frontEast.userData.collider.box;
  assert.ok(Math.abs(b.min.x-a.max.x-.6)<1e-9);assert.ok(b.min.x-a.max.x<.78&&b.min.x-a.max.x<.86);
 }finally{f.dispose();}
});

test('Castle impulse service geometry leaves the entire physical carriage stroke and finite guide compliance clear',t=>{
 const f=fixture();try{
  const{branch}=f,owned=new Set([...branch.cell.movingParts,...branch.cell.fixedParts].map(p=>p.mesh)),statics=f.game.colliders.filter(c=>!owned.has(c.mesh)).map(c=>({name:c.mesh.name,box:c.box}));
  // Sweep actual production boxes, including both simultaneous worst-case
  // lateral/sag corners and the central axes. A guided Cannon body has finite
  // solver compliance; 20 mm must fit the architecture on each transverse
  // axis, rather than being accepted only because an observed route used it.
  const compliance=.02,offsets=[-compliance,0,compliance];let inspected=0,comparisons=0;
  assert.equal(branch.cell.movingParts.length,12);
  for(let i=0;i<=83;i++)for(const dy of offsets)for(const dz of offsets)for(const p of branch.cell.movingParts){
   const bounds=p.collider.box.clone().translate(V(i/20,dy,dz));
   for(const fixed of statics){
    comparisons++;
    const overlap=bounds.clone().intersect(fixed.box);if(overlap.isEmpty())continue;
    const size=overlap.getSize(V());assert.ok(Math.min(size.x,size.y,size.z)<=1e-8,`${p.mesh.name} at stroke ${i/20}, Y/Z compliance ${dy}/${dz} overlaps ${fixed.name} by ${size.toArray()}`);
   }
   inspected++;
  }
  assert.equal(inspected,84*9*12);
  assert.equal(comparisons,inspected*statics.length);
  // Each box retains its identity orientation here. Its union over the full
  // X stroke and the complete Y/Z square is this exact AABB, so also check
  // the continuous sweep: no thin obstacle may hide between sampled poses.
  let sweptComparisons=0;
  for(const p of branch.cell.movingParts){
   const swept=p.collider.box.clone().union(p.collider.box.clone().translate(V(4.15,0,0))).expandByVector(V(0,compliance,compliance));
   for(const fixed of statics){
    sweptComparisons++;
    const overlap=swept.clone().intersect(fixed.box);if(overlap.isEmpty())continue;
    const size=overlap.getSize(V());assert.ok(Math.min(size.x,size.y,size.z)<=1e-8,`${p.mesh.name} continuous translation envelope overlaps ${fixed.name} by ${size.toArray()}`);
   }
  }
  assert.equal(sweptComparisons,12*statics.length);
  // Independently derive the operating margins from the real manufactured
  // colliders. The guide shoe is 100 mm inside either lateral rail edge;
  // applying either signed transverse offset must retain 80 mm of that inset.
  const shoes=branch.cell.movingParts.filter(p=>p.mesh.name==='Castle impulse captive guide shoe'),rails=branch.cell.fixedParts.filter(p=>p.mesh.name==='Castle impulse founded guide rail');
  assert.equal(shoes.length,2);assert.equal(rails.length,2);
  let minimumRailInset=Infinity,minimumRailVerticalGap=Infinity;
  for(const shoe of shoes){
   const bounds=shoe.collider.box,centre=bounds.getCenter(V()),rail=rails.find(p=>Math.abs(p.collider.box.getCenter(V()).z-centre.z)<1e-8)?.collider.box;
   assert.ok(rail);assert.ok(Math.abs(bounds.min.z-rail.min.z-.1)<1e-8);assert.ok(Math.abs(rail.max.z-bounds.max.z-.1)<1e-8);
   for(const dy of offsets)for(const dz of offsets){
    minimumRailInset=Math.min(minimumRailInset,bounds.min.z+dz-rail.min.z,rail.max.z-bounds.max.z-dz);
    minimumRailVerticalGap=Math.min(minimumRailVerticalGap,bounds.min.y+dy-rail.max.y);
   }
  }
  assert.ok(Math.abs(minimumRailInset-.08)<1e-8);assert.ok(Math.abs(minimumRailVerticalGap-.075)<1e-8);
  const shutter=branch.cell.shutterPart.collider.box,deck=f.game.colliders.find(c=>c.mesh.uuid===branch.panels.intake.mesh.userData.portalBackingIds[0])?.box;
  assert.ok(deck);assert.ok(Math.abs(shutter.min.y-deck.max.y-.08)<1e-8);
  const minimumShutterFloorGap=shutter.min.y-compliance-deck.max.y;
  assert.ok(Math.abs(minimumShutterFloorGap-.06)<1e-8);
  const pocketFront=branch.parts.find(p=>p.name==='Castle impulse founded shutter pocket front').userData.collider.box,pocketBack=branch.parts.find(p=>p.name==='Castle impulse founded shutter pocket back').userData.collider.box,pocketEnd=branch.parts.find(p=>p.name==='Castle impulse founded shutter pocket end').userData.collider.box;
  assert.ok(Math.abs(pocketBack.min.z-pocketFront.max.z-.7)<1e-8);assert.ok(Math.abs(shutter.max.z-shutter.min.z-.36)<1e-8);
  const minimumPocketSideGap=Math.min(...offsets.flatMap(dz=>[shutter.min.z+dz-pocketFront.max.z,pocketBack.min.z-shutter.max.z-dz])),minimumPocketEndGap=pocketEnd.min.x-shutter.max.x-4.15;
  assert.ok(Math.abs(minimumPocketSideGap-.15)<1e-8);assert.ok(Math.abs(minimumPocketEndGap-.03)<1e-8);
  t.diagnostic(`${84*9} carriage poses, ${inspected} moving-part boxes, ${comparisons} pose comparisons and ${sweptComparisons} continuous-envelope comparisons against ${statics.length} non-cell static colliders; minimum rail inset ${minimumRailInset} m, rail vertical gap ${minimumRailVerticalGap} m, shutter floor gap ${minimumShutterFloorGap} m, pocket side/end gaps ${minimumPocketSideGap}/${minimumPocketEndGap} m`);
  const apron=branch.floors.find(p=>p.name==='Castle impulse low cargo pickup apron').userData.floor;
  assert.ok(Math.abs(apron.y-56.8)<1e-10);assert.ok(Math.abs(apron.minZ-27.4)<1e-10);
  const receiver=branch.targets.receiverPlatform.userData.collider.box;
  assert.ok(Math.abs(receiver.max.y-54.16)<1e-10);
 }finally{f.dispose();}
});

test('Castle impulse roof, real pocket and finite pickup opening retain physical separation',()=>{
 const f=fixture();try{
  const{branch,room}=f;
  const roof=branch.parts.find(p=>p.name==='Castle impulse sealed service roof').userData.collider.box;
  assert.ok(roof.max.z>=room.def.at[2]+10&&roof.min.z<=room.def.at[2]-2.4);
  const lower=branch.parts.find(p=>p.name==='Castle impulse lower founded pickup separation').userData.collider.box;
  assert.ok(Math.abs(lower.max.y-room.def.at[1]-3.15)<1e-10);
  const front=branch.parts.find(p=>p.name==='Castle impulse founded shutter pocket front').userData.collider.box,back=branch.parts.find(p=>p.name==='Castle impulse founded shutter pocket back').userData.collider.box;
  assert.ok(back.min.z-front.max.z>.36,'The actual .36m shutter fits inside its founded pocket');
  const descent=branch.floors.filter(p=>p.name.startsWith('Castle impulse pickup descent'));
  assert.equal(descent.length,3);for(let i=1;i<descent.length;i++)assert.ok(Math.abs(descent[i-1].userData.floor.y-descent[i].userData.floor.y-.25)<1e-10);
 }finally{f.dispose();}
});

test('Castle impulse receiver measures positive current contact from the same free original shape',()=>{
 const f=fixture();try{
  const{game,branch}=f;game.physics=new LabPhysics();for(const c of game.colliders)game.physics.addStaticBox(c.mesh.uuid,c.box,{kinematic:c.kinematic});
  game.physics.createCargo({position:[branch.targets.receiver[0],branch.targets.receiver[1]+1.2,branch.targets.receiver[2]]});branch.cell.ensure();
  const step=seconds=>{for(let i=0;i<Math.round(seconds*120);i++){game.physics.step(1/120);game.cargo.position.copy(game.physics.cargoBody.position);branch.update(1/120);}};
  step(2);assert.equal(branch.state.receiverLoaded,true,JSON.stringify({cargo:game.physics.cargoBody.position.toArray(),velocity:game.physics.cargoBody.velocity.toArray(),contact:branch.state.receiverContact,contacts:game.physics.world.contacts.map(c=>({a:c.bi.labId,b:c.bj.labId,ai:c.bi.id,bi:c.bj.id,n:c.ni.toArray(),f:c.multiplier,enabled:c.enabled})),supportInWorld:game.physics.solids.get(branch.targets.receiverPlatform.uuid).inWorld,supportBodyId:game.physics.solids.get(branch.targets.receiverPlatform.uuid).body.id}));const witness=branch.state.receiverContact;
  assert.equal(witness.cargoBodyId,branch.cell.originalCargoBody.id);assert.equal(witness.cargoShapeId,branch.cell.originalCargoShape.id);assert.ok(witness.contacts>0&&witness.normalForce>50);assert.equal(witness.worldStep,game.physics.world.stepnumber);
  assert.equal(f.finish.predicate(),false,'A load on the rear socket cannot substitute for the original physical impact and crossing');
  game.heldCube=game.cargo;step(1/120);assert.equal(branch.state.receiverLoaded,false);assert.equal(branch.state.receiverContact,null);
  game.heldCube=null;step(.3);assert.equal(branch.state.receiverLoaded,true);
  const support=game.physics.solids.get(branch.targets.receiverPlatform.uuid).body;support.collisionResponse=false;step(1/120);assert.equal(branch.state.receiverLoaded,false);assert.equal(branch.state.receiverContact,null);
 }finally{f.dispose();}
});

test('Castle impulse complete production shell permits an initial-condition cargo launch to flip the actual carriage',()=>{
 const f=fixture();try{
  const{game,branch,room}=f;game.physics=new LabPhysics();for(const c of game.colliders)game.physics.addStaticBox(c.mesh.uuid,c.box,{kinematic:c.kinematic});
  // A physical unit fixture starts at an already transported launch state.
  // It does not represent an ordinary-input or portal-throughput proof.
  game.physics.createCargo({position:room.P(1,0,4.9),velocity:[19,0,0]});branch.cell.ensure();
  const original=game.physics.cargoBody,shape=original.shapes[0];let furthest=branch.cell.x;
  for(let i=0;i<3600;i++){game.physics.step(1/120);game.cargo.position.copy(original.position);branch.update(1/120);furthest=Math.max(furthest,branch.cell.x);}
  const d=branch.cell.diagnostics();assert.ok(furthest>10.9,JSON.stringify(d));assert.equal(d.open,true,JSON.stringify({cell:d,contacts:game.physics.world.contacts.filter(c=>[c.bi,c.bj].includes(branch.cell.sliderBody)).map(c=>({a:c.bi.labId,b:c.bj.labId,shapeA:c.si.id,shapeB:c.sj.id,n:c.ni.toArray(),force:c.multiplier}))}));assert.equal(d.impacted,true);assert.equal(d.currentCollisionValid,true);assert.equal(d.firstImpact.cargoBodyId,original.id);assert.equal(d.firstImpact.cargoShapeId,shape.id);assert.ok(d.firstImpact.normalImpulse>0);
  assert.equal(game.physics.cargoBody,original);assert.equal(original.shapes[0],shape);assert.equal(f.finish.predicate(),false,'A correct collision cannot substitute for physical service access and original-cargo delivery');
  // Observer boundary fixture: the same actual body has already reached the
  // service corridor before these synthetic controller samples. This does
  // not claim an ordinary route. A crossing and retrieval may never share
  // one completed interval, even when both spatial conditions are true.
  original.position.copy(V(...room.P(7,7,1)));original.previousPosition.copy(original.position);original.velocity.setZero();original.aabbNeedsUpdate=true;original.wakeUp();
  for(const z of [9.5,9.6,9.7,9.8,9.9,10,10.1,10.2,10.3]){game.playerPosition.fromArray(room.P(7,z));game.physics.step(1/120);game.cargo.position.copy(original.position);branch.update(1/120);if(branch.state.actualServiceCrossing)break;}
  const crossing=branch.state.actualServiceCrossing;assert.ok(crossing);assert.equal(crossing.arrivalWorldStep,game.physics.world.stepnumber);assert.equal(branch.state.cargoRetrieval,null,'One completed interval cannot prove both crossing and later retrieval');
  game.physics.step(1/120);game.cargo.position.copy(original.position);branch.update(1/120);assert.ok(branch.state.cargoRetrieval.worldStep>crossing.arrivalWorldStep);assert.deepEqual(branch.state.cargoRetrieval.cargo,original.position.toArray());
 }finally{f.dispose();}
});
