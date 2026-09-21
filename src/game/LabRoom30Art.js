import * as THREE from 'three';
import {SolidAssembly,createGuideRing,createPlanter,createSolarObservatory,placeSolidModel} from './LabSolidModels.js';
const V=(...p)=>new THREE.Vector3(...p),Q=()=>new THREE.Quaternion();

/** Manufactured launch structures. The segmented collars are solid at their
 * rims, open in their centres and synchronized with the actual outlet pose. */
export function buildRoom30Art(level){
 const {world,flightGeometry:f,state,workshop:k}=level;
 const root=new THREE.Group();root.name='Sunward launch park landmarks';root.userData.keepMaterial=true;world.root.add(root);
 const steel=new SolidAssembly('Launch park trusses and tower fins','launch');
 for(const floor of world.floors){if(floor.y<20||!floor.mesh)continue;const {minX,maxX,minZ,maxZ,y}=floor;
  // Real broad soffits replace thin floating edge strips. The walking plane is unchanged.
  steel.box([(minX+maxX)/2,y-.42,(minZ+maxZ)/2],[maxX-minX,.64,maxZ-minZ],1,.08);
  if(maxX-minX>20&&maxZ-minZ>20)for(const x of [minX+3,maxX-3])for(const z of [minZ+3,maxZ-3]){
   steel.box([x,y/2-.6,z],[.82,y-1.2,.82],1,.08);
   steel.box([x,.3,z],[1.7,.6,1.7],1,.08);
   steel.beam([x,y-12,z],[x+(x<(minX+maxX)/2?5:-5),y-.7,z],.21,1);
  }
 }
 placeSolidModel(k,createSolarObservatory(),[-1,65.6,7],{parent:root});
 for(const p of [[-21,56,-6],[19,56,8]])placeSolidModel(k,createPlanter('launch'),p,{parent:root,scale:1.4});
 const horizontal=Q().setFromAxisAngle(V(1,0,0),-Math.PI/2);
 for(const well of f.wells){const c=well.panel.getFrame().center;
  for(let y=c.y+4;y<well.top;y+=7)placeSolidModel(k,createGuideRing(5.7,'lagoon',.19,.28),[c.x,y,c.z],{parent:root,quaternion:horizontal});
  for(const dx of [-6.5,6.5])steel.beam([c.x+dx,c.y-1,c.z+3],[c.x+dx,well.top+1,c.z+3],.22,0);
 }
 const paths=[],clearances=[];
 const posePath=path=>{
  const frame=path.panel.getFrame(),normal=frame.normal,speed=Math.sqrt(39*(path.drop+1.2));
  const vy=normal.y*speed,time=(vy+Math.sqrt(vy*vy+39*(frame.center.y-path.landingY)))/19.5;
  for(let i=0;i<path.rings.length;i++){
   const t=time*(i+1)/(path.rings.length+1),mesh=path.rings[i];
   mesh.position.copy(frame.center).addScaledVector(normal,speed*t).add(V(0,-9.75*t*t,0));
   mesh.quaternion.setFromUnitVectors(V(0,0,1),normal.clone().multiplyScalar(speed).add(V(0,-19.5*t,0)).normalize());
  }
 };
 for(const [name,panel,drop,landingY,style] of [['north',f.north,36,40,'launch'],['east',f.east,36,40,'lagoon'],['final',f.final,34,28,'launch']]){
  const path={name,panel,drop,landingY,rings:[],bindings:[]};
  for(let i=0;i<(name==='final'?8:6);i++){const model=createGuideRing(name==='final'?7:6,style);root.add(model);path.rings.push(model);}
  posePath(path);
  for(const model of path.rings){const position=model.position.toArray(),quaternion=model.quaternion.clone();path.bindings.push(placeSolidModel(k,model,position,{parent:root,quaternion,kinematic:name==='final'}));}
  // Receiver collars live in the same local frame as their physical panel.
  placeSolidModel(k,createGuideRing(7.5,style,.44,.65),[0,0,-1.3],{parent:panel.group,kinematic:name==='final'});
  paths.push(path);clearances.push({name,radius:name==='final'?6.6:5.6});
 }
 for(const x of [183,218]){
  steel.box([x,39,32],[2,22,3],0,.25);
  steel.box([x,50.4,32],[2.3,.6,3.3],2,.1);
 }
 steel.beam([183,49,32],[218,49,32],.58,1);
 placeSolidModel(k,createGuideRing(7,'launch',1.05,.95),[200,43,32],{parent:root});
 for(let i=0;i<12;i++){
  const t=i*Math.PI/6;steel.beam([200+Math.cos(t)*8.2,43+Math.sin(t)*8.2,32],[200+Math.cos(t)*9.5,43+Math.sin(t)*9.5,32],.20,2);
 }
 for(const [x,z] of [[-59,-65],[-57,53],[25,64],[112,63],[208,65],[224,-89]])placeSolidModel(k,createPlanter('launch'),[x,0,z],{parent:root,scale:2.5});
 placeSolidModel(k,steel.finish(),[0,0,0],{parent:root});
 const moving=(k.solidModels??[]).filter(b=>b.colliders[0]?.kinematic);
 const update=()=>{for(const path of paths)if(path.name==='final')posePath(path);};
 // The final outlet actuator has already run when this callback executes.
 // Decorative rings no longer move in render-only time with stale colliders.
 k.ticks.push(dt=>{update();for(const binding of moving)binding.sync(dt);});
 k.resets.push(()=>{update();for(const binding of moving)binding.sync(0,true);});
 update();level.launchArt={root,paths,clearances,update,drawCalls:root.children.length};return level.launchArt;
}
