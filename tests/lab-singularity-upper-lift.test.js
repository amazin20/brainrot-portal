import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {Body} from 'cannon-es';
import {LabPhysics} from '../src/game/LabPhysics.js';
import {SingularityKit} from '../src/game/LabSingularityKit.js';
import {buildTower41UpperLift} from '../src/game/LabTower41UpperLift.js';
const DT=1/120;

// Mechanism fixture only: the original cargo is deliberately remote. The
// production car moves solely through actual forces, joints and contacts.
function fixture(){
 const game={scene:new THREE.Scene(),colliders:[],floors:[],cameraBlockers:[],aimBlockers:[],portalPanels:[],cargo:new THREE.Object3D(),heldCube:null};
 const kit=new SingularityKit(game),cell=buildTower41UpperLift(game,kit,{centre:[0,0,0]});assert.equal(cell.ensure(),false);game.physics=new LabPhysics();for(const c of game.colliders)game.physics.addStaticBox(c.mesh.uuid,c.box,{kinematic:c.kinematic});game.physics.createCargo({position:[30,0,30]});const original=game.physics.cargoBody,baseline={bodies:game.physics.world.bodies.length,subsystems:game.physics.world.subsystems.length};cell.ensure();
 const step=(dt=DT)=>{const before=cell.liftBody.position.clone();game.physics.step(dt);const after=cell.liftBody.position;assert.ok([after.x,after.y,after.z].every(Number.isFinite));assert.ok(Math.abs(after.x-7)<.025&&Math.abs(after.z)<.025);assert.ok(after.distanceTo(before)<.15||dt>.02);};
 function until(p,seconds=20){for(let i=0;i<seconds/DT&&!p();i++)step();assert.ok(p(),JSON.stringify(cell.diagnostics()));}
 function catchCar(){until(()=>cell.height>6.4&&cell.diagnostics().direction===1);assert.equal(cell.armCatch(),true);until(()=>cell.retained,4);}
 function geometry(){for(const p of [...cell.liftParts,...cell.pawlParts,...cell.fixedParts]){const entry=game.physics.bodyBoxes.get(p.mesh.uuid);assert.ok(game.physics.inspectBodyBox(p.mesh.uuid,{bounds:p.collider.box}).valid);assert.equal(entry.orientedBox,p.collider.orientedBox);assert.equal(game.physics.solids.has(p.mesh.uuid),false);const centre=p.collider.box.getCenter(new THREE.Vector3());assert.ok(centre.distanceTo(p.mesh.position)<1e-6);}}
 return{game,kit,cell,original,baseline,step,until,catchCar,geometry,dispose(){cell.dispose();kit.dispose();game.physics.dispose();}};
}

test('upper hydraulic car sweeps through actual bounded dynamic motion and reverses only after finite stop reactions',()=>{
 const f=fixture();try{const c=f.cell;let minimum=Infinity,maximum=-Infinity,bottom=0,top=0,changes=0,positiveWork=0,last=c.diagnostics().direction;for(let i=0;i<3600;i++){f.step();const d=c.diagnostics();positiveWork+=Math.max(0,d.lastForce*d.lift.velocity[1])*DT;minimum=Math.min(minimum,d.height);maximum=Math.max(maximum,d.height);if(d.bottomForce>0)bottom++;if(d.topForce>0)top++;if(d.direction!==last){assert.ok(d.direction>0?d.bottomForce>0:d.topForce>0);changes++;last=d.direction;}assert.ok(Math.abs(d.lastForce)<=200);assert.equal(c.latched,false);assert.equal(c.rideComplete,false);}
 assert.ok(minimum<.02&&maximum>6.48&&maximum<6.53);assert.ok(bottom>=2&&top>=2&&changes>=4);assert.ok(positiveWork>c.liftBody.mass*19.5*6,'Actual bounded hydraulic force supplies positive work during real ascents');assert.equal(c.liftBody.type,Body.DYNAMIC);assert.ok(c.liftBody.mass>0);assert.deepEqual(c.constraints.map(x=>x.equations.length),[5,5]);assert.equal(c.constraints[0].equations.includes(c.constraints[0].equationY),false);assert.equal(c.constraints[1].equations.includes(c.constraints[1].motorEquation),false);assert.equal(f.game.physics.cargoBody,f.original);f.geometry();
 }finally{f.dispose();}
});

