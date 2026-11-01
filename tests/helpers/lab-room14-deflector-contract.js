import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import * as THREE from 'three';
import {gameplayContract} from './lab-art-contract.js';
import {makePortalFrame,orientedBoxFitsPortal,uprightCapsuleFitsPortal} from '../../src/game/LabPortals.js';

const V=(...p)=>new THREE.Vector3(...p),array=v=>v?.toArray?.()??null;
const hash=a=>createHash('sha256').update(Buffer.from(a.buffer,a.byteOffset,a.byteLength)).digest('hex');
const round=value=>JSON.parse(JSON.stringify(value,(_key,n)=>{if(typeof n!=='number')return n;assert.ok(Number.isFinite(n),'Nonfinite current14 physical/interaction record');return Math.round(n*1e9)/1e9;}));
const bounds=b=>b?{min:array(b.min),max:array(b.max)}:null;
const material=m=>m?{friction:m.friction,restitution:m.restitution}:null;
const shape=s=>s?{type:s.type,half:array(s.halfExtents),radius:s.radius,collisionResponse:s.collisionResponse,group:s.collisionFilterGroup,mask:s.collisionFilterMask,material:material(s.material),vertices:s.vertices?.map(array),faces:s.faces?.map(f=>[...f])}:null;
const pose=p=>p?{center:array(p.center),quaternion:array(p.quaternion),bounds:bounds(p.bounds)}:null;
const oriented=d=>d?{half:array(d.half),offset:array(d.offset),step:d.step,current:pose(d.current),previous:pose(d.previous)}:null;

/** Full replacement snapshot, deliberately without the old14 mount/stair
 * subtraction. Allocation IDs are represented by their actual world index;
 * every registered owner/shape relationship is checked separately below. */
