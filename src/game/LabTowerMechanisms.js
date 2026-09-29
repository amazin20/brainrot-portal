import * as THREE from 'three';
import {tracePortalRay} from './LabPuzzleMechanics.js';
import {towerPoint,towerCoordinates} from './LabTowerLayout.js';

const V=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z);
const UP=V(0,1,0);
const clamp=THREE.MathUtils.clamp;
const BEAM_COLOUR=0xffd99a;
const AIR_COLOUR=0x83e9eb;
const ON=0xa5ffd9;
const OFF=0x53656c;

/** A small optical target. The geometric receiver is distinct from its lamp:
 * the lamp only reports the result of the ray hitting the front of the disc. */
function receiver(group,position,normal,radius,color,owned){
 const assembly=new THREE.Group();assembly.position.copy(position);
 assembly.quaternion.setFromUnitVectors(V(0,0,1),normal);group.add(assembly);
 const rimGeometry=new THREE.TorusGeometry(radius,.075,8,28);
 const rim=new THREE.Mesh(rimGeometry,new THREE.MeshStandardMaterial({color:0xc4d6d6,metalness:.73,roughness:.25}));
 assembly.add(rim);owned.push(rim);
 const lensGeometry=new THREE.CircleGeometry(radius-.10,28);
 const lens=new THREE.Mesh(lensGeometry,new THREE.MeshStandardMaterial({color:0x365565,metalness:.56,roughness:.24,side:THREE.DoubleSide}));
 lens.position.z=.013;assembly.add(lens);owned.push(lens);
 const lightGeometry=new THREE.TorusGeometry(radius-.13,.026,6,28);
 const light=new THREE.Mesh(lightGeometry,new THREE.MeshBasicMaterial({color}));
 light.position.z=.054;assembly.add(light);owned.push(light);
 return {assembly,light,position,normal,radius,set(active){light.material.color.setHex(active?ON:color);}};
}

/** Unlike a closest-distance test, the incident segment must reach the front
 * face while pointing into the receiver. A ray behind the housing is dark. */
export function towerReceiverHit(segments,receiver){
 for(const segment of segments){
  const denominator=segment.direction.dot(receiver.normal);
  if(denominator>=-.35)continue;
  const along=receiver.position.clone().sub(segment.a).dot(receiver.normal)/denominator;
  if(along<-.025||along>segment.length+.025)continue;
  const impact=segment.a.clone().addScaledVector(segment.direction,along);
  if(impact.distanceTo(receiver.position)<receiver.radius)return true;
 }
 return false;
}

/** A ray segment mesh is updated in place. It is hidden when the beam stops,
 * including when its paired portal is moved out of the optical route. */
function tracedLine(group,colour,width,owned){
 const geometry=new THREE.CylinderGeometry(1,1,1,8);
 const material=new THREE.MeshBasicMaterial({color:colour,transparent:true,opacity:.8,depthWrite:false});
 const pieces=Array.from({length:8},()=>{const mesh=new THREE.Mesh(geometry,material);mesh.visible=false;group.add(mesh);return mesh;});
 owned.push({geometry,material});
 return {update(segments){pieces.forEach((mesh,i)=>{
  const segment=segments[i];mesh.visible=Boolean(segment&&segment.length>.02);
  if(!mesh.visible)return;
  mesh.position.copy(segment.a).add(segment.b).multiplyScalar(.5);
  mesh.scale.set(width,segment.length,width);
  mesh.quaternion.setFromUnitVectors(UP,segment.direction);
 });}};
}

/** Live machinery for one resident tower wing. All signals are measurements of
 * the production portal ray or original Cannon cargo body. Stage latches and
 * door ordering belong to LabTowerLevel; this module never advances a stage.
 * `box` registers its permanent housings with that stage's collision owner. */
