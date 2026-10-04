import * as THREE from 'three';
import {cargoLoadsPlate} from './LabPlateContact.js';

/** Room-local counterweight. Either real cargo tray supports the moving stair;
 * no observer milestones, portal count or hidden success latch power it. */
export function createRoom14CounterweightStair(k,steps){
 const g=k.game,w=k.world,group=new THREE.Group();group.name='Two-tray counterweighted folded stair';w.root.add(group);
 const parts=[];
 for(const {surface,casing,baseY}of steps){
  group.attach(surface.group);group.attach(casing);
  const colliders=[surface.collider,g.colliderForMesh(surface.backing),g.colliderForMesh(casing)].filter(Boolean);
  for(const c of colliders)c.kinematic=true;
  parts.push({surface,casing,baseY,colliders});
 }
 const frame=(x,y,z,width,depth)=>({center:new THREE.Vector3(x,y,z),normal:new THREE.Vector3(0,1,0),right:new THREE.Vector3(1,0,0),up:new THREE.Vector3(0,0,1),halfWidth:width/2,halfHeight:depth/2});
 const island=frame(0,7.4,0,5.6,5.6),receiver=frame(3.75,12,-6.45,7.1,6.7);
 const stair={group,parts,island,receiver,offset:-7.2,previousOffset:-7.2,supported:false,source:null,
  loaded(){return cargoLoadsPlate(g.cargo,g.heldCube,island,g.physics.cargoSize/2)||cargoLoadsPlate(g.cargo,g.heldCube,receiver,g.physics.cargoSize/2);}};
 const strips=[];
 function tray(f){
  const x=f.center.x,z=f.center.z,y=f.center.y+.046,hw=f.halfWidth,hd=f.halfHeight;
  for(const [at,size]of [[[x-hw,y,z],[.065,.025,2*hd]],[[x+hw,y,z],[.065,.025,2*hd]],[[x,y,z-hd],[2*hw,.025,.065]],[[x,y,z+hd],[2*hw,.025,.065]]]){
   const m=w.box(at,size,w.materials.accent.clone(),false);m.name='Counterweight tray rim';strips.push(m);
  }
 }
 tray(island);tray(receiver);
 // Guide channels sit on the existing enclosing walls. Driven rods and the
 // cross-head belong to the stair chassis and descend with every tread.
 for(const x of [-2.94,-.06]){
  w.box([x,6.1,-6.15],[.065,11.8,.13],w.materials.trim,false).name='Counterweight vertical guide';
  w.box([x,10.45,-6.15],[.09,3.8,.16],w.materials.accent,false,group).name='Driven stair suspension rod';
 }
 w.box([-1.5,12.35,-6.15],[2.95,.18,.35],w.materials.trim,false,group).name='Counterweight stair cross-head';
 function setPose(offset){
  group.position.y=offset;group.updateWorldMatrix(true,true);
  for(const p of parts)p.surface.floor.y=p.baseY+stair.offset;
 }
 function step(dt){
  stair.previousOffset=stair.offset;
  const low=cargoLoadsPlate(g.cargo,g.heldCube,island,g.physics.cargoSize/2),high=cargoLoadsPlate(g.cargo,g.heldCube,receiver,g.physics.cargoSize/2);
  stair.supported=low||high;stair.source=low?'island':high?'receiver':null;
  const target=stair.supported?0:-7.2,rate=stair.supported?2.4:12;
  const next=THREE.MathUtils.clamp(target,stair.offset-rate*dt,stair.offset+rate*dt),delta=next-stair.offset;
  // Grounded passengers follow their actual moving tread exactly as on the
  // existing authored carriers; an airborne actor receives no correction.
  if(dt&&g.playerGrounded&&parts.some(p=>{const f=p.surface.floor;return Math.abs(g.playerPosition.y-f.y)<.18&&g.playerPosition.x>f.minX-.08&&g.playerPosition.x<f.maxX+.08&&g.playerPosition.z>f.minZ-.08&&g.playerPosition.z<f.maxZ+.08;})){
   g.playerPosition.y+=delta;g.previousPlayerPosition.y+=delta;
  }
  stair.offset=next;setPose(next);
  for(const p of parts)for(const c of p.colliders)g.syncCollision(c,new THREE.Box3().setFromObject(c.mesh),dt);
  for(const m of strips)m.material.color.setHex(stair.supported?0x83e0bd:0xbe885a);
 }
 k.ticks.push(step);k.renders.push(alpha=>setPose(THREE.MathUtils.lerp(stair.previousOffset,stair.offset,alpha)));
 k.resets.push(()=>{stair.offset=stair.previousOffset=-7.2;stair.supported=false;stair.source=null;setPose(-7.2);});
 k.state.counterweightStair=stair;setPose(-7.2);return stair;
}
