import * as THREE from 'three';
import {V,tracePortalRay,rayTouches,beamDrawing,ringDevice} from './LabPuzzleMechanics.js';
/** One weight translates two opposed opaque shutters. Receiver illumination
 * is traced through their real kinematic collision boxes at every tick. */
export function buildRoom25Optics(k,pad,first,second){
 const w=k.world,g=k.game,source=V(18,3,16),direction=V(-1,0,0),receivers=[V(-7,3,-6),V(18,11.3,-6)];
 const drawing=beamDrawing(w,0xffd894,.032),lamps=receivers.map(p=>ringDevice(w,p.toArray(),[-1,0,0],0xc2a677,.65));
 const blades=[{base:V(-11,3,-6),sign:1},{base:V(11,11.3,2),sign:-1}].map(({base,sign})=>{
  const mesh=w.box(base.toArray(),[.4,6,5],w.materials.wall,false);
  const collider={mesh,box:new THREE.Box3().setFromObject(mesh),enabled:true,kinematic:true};g.colliders.push(collider);g.cameraBlockers.push(mesh);g.aimBlockers.push(mesh);
  w.box([base.x,base.y-3.2,-2],[.2,.2,13],w.materials.trim,false);
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
 k.wire([[-7,1,-6],[-7,1,-10],[-14,1,-10]],()=>state.receivers[0]);k.wire([[18,9.5,-6],[18,9.5,-10],[16,9.5,-10]],()=>state.receivers[1]);
 return state;
}
