import * as THREE from 'three';
import {V,tracePortalRay,rayTouches,beamDrawing,ringDevice} from './LabPuzzleMechanics.js';
/** The same torsion cradle drives two visible optical branches. No stage is
 * remembered: losing the ray or unloading the plate changes actual power. */
export function exchangeOptics(k,pad,first,second,returnCar){
 const w=k.world,g=k.game,source=V(18,2,-14),direction=V(1,0,0),mirror=V(-12,2,0);
 const drawing=beamDrawing(w,0xffdd94,.036),pivot=new THREE.Group();pivot.position.copy(mirror);w.root.add(pivot);
 const plate=w.box([0,0,0],[.11,2.4,2.2],new THREE.MeshStandardMaterial({color:0xb8d5d4,metalness:.92,roughness:.12}),false,pivot);plate.userData.mechanismMirror=true;
 ringDevice(w,source.toArray(),direction.toArray(),0xffdd94,.45);
 const receivers=[V(-12,2,-9),V(-12,2,9)],lamps=receivers.map((p,i)=>ringDevice(w,p.toArray(),[0,0,i?-1:1],0xffdd94,1.25));
 const optical={source,direction,pivot,mirror,angle:-Math.PI/4,velocity:0,loaded:false,receivers:[false,false],segments:[],update(dt){
  optical.loaded=pad.loaded()||pad.player();const target=optical.loaded?Math.PI/4:-Math.PI/4;
  optical.velocity+=((target-optical.angle)*28-optical.velocity*10)*dt;optical.angle+=optical.velocity*dt;pivot.rotation.y=-optical.angle;
  const normal=V(Math.cos(optical.angle),0,Math.sin(optical.angle));optical.segments=tracePortalRay(g,source,direction,{length:120,reflectors:[{position:mirror,normal,radius:1.25}],bounces:6});drawing.update(optical.segments);
  optical.receivers=receivers.map(p=>rayTouches(optical.segments,p,1.12));first.powered=returnCar.powered=optical.receivers[1];second.powered=optical.receivers[0];
  lamps.forEach((l,i)=>l.glow.material.color.setHex(optical.receivers[i]?0xffedb3:0x605545));
 },reset(){optical.angle=-Math.PI/4;optical.velocity=0;optical.loaded=false;optical.receivers=[false,false];}};
 k.ticks.push(dt=>optical.update(dt));k.resets.push(()=>optical.reset());k.state.optical=optical;return optical;
}
