import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {createHeadlessGame} from '../scripts/lab-headless.mjs';
import {runV8Journey} from '../src/game/LabV8Journey.js';
import {ROOM23_DOCKED_INITIAL_STATE,runRoom23DockedHandoff} from './room23-docked-handoff-probe.mjs';

const root=fileURLToPath(new URL('../',import.meta.url)),out=path.resolve(process.argv[2]??path.join(root,'research','local-scene-return'));
fs.mkdirSync(out,{recursive:true});const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const sourceFiles=['src/game/LabPortalRoom23.js','src/game/LabRoom23PhysicalPrototype.js','src/game/LabRoom23PhysicalMachine.js','src/game/LabRoom23DynamicTraveller.js',
 'research/room23-docked-handoff-probe.mjs','research/room23-scene-return-probe.mjs'].map(p=>{const b=fs.readFileSync(path.join(root,p));return{path:p,bytes:b.length,sha256:sha(b)};});
const g=await createHeadlessGame();g.room23PhysicalPrototype=true;g.room23PhysicalPrototypeInitialState=ROOM23_DOCKED_INITIAL_STATE;
await g.selectLevel(22,false);const original=g.physics.cargoBody,shape=original.shapes[0],m=g.firstLevel.balance;
let phase='initial',failure=null,report=null,transfer=null,brakeInputAccepted=false,resets=0,respawns=0,releaseStep=null;
const oldResetCargo=g.physics.resetCargo,oldRespawn=g.respawn;
g.physics.resetCargo=function(...args){if(phase!=='initial')resets++;return oldResetCargo.apply(this,args);};
g.respawn=function(...args){if(phase!=='initial')respawns++;return oldRespawn.apply(this,args);};
const rows=[];
function capture(){
 const d=m.diagnostics();rows.push({worldStep:d.worldStep,phase,contactStep:d.contactStep,force:d.lastForce,west:d.west,east:d.east,
  original:original.position.toArray(),originalVelocity:original.velocity.toArray(),originalQuaternion:original.quaternion.toArray(),originalSleepState:original.sleepState,
  passenger:g.playerPosition.toArray(),passengerVelocity:m.traveller.body.velocity.toArray(),held:g.heldCube!==null,
  clutchNormal:d.clutchNormal,brakeNormal:d.brakeNormal,clutchTorque:d.clutchTorque,brakeTorque:d.brakeTorque,
  sourceInput:d.sourceInput,ownershipValid:d.ownershipValid,fault:d.fault});
}
g.physics.world.addEventListener('postStep',capture);
try{
 report=await runV8Journey(g,{scenario:async d=>{
  phase='actual-handoff-in-declared-docked-fixture';transfer=await runRoom23DockedHandoff(d);
  phase='board-east-after-real-handoff';d.walk(-3.1,1);d.walk(3.1,1);d.walk(5.5,4.5);
  brakeInputAccepted=g.interact();releaseStep=g.physics.world.stepnumber;phase='attempted-real-second-return';
  d.until(()=>g.playerPosition.y>19.9,20,'Same original on opposite cabin did not enable the actual scene return');
 }});
}catch(error){failure={name:error.name,message:error.message,stack:error.stack};}
const d=m.diagnostics(),names=new Map(m.parts.map(p=>[p.shape,p.mesh.name])),bodySet=new Set([...m.bodies,original,m.traveller.body]);
const body=b=>({id:b.id,type:b.type,mass:b.mass,position:b.position.toArray(),velocity:b.velocity.toArray(),quaternion:b.quaternion.toArray(),angularVelocity:b.angularVelocity.toArray(),
 force:b.force.toArray(),torque:b.torque.toArray(),linearFactor:b.linearFactor.toArray(),angularFactor:b.angularFactor.toArray(),inertia:b.inertia.toArray(),invMass:b.invMass,
 collisionFilterGroup:b.collisionFilterGroup,collisionFilterMask:b.collisionFilterMask,sleepState:b.sleepState,
 shapes:b.shapes.map((s,i)=>({id:s.id,type:s.type,name:names.get(s)??null,group:s.collisionFilterGroup,mask:s.collisionFilterMask,response:s.collisionResponse,
  offset:b.shapeOffsets[i].toArray(),orientation:b.shapeOrientations[i].toArray()}))});
