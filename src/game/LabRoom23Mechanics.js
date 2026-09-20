import * as THREE from 'three';
import {cargoLoadsPlate} from './LabPlateContact.js';
/** Coupled counterweight cars, with one displacement and real load contact.
 * A three-kilogram freight load overcomes the spring return; the traveller
 * rides the service car. Brake clamps their common mechanical transmission. */
export function buildRoom23Balance(k){
 const {game:g,world:w}=k;
 const make=(name,x,y,z)=>{const group=new THREE.Group();group.position.set(x,y,z);w.root.add(group);const surface=k.panel(name,[0,.025,0],[0,1,0],6,7,group,true);
  const floor={minX:x-3,maxX:x+3,minZ:z-3.5,maxZ:z+3.5,y:y+.025,mesh:surface.mesh,enabled:true};g.floors.push(floor);w.floors.push(floor);
  w.box([0,-.3,0],[6,.5,7],w.materials.trim,false,group);const backing=g.colliders.find(c=>c.mesh===surface.backing);if(backing)backing.kinematic=true;
  return {group,surface,floor,backing,position:group.position,loaded:()=>cargoLoadsPlate(g.cargo,g.heldCube,surface.getFrame()),setY(y,dt){const old=floor.y,on=g.playerGrounded&&Math.abs(g.playerPosition.y-old)<.20&&g.playerPosition.x>floor.minX-.1&&g.playerPosition.x<floor.maxX+.1&&g.playerPosition.z>floor.minZ-.1&&g.playerPosition.z<floor.maxZ+.1;group.position.y=y;floor.y=y+.025;if(on){g.playerPosition.y+=floor.y-old;g.previousPlayerPosition.y+=floor.y-old;}group.updateWorldMatrix(true,true);for(const c of [surface.collider,backing].filter(Boolean)){c.box.setFromObject(c.mesh);g.physics?.updateStaticBox(c.mesh.uuid,c.box,dt);}}};};
 const west=make('west-load-car',-11,0,3),east=make('east-load-car',11,20,3);
 const system={west,east,height:0,velocity:0,braked:false,loaded:false,update(dt){
  const f=east.floor,p=g.playerPosition,heldOnEast=Boolean(g.heldCube)&&g.playerGrounded&&Math.abs(p.y-f.y)<.2&&p.x>f.minX&&p.x<f.maxX&&p.z>f.minZ&&p.z<f.maxZ;
  // Carried freight still weighs down its car: lifting it in place is no cheat.
  system.loaded=east.loaded()||heldOnEast;
  const target=system.loaded?10:0;
  if(system.braked)system.velocity=0;
  else {system.velocity+=THREE.MathUtils.clamp((target-system.height)*3-system.velocity*4,-3.5,3.5)*dt;system.velocity=THREE.MathUtils.clamp(system.velocity,-1.5,1.5);system.height=THREE.MathUtils.clamp(system.height+system.velocity*dt,0,10);if(Math.abs(target-system.height)<.004&&Math.abs(system.velocity)<.02){system.height=target;system.velocity=0;}}
  west.setY(system.height,dt);east.setY(20-system.height,dt);
 },reset(){system.height=system.velocity=0;system.braked=system.loaded=false;west.setY(0,0);east.setY(20,0);}};
 k.ticks.push(dt=>system.update(dt));k.resets.push(()=>system.reset());k.state.balance=system;
 for(const x of [-14.35,-7.65,7.65,14.35])w.box([x,10,6.9],[.18,21,.18],w.materials.trim,false);
 w.box([0,22,6.9],[29,.3,.3],w.materials.trim,false);
 return system;
}
