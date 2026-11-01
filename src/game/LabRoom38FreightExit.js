import * as THREE from 'three';
import {movingMechanismBlock} from './LabLateCampaignMechanisms.js';

/** The tread reads the same original free body's present upward narrowphase
 * contact with this carrier's own deck. A nearby, airborne or hand-supported
 * companion cannot engage the motor. This does not alter any transit rule. */
export function readRoom38FreightLoad(game,freight){
 const physics=game.physics,body=physics?.cargoBody,solid=physics?.solids.get(freight.floor.mesh.uuid);
 const empty={normalForce:0,contacts:0,worldStep:physics?.world.stepnumber??-1};
 if(!body||physics.carryTarget||!solid?.inWorld||body.world!==physics.world||solid.body.world!==physics.world
  ||body.collisionResponse===false||solid.body.collisionResponse===false||!solid.body.collisionFilterMask)return empty;
 const shape=body.shapes[0],deckShape=solid.body.shapes[0];
 if(!shape||!deckShape||shape.collisionResponse===false||deckShape.collisionResponse===false)return empty;
 if(!(body.collisionFilterGroup&solid.body.collisionFilterMask)||!(solid.body.collisionFilterGroup&body.collisionFilterMask)
  ||!(shape.collisionFilterGroup&deckShape.collisionFilterMask)||!(deckShape.collisionFilterGroup&shape.collisionFilterMask))return empty;
 // A just-picked-up body can leave last step's contacts in the list. Retain
 // only a contact whose original shape is still supported by this deck now.
 const q=body.quaternion,h=shape.halfExtents;
 if(!h)return empty;
 const inverse=new THREE.Quaternion(q.x,q.y,q.z,q.w).invert(),up=new THREE.Vector3(0,1,0).applyQuaternion(inverse);
 const halfY=Math.abs(up.x)*h.x+Math.abs(up.y)*h.y+Math.abs(up.z)*h.z;
 if(Math.abs(body.position.y-halfY-freight.floor.y)>.07)return empty;
 const projectedHalf=axis=>{axis.applyQuaternion(inverse);return Math.abs(axis.x)*h.x+Math.abs(axis.y)*h.y+Math.abs(axis.z)*h.z;};
 if(Math.abs(body.position.x-solid.body.position.x)>deckShape.halfExtents.x+projectedHalf(new THREE.Vector3(1,0,0))+.025
  ||Math.abs(body.position.z-solid.body.position.z)>deckShape.halfExtents.z+projectedHalf(new THREE.Vector3(0,0,1))+.025)return empty;
 let normalForce=0,contacts=0;
 for(const c of physics.world.contacts){
  if(c.enabled===false||!(c.multiplier>1e-6)||![c.bi,c.bj].includes(body)||![c.bi,c.bj].includes(solid.body)
   ||![c.si,c.sj].includes(shape)||![c.si,c.sj].includes(deckShape))continue;
  const ny=(c.bi===body?-1:1)*c.ni.y;
  if(ny>.65){normalForce+=ny*c.multiplier;contacts++;}
 }
 return {normalForce,contacts,worldStep:physics.world.stepnumber,
  cargoBodyId:body.id,cargoShapeId:shape.id,deckBodyId:solid.body.id,deckShapeId:deckShape.id};
}

/** A loaded freight tread couples the existing self-locking motor. At the
 * upper dock, its actual carriage height moves a visible continuous cam and
 * the final bay's collision leaf. Neither coupling nor door remembers an
 * arrival, and the ordinary joint goal remains purely spatial. */
