import * as THREE from 'three';
import {V,tracePortalRay,rayTouches,beamDrawing,ringDevice} from './LabPuzzleMechanics.js';
/** A guided platform follows an optical motor against its counterweight.
 * Losing the ray releases it; there is no saved puzzle stage or teleport. */
export function opticalLift(k,name,p,{top=12,width=4,depth=4}={}){
 const w=k.world,g=k.game,group=new THREE.Group();w.root.add(group);group.position.fromArray(p);
 const surface=w.surface({name,position:[0,0,0],normal:[0,1,0],width,height:depth,parent:group,moving:true});
 const floor={minX:p[0]-width/2,maxX:p[0]+width/2,minZ:p[2]-depth/2,maxZ:p[2]+depth/2,y:p[1],mesh:surface.mesh,enabled:true};g.floors.push(floor);w.floors.push(floor);
 w.box([0,-.25,0],[width,.4,depth],w.materials.trim,false,group);
 for(const x of [p[0]-width/2-.28,p[0]+width/2+.28])w.box([x,(p[1]+top)/2,p[2]+depth/2+.3],[.18,top-p[1]+1,.2],w.materials.trim);
 const car={position:V(...p),velocity:0,powered:false,progress:0,update(dt){
  const old=floor.y,target=car.powered?top:p[1];
  const acceleration=THREE.MathUtils.clamp((target-old)*6-car.velocity*5,-5,5);
  car.velocity+=acceleration*dt;car.velocity=THREE.MathUtils.clamp(car.velocity,-1.2,2.2);
  let y=THREE.MathUtils.clamp(old+car.velocity*dt,p[1],top);if((y===p[1]&&car.velocity<0)||(y===top&&car.velocity>0))car.velocity=0;
  const on=g.playerGrounded&&Math.abs(g.playerPosition.y-old)<.2&&g.playerPosition.x>floor.minX-.1&&g.playerPosition.x<floor.maxX+.1&&g.playerPosition.z>floor.minZ-.1&&g.playerPosition.z<floor.maxZ+.1;
  if(on){g.playerPosition.y+=y-old;g.previousPlayerPosition.y+=y-old;}
  group.position.y=y;car.position.y=y;floor.y=y;car.progress=(y-p[1])/(top-p[1]);group.updateWorldMatrix(true,true);surface.collider.box.setFromObject(surface.mesh);g.physics?.updateStaticBox(surface.mesh.uuid,surface.collider.box,dt);
 },reset(){car.velocity=0;car.powered=false;group.position.y=p[1];floor.y=p[1];car.position.y=p[1];car.progress=0;car.update(0);}};
 k.ticks.push(dt=>car.update(dt));k.resets.push(()=>car.reset());k.state[name]=car;return car;
}
export function weightedOptics(k,pad,north,south){
 const w=k.world,g=k.game,source=V(14,8,-12),direction=V(1,0,0),mirror=V(-10,8,0),drawing=beamDrawing(w,0xffdb94,.034);
 ringDevice(w,source.toArray(),direction.toArray(),0xffdc88,.45);
 const pivot=new THREE.Group();pivot.position.copy(mirror);w.root.add(pivot);
 const plate=w.box([0,0,0],[.11,2.4,2.2],new THREE.MeshStandardMaterial({color:0xaed6da,metalness:.92,roughness:.12}),false,pivot);
 w.box([-12.3,6.9,0],[.18,1.7,.18],w.materials.trim,false);
 w.box([-11.15,7.7,0],[2.3,.14,.18],w.materials.trim,false);
 const receivers=[V(-10,8,-9),V(-10,8,9)];
 const lamps=receivers.map((p,i)=>ringDevice(w,p.toArray(),[0,0,i?-1:1],0xf0d69a,1.05));
 const optical={angle:Math.PI/4,velocity:0,segments:[],loaded:false,receivers:[false,false],update(dt){
  optical.loaded=pad.loaded()||pad.player();const target=optical.loaded?-Math.PI/4:Math.PI/4;
  // The load rotates a damped spring mirror; intermediate angles really scan
  // the walls rather than selecting a receiver by puzzle ID.
  optical.velocity+=((target-optical.angle)*28-optical.velocity*10)*dt;
  optical.angle+=optical.velocity*dt;pivot.rotation.y=-optical.angle;
  const normal=V(Math.cos(optical.angle),0,Math.sin(optical.angle));
  optical.segments=tracePortalRay(g,source,direction,{length:110,reflectors:[{position:mirror,normal,radius:1.25}],bounces:6});drawing.update(optical.segments);
  optical.receivers=receivers.map(p=>rayTouches(optical.segments,p,.9));
  north.powered=optical.receivers[0];south.powered=optical.receivers[1];
  lamps.forEach((l,i)=>l.glow.material.color.setHex(optical.receivers[i]?0xffedb3:0x605545));
 },reset(){optical.angle=Math.PI/4;optical.velocity=0;optical.loaded=false;optical.receivers=[false,false];}};
 k.ticks.push(dt=>optical.update(dt));k.resets.push(()=>optical.reset());k.state.optical=optical;return optical;
}
