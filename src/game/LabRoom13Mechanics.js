import * as THREE from 'three';
import {CounterweightDynamics} from './LabCounterweightDynamics.js';
import {cargoLoadsPlate} from './LabPlateContact.js';
import {V,tracePortalRay,rayTouches,beamDrawing,ringDevice} from './LabPuzzleMechanics.js';

/** A constrained drum hoist: one generalized coordinate, two opposite decks.
 * Contact loads drive it. Optics only release the two visible safety pawls.
 * The 7:5 drum radii explain both the mechanical advantage and unequal travel.
 */
export function counterweightHoist(k,{a=[-12,0,2],b=[9,19.6,2],travel=14,ratio=1.4}={}){
 const g=k.game,w=k.world,dynamics=new CounterweightDynamics({travel,ratio});
 const steel=new THREE.MeshStandardMaterial({color:0x41535e,roughness:.48,metalness:.65});
 const copper=new THREE.MeshStandardMaterial({color:0xc49a60,roughness:.42,metalness:.6});
 const brakeMat=new THREE.MeshStandardMaterial({color:0x9b6254,roughness:.7});
 const makeCar=(name,p,{portal=false,back=false}={})=>{
  const group=new THREE.Group();group.name=name;group.position.fromArray(p);w.root.add(group);
  const width=5,depth=5;
  const surface=portal?k.panel('mirror-cradle',[0,0,0],[0,1,0],width,depth,group,true)
   :w.surface({name,position:[0,0,0],normal:[0,1,0],width,height:depth,kind:'floor',parent:group,moving:true});
  const floor={minX:p[0]-2.5,maxX:p[0]+2.5,minZ:p[2]-2.5,maxZ:p[2]+2.5,y:p[1],mesh:surface.mesh,enabled:true};
  g.floors.push(floor);w.floors.push(floor);surface.floor=floor;
  w.box([0,-.32,0],[width,.44,depth],steel,false,group);
  for(const x of [-2.36,2.36])w.box([x,-.1,0],[.12,.2,depth],copper,false,group);
  const surfaces=[surface];
  // This return portal is a real panel on the cabin, not a checkpoint. It lets
  // a fallen traveller recover the height that was physically retained.
  if(back)surfaces.push(k.panel('passenger-return',[0,1.85,-2.46],[0,0,1],4.7,3.7,group,true));
  const colliders=surfaces.flatMap(s=>[s.collider,g.colliders.find(c=>c.mesh===s.backing)].filter(Boolean));
  if(portal){
   for(const [p,size] of [[[0,.55,2.39],[5,1.1,.18]],[[-2.39,.14,0],[.18,.28,5]],[[2.39,.14,0],[.18,.28,5]]]){
    const mesh=w.box(p,size,steel,true,group);const c=g.colliders.find(c=>c.mesh===mesh);if(c)colliders.push(c);
   }
  }
  for(const c of colliders)c.kinematic=true;
  const car={name,group,surface,floor,position:V(...p),velocity:0,previousY:p[1],progress:0,
   occupied(){const v=g.playerPosition;return g.playerGrounded&&Math.abs(v.y-floor.y)<.24&&v.x>floor.minX-.05&&v.x<floor.maxX+.05&&v.z>floor.minZ-.05&&v.z<floor.maxZ+.05;},
   loaded(){if(!g.cargo||g.heldCube)return false;return cargoLoadsPlate({...g.cargo,velocity:g.cargo.velocity.clone().sub(V(0,car.velocity,0))},null,surface.getFrame());},
   load(){const cargoMass=g.physics?.cargoBody?.mass??3.2;return (car.occupied()?3.2+(g.heldCube?cargoMass:0):0)+(car.loaded()?cargoMass:0);},
   sync(y,velocity,dt,{transport=true}={}){
    const old=floor.y;car.previousY=old;
    // Cannon deliberately sleeps resting cargo. A moving support must wake
    // its actual passenger before gravity/contact advances; otherwise a
    // sleeping body briefly hangs in the air and falsely unloads the mirror.
    if(dt&&Math.abs(y-old)>1e-8&&car.loaded())g.physics?.cargoBody?.wakeUp();
    if(transport&&dt&&car.occupied()){g.playerPosition.y+=y-old;g.previousPlayerPosition.y+=y-old;}
    group.position.y=y;floor.y=car.position.y=y;car.velocity=velocity;group.updateWorldMatrix(true,true);
    for(const c of colliders){c.box.setFromObject(c.mesh);if(g.physics?.solids.has(c.mesh.uuid))g.physics.updateStaticBox(c.mesh.uuid,c.box,dt);}
   },
   render(alpha){group.position.y=THREE.MathUtils.lerp(car.previousY,car.position.y,alpha);group.updateWorldMatrix(true,true);}
  };
  k.state[name]=car;return car;
 };
 const A=makeCar('passenger-car',a,{back:true}),B=makeCar('freight-car',b,{portal:true});
 const top=24.5;
 // Guides are complete visible rails, outside the useful deck footprint.
 for(const p of [a,b])for(const x of [-2.85,2.85])w.box([p[0]+x,top/2,p[2]+2.8],[.22,top,.26],steel);
 w.box([(a[0]+b[0])/2,top,a[2]+2.8],[b[0]-a[0]+6.1,.4,.6],steel);
 const axle=w.box([(a[0]+b[0])/2,top+.2,a[2]+2.8],[b[0]-a[0],.12,.12],copper,false);
 const drums=[];
 for(const [p,r] of [[a,.5],[b,.7]]){
  const group=new THREE.Group();group.position.set(p[0],top+.2,p[2]+2.8);w.root.add(group);
  const drum=new THREE.Mesh(new THREE.CylinderGeometry(r,r,.55,20),copper);drum.rotation.z=Math.PI/2;group.add(drum);
  for(let i=0;i<8;i++){const angle=i*Math.PI/4;w.box([0,Math.cos(angle)*r,Math.sin(angle)*r],[.6,.08,.08],steel,false,group);}
  drums.push(group);
 }
 const ropes=[a,b].map((p,i)=>w.box([p[0],top/2,p[2]+2.8+(i?.7:-.5)],[.055,top,.055],copper,false));
 const jaws=[-1,1].map(side=>w.box([a[0]+side*.7,top+.2,a[2]+2.8],[.16,1.15,.9],brakeMat.clone(),false));
 const rig={dynamics,A,B,loadA:0,loadB:0,optical:null,
  loaded:()=>A.loaded()||B.loaded(),
  update(dt){
   rig.loadA=A.load();rig.loadB=B.load();rig.optical?.update(dt,rig.loadB);
   dynamics.step(dt,{loadA:rig.loadA,loadB:rig.loadB,releaseUp:rig.optical?.receivers[1]??false,releaseDown:rig.optical?.receivers[0]??false});
   A.sync(a[1]+dynamics.heightA,dynamics.velocity,dt);B.sync(b[1]-ratio*dynamics.heightA,dynamics.speedB,dt);
   A.progress=dynamics.q/travel;B.progress=1-A.progress;
   for(let i=0;i<2;i++){
    const car=i?B:A,length=top+.2-car.position.y+.12;
    ropes[i].position.y=(top+.2+car.position.y)/2;ropes[i].scale.y=length/top;
    drums[i].rotation.x=dynamics.q/.5;
    const released=!!rig.optical?.receivers[i];jaws[i].position.x=a[0]+(i?1:-1)*(released?.62:.36);
    jaws[i].material.color.setHex(released?0x85c9ac:0xa06b55);
   }
  },
  reset(){dynamics.reset();A.sync(a[1],0,0,{transport:false});B.sync(b[1],0,0,{transport:false});rig.loadA=rig.loadB=0;rig.optical?.reset();},
  render(alpha){A.render(alpha);B.render(alpha);},
  diagnostics(){return {heightA:A.position.y,heightB:B.position.y,loadA:rig.loadA,loadB:rig.loadB,velocity:dynamics.velocity,braking:dynamics.braking,energy:dynamics.kineticEnergy,receiver:rig.optical?.receivers.slice()};}
 };
 k.state.counterweight=rig;k.ticks.push(dt=>rig.update(dt));k.resets.push(()=>rig.reset());k.renders.push(alpha=>rig.render(alpha));
 return rig;
}

