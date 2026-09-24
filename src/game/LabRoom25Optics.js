import * as THREE from 'three';
import {V,tracePortalRay,rayTouches,beamDrawing,ringDevice} from './LabPuzzleMechanics.js';
import {SolidAssembly} from './LabSolidModels.js';
/** One weight translates two opposed opaque shutters. Receiver illumination
 * is traced through their real kinematic collision boxes at every tick. */
export function buildRoom25Optics(k,pad,first,second){
 const w=k.world,g=k.game,source=V(18,3,16),direction=V(-1,0,0),receivers=[V(-7,3,-6),V(18,11.3,-6)];
 // A physical beam becomes readable in the long gallery and through a portal;
 // its endpoints are still the exact same traced light segments.
 const drawing=beamDrawing(w,0xffd894,.075),lamps=receivers.map(p=>ringDevice(w,p.toArray(),[-1,0,0],0xc2a677,.84));
 const bladeFinish=new THREE.MeshStandardMaterial({color:0x324650,metalness:.43,roughness:.48});
 const blades=[{base:V(-11,3,-6),sign:1},{base:V(11,11.3,2),sign:-1}].map(({base,sign})=>{
  const mesh=w.box(base.toArray(),[.4,6,5],bladeFinish,false);
  mesh.userData.keepMaterial=true;
  const collider={mesh,box:new THREE.Box3().setFromObject(mesh),enabled:true,kinematic:true};g.colliders.push(collider);g.cameraBlockers.push(mesh);g.aimBlockers.push(mesh);
  // Ribbed enamel is mounted on the very shutter that blocks the real ray.
  // The thin face details sit within its swept .4 × 6 × 5 collision volume.
  const a=new SolidAssembly(sign>0?'Lower counterweighted shutter':'Upper counterweighted shutter','launch');
  a.materials[1].color.setHex(0x263f4a);a.materials[2].color.setHex(0xd7ad66);
  for(const x of [-.191,.191]){
   for(const z of [-2.24,2.24])a.box([x,0,z],[.018,5.72,.16],1,.006,false);
   for(const y of [-2.4,-.8,.8,2.4])a.box([x,y,0],[.018,.045,4.55],2,.006,false);
  }
  const finish=a.finish();finish.userData.solidModel=false;delete finish.userData.collisionParts;finish.userData.visualOnly=true;mesh.add(finish);
  // Two fixed rails show the eight-metre reversed strokes, even while the
  // shutter is resting. They never cross the playable opening or act as walls.
  for(const z of [-8,3])w.box([base.x,base.y-3.05,z],[.08,.09,1.3],w.materials.trim,false);
  return {mesh,collider,base,sign};
 });
 const state={source,direction,segments:[],receivers:[false,false],loaded:false,travel:0,blades};
 k.ticks.unshift(dt=>{
  state.loaded=pad.loaded()||pad.player();state.travel=THREE.MathUtils.damp(state.travel,state.loaded?1:0,2.2,dt);
  for(const b of blades){b.mesh.position.copy(b.base);b.mesh.position.z+=b.sign*8*state.travel;b.mesh.updateWorldMatrix(true,false);b.collider.box.setFromObject(b.mesh);g.physics?.updateStaticBox(b.mesh.uuid,b.collider.box,dt);}
  state.segments=tracePortalRay(g,source,direction,{length:125,medium:'light'});drawing.update(state.segments);state.receivers=receivers.map(p=>rayTouches(state.segments,p,.7));
  first.powered=state.receivers[0];second.powered=state.receivers[1];lamps.forEach((l,i)=>l.glow.material.color.setHex(state.receivers[i]?0xffe8ab:0x645b4d));
 });
 k.resets.push(()=>{state.travel=0;state.loaded=false;state.receivers=[false,false];});k.state.optical=state;
 k.wire([[-7,.6,12],[-11,.6,12],[-11,.6,-6],[-11,6.3,-6],[11,6.3,-6],[11,11.3,-6]],()=>state.loaded);
 k.wire([[-7,1,-6],[-7,1,-10],[-14,1,-10]],()=>state.receivers[0]);k.wire([[18,9.5,-6],[18,9.5,-10],[16,9.5,-10]],()=>state.receivers[1]);
 return state;
}