const contacts=g.physics.world.contacts.filter(c=>bodySet.has(c.bi)||bodySet.has(c.bj)).map(c=>({a:c.bi.id,b:c.bj.id,shapeA:c.si?.id,shapeB:c.sj?.id,
 nameA:names.get(c.si)??null,nameB:names.get(c.sj)??null,normal:c.ni.toArray(),ri:c.ri.toArray(),rj:c.rj.toArray(),multiplier:c.multiplier,enabled:c.enabled}));
const constraints=m.constraints.map(c=>({type:c.constructor.name,a:c.bodyA.id,b:c.bodyB.id,
 equations:c.equations.map(e=>({type:e.constructor.name,enabled:e.enabled,minImpulse:e.minForce,maxImpulse:e.maxForce,multiplier:e.multiplier,
  GW:e.computeGW(),Gq:e.computeGq(),GiMf:e.computeGiMf(),jacobianA:{linear:e.jacobianElementA.spatial.toArray(),angular:e.jacobianElementA.rotational.toArray()},
  jacobianB:{linear:e.jacobianElementB.spatial.toArray(),angular:e.jacobianElementB.rotational.toArray()}}))}));
const snapshot={kind:'room23-blocked-scene-return-physical-snapshot',worldStep:g.physics.world.stepnumber,sourceFiles,bodies:[...bodySet].map(body),contacts,constraints,
 ownedParts:m.parts.map(p=>({name:p.mesh.name,meshId:p.mesh.uuid,kind:p.kind,bodyId:p.body.id,shapeId:p.shape.id,
  bounds:{min:p.collider.box.min.toArray(),max:p.collider.box.max.toArray()},enabled:p.collider.enabled,opened:p.opened??false})),
 diagnostics:d,energy:m.energy(),compoundCargoSweep:g.physics.diagnostics};
const snapshotFile=path.join(out,'terminal-physical-snapshot.json');fs.writeFileSync(snapshotFile,JSON.stringify(snapshot,null,2)+'\n');
const journalFile=path.join(out,'actual-scene-return-journal.jsonl');fs.writeFileSync(journalFile,[JSON.stringify({kind:'room23-declared-dock-scene-journal',
 initialState:ROOM23_DOCKED_INITIAL_STATE,sourceFiles,originalBodyId:original.id,originalShapeId:shape.id,passengerBodyId:m.traveller.body.id,
 scope:'Declared 10m component initial state, real subsequent movement/E actions; not authored normal Play route'}),...rows.map(r=>JSON.stringify(r))].join('\n')+'\n');
const receipt=p=>{const b=fs.readFileSync(p);return{path:p,bytes:b.length,sha256:sha(b),allBytesReadForHash:true};};
const result={kind:'room23-actual-scene-return-diagnostic',createdAt:new Date().toISOString(),sourceFiles,initialState:ROOM23_DOCKED_INITIAL_STATE,
 scope:'A real public-input continuation after a declared middle-height component initialization and finite clutch bootstrap; not a normal-spawn campaign proof',
 failure,driverReport:report,transfer,brakeInputAccepted,releaseStep,terminalWorldStep:g.physics.world.stepnumber,physicsSteps:rows.length,seconds:rows.length/120,
 resets,respawns,sameOriginal:g.physics.cargoBody===original&&original.shapes[0]===shape,originalMass:original.mass,passengerMass:m.traveller.body.mass,
 terminal:{west:d.west,east:d.east,passenger:g.playerPosition.toArray(),original:original.position.toArray(),clutchNormal:d.clutchNormal,brakeNormal:d.brakeNormal,sourceInput:d.sourceInput,
  motorTorque:d.lastForce?.motorTorque,ownershipValid:d.ownershipValid},journal:receipt(journalFile),snapshot:receipt(snapshotFile),
 actualSceneReturnPassed:failure===null,fullOrdinaryRouteAccepted:false,sourceAccepted:false,publicAccepted:false,nativeAccepted:false};
const resultFile=path.join(out,'blocked-scene-return.json');fs.writeFileSync(resultFile,JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({receipt:receipt(resultFile),failure:failure?.message,physicsSteps:rows.length,terminal:result.terminal}));
g.physics.world.removeEventListener('postStep',capture);g.physics.resetCargo=oldResetCargo;g.respawn=oldRespawn;g.firstLevel.dispose();g.physics.dispose();g.portals.dispose();