test('upper horizontal shelf carries real pressure load, then a tenfold gravity load after hydraulic power loss',()=>{
 const f=fixture();try{f.catchCar();const c=f.cell,on=c.diagnostics();assert.ok(on.catchContacts>0&&on.catchForce>7);assert.equal(on.catchWitness.action,'close');assert.equal(on.catchWitness.angularImpulse,-1.2);assert.ok(Math.abs(on.catchWitness.angularMomentumAfter-on.catchWitness.angularMomentumBefore+1.2)<1e-7);assert.equal(on.rideComplete,false,'Mechanism contact alone does not invent a player ride');
 c.powered=false;for(let i=0;i<600;i++)f.step();const off=c.diagnostics();assert.equal(off.lastForce,0);assert.equal(off.latched,true);assert.equal(off.retained,true);assert.ok(Math.abs(off.height-6)<.06);assert.ok(off.catchForce>on.catchForce*9);assert.ok(Math.abs(off.catchForce-c.liftBody.mass*19.5)<1);assert.equal(off.worldStep,off.contactStep);f.geometry();
 }finally{f.dispose();}
});

test('upper unlatched power loss falls by gravity while an accepted loaded catch refuses destructive repeated input',()=>{
 const f=fixture();try{f.cell.powered=false;for(let i=0;i<60;i++)f.step();assert.ok(f.cell.height<3.7);assert.equal(f.cell.diagnostics().lastForce,0);assert.ok(f.cell.liftBody.velocity.y<-9);f.cell.reset();f.catchCar();const hand=f.cell.diagnostics().handCount;assert.equal(f.cell.armCatch(),false);assert.equal(f.cell.diagnostics().handCount,hand);for(let i=0;i<240;i++)f.step();assert.equal(f.cell.retained,true);}
 finally{f.dispose();}
});

test('upper empty or early catch hand input never invents an actual low-to-high player ride',()=>{
 const f=fixture();try{assert.equal(f.cell.armCatch(),true);for(let i=0;i<1200;i++)f.step();assert.equal(f.cell.rideComplete,false);assert.equal(f.cell.diagnostics().rideLow,null);assert.equal(f.cell.diagnostics().rideHigh,null);assert.equal(f.cell.diagnostics().rideTicks,0);assert.equal(f.game.physics.cargoBody,f.original);}
 finally{f.dispose();}
});

test('upper dynamic geometry, pressure work and catch recover after variable frame dt and reset disposes all owned world state',()=>{
 const f=fixture();try{f.catchCar();for(const dt of [1/30,1/60,.1,1/144,1/120])for(let i=0;i<20;i++)f.step(dt);assert.equal(f.cell.retained,true);assert.ok(Number.isFinite(f.cell.diagnostics().pressureWork));f.geometry();f.cell.reset();assert.equal(f.cell.latched,false);assert.equal(f.cell.rideComplete,false);assert.equal(f.cell.height,6);assert.equal(f.cell.diagnostics().handCount,0);assert.equal(f.cell.diagnostics().pressureWork,0);f.catchCar();f.cell.dispose();f.cell.dispose();assert.equal(f.cell.ensure(),false);assert.equal(f.game.physics.world.bodies.length,f.baseline.bodies- [...f.cell.liftParts,...f.cell.pawlParts,...f.cell.fixedParts].length);assert.equal(f.game.physics.world.subsystems.length,f.baseline.subsystems);assert.ok(f.cell.constraints.every(c=>!f.game.physics.world.constraints.includes(c)));assert.ok([...f.cell.liftParts,...f.cell.pawlParts,...f.cell.fixedParts].every(p=>!f.game.physics.bodyBoxes.has(p.mesh.uuid)&&!p.collider.orientedBox));assert.equal(f.game.physics.cargoBody,f.original);}
 finally{f.dispose();}
});