export function room14DeflectorContract(game){
 const level=game.firstLevel,p=game.physics,w=p.world;
 assert.equal(level.index,13);assert.equal(level.deflectorRoom,true,'A legacy island layout cannot satisfy the replacement acceptance');
 game.scene.updateMatrixWorld(true);
 const bodyIndex=b=>{const n=w.bodies.indexOf(b);assert.ok(n>=0,'Every claimed Cannon owner must belong to the real world');return n;};
 const sourceName=id=>{const c=game.colliders.find(c=>c.mesh.uuid===id);assert.ok(c,'Every physical registry key must identify its actual authored collider');return c.mesh.name;};
 const bodies=w.bodies.map(b=>({type:b.type,mass:b.mass,invMass:b.invMass,inertia:array(b.inertia),invInertia:array(b.invInertia),fixedRotation:b.fixedRotation,position:array(b.position),previousPosition:array(b.previousPosition),quaternion:array(b.quaternion),previousQuaternion:array(b.previousQuaternion),velocity:array(b.velocity),angularVelocity:array(b.angularVelocity),force:array(b.force),torque:array(b.torque),linearFactor:array(b.linearFactor),angularFactor:array(b.angularFactor),linearDamping:b.linearDamping,angularDamping:b.angularDamping,collisionResponse:b.collisionResponse,group:b.collisionFilterGroup,mask:b.collisionFilterMask,material:material(b.material),shapes:b.shapes.map(shape),shapeOffsets:b.shapeOffsets.map(array),shapeOrientations:b.shapeOrientations.map(array)}));
 const ownerRows=game.colliders.map(c=>{
  const id=c.mesh.uuid,s=p.solids.get(id),o=p.bodyBoxes.get(id),sweep=p.cargoSweepBoxes.get(id);
  assert.ok(!(s&&o),'A collider cannot acquire a second static body in addition to its oriented owner');
  if(o){assert.equal(o.shape,o.body.shapes[o.shapeIndex]);assert.equal(o.orientedBox,c.orientedBox);assert.equal(o.orientedBox.body,o.body);}
  if(sweep)assert.equal(sweep.shape,sweep.body.shapes[sweep.shapeIndex]);
  return{name:c.mesh.name,static:s?{body:bodyIndex(s.body),kind:s.kind,half:array(s.half),target:array(s.target),remaining:s.remaining,inWorld:s.inWorld}:null,owned:o?{body:bodyIndex(o.body),shapeIndex:o.shapeIndex,oriented:oriented(o.orientedBox)}:null,cargoSweep:sweep?{body:bodyIndex(sweep.body),shapeIndex:sweep.shapeIndex}:null};
 });
 const triangles=game.aimBlockers.map(m=>({name:m.name,position:m.geometry?.attributes.position?hash(m.geometry.attributes.position.array):null,index:m.geometry?.index?hash(m.geometry.index.array):null}));
 const constraints=w.constraints.map(c=>({bodyA:bodyIndex(c.bodyA),bodyB:bodyIndex(c.bodyB),enabled:c.enabled,collideConnected:c.collideConnected,equations:c.equations.map(e=>({enabled:e.enabled,minForce:e.minForce,maxForce:e.maxForce}))}));
 return round({gameplay:gameplayContract(game),physics:{fixedStep:p.fixedStep,worldStep:w.stepnumber,gravity:array(w.gravity),solverIterations:w.solver.iterations,solverTolerance:w.solver.tolerance,defaultContact:{friction:w.defaultContactMaterial.friction,restitution:w.defaultContactMaterial.restitution,contactEquationStiffness:w.defaultContactMaterial.contactEquationStiffness,contactEquationRelaxation:w.defaultContactMaterial.contactEquationRelaxation,frictionEquationStiffness:w.defaultContactMaterial.frictionEquationStiffness,frictionEquationRelaxation:w.defaultContactMaterial.frictionEquationRelaxation},bodies,constraints,owners:ownerRows,bodyBoxOrder:[...p.bodyBoxes.keys()].map(sourceName),cargoSweepOrder:[...p.cargoSweepBoxes.keys()].map(sourceName),cargoBody:bodyIndex(p.cargoBody),cargoShape:shape(p.cargoBody.shapes[0])},aimSourceTriangles:triangles,geometry:{freightTarget:bounds(level.readability.cargoTarget),passengerTarget:bounds(level.readability.passengerTarget),fieldOwnedNames:level.readability.field.owned.map(p=>p.mesh.name),fieldPieceNames:level.readability.field.pieces.map(p=>p.mesh.name),panelSizes:Object.fromEntries(Object.entries(level.panels).map(([name,p])=>[name,p.mesh.userData.portalSize??null]))}});
}

export function loadRoom14DeflectorFixture(){return JSON.parse(readFileSync(new URL('../fixtures/room14-deflector-contract.json',import.meta.url)));}
export function assertRoom14DeflectorSnapshot(actual,expected){assert.deepEqual(actual,expected,'Complete replacement14 contract changed; investigate physical/query/topology differences explicitly');}

/** Independent live ownership check, usable during motion/readdress, not a
 * golden comparison and not an ordinary-input route by itself. */
export function assertRoom14FieldOwnership(game){
 const level=game.firstLevel,field=level.readability.field,p=game.physics;
 assert.equal(level.deflectorRoom,true);assert.equal(level.state.lightBridge,undefined);assert.equal(level.state.counterweightStair,undefined);
 const ids=new Set();
 for(const part of field.owned){
  const {mesh,collider,body,shape,descriptor}=part;assert.ok(!ids.has(mesh.uuid));ids.add(mesh.uuid);
  assert.equal(game.colliders.filter(c=>c===collider).length,1);assert.equal(game.cameraBlockers.filter(m=>m===mesh).length,1);assert.equal(game.aimBlockers.filter(m=>m===mesh).length,1);
  assert.equal(mesh.visible,collider.enabled!==false);assert.equal(p.solids.has(mesh.uuid),false);assert.equal(p.bodyBoxes.get(mesh.uuid)?.body,body);assert.equal(p.bodyBoxes.get(mesh.uuid)?.shape,shape);assert.equal(p.cargoSweepBoxes.get(mesh.uuid)?.body,body);assert.equal(p.cargoSweepBoxes.get(mesh.uuid)?.shape,shape);assert.equal(body.shapes[0],shape);assert.equal(collider.orientedBox,descriptor);
  const inspection=p.inspectBodyBox(mesh.uuid,{bounds:collider.box,enabled:collider.enabled});assert.equal(inspection.valid,true,mesh.name+': '+inspection.errors.join(','));
  mesh.updateWorldMatrix(true,false);const visibleBounds=new THREE.Box3().setFromObject(mesh),position=mesh.getWorldPosition(V()),rotation=mesh.getWorldQuaternion(new THREE.Quaternion());
  assert.ok(visibleBounds.min.distanceTo(collider.box.min)<1e-6&&visibleBounds.max.distanceTo(collider.box.max)<1e-6,'Visible finite geometry differs from its real contact envelope');
  assert.ok(position.distanceTo(V().copy(body.position))<1e-7);assert.ok(rotation.angleTo(new THREE.Quaternion(body.quaternion.x,body.quaternion.y,body.quaternion.z,body.quaternion.w))<1e-7);
  assert.equal(game.floors.some(f=>f.mesh===mesh),false,'A vertical oblique field must not acquire an axis-aligned walking floor');
 }
 assert.equal(ids.size,field.owned.length);
}

