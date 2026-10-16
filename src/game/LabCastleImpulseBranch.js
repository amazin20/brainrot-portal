import * as THREE from 'three';
import {buildCastleImpulseCell} from './LabCastleImpulseCell.js';

const V=(...v)=>new THREE.Vector3(...v);

/** A gravity drop is turned through an ordinary portal into a real cargo
 * collision. The retained spring position opens the rear service gallery;
 * the same free companion must then be recovered and carried to its socket. */
export function buildCastleImpulseBranch({game,k,room,standing,plate,sign,goal,base,register}){
 const r=room,{P}=r,m=k.m,parts=[],floors=[];
 const deck=base(r),box=(name,x,z,y,w,h,d,material=m.wall)=>{
  const mesh=k.box(P(x,z,y),[w,h,d],material);mesh.name=name;parts.push(mesh);return mesh;
 };
 const floor=(name,x0,x1,z0,z1,y,material=m.floor)=>{
  const mesh=k.floor(r.def.at[0]+x0,r.def.at[0]+x1,r.def.at[2]+z0,r.def.at[2]+z1,r.def.at[1]+y,material);mesh.name=name;floors.push(mesh);return mesh;
 };
 const wall=(name,x0,x1,z,y0,y1,material=m.wall)=>box(name,(x0+x1)/2,z,(y0+y1)/2,x1-x0,y1-y0,.3,material);
 const side=(name,x,z0,z1,y0,y1,material=m.wall)=>box(name,x,(z0+z1)/2,(y0+y1)/2,.24,y1-y0,z1-z0,material);

 const cell=buildCastleImpulseCell(game,k,{centre:r.def.at});
 const intake=k.panel('castle impulse gravity drop',P(-8,-12,.035),[0,1,0],4.8,4.8);
 intake.mesh.userData.portalBackingIds=[deck.uuid];
 // This finite low aperture admits the companion, never an upright actor.
 const outlet=k.panel('castle impulse low momentum throat',P(0,0,4.9),[1,0,0],2.4,1.4);
 outlet.mesh.userData.portalSize={width:.8,height:.6};

 // The carrier exactly fills the opening in this west wall. Neither it nor
 // the drop floor has an unrelated second collision skin across its portal.
 for(const[a,b]of [[-2.4,-1.2],[1.2,6.5]])side('Castle impulse founded west impact enclosure',-.12,a,b,0,8);
 side('Castle impulse founded low throat sill',-.12,-1.2,1.2,0,4.2);
 side('Castle impulse founded low throat lintel',-.12,-1.2,1.2,5.6,8);
 // An ordinary floor passage approaches the front face of the shutter.
 // Its low ceiling prevents a fall from the drop balcony entering above it.
 side('Castle impulse founded west service lintel',-.12,6.5,9.5,2.8,8);
 side('Castle impulse founded west service return',-.12,9.5,10,0,8);
 side('Castle impulse founded east enclosure',14.5,-2.4,10,0,8);
 box('Castle impulse sealed service roof',7.2,3.8,8.2,14.6,.4,12.4,m.dark);

 // A 0.6m aiming slit is narrower than either traveller. Its real opening
 // gives a charged shot a front-facing line to the high horizontal outlet.
 wall('Castle impulse front aiming wall west',0,.4,-2.4,0,8);
 wall('Castle impulse front aiming wall east',1,14.5,-2.4,0,8);
 wall('Castle impulse aiming slit sill',.4,1,-2.4,0,3);
 wall('Castle impulse aiming slit lintel',.4,1,-2.4,6,8);
 for(const x of [.32,1.08])box('Castle impulse aiming slit ceramic jamb',x,-2.57,4.5,.08,3.15,.07,m.ivory);

 // The public approach remains on the ground. Only a supported rear climb
 // reaches the high opening into the pickup gallery. The complete roof and
 // lintel also close the tempting balcony -> roof -> cargo shortcut.
 wall('Castle impulse lower founded pickup separation',0,14.5,5,0,3.15,m.steel);
 wall('Castle impulse upper founded pickup separation',0,14.5,5,6.5,8,m.steel);
 for(const[a,b]of [[0,9.7],[14.3,14.5]])wall('Castle impulse founded yoke channel lintel',a,b,5,6.15,6.5,m.steel);
 for(const[a,b]of [[0,5.3],[12.5,14.5]])wall('Castle impulse pickup gallery side pier',a,b,5,3.15,6.15,m.steel);

 // The shutter has a genuine lateral pocket. A coplanar right-hand wall
 // would collide with the travelling shutter before it could open.
 const left=r.b.x0-r.def.at[0],right=r.b.x1-r.def.at[0];
 wall('Castle impulse service partition west',left,5.1,10,0,6.6,m.steel);
 wall('Castle impulse service partition east',13.2,right,10,0,6.1,m.steel);
 wall('Castle impulse service partition east upper band',13.2,right,10,6.5,6.6,m.steel);
 wall('Castle impulse service partition east channel end',14.3,right,10,6.1,6.5,m.steel);
 wall('Castle impulse full service partition lintel',left,right,10,6.6,r.def.h,m.steel);
 wall('Castle impulse founded shutter pocket front',9,13.2,9.5,0,6.1,m.dark);
 wall('Castle impulse founded shutter pocket front cap',9,13.2,9.5,6.5,6.6,m.dark);
 wall('Castle impulse founded shutter pocket front pier',9,9.7,9.5,6.1,6.5,m.dark);
 wall('Castle impulse founded shutter pocket back',9,13.2,10.5,0,6.6,m.dark);
 side('Castle impulse founded shutter pocket end',13.2,9.5,10.5,0,6.1,m.dark);
 side('Castle impulse founded shutter pocket end cap',13.2,9.5,10.5,6.5,6.6,m.dark);

 // The drop has two differently directed physical stair flights. A narrow
 // open-ended tongue puts a normal held release over the floor aperture.
 k.stairs(P(-19,-2),P(-19,-18,4.5),3.2,m.floor);
 floor('Castle impulse stair exchange',-20.6,-17.4,-19.6,-16.4,4.5);
 k.stairs(P(-19,-18,4.5),P(-8,-18,9),3.2,m.ivory);
 floor('Castle impulse drop balcony',-11.4,-4.6,-19.6,-14.6,9,m.ivory);
 floor('Castle impulse ordinary release tongue',-9.6,-6.4,-18,-12.65,9,m.copper);
 // Rails retain the sides while leaving the actual gravity release mouth.
 for(const x of [-9.72,-6.28])box('Castle impulse founded drop tongue side rail',x,-14.95,9.58,.16,1.16,4.6,m.steel);
 box('Castle impulse drop balcony rear rail',-8,-19.75,9.58,6.9,1.16,.16,m.steel);

 k.stairs(P(7,20),P(7,13,3.55),3.4,m.floor);
 // The real shutter passes through a finite slot in this elevated bridge;
 // filling it with a floor would jam the closed compound before the impact.
 floor('Castle impulse rear service high traverse near',5.3,8.7,5,9.7,3.55,m.ivory);
 floor('Castle impulse rear service high traverse far',5.3,8.7,10.3,13,3.55,m.ivory);
 floor('Castle impulse high pickup gallery',5.3,12.5,3.25,5,3.55,m.ivory);
 for(let i=0;i<3;i++)floor('Castle impulse pickup descent '+(i+1),5.3,12.5,3-i*.25,3.25-i*.25,3.3-i*.25,m.floor);
 floor('Castle impulse low cargo pickup apron',5.3,12.5,1.4,2.5,2.8,m.copper);
 // The apron never overlaps the travelling scoop or side cheeks. The
 // founded guides remain under the high gallery, with 25mm shoe clearance.

 const receiver=P(-6,16,.16),contact=P(-2,16);
 const receiverPlatform=box('Castle impulse original companion receiver',-6,16,.08,3.2,.16,3.2,m.copper);
 plate(receiver,2.8,m.copper);plate(contact,2.7,m.rose);
 sign('ПАДЕНИЕ СОХРАНЯЕТ ИМПУЛЬС\nПРУЖИНЫ УДЕРЖИВАЮТ ДВА ПОЛОЖЕНИЯ',P(-9,-3,4.4),10,[0,0,1],2);
 sign('ДРУГ ПЕРЕВОДИТ КАРЕТКУ УДАРОМ\nЗАТЕМ ВЕРНИ ЕГО ЧЕРЕЗ СЕРВИСНУЮ ГАЛЕРЕЮ',P(5,9.29,6.1),9,[0,0,-1],2);

 let receiverContact=null,receiverTicks=0,lastStep=-1,previousFoot=null,serviceApproach=null,serviceCrossing=null,retrieval=null;
 function currentReceiver(){
  const physics=game.physics,body=physics?.cargoBody,solid=physics?.solids?.get(receiverPlatform.uuid),support=solid?.body,shape=support?.shapes[0],cargoShape=body?.shapes[0],collider=receiverPlatform.userData.collider;
  if(!cell.ensure()||game.cargo!==cell.originalCargo||body!==cell.originalCargoBody||cargoShape!==cell.originalCargoShape||game.heldCube||physics.carryTarget||!support||!solid.inWorld||!physics.world.bodies.includes(support)||!physics.world.bodies.includes(body)||collider?.enabled===false||support.collisionResponse===false||shape?.collisionResponse===false||body.collisionResponse===false||cargoShape?.collisionResponse===false||body.velocity.length()>1)return null;
  const expected=collider.box.getCenter(V()),half=collider.box.getSize(V()).multiplyScalar(.5);
  if(expected.distanceTo(V(support.position.x,support.position.y,support.position.z))>1e-7||half.distanceTo(V(shape.halfExtents.x,shape.halfExtents.y,shape.halfExtents.z))>1e-7)return null;
  let normalForce=0,count=0;for(const c of physics.world.contacts){if(c.enabled===false||!(c.multiplier>1e-6)||![c.bi,c.bj].includes(body)||![c.bi,c.bj].includes(support)||![c.si,c.sj].includes(shape)||![c.si,c.sj].includes(cargoShape))continue;const ny=(c.bi===body?-1:1)*c.ni.y;if(ny>.65){normalForce+=ny*c.multiplier;count++;}}
  return count&&normalForce>1e-6?{worldStep:physics.world.stepnumber,bodyId:support.id,shapeId:shape.id,cargoBodyId:body.id,cargoShapeId:cargoShape.id,normalForce,contacts:count,originalCargoFree:true,receiver:receiver.slice()}:null;
 }
 function observe(dt){
  const step=game.physics?.world.stepnumber??-1;if(!(dt>0)||step<=0||step===lastStep)return;
  const sequential=step===lastStep+1,foot=game.playerPosition,local=foot.clone().sub(V(...r.def.at));lastStep=step;
  const valid=cell.open&&cell.impacted,continuous=sequential&&previousFoot&&foot.distanceTo(previousFoot)<.22;
  if(valid&&game.playerGrounded&&local.x>5.53&&local.x<8.47&&local.z>8&&local.z<9.8)serviceApproach={worldStep:step,foot:foot.toArray(),sliderX:cell.x};
  if(!serviceCrossing&&valid&&continuous&&serviceApproach&&step-serviceApproach.worldStep<240&&local.x>5.53&&local.x<8.47&&local.z>10.2&&local.z<11.5)serviceCrossing={...serviceApproach,arrivalWorldStep:step,arrivalFoot:foot.toArray(),sliderX:cell.x,originalCargoBodyId:cell.originalCargoBody.id};
  const original=game.physics.cargoBody===cell.originalCargoBody&&game.physics.cargoBody.shapes[0]===cell.originalCargoShape&&game.cargo===cell.originalCargo,cargoPosition=original?V(...cell.originalCargoBody.position.toArray()):null,cargoLocal=cargoPosition?.clone().sub(V(...r.def.at));
  if(!retrieval&&serviceCrossing&&step>serviceCrossing.arrivalWorldStep&&original&&cargoLocal?.z>5.3&&cargoLocal.z<12&&cargoLocal.x>4.5&&cargoLocal.x<13.5)retrieval={worldStep:step,player:foot.toArray(),cargo:cargoPosition.toArray(),originalCargoBodyId:cell.originalCargoBody.id,originalCargoShapeId:cell.originalCargoShape.id,held:game.heldCube===cell.originalCargo};
  previousFoot=foot.clone();receiverContact=currentReceiver();receiverTicks=receiverContact&&sequential?receiverTicks+1:receiverContact?1:0;
  // Keep the already measured physical load in the ordinary narrowphase.
  // Sleeping Cannon bodies otherwise omit their continuing support contact.
  if(receiverContact)cell.originalCargoBody.wakeUp();
 }
 const targets={intake,outlet,receiver,contact,receiverPlatform,drop:P(-8,-12.9,9),aim:P(3,-10),serviceApproach:P(7,8),rearStairBase:P(7,20),rearStairTop:P(7,13,3.55),pickup:P(10.45,1.85,2.8)};
 const state={cell,...targets,get receiverLoaded(){return receiverTicks>=24&&Boolean(receiverContact)&&receiverContact.worldStep===game.physics?.world.stepnumber;},get receiverContact(){return receiverContact;},get actualServiceCrossing(){return serviceCrossing;},get cargoRetrieval(){return retrieval;}};
 const finish=goal('impulse',contact,()=>cell.readyForProof&&state.receiverLoaded&&Boolean(serviceCrossing)&&Boolean(retrieval),()=>({physicalOriginalCargoImpulse:true,passiveBistableCarriage:true,impulseCell:cell.diagnostics(),physicalImpulseCell:cell.diagnostics(),originalCargo:true,actualServiceCrossing:serviceCrossing,sameOriginalCargoRetrieved:true,cargoRetrieval:retrieval,originalCargoBodyId:cell.originalCargoBody.id,originalCargoShapeId:cell.originalCargoShape.id,receiverContact:{...receiverContact,stableTicks:receiverTicks},independentLoads:true}));
 const update=dt=>{cell.syncPose();observe(dt);finish(dt);};
 const reset=()=>{cell.reset();receiverContact=null;receiverTicks=0;lastStep=-1;previousFoot=serviceApproach=serviceCrossing=retrieval=null;};
 register('impulse',{state,update,reset});
 return {cell,panels:{intake,outlet},targets,state,parts,floors,update,reset,dispose:()=>cell.dispose()};
}
