import * as THREE from 'three';
import {V,clamp} from './LabSingularityKit.js';

const TEETH=4,STROKE=1.6,BOLT_HEIGHT=2.7;
/** Constrained powered rack with four physical retaining notches. This is a
 * kinematic ratchet model, not a Cannon motor/contact solver. Power loss lets
 * the spring return only as far as the last tooth passed by the pawl. */
export function createArchiveRatchet(){
 let position=0,stop=0,power=0;
 return{
  get position(){return position;},get stop(){return stop;},get power(){return power;},
  update(input,dt){
   power=clamp(Number.isFinite(input)?input:0,0,1);
   if(!(dt>0))return;
   const next=clamp(position+(power>0?.65*power:-.4)*dt,stop,1);
   stop=Math.max(stop,Math.floor((next+1e-9)*TEETH)/TEETH);
   position=Math.max(stop,next);
  },
  reset(){position=stop=power=0;},
  snapshot(){return{position,retainingNotch:stop,power};},
 };
}

/** Two source-driven bolts retain a common door yoke. Achievements never feed
 * the linkage. Fixed pipes/cable follow founded castle ribs; the racks, pawls,
 * tooth positions and door shoes display the very state which opens the door. */
export function buildCastleArchiveMemory({k,rooms,machines,gate}){
 const r=rooms.get('archive'),m=k.m,[x,y,z]=r.door;
 const drives={hydraulic:createArchiveRatchet(),optical:createArchiveRatchet()};
 const assemblies=[],solids=[],sources=[];
 const solid=(p,size,material,name,dynamic=false)=>{
  const mesh=k.box(p,size,material,{dynamic});mesh.name='Archive physical memory / '+name;
  solids.push(mesh.userData.collider);return mesh;
 };
 // The header is mounted to the existing east wall piers. New hardware is
 // above capsule head height and outside the original 6.8 m entry opening.
 solid([x+.35,y+7.8,z],[.6,.3,12],m.steel,'founded common header');
 for(const sign of [-1,1]){
  solid([x+.05,y+7.8,z+sign*5.7],[1.2,.55,.65],m.copper,'wall-pier header shoe');
  for(const dz of [-.34,.34])solid([x+.4,y+6.2,z+sign*5.2+dz],[.30,2.9,.16],m.steel,'open rack guide');
 }
 const teeth=new THREE.InstancedMesh(k.cube,m.copper,TEETH*2);teeth.name='Archive physical memory / moving retaining teeth';
 teeth.castShadow=true;teeth.receiveShadow=true;k.root.add(teeth);k.batches.push(teeth);
 const matrix=new THREE.Matrix4(),quaternion=new THREE.Quaternion();
 for(const [i,key]of ['optical','hydraulic'].entries()){
  const sign=i?1:-1,az=z+sign*5.2,drive=drives[key],base=y+3.1;
  const bolt=solid([x+.4,base+BOLT_HEIGHT/2,az],[.22,BOLT_HEIGHT,.22],m.copper,key+' lock rack',true);
  const shoe=solid([x+.41,y+4.45,z+sign*3.4],[.28,.28,3.6],m.steel,key+' door-yoke arm',true);
  const connector=k.mesh(k.round,m.copper,[x+.17,y+4.45,z+sign*2],[.4,.14,.2],{dynamic:true});
  connector.name='Archive physical memory / '+key+' leaf shoe pin';
  const pawlGeometry=k.geo(k.round.clone().translate(-.11/.45,0,0));
  const pawl=k.mesh(pawlGeometry,m.rose,[x+.82,y+6,az],[.45,.14,.24],{dynamic:true});
  pawl.name='Archive physical memory / '+key+' retaining pawl';
  solid([x+.82,y+6,az],[.15,.4,.8],m.steel,key+' founded pawl pivot');
  solid([x+.61,y+6,az+.34],[.57,.18,.16],m.steel,key+' guide-mounted hinge outrigger');
  assemblies.push({key,sign,drive,bolt,shoe,connector,pawl,base,az});
 }
 function pipe(points,material,name,radius=.065){
  for(let i=1;i<points.length;i++){
   const a=V(...points[i-1]),b=V(...points[i]),delta=b.clone().sub(a);
   const tube=k.drum(a.clone().add(b).multiplyScalar(.5).toArray(),radius,delta.length(),material,{solid:false});
   tube.quaternion.setFromUnitVectors(V(0,1,0),delta.normalize());tube.name='Archive physical memory / '+name;
  }
 }
 const s=rooms.get('sluice'),o=rooms.get('optics');
 // Small conduits are fittings, not extra decks or actor-sized obstacles.
 // Their vertical runs meet the same founded atrium ribs used by the castle.
 pipe([s.P(0,-6.94,.6),s.P(0,-6.94,12),[19,12,32.06],[19,12,10],[19,y+7.45,10],[-19,y+7.45,10],[-19,y+7.45,z+5.2],[x+.35,y+7.45,z+5.2]],m.mint,'hydraulic pressure line');
 pipe([o.P(1.15,-12,2.4),o.P(1.15,-12,12),[-19,12,-53],[-19,12,-10],[-19,y+7.1,-10],[-19,y+7.1,z-5.2],[x+.35,y+7.1,z-5.2]],m.cyan,'receiver motor cable',.045);
 for(const [cx,cz,top]of [[19,10,y+7.45],[-19,10,y+7.45],[-19,-10,y+7.1]]){
  solid([cx,top,cz],[1.45,.24,1.45],m.copper,'founded rib conduit clamp');
 }
 // The live source connection is mounted on the existing optical receiver.
 const coil=k.drum(o.P(1.15,-12,2.4),.23,.16,m.copper,{dynamic:true});
 coil.quaternion.setFromUnitVectors(V(0,1,0),V(0,0,1));coil.name='Archive physical memory / receiver motor winding';
 sources.push(coil);
 const input=()=>{
  const water=machines.get('sluice').state,light=machines.get('optics').state;
  const equal=!water.flowing&&Math.abs(water.volumes[0]-5)<.01&&Math.abs(water.volumes[1]-5)<.01&&water.volumes[2]<.01;
  return{hydraulic:equal?clamp((water.height+5)/5,0,1):0,optical:light.beamPowered?1:0};
 };
 const clearance=()=>assemblies.map(a=>a.bolt.position.y-BOLT_HEIGHT/2-(a.shoe.position.y+a.shoe.scale.y/2));
 const released=()=>clearance().every(gap=>gap>.025);
 function update(dt){
  const power=input();for(const [key,drive]of Object.entries(drives))drive.update(power[key],dt);
  for(const [index,a]of assemblies.entries()){
   const lift=a.drive.position*STROKE;
   k.move(a.bolt,[x+.4,a.base+BOLT_HEIGHT/2+lift,a.az],dt);
   // A tooth lifts the sprung pawl during forward travel; its shoulder is
   // captured at exactly the same four notch heights used by the model.
   const phase=(a.drive.position*TEETH)%1;
   a.pawl.rotation.z=phase>.3?-1.3*Math.min(1,(phase-.3)/.35):0;
   for(let tooth=0;tooth<TEETH;tooth++){
    matrix.compose(V(x+.56,y+4.54+tooth*.4+lift,a.az),quaternion,V(.16,.14,.23));
    teeth.setMatrixAt(index*TEETH+tooth,matrix);
   }
  }
  teeth.instanceMatrix.needsUpdate=true;teeth.computeBoundingSphere();
  coil.material=power.optical?m.live:m.copper;
 }
 function syncDoorYoke(dt){for(const a of assemblies){k.move(a.shoe,[x+.41,y+4.45,z+a.sign*(3.4+3.5*gate.progress)],dt);k.move(a.connector,[x+.17,y+4.45,z+a.sign*(2+3.5*gate.progress)],dt);}}
 function reset(){Object.values(drives).forEach(d=>d.reset());update(0);syncDoorYoke(0);}
 function label(){const names={hydraulic:'НАПОР',optical:'ЛУЧ'};return Object.entries(drives).map(([key,d])=>`${names[key]}: ${d.stop===1?'УЛОВИТЕЛЬ ДЕРЖИТ':d.power>0?'ПОДНИМАЕТ РЕЙКУ':'ЗАПОР ЗАКРЫТ'}`).join('   +   ');}
 update(0);
 return{update,syncDoorYoke,reset,released,label,solids,assemblies,teeth,sources,diagnostics:()=>({model:'powered four-tooth rack and return spring; constrained kinematic ratchet',inputs:input(),hydraulic:drives.hydraulic.snapshot(),optical:drives.optical.snapshot(),boltClearance:clearance(),released:released(),gateProgress:gate.progress,readsAchievements:false,checkpoint:false})};
}