/** Geometry inequalities independent of the snapshot hash. They preserve
 * the reasons this layout needs separate thin-field and actor routes. */
export function assertRoom14DeflectorGeometry(game){
 const level=game.firstLevel,p=game.physics;assert.equal(level.deflectorRoom,true);
 assert.deepEqual(Object.keys(level.panels).sort(),['contact-intake','contact-turn','passenger-arrival','passenger-departure']);
 const half=p.cargoBody.shapes[0].halfExtents;assert.deepEqual(array(half),[.39,.39,.39]);
 for(const name of ['contact-intake','contact-turn']){
  const panel=level.panels[name],f=panel.getFrame(),aperture=makePortalFrame(f.center,f.normal,f.up,panel.mesh.userData.portalSize);
  assert.ok(2*aperture.width<2*Math.min(half.x,half.y,half.z),'The complete cube cannot fit at any orientation through the full optical width');
  assert.equal(orientedBoxFitsPortal(aperture,aperture.position,new THREE.Quaternion(),.39),false);assert.equal(uprightCapsuleFitsPortal(aperture,2.4,.44),false);
 }
 for(const name of ['passenger-arrival','passenger-departure']){
  const panel=level.panels[name],f=panel.getFrame(),aperture=makePortalFrame(f.center,f.normal,f.up,panel.mesh.userData.portalSize);
  assert.equal(uprightCapsuleFitsPortal(aperture,2.4,.44),true,'The real passenger route must remain physically usable');
 }
 const floor=name=>{const surface=level.world.surfaces.find(s=>s.name==='14 / '+name);assert.ok(surface?.floor,name);return surface.floor;};
 const straight=floor('straight freight floor'),lower=floor('freight exit lower floor'),gap=straight.minZ-lower.maxZ,diagonal=2*Math.hypot(half.x,half.y,half.z);
 assert.ok(gap>diagonal,'The true unsupported turn must exceed the original cube space diagonal, including rotated corner bridging');
 for(const f of game.floors){
  const overlapX=Math.min(f.maxX,lower.maxX)-Math.max(f.minX,lower.minX),overlapZ=Math.min(f.maxZ,straight.minZ)-Math.max(f.minZ,lower.maxZ);
  assert.ok(f.enabled===false||f.y<lower.y-.01||overlapX<=1e-6||overlapZ<=1e-6,'No hidden walking plank may bridge the required freight gap');
 }
 const roof=game.colliders.find(c=>c.mesh.name==='14 / freight roof mass');assert.ok(roof?.enabled);
 const clearance=roof.box.min.y-straight.y;assert.ok(clearance>2*half.y&&clearance<2.4,'The actual roof must admit the free cargo and reject the complete upright traveller');
 const glass=level.readability.window,c=game.colliders.find(c=>c.mesh===glass),cargo=level.readability.cargoTarget,person=level.readability.passengerTarget;
 assert.ok(c?.enabled&&glass.visible&&c.opticallyTransparent);assert.ok(c.box.min.x>cargo.max.x&&c.box.max.x<person.min.x,'An actual solid pane separates the two goal bays');
 assert.ok(c.box.min.z<Math.min(cargo.min.z,person.min.z)&&c.box.max.z>Math.max(cargo.max.z,person.max.z));assert.ok(c.box.min.y<=lower.y+.001&&c.box.max.y>=lower.y+2.4);
 assert.equal(game.cameraBlockers.filter(m=>m===glass).length,1);assert.equal(game.aimBlockers.filter(m=>m===glass).length,1);
 const physical=p.solids.get(glass.uuid);assert.ok(physical&&physical.inWorld&&p.world.bodies.includes(physical.body)&&physical.body.collisionFilterMask,'The observation pane must be actual cargo contact, not cosmetic transparency');
 return{straight,lower,gap,cargoSpaceDiagonal:diagonal,glass:c};
}