/** Weight rotates the actual mirror plane. The traced ray, not a switch or
 * puzzle ID, determines which pawl is released. Intermediate angles hit walls. */
export function counterweightOptics(k,rig){
 const w=k.world,g=k.game,source=V(20,8,-16),direction=V(1,0,0),mirror=V(-18,8,-3);
 const drawing=beamDrawing(w,0xffdc98,.035);ringDevice(w,source.toArray(),direction.toArray(),0xffdc88,.48);
 const pivot=new THREE.Group();pivot.position.copy(mirror);w.root.add(pivot);
 w.box([0,0,0],[.11,2.3,2.25],new THREE.MeshStandardMaterial({color:0xa9d5d9,metalness:.93,roughness:.13}),false,pivot);
 w.box([-18,3.3,-3],[.35,6.6,.35],w.materials.trim);
 const receiverPositions=[V(-18,8,-11),V(-18,8,5)];
 const lamps=receiverPositions.map((p,i)=>ringDevice(w,p.toArray(),[0,0,i?-1:1],0xf0d69a,.95));
 const optical={mirror,source,angle:Math.PI/4,velocity:0,segments:[],loaded:false,receivers:[false,false],receiverPositions,
  update(dt,load){
   optical.loaded=load>2.9;const target=Math.PI/4-Math.PI/2*THREE.MathUtils.clamp(load/3.2,0,1);
   optical.velocity+=((target-optical.angle)*28-optical.velocity*10)*dt;optical.angle+=optical.velocity*dt;pivot.rotation.y=-optical.angle;
   const normal=V(Math.cos(optical.angle),0,Math.sin(optical.angle));
   optical.segments=tracePortalRay(g,source,direction,{length:140,reflectors:[{position:mirror,normal,radius:1.2}],bounces:6});drawing.update(optical.segments);
   optical.receivers=receiverPositions.map(p=>rayTouches(optical.segments,p,.75));
   lamps.forEach((lamp,i)=>lamp.glow.material.color.setHex(optical.receivers[i]?0xffedaf:0x65594b));
  },
  reset(){optical.angle=Math.PI/4;optical.velocity=0;optical.loaded=false;optical.receivers=[false,false];optical.segments=[];pivot.rotation.y=-optical.angle;drawing.update([]);}
 };
 rig.optical=optical;k.state.optical=optical;
 // Signal cables physically follow the wall/overhead cross-member.
 for(let i=0;i<2;i++)k.wire([receiverPositions[i].toArray(),[-21,8,receiverPositions[i].z],[-21,24.5,receiverPositions[i].z],[-21,24.5,4.8],[-12,24.5,4.8]],()=>optical.receivers[i]);
 return optical;
}
