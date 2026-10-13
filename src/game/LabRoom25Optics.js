import * as THREE from 'three';
import {V,tracePortalRay,rayTouches,beamDrawing,ringDevice} from './LabPuzzleMechanics.js';
import {SolidAssembly} from './LabSolidModels.js';
import {buildRoom25OpticalMachine} from './LabRoom25OpticalMachine.js';
/** Both receiver routes and the carriage's moving mirror are actual rays.
 * The owned machine repeats this trace before every real 120Hz world step. */
export function buildRoom25Optics(k,pad,first,second){
 const w=k.world,g=k.game,source=V(18,3,16),direction=V(-1,0,0),receivers=[V(-1,12.96,12),V(18,11.3,-6)];
 // A physical beam becomes readable in the long gallery and through a portal;
 // its endpoints are still the exact same traced light segments.
 const drawing=beamDrawing(w,0xffbe55,.12),lamps=receivers.map(p=>ringDevice(w,p.toArray(),[-1,0,0],0xc2a677,.96));
 const bladeFinish=new THREE.MeshStandardMaterial({color:0x324650,metalness:.43,roughness:.48});
 const blades=[{base:V(-11,3,-6),sign:1},{base:V(11,11.3,2),sign:-1}].map(({base,sign})=>{
  const mesh=w.box(base.toArray(),[.4,6,5],bladeFinish,false);
  mesh.userData.keepMaterial=true;
  const collider={mesh,box:new THREE.Box3().setFromObject(mesh),enabled:true,kinematic:true};g.colliders.push(collider);g.cameraBlockers.push(mesh);g.aimBlockers.push(mesh);
  // Ribbed enamel is mounted on the very shutter that blocks the real ray.
  // Its shallow surface finish projects just 4 cm beyond that solid blade.
  const a=new SolidAssembly(sign>0?'Lower counterweighted shutter':'Upper counterweighted shutter','launch');
  a.materials[0].color.setHex(0x507b86);a.materials[1].color.setHex(0x263f4a);a.materials[2].color.setHex(0xe5b864);
  for(const signX of [-1,1]){
   a.box([signX*.211,0,0],[.018,4.9,3.92],0,.006,false);
   for(const z of [-2.24,2.24])a.box([signX*.224,0,z],[.024,5.72,.16],1,.006,false);
   for(const y of [-2.4,0,2.4])a.box([signX*.231,y,0],[.018,.12,4.55],2,.006,false);
  }
  const finish=a.finish();finish.userData.solidModel=false;delete finish.userData.collisionParts;finish.userData.visualOnly=true;mesh.add(finish);
  // Two fixed rails show the eight-metre reversed strokes, even while the
  // shutter is resting. They never cross the playable opening or act as walls.
  for(const z of [-8,3])w.box([base.x,base.y-3.05,z],[.08,.09,1.3],w.materials.trim,false);
  return {mesh,collider,base,sign};
 });
 const mirrorMaterial=new THREE.MeshStandardMaterial({color:0xb5d5da,metalness:.95,roughness:.08,side:THREE.DoubleSide});
 const reflector=(position,normal,name)=>{
  const mesh=new THREE.Mesh(new THREE.CircleGeometry(.45,24),mirrorMaterial);mesh.name=name;mesh.position.copy(position);mesh.quaternion.setFromUnitVectors(V(0,0,1),normal);w.root.add(mesh);
  const rim=new THREE.Mesh(new THREE.TorusGeometry(.45,.035,8,24),w.materials.trim);rim.position.copy(position);rim.quaternion.copy(mesh.quaternion);w.root.add(rim);
  return {position:position.clone(),normal:normal.clone(),radius:.45,mesh,rim};
 };
 // Two visible folded mirrors feed an upright optical column through the carriage's
 // whole nine-metre stroke. Its moving mirror redirects that real column
 // into the travelling motor receiver. Its horizontal export reaches the
 // fixed passenger-lift receiver only near the upper freight landing.
 // The column is outside the entire deck/carriage footprint: the load can
 // pass through its nine-metre travel without occluding its own supply.
 const folds=[reflector(V(-3.5,3,-6),V(1,0,-1).normalize(),'Room25 lower optical fold'),
  reflector(V(-3.5,3,12),V(0,-1,1).normalize(),'Room25 vertical optical fold')];
 const moving=reflector(V(-3.5,4,12),V(-1,1,0).normalize(),'Room25 carriage mirror');
 const motorReceiver=V(-2.2,4,12),motorLamp=ringDevice(w,motorReceiver.toArray(),[-1,0,0],0xc2a677,.30);
 const state={source,direction,segments:[],receivers:[false,false],loaded:false,travel:0,blades,
  movingMirror:moving,motorReceiver,motorLit:false,motorLamp,folds};
 function updateOptics(machine){
  g.portals?.syncMovingSurfaces?.();
  const body=machine.carriageBody;
  if(body){
   const q=new THREE.Quaternion().copy(body.quaternion);
   moving.position.set(3.5,3.96,0).applyQuaternion(q).add(V().copy(body.position));
   moving.normal.copy(V(-1,1,0).normalize()).applyQuaternion(q);
   motorReceiver.set(4.8,3.96,0).applyQuaternion(q).add(V().copy(body.position));
   moving.mesh.position.copy(moving.position);moving.mesh.quaternion.setFromUnitVectors(V(0,0,1),moving.normal);
   moving.rim.position.copy(moving.position);moving.rim.quaternion.copy(moving.mesh.quaternion);
   motorLamp.group.position.copy(motorReceiver);
  }
  state.loaded=machine.loaded;state.travel=(blades[0].mesh.position.z-blades[0].base.z)/8;
  state.segments=tracePortalRay(g,source,direction,{length:150,medium:'light',reflectors:[...folds,moving]});
  drawing.update(state.segments);state.receivers=receivers.map(p=>rayTouches(state.segments,p,.7));
  state.motorLit=rayTouches(state.segments,motorReceiver,.25);
  first.powered=state.receivers[0];second.powered=state.receivers[1];lamps.forEach((l,i)=>l.glow.material.color.setHex(state.receivers[i]?0xffe8ab:0x645b4d));
  motorLamp.glow.material.color.setHex(state.motorLit?0xffe8ab:0x645b4d);
  return {motor:state.motorLit,mirror:{position:moving.position.toArray(),normal:moving.normal.toArray()},motorReceiver:motorReceiver.toArray(),
   segments:state.segments.map(s=>({a:s.a.toArray(),b:s.b.toArray(),kind:s.kind}))};
 }
 const machine=buildRoom25OpticalMachine(k,pad,blades,{traceCurrentLight:updateOptics});state.machine=machine;
 k.ticks.unshift(()=>{machine.ensure();machine.syncPose();updateOptics(machine);});
 k.resets.push(()=>{state.travel=0;state.loaded=false;state.receivers=[false,false];});k.state.optical=state;
 k.wire([[-7,.6,12],[-11,.6,12],[-11,.6,-6],[-11,6.3,-6],[11,6.3,-6],[11,11.3,-6]],()=>machine.pressureFraction>.001);
 k.wire([[-1,12.96,12],[-1,9.2,12],[-3.8,9.2,12],[-3.8,9.2,-10],[-14,9.2,-10]],()=>state.receivers[0]);k.wire([[18,9.5,-6],[18,9.5,-10],[16,9.5,-10]],()=>state.receivers[1]);
 return state;
}