export function assertRoom14ProjectorSupport(game){
 const root=game.firstLevel.world.root,find=name=>{const c=game.colliders.find(c=>c.mesh.name==='14 / '+name);assert.ok(c?.enabled);return c;};
 const pedestal=find('projector pedestal'),barrel=find('projector barrel'),court=game.firstLevel.world.surfaces.find(s=>s.name==='14 / blower service court').floor;
 assert.ok(Math.abs(pedestal.box.min.y-court.y)<1e-6&&pedestal.box.intersectsBox(barrel.box),'The current actual projector must be founded on its service court');
 for(const c of [pedestal,barrel]){const body=game.physics.solids.get(c.mesh.uuid)?.body;assert.ok(body&&game.physics.world.bodies.includes(body)&&body.collisionFilterMask);assert.ok(game.cameraBlockers.includes(c.mesh)&&game.aimBlockers.includes(c.mesh));}
 const source=game.firstLevel.readability.field.segments[0];assert.ok(source&&source.direction.x>.99);
 const meshes=[];root.updateWorldMatrix(true,true);root.traverse(m=>{if(m.isMesh)meshes.push(m);});
 const lenses=meshes.filter(m=>{const p=m.geometry.parameters;return Math.abs(p?.width-.06)<1e-8&&Math.abs(p?.height-.18)<1e-8&&Math.abs(p?.depth-.55)<1e-8;});assert.equal(lenses.length,1);
 const lens=lenses[0],lensBounds=new THREE.Box3().setFromObject(lens);assert.ok(source.a.x-lensBounds.max.x>=0&&source.a.x-lensBounds.max.x<.08&&source.a.y>lensBounds.min.y&&source.a.y<lensBounds.max.y&&source.a.z>lensBounds.min.z&&source.a.z<lensBounds.max.z,'The real emitted segment must start immediately at its actual finite lens');
 for(const [up,side] of [[0,0],[.5,0],[.5,.2],[.5,-.2]]){
  const from=source.a.clone().addScaledVector(source.direction,2).add(V(0,up,side)),ray=new THREE.Raycaster(from,source.a.clone().sub(from).normalize());
  const hits=ray.intersectObjects(meshes,false),lensHit=hits.find(h=>h.object===lens);assert.ok(lensHit,'The actual current lens must be in the finite frontal/raised sight line');
  for(let n=lens;n;n=n.parent)assert.equal(n.visible,true);
  const lensMaterial=Array.isArray(lens.material)?lens.material[lensHit.face?.materialIndex??0]:lens.material;assert.ok(lensMaterial?.visible!==false&&lensMaterial.opacity>0);
  const hit=hits.find(h=>{
   for(let n=h.object;n;n=n.parent)if(!n.visible)return false;
   const m=Array.isArray(h.object.material)?h.object.material[h.face?.materialIndex??0]:h.object.material;return m?.visible!==false&&(!m?.transparent||m.opacity>=.99);
  });
  assert.ok(!hit||hit.distance>=lensHit.distance-1e-7,'An opaque barrel/cover must not hide the actual emitted-axis lens');
 }
 return{pedestal,barrel};
}
