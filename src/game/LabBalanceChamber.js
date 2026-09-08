import * as THREE from 'three';
import {LabTileWorld} from './LabTileWorld.js';
import {buildBalanceRig, BALANCE_RIG_LAYOUT as L} from './LabBalanceRig.js';
import {cargoLoadsPlate} from './LabPlateContact.js';
import {V,consoleNode,terminalAccessible,glass} from './LabPuzzleMechanics.js';

/** A load steers a portal, rather than unlocking an invisible completion flag.
 * Gravity supplies all launch energy. The receiving balcony is reached in
 * free flight; the same friend can then be transferred out of the load tray. */
export function buildBalanceChamber(game,spec){
 const world=new LabTileWorld(game,{wall:0x52616a,floor:0x75838a,accent:0x99cfbb,sky:0x637681});
 world.materials.wall.color.setHex(0x52616a);world.materials.floor.color.setHex(0x75838a);world.materials.trim.color.setHex(0x30434d);
 const bounds={minX:-18.5,maxX:14,minZ:-18.5,maxZ:19},spawn=[8,0,12.5],cargoSpawn=[6,.55,11.5];
 const panels={},terminals=[],fixtures=[],state={angle:0,previousAngle:0,omega:0,torque:0,counterIndex:2,counterZ:-1.2};
 world.walls(bounds,16);world.floor(-18.5,14,-18.5,19);
 const patch=(name,p,n,w,h,parent=world.root,moving=false)=>(panels[name]=world.patch(name,p,n,w,h,parent,moving));
 // Treads are ordered in positive Z and have positive tile dimensions. Each
 // riser has one recessed backing; there are no coplanar stair foundations.
 function stairs(x0,x1,front,back,high){
  const count=Math.ceil(high/.28),depth=(front-back)/count;
  for(let i=0;i<count;i++){
   const z1=front-i*depth,z0=z1-depth,y=high*(i+1)/count;
   world.floor(x0,x1,z0,z1,y);
   world.box([(x0+x1)/2,(y-.12)/2,(z0+z1)/2],[x1-x0,Math.max(.025,y-.12),depth-.02],world.materials.trim);
  }
 }
 stairs(6.5,9.7,11,5.5,3.3);world.floor(1.8,9.7,3.5,5.5,3.3);
 for(const x of [3.1,8.9])world.box([x,1.55,4.7],[.22,3.1,.22]);
 world.box([5.75,3.15,4.7],[7.9,.16,.25]);
 // The fall tower is a visible, enclosed structure. Its high stair cannot
 // serve as a direct jumping platform to the receiving balcony.
 const tower={minX:-18,maxX:-9.3,minZ:-17.8,maxZ:6.8,height:14.5};state.tower=tower;
 world.surface({name:'Fall tower west wall',position:[-18,7.25,-5.5],normal:[1,0,0],width:24.6,height:14.5});
 world.surface({name:'Fall tower back wall',position:[-13.65,7.25,-17.8],normal:[0,0,1],width:8.7,height:14.5});
 // Solid lower panels and framed glazing show the stairs from the chamber.
 world.box([-9.3,1.6,-5.5],[.24,3.2,24.6]);
 glass(world,[-9.3,8.85,-5.5],[.16,11.3,24.6]);
 for(const z of [-17.8,-11.65,-5.5,.65,6.8])world.box([-9.3,8.85,z],[.3,11.3,.15]);
 world.box([-13.65,8.85,6.8],[8.7,11.3,.24]);
 for(const x of [-17.55,-9.7])world.box([x,1.6,6.8],[.9,3.2,.24]);
 world.box([-13.65,14.58,-5.5],[8.7,.16,24.6]);
 stairs(-17.1,-13.9,5.5,-10.5,10);
 world.floor(-17.1,-9.9,-12.4,-10.5,10);
 for(const z of [-12.1,-10.8])world.box([-13.65,9.825,z],[8.7,.20,.22]);
 // Landing guardrails leave the well edge open, with a broad floor target.
 world.box([-17.2,10.7,-11.4],[.1,1.4,2]);
 world.box([-11.8,10.7,-10.45],[4,1.4,.10]);
 patch('balance-drop',[-11.7,.025,-14.8],[0,1,0],3.6,4.8);
 // Open receiving dock: its underside is opaque and physically solid, and
 // the front lip is well outside the unloaded rocker + jump envelope.
 world.floor(-3.4,3.4,7.3,14,8.2);
 for(const x of [-3.15,3.15])for(const z of [7.65,13.6])world.box([x,3.99,z],[.24,7.98,.24]);
 for(const z of [7.65,13.6])world.box([0,8.025,z],[6.8,.15,.26]);
 for(const x of [-3.45,3.45]){world.box([x,8.83,10.7],[.12,1.26,6.8]);world.box([x,9.49,10.7],[.16,.07,6.8],world.materials.accent,false);}
 world.box([0,8.83,14.05],[6.9,1.26,.12]);
 patch('lever-receiver',[0,8.225,11],[0,1,0],6,5);
 const goal=world.goal([0,8.225,11],[5.6,5]);
 const rig=buildBalanceRig(world.root);fixtures.push(rig);state.rig=rig;state.balanceArt=rig;state.bridge=rig.moving;state.mass=rig.counterweight;state.surfaceOffset=L.deckTop+.027;
 rig.fixedSupportBoxes.forEach(b=>game.collisionProxy(b));
 const moving=[],support=[];
 function movingBox(part,{walkable=false}={}){
  const mesh=world.box(part.center.toArray(),part.size.toArray(),world.materials.trim,true,rig.moving);mesh.visible=false;
  mesh.rotation.x=part.rotationX||0;mesh.userData.collisionProxy=true;
  const c=game.colliders.find(c=>c.mesh===mesh);c.kinematic=true;c.walkablePlane=walkable;
  moving.push({mesh,collider:c,part});return c;
 }
 for(const [i,part] of rig.deckSurfaces.entries()){
  const top=i<2?state.surfaceOffset:L.deckTop;
  const collisionPart=i<2?{...part,center:part.center.clone().add(V(0,(top-L.deckTop)/2,0)),size:part.size.clone().add(V(0,top-L.deckTop,0))}:part;
  const c=movingBox(collisionPart,{walkable:true});c.surfaceOffset=top;c.solidUnderside=true;support.push(c);
  const cx=part.center.x,cz=part.center.z,hw=part.size.x/2,hh=part.size.z/2;
  const f={minX:cx-hw,maxX:cx+hw,minZ:cz-hh,maxZ:cz+hh,y:2.25,mesh:c.mesh,enabled:true,
   heightAt(x,z){const a=state.angle,localZ=(z-top*Math.sin(a))/Math.cos(a);return Math.abs(x-cx)<=hw&&Math.abs(localZ-cz)<=hh?L.pivotHeight+top/Math.cos(a)-Math.tan(a)*z:null;},
   normalAt:()=>V(0,Math.cos(state.angle),Math.sin(state.angle))};
  game.floors.push(f);world.floors.push(f);c.floor=f;
  if(i<2){const p=patch(i===0?'balance-launch':'lever-load',[0,state.surfaceOffset,cz],[0,1,0],3.55,3.75,rig.moving,true);
   // One actual oriented deck body backs each aperture. The separate thin
   // tile proxy remains raycastable, without duplicating cargo contact.
   game.colliders=game.colliders.filter(x=>x!==p.collider);p.mesh.userData.portalColliderId=c.mesh.uuid;p.mesh.userData.portalBackingIds=[c.mesh.uuid];c.frontPlane=()=>p.getFrame();c.portalOwner=p.mesh;
   if(i===0)state.launch=p;else state.load=p;
  }
 }
 // Deck boxes already block their entire top. Keep collision for the narrow
 // central beam, rims and counterweight, without an AABB spanning the holes.
 for(const part of rig.movingCollisionParts){if(rig.deckSurfaces.includes(part))continue;
  if(part.size.z>8){
   movingBox({...part,center:V(0,part.center.y,0),size:V(part.size.x,part.size.y,.8)});
   for(const z of L.deckEnds)addBacking({center:V(0,part.center.y,z),size:V(part.size.x,part.size.y,3.55)},z);
   continue;
  }
  movingBox(part);
 }
 // Exact under-tray members also obstruct actors approaching from below.
 for(const z of L.deckEnds)for(const x of [-1.18,1.18])addBacking({center:V(x,-.25,z),size:V(.2,.34,3.84)},z);
 function addBacking(part,z){const owner=panels[z<0?'balance-launch':'lever-load'],c=movingBox(part,{walkable:true});c.solidUnderside=true;c.frontPlane=()=>owner.getFrame();c.portalOwner=owner.mesh;owner.mesh.userData.portalBackingIds.push(c.mesh.uuid);return c;}
 // The narrow spine has its own top plane, without advertising empty sides.
 support[2].frontPlane=()=>topFrame(support[2]);
 state.collider=support[0];state.support=support;
 const counterPositions=[-2.8,-2,-1.2],inertia=100,spring=190,damping=60;
 consoleNode(world,terminals,[4.8,3.3,4.3],()=>{state.counterIndex=(state.counterIndex+1)%3;game.audio?.mechanism?.('switch');},'balance','E — передвинуть противовес. Чем длиннее его плечо, тем сильнее он опускает пустой конец.');
 function topFrame(c){const f=c.floor,part=moving.find(x=>x.collider===c).part;return{center:rig.moving.localToWorld(V(part.center.x,c.surfaceOffset,part.center.z)),normal:V(0,Math.cos(state.angle),Math.sin(state.angle)),right:V(1,0,0),up:V(0,-Math.sin(state.angle),Math.cos(state.angle)),halfWidth:part.size.x/2,halfHeight:part.size.z/2};}
 function cargoContact(){if(!game.cargo||game.heldCube)return null;for(const c of support){const f=topFrame(c),r=game.cargo.position.clone().sub(rig.root.position),v=V(0,-state.omega*r.z,state.omega*r.y);if(cargoLoadsPlate({...game.cargo,velocity:game.cargo.velocity.clone().sub(v)},false,f))return f;}return null;}
 function pose(angle,dt=0){rig.setAngle(angle);rig.setCounterweight(state.counterZ);rig.root.updateWorldMatrix(true,true);
  for(const m of moving){if(m.part.dynamicCenter)m.mesh.position.copy(m.part.center);m.mesh.updateWorldMatrix(true,false);m.collider.box.setFromObject(m.mesh);
   if(m.collider.floor){m.collider.floor.minZ=m.collider.box.min.z-.02;m.collider.floor.maxZ=m.collider.box.max.z+.02;}
   const item=game.physics?.solids.get(m.mesh.uuid);if(!item)continue;
   const p=m.mesh.getWorldPosition(V()),q=m.mesh.getWorldQuaternion(new THREE.Quaternion());
   if(dt>0){item.target.copy(p);item.remaining=dt;item.body.angularVelocity.set((angle-state.previousAngle)/dt,0,0);}
   else{item.body.position.copy(p);item.body.quaternion.copy(q);item.body.velocity.setZero();item.body.angularVelocity.setZero();item.target.copy(p);item.remaining=0;}
   item.body.aabbNeedsUpdate=true;
  }
  if(game.physics)game.physics.world.broadphase.dirty=true;
 }
 function update(dt){pose(state.angle);state.previousAngle=state.angle;
  const floor=support.find(c=>{const y=c.floor.heightAt(game.playerPosition.x,game.playerPosition.z);return y!==null&&game.playerGrounded&&Math.abs(game.playerPosition.y-y)<.24;})?.floor;
  const py=floor?.heightAt(game.playerPosition.x,game.playerPosition.z),aboard=!!floor,travellerMass=3.2+(game.heldCube?(game.physics?.cargoBody?.mass||3.2):0),vy=game.playerVelocity.y;
  const localZ=rig.moving.worldToLocal(game.playerPosition.clone()).z;
  if(dt>0&&state.lastPlayerContact!==undefined){
   if(state.lastPlayerContact&&!aboard&&vy>1)state.omega+=(state.lastPlayerMass||travellerMass)*(vy-Math.min(0,state.lastPlayerVy||0))*state.lastPlayerZ/inertia;
   else if(!state.lastPlayerContact&&aboard&&(state.lastPlayerVy||0)<-.2)state.omega+=travellerMass*(-state.lastPlayerVy)*localZ/inertia;
  }
  state.lastPlayerContact=aboard;state.lastPlayerVy=vy;state.lastPlayerZ=localZ;state.lastPlayerMass=travellerMass;
  state.counterZ=THREE.MathUtils.damp(state.counterZ,counterPositions[state.counterIndex],2.4,dt);
  const loaded=!!cargoContact(),cargoMoment=loaded?(game.physics?.cargoBody?.mass||3.2)*rig.moving.worldToLocal(game.cargo.position.clone()).z:0;
  state.loaded=loaded;state.torque=19.5*Math.cos(state.angle)*(L.counterweight.mass*state.counterZ+cargoMoment+(aboard?travellerMass*localZ:0));
  state.omega+=(state.torque-spring*state.angle-damping*state.omega)/inertia*dt;
  state.angle+=state.omega*dt;
  if(Math.abs(state.angle)>L.maxAngle){state.angle=THREE.MathUtils.clamp(state.angle,-L.maxAngle,L.maxAngle);if(Math.sign(state.omega)===Math.sign(state.angle))state.omega*=-.10;}
  pose(state.angle,dt);
  if(aboard&&dt){const y=floor.heightAt(game.playerPosition.x,game.playerPosition.z);if(y!==null){game.playerPosition.y+=y-py;game.previousPlayerPosition.y+=y-py;}}
 }
 const near=()=>terminals.filter(t=>terminalAccessible(game,t)).sort((a,b)=>a.position.distanceToSquared(game.playerPosition)-b.position.distanceToSquared(game.playerPosition))[0];
 world.root.userData.distinctConcept=spec.concept;
 return{id:spec.id,index:6,title:`7 / ${spec.title}`,bounds,spawn,cargoSpawn,goal,world,structure:world.root,panels,terminals,state,fixtures,pads:[],gates:[],floors:world.floors,bridges:[],lift:null,receiverPanel:null,launchPad:null,momentum:true,hints:spec.hints,
  update,reset(){Object.assign(state,{angle:0,previousAngle:0,omega:0,torque:0,counterIndex:2,counterZ:-1.2,lastPlayerContact:undefined,lastPlayerVy:0,lastPlayerZ:0,lastPlayerMass:0});pose(0);},
  renderUpdate(a=1){rig.setAngle(THREE.MathUtils.lerp(state.previousAngle,state.angle,a));rig.setCounterweight(state.counterZ);},
  interact(){const t=near();if(!t)return false;t.action();game.companionAnimator?.trigger?.('curiosity');return true;},nearbyInteraction(){const t=near();return t?{kind:t.kind,label:'E',text:t.lesson}:null;},
  cargoOnAnyPad:()=>!!cargoContact(),getLaunch:()=>null,getObjective:()=>spec.description,
  isWon:()=>game.playerGrounded&&goal.contains(game.playerPosition)&&!!game.cargo&&goal.contains(game.cargo.position)&&game.playerPosition.distanceTo(game.cargo.position)<3.3,
  diagnostics:()=>({level:7,id:spec.id,concept:spec.concept,uniqueTopology:true,noCheckpoints:true,portalSurfaces:game.portalPanels.length,goal:goal.position.toArray(),angle:state.angle,omega:state.omega,torque:state.torque,counterZ:state.counterZ,loaded:state.loaded})};
}