export function installRoom38FreightExit(k,freight){
 const game=k.game,bay={minX:5,maxX:17,minZ:6,maxZ:14,floor:15,roof:28.8};
 const deck=k.deck('Final freight docking hall',bay.minX,bay.maxX,bay.minZ,bay.maxZ,bay.floor);
 const parts=[],fixedColliders=[],fixed=(name,p,size,material='shell')=>{
  const mesh=k.block(p,size,material),collider=k.game.colliders.at(-1);
  mesh.name='38 / '+name;collider.mesh.name=mesh.name+' / collision';parts.push(mesh);fixedColliders.push(collider);return mesh;
 };
 // The full upper enclosure cannot be entered by steering a carried gravity
 // flight around its door or landing on a roof below the room's ceiling.
 for(const x of [bay.minX,bay.maxX])fixed('sealed exit side',[x,21.6,10],[.4,13.6,8.4]);
 fixed('sealed exit rear',[11,21.6,14.2],[12.4,13.6,.4]);
 fixed('sealed exit roof',[11,28.6,10],[12.4,.4,8.4],'dark');
 for(const [x,width]of [[6.5,3],[15.5,3]])fixed('front door pier',[x,21.6,6.6],[width,13.6,.5]);
 fixed('front door lintel',[11,23.75,6.6],[6,10.5,.5],'dark');
 // Tall guide posts are founded on the existing service floor, clear of
 // the carrier's true rear-edge footprint x5..17 / z-6..+6.
 for(const x of [4.65,17.35])for(const z of [-6.35,6.35]){
  fixed('founded hoist guide',[x,7.5,z],[.35,23,.42],'metal');
  fixed('guide foot',[x,-3.7,z],[.9,.6,1.0],'dark');
 }
 const leaf=movingMechanismBlock(k,'38 / dock-driven final leaf',[11,16.85,6.1],[6.2,3.7,.28]);
 const collider=game.collisionProxy(new THREE.Box3().setFromObject(leaf),{kinematic:true});
 collider.mesh.name='38 / dock-driven final leaf / collision';
 for(const x of [7.7,14.3])fixed('external leaf guide',[x,19.2,6.05],[.2,8.5,.5],'metal');
 const follower=movingMechanismBlock(k,'38 / carriage cam follower',[17.55,1.5,6.35],[.55,1.3,.55],'metal');
 const followerCollider=game.collisionProxy(new THREE.Box3().setFromObject(follower),{kinematic:true});
 followerCollider.mesh.name='38 / carriage cam follower / collision';
 fixed('dock cam housing',[17.55,17.1,6.35],[.9,3.0,.9],'dark');
 const rack=movingMechanismBlock(k,'38 / continuous door lifting rack',[15.6,18.0,6.05],[2.6,.18,.22],'metal');
 const gear=k.geometry(new THREE.TorusGeometry(.48,.13,8,24),'metal',[17.45,17.9,5.8],new THREE.Quaternion(),{batch:false,name:'38 / visible docking cam'});
 const treadLink=movingMechanismBlock(k,'38 / deck pressure coupling link',[17.35,-.65,0],[.16,.65,.22],'metal');
 const motor={contact:{normalForce:0,contacts:0,worldStep:-1},engaged:false,stroke:0,
  read(){return readRoom38FreightLoad(game,freight);},
  requestLift(){
   // An empty call cannot remain queued while its operator boards the lower
   // car and later releases a carried body. The same current loaded tread
   // mechanically connects the hand selector to the motor at this instant.
   const contact=this.read();
   if(!contact.contacts||contact.normalForce<=8)return false;
   freight.target=1;return true;
  },
  update(){
   this.contact=this.read();this.engaged=this.contact.contacts>0&&this.contact.normalForce>8;
   const rising=freight.stations[freight.target].y>freight.position.y+.00001;
   freight.braked=rising&&!this.engaged;freight.speed=3;
   // Awake support is needed only while its existing positive load contact
   // is being measured. It supplies no pose, velocity, force or fake weight.
   if(this.engaged)game.physics.cargoBody.wakeUp();
  },
  sync(dt=0){
   this.stroke=THREE.MathUtils.clamp((freight.position.y-13.5)/1.5,0,1);
   leaf.position.y=16.85+4.4*this.stroke;leaf.updateWorldMatrix(true,false);
   game.syncCollision(collider,new THREE.Box3().setFromObject(leaf),dt);
   follower.position.y=freight.position.y+1.5;follower.updateWorldMatrix(true,false);
   game.syncCollision(followerCollider,new THREE.Box3().setFromObject(follower),dt);
   rack.position.y=18+4.4*this.stroke;gear.rotation.z=-1.2*this.stroke;
   treadLink.position.y=freight.position.y-.65-Math.min(.06,this.contact.normalForce/1200);
  },
  reset(){this.contact={normalForce:0,contacts:0,worldStep:-1};this.engaged=false;freight.braked=false;this.sync(0);},
 };
 // The existing support-aware companion behavior waits naturally on its
 // actual loaded car. It remains the original free dynamic body throughout.
 freight.loaded=()=>motor.contact.worldStep===game.physics?.world.stepnumber&&motor.contact.contacts>0&&motor.contact.normalForce>8;
 k.ticks.unshift(()=>motor.update());
 k.ticks.push(dt=>motor.sync(dt));k.resets.push(()=>motor.reset());
 motor.sync(0);k.state.freightDock=motor;
 k.label('ГРУЗ ВКЛЮЧАЕТ ПРИВОД / ПРИЧАЛ ОТВОДИТ СТВОРКУ',[11,20,5.72],[0,0,-1],12,.65);
 k.label('СВОБОДНЫЙ ГРУЗ / НАСТОЯЩИЙ НАЖИМ НА НАСТИЛ',[11,3.4,6.15],[0,0,1],10,.55);
 return {bay,deck,parts,fixedColliders,leaf,collider,follower,followerCollider,motor};
}