export function createTowerMechanism({game,definition,group,box,materials}){
 const required=new Set(definition.puzzle.requirements),hasMirror=required.has('mirror');
 const isBalance=definition.id==='balance';
 const hasOptics=required.has('beamA')||required.has('beamB')||hasMirror;
 const hasAir=required.has('airA'),hasGravity=required.has('gravity');
 const direction=V(definition.direction[0],0,definition.direction[1]);
 const across=V(-definition.direction[1],0,definition.direction[0]);
 const position=(s,n,y=2.4)=>V(...towerPoint(definition,s,n,definition.baseY+y));
 const owned=[],drawables=new THREE.Group();drawables.name=`${definition.id} live machinery`;
 group.add(drawables);
 const solidBox=(point,size,material)=>box(point,size,material,{solid:true,camera:true,aim:true});
 const signals={beamA:false,beamB:false,airA:false,gravity:false,bridgeCatch:false};
 const input=position(8,-5.05),beamDirection=across.clone();
 const mirrorPosition=position(14,1.2);
 const mirrorNormalOn=across.clone().sub(direction).normalize();
 const mirrorNormalOff=across.clone().add(direction).normalize();
 const beamReceiverA=receiver(drawables,hasMirror?position(23,1.2):position(14,4.2),
  hasMirror?direction.clone().negate():across.clone().negate(),.79,OFF,owned);
 const beamReceiverB=receiver(drawables,position(20,4.2),across.clone().negate(),.79,OFF,owned);
 const turbinePosition=position(14,3.7,2.0);
 const turbine=receiver(drawables,turbinePosition,across.clone().negate(),.85,OFF,owned);
 const beam=hasOptics?tracedLine(drawables,BEAM_COLOUR,.032,owned):null;
 const air=hasAir?tracedLine(drawables,AIR_COLOUR,.045,owned):null;

 // Physical bases and stands occupy the sides of the corridor below the
 // optical plane. No invisible blocking collider is put across a portal ray.
 if(hasOptics||hasAir){
  solidBox(position(8,-5.05,.55).toArray(),[1.12,1.1,1.12],materials.dark);
  solidBox(position(8,-5.05,1.54).toArray(),[.30,.90,.30],materials.ivory);
 }
 if(hasOptics){
  solidBox(beamReceiverA.position.clone().addScaledVector(UP,-1.15).toArray(),[.28,1.2,.28],materials.dark);
  if(required.has('beamB'))solidBox(beamReceiverB.position.clone().addScaledVector(UP,-1.15).toArray(),[.28,1.2,.28],materials.dark);
 }
 if(hasAir)solidBox(turbinePosition.clone().addScaledVector(UP,-1.05).toArray(),[.30,1.3,.30],materials.dark);

 const projector=receiver(drawables,position(8,-5.05),across,hasAir?.53:.43,BEAM_COLOUR,owned);
 const airProjector=hasAir?receiver(drawables,position(8,-5.05,2.0),across,.31,AIR_COLOUR,owned):null;

 const mirror=hasMirror?new THREE.Group():null;
 let mirrorPlate,mirrorCollider;
 if(mirror){
  mirror.position.copy(mirrorPosition);drawables.add(mirror);
  const surface=new THREE.MeshStandardMaterial({color:0xe3f4e9,metalness:.88,roughness:.09,side:THREE.DoubleSide});
  owned.push(surface);
  mirrorPlate=box(mirrorPosition.toArray(),[1.42,1.5,.09],surface,
   {solid:true,camera:true,aim:true,kinematic:true});
  mirrorPlate.name=`${definition.id} moving solid mirror`;
  mirrorCollider=game.colliders.find(c=>c.mesh===mirrorPlate);
  if(mirrorCollider)mirrorCollider.ignorePropagation=true;
  const halo=new THREE.Mesh(new THREE.BoxGeometry(1.53,1.61,.035),new THREE.MeshBasicMaterial({color:0x8a7866}));
  halo.position.z=-.075;mirror.add(halo);owned.push(halo);
  solidBox(position(14,1.2,.7).toArray(),[.38,1.4,.38],materials.dark);
 }

 // The inlet cage has a solid back. Its propagation exception is specific to
 // rays; people and the physical companion cannot walk through the blades.
 const bladeRoot=new THREE.Group();turbine.assembly.add(bladeRoot);
 if(hasAir){
  for(let i=0;i<5;i++){
   const pivot=new THREE.Group();pivot.rotation.z=i*Math.PI*2/5;bladeRoot.add(pivot);
   const blade=new THREE.Mesh(new THREE.BoxGeometry(.23,.55,.065),
    new THREE.MeshStandardMaterial({color:0xa5c8cd,metalness:.56,roughness:.26}));
   blade.position.y=.34;pivot.add(blade);owned.push(blade);
  }
  const guardMaterial=new THREE.MeshStandardMaterial({color:0xb6e1e2,transparent:true,
   opacity:.16,depthWrite:false,metalness:.18,roughness:.31,side:THREE.DoubleSide});
  owned.push(guardMaterial);
  const guard=solidBox(position(14,4.18,2.0).toArray(),
   [Math.abs(direction.x)*1.63+Math.abs(across.x)*.14,1.63,Math.abs(direction.z)*1.63+Math.abs(across.z)*.14],
   guardMaterial);
  const collider=game.colliders.find(c=>c.mesh===guard);
  if(collider)collider.ignorePropagation=true;
 }

 const coilPosition=position(5.1,0,.55),upper=position(5.1,0,3.5);
 const coil=hasGravity?receiver(drawables,upper,V(0,-1,0),.92,OFF,owned):null;
 if(hasGravity){
  // Four separated pedestals form a legible load zone and leave its centre
  // open for the original cargo body's natural support and subsequent lift.
  for(const s of [-1,1])for(const n of [-1,1]){
   const p=position(5.1+s*1.70,n*1.70,.52);
   solidBox(p.toArray(),[.23,1.04,.23],materials.dark);
  }
  const race=new THREE.Mesh(new THREE.TorusGeometry(1.03,.065,8,36),
   new THREE.MeshBasicMaterial({color:0x68818a}));
  race.position.copy(coilPosition);race.rotation.x=Math.PI/2;drawables.add(race);owned.push(race);
 }

 let control=false,mirrorAngle=0,turbineOmega=0,turbineAngle=0,gravityContact=false,gravityArmed=false;
 let escortArmed=false,bridgeApproach=false,bridgeFlight=false,returned=false;
 const getSignals=()=>({...signals});
 function setControl(active){control=Boolean(active);}
 function activePortalled(segments){return segments.some(segment=>segment.kind==='portal');}
 function poseMirror(dt){
  if(!mirror)return;
  const normal=mirrorNormalOff.clone().lerp(mirrorNormalOn,mirrorAngle).normalize();
  mirror.quaternion.setFromUnitVectors(V(0,0,1),normal);
  mirrorPlate.quaternion.copy(mirror.quaternion);
  mirrorPlate.updateWorldMatrix(true,false);
  if(mirrorCollider){
   mirrorCollider.box.setFromObject(mirrorPlate);
   game.physics?.updateStaticBox?.(mirrorPlate.uuid,mirrorCollider.box,dt);
  }
 }
 function update(dt){
  if(hasMirror){
   const target=control?1:0;
   mirrorAngle=THREE.MathUtils.damp(mirrorAngle,target,9,dt);
   poseMirror(dt);
  }
  if(hasOptics){
   const reflector=hasMirror?[{position:mirrorPosition,normal:mirrorNormalOff.clone().lerp(mirrorNormalOn,mirrorAngle).normalize(),radius:.80}]:[];
   const segments=tracePortalRay(game,input,beamDirection,{length:89,bounces:8,reflectors:reflector,medium:'light'});
   const portalCrossed=activePortalled(segments);
   // Battery's two separated sockets supply alternate projector circuits.
   // The original cargo must stay on each socket while its matching receiver
   // is lit. The first circuit extends a real bridge to the second socket.
   const battery=definition.id==='battery';
   const inletPowered=!battery||Boolean(game.cargoOnPad?.(V(...definition.cargoPad),2.0));
   const outletPowered=!battery||Boolean(game.cargoOnPad?.(V(...definition.batteryOutput),1.35));
   const sourcePowered=inletPowered||outletPowered;
   signals.beamA=inletPowered&&portalCrossed&&towerReceiverHit(segments,beamReceiverA);
   signals.beamB=outletPowered&&portalCrossed&&towerReceiverHit(segments,beamReceiverB);
   beam.update(sourcePowered?segments:[]);projector.set(sourcePowered&&portalCrossed);
   beamReceiverA.set(signals.beamA);beamReceiverB.set(signals.beamB);
  }
  if(hasAir){
   const segments=tracePortalRay(game,position(8,-5.05,2.0),beamDirection,{length:75,bounces:6,medium:'air'});
   const flowing=activePortalled(segments)&&towerReceiverHit(segments,turbine);
   // Rotor inertia and damping are visible. Air power is measured from the
   // actual flow, then its force is applied by the game on subsequent steps.
   turbineOmega=clamp(turbineOmega+(flowing?26-2.8*turbineOmega:-4*turbineOmega)*dt,0,12);
   turbineAngle+=turbineOmega*dt;bladeRoot.rotation.z=turbineAngle;
   signals.airA=flowing&&turbineOmega>2.7;
   turbine.set(signals.airA);airProjector.set(flowing);air.update(segments);
  }
  if(hasGravity){
   const cargo=game.cargo,local=cargo&&towerCoordinates(definition,cargo.position);
   if(!game.heldCube&&local&&Math.abs(local.s-5.1)<.98&&Math.abs(local.n)<.98
    &&cargo.position.y>=definition.baseY+3.42&&cargo.position.y<definition.baseY+4.42)
    gravityContact=true;
   signals.gravity=gravityContact;
   coil.set(gravityContact);
  }
  if(isBalance){
   const p=towerCoordinates(definition,game.playerPosition),body=game.physics?.cargoBody;
   const local=body&&towerCoordinates(definition,body.position);
   if(gravityContact&&!game.heldCube&&game.playerGrounded&&p.s>10.45&&p.s<12.5
    &&p.n< -2.6&&p.n> -4.8)escortArmed=true;
   if(gravityContact&&escortArmed&&!game.heldCube&&local&&local.s>7&&local.s<11.3
    &&local.n< -5.0&&local.n> -6.4&&body.position.y>definition.baseY+2.9)
    bridgeApproach=true;
   if(bridgeApproach&&gravityContact&&escortArmed&&!game.heldCube&&local&&local.s>8.2&&local.s<12.8
    &&local.n< -6.6&&body.position.y>definition.baseY+2.9)bridgeFlight=true;
   // A token proximity event cannot finish the bridge. The original Cannon
   // body must physically settle on the elevated catch after crossing the
   // side opening while the player has travelled the separate escort lane.
   if(bridgeFlight&&!game.heldCube&&local&&Math.abs(local.s-11.1)<.86
    &&Math.abs(local.n+9.25)<.90&&body.position.y>=definition.baseY+3.53
    &&body.position.y<definition.baseY+4.32
    &&Math.hypot(body.velocity.x,body.velocity.y,body.velocity.z)<2.2)
    signals.bridgeCatch=true;
  }
  return getSignals();
 }
 function airAcceleration(p,v){
  if(!signals.airA)return V();
  const local=towerCoordinates(definition,p);
  if(local.s<13.2||local.s>24.2||Math.abs(local.n)>3.3
   ||p.y<definition.baseY+.3||p.y>definition.baseY+5.5)return V();
  const along=v.dot(direction);
  const force=direction.clone().multiplyScalar(clamp(13-along*1.5,0,18))
   .addScaledVector(across,clamp(-local.n*1.2-v.dot(across)*.5,-5,5));
  // Windway's duct angles the live portal-fed current upward. Its 3.5 m
  // baffle cannot be cleared by the ordinary jump (7.8 m/s takeoff against
  // 19.5 m/s² gravity); the player's full body and the original free cargo
  // receive the same force while inside the real capture lane.
  if(definition.id==='windway'&&local.s>14.2&&local.s<19.6&&Math.abs(local.n)<2.8
   &&p.y<definition.baseY+4.75)force.y=clamp(49-v.y*5,0,49);
  return force;
 }
 function playerAcceleration(point,velocity){return airAcceleration(point.clone().addScaledVector(UP,1.1),velocity);}
 function applyCargoForces(){
  const body=game.physics?.cargoBody;
  if(!body||game.heldCube||game.velocityCompanion?.connected)return;
  if(hasGravity&&!gravityContact&&!control){
   const local=towerCoordinates(definition,body.position);
   const intake=Math.abs(local.s-5.1)<2.5&&Math.abs(local.n)<3.6
    &&body.position.y>definition.baseY+.2&&body.position.y<definition.baseY+1.45;
   if(intake){
    // Broad visible catch tray gathers an ordinarily released companion.
    // Real horizontal force draws the rigid body onto the centre contacts;
    // release facing or a small throw cannot substitute for settling there.
    const along=body.velocity.x*direction.x+body.velocity.z*direction.z;
    const lateral=body.velocity.x*across.x+body.velocity.z*across.z;
    const pull=direction.clone().multiplyScalar(clamp((5.1-local.s)*14-along*7,-35,35))
     .addScaledVector(across,clamp(-local.n*14-lateral*7,-35,35));
    body.force.x+=body.mass*pull.x;body.force.z+=body.mass*pull.z;body.wakeUp();
   }
   // A falling or carried companion does not arm the magnet. It first has
   // to settle on the real lower plate, so cargo-before-gravity puzzles retain
   // their causal load contact rather than skipping the weight requirement.
   if(!gravityArmed&&game.physics.grounded
    &&Math.abs(local.s-5.1)<.95&&Math.abs(local.n)<.95
    &&body.position.y>=definition.baseY+.38&&body.position.y<definition.baseY+.82
    &&Math.hypot(body.velocity.x,body.velocity.y,body.velocity.z)<1.1)gravityArmed=true;
   if(gravityArmed&&Math.abs(local.s-5.1)<1.05&&Math.abs(local.n)<1.05
    &&body.position.y>definition.baseY+.20&&body.position.y<definition.baseY+4.35){
    // Cannon's gravity remains enabled. This magnetic force must really
    // accelerate the original body from the pad to the overhead contact.
    const sideways=direction.clone().multiplyScalar(clamp((5.1-local.s)*7-body.velocity.x*direction.x-body.velocity.z*direction.z,-7,7))
     .addScaledVector(across,clamp(-local.n*7-body.velocity.x*across.x-body.velocity.z*across.z,-7,7));
    body.force.x+=body.mass*sideways.x;
    body.force.z+=body.mass*sideways.z;
    body.force.y+=body.mass*(19.5+10.8-clamp(body.velocity.y*1.3,0,5));
    body.wakeUp();
   }
  }
  if(isBalance&&gravityContact){
   const local=towerCoordinates(definition,body.position);
   if(signals.bridgeCatch&&returned)return;
   let s,n,y;
   if(signals.bridgeCatch){s=10.05;n=0;y=definition.baseY+3.72;
    if(local.n>-.95&&Math.abs(local.s-s)<.95){returned=true;return;}
   }else if(escortArmed){s=11.1;n=-9.25;y=definition.baseY+3.74;}
   else{s=5.1;n=0;y=definition.baseY+3.72;}
   const vs=body.velocity.x*direction.x+body.velocity.z*direction.z;
   const vn=body.velocity.x*across.x+body.velocity.z*across.z;
   const towardS=clamp((s-local.s)*25-vs*9,-55,55);
   const towardN=clamp((n-local.n)*25-vn*9,-65,65);
   const vertical=clamp(19.5+(y-body.position.y)*28-body.velocity.y*9,-30,66);
   const planar=direction.clone().multiplyScalar(towardS).addScaledVector(across,towardN);
   body.force.x+=body.mass*planar.x;body.force.z+=body.mass*planar.z;
   body.force.y+=body.mass*vertical;body.wakeUp();
  }
  if(hasAir){
   const acceleration=airAcceleration(V(body.position.x,body.position.y,body.position.z),
    V(body.velocity.x,body.velocity.y,body.velocity.z));
   if(acceleration.lengthSq()){
    body.force.x+=body.mass*acceleration.x;
    body.force.y+=body.mass*acceleration.y;
    body.force.z+=body.mass*acceleration.z;body.wakeUp();
   }
  }
 }
 function reset(){
  control=false;mirrorAngle=0;turbineOmega=turbineAngle=0;gravityContact=gravityArmed=false;
  escortArmed=bridgeApproach=bridgeFlight=returned=false;
  Object.keys(signals).forEach(key=>{signals[key]=false;});
  beam?.update([]);air?.update([]);
  beamReceiverA.set(false);beamReceiverB.set(false);turbine.set(false);coil?.set(false);
  projector.set(false);airProjector?.set(false);bladeRoot.rotation.z=0;
  poseMirror(0);
 }
 function dispose(){
  drawables.removeFromParent();
  for(const object of owned){
   if(object.isMesh){object.geometry.dispose();object.material.dispose();}
   else if(object.isMaterial)object.dispose();
   else {object.geometry.dispose();object.material.dispose();}
  }
 }
 reset();
 return {update,getSignals,setControl,reset,dispose,playerAcceleration,applyCargoForces,
  get state(){return {mirrorAngle,turbineOmega,gravityContact,gravityArmed,escortArmed,bridgeApproach,bridgeFlight,returned,control,...signals};}};
}
