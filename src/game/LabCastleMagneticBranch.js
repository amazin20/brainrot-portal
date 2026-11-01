import * as THREE from 'three';
import {Body,Vec3} from 'cannon-es';
import {createCastleMagneticBend} from './LabCastleMagneticBend.js';

const V=(...p)=>new THREE.Vector3(...p),C=(...p)=>new Vec3(...p);
export const CASTLE_MAGNETIC=Object.freeze({
 intake:Object.freeze([-16,0,12]),outlet:Object.freeze([-12.5,8.5,-4]),
 fieldCentre:Object.freeze([-7.5,6,0]),fieldHalf:Object.freeze([6.5,9,4.5]),qB:8.6,
 dropFootY:12,recoveryY:-4,receiverY:4,receiverX:Object.freeze([-6,-2]),receiverZ:Object.freeze([4,8]),
 roofBottom:5.8,roofZ:Object.freeze([5.1,7]),hatchZ:7.25,shieldX:-14.8,
 serviceZ:16.5,shotStand:Object.freeze([-10,8,-12.2]),shotSlit:Object.freeze([-10.366,9.524,-11]),
});

/** A finite Lorentz field bends the original freight's gravity velocity.
 * Every obstacle is a real closed mesh/query/cargo barrier. The observation
 * glass is solid; only the small aiming slot is open. A present upward cargo
 * contact powers the ordinary castle completion relay, which then supplies
 * the service door and retrieval hatch. Their work is externally powered.
 */
export function buildCastleMagneticBranch({game,k,room,complete,isComplete=()=>false,available=()=>true,sign=()=>{}}){
 const cfg=CASTLE_MAGNETIC,r=room,{P}=r,m=k.m,o=V(...r.def.at),parts=[],recoveryParts=[];
 let owner=null,field=null,subsystem=null,post=null,disposed=false,enabled=false,polarity=1,
  appliedSteps=0,magneticWork=0,foundationImpulse=C(),lastImpulse=null,lastContact=null,serviceProgress=0,hatchProgress=0;
 const floor=(name,x0,x1,z0,z1,y,mat=m.floor)=>{const a=k.floor(o.x+x0,o.x+x1,o.z+z0,o.z+z1,o.y+y,mat);a.name=name;parts.push(a);return a;};
 const box=(name,x,z,y,w,h,d,mat=m.wall,options={})=>{const a=k.box(P(x,z,y),[w,h,d],mat,options);a.name=name;parts.push(a);return a;};
 // The basement cannot escape beneath the shell, which starts at Y=0.
 const recoveryFloor=floor('Magnetic dry lower recovery floor',-21.75,21.75,-20.75,20.75,-4,m.dark);
 for(const x of[-21.75,21.75])recoveryParts.push(box('Magnetic founded lower perimeter',x,0,-2,.5,4,42,m.steel));
 for(const z of[-20.75,20.75])recoveryParts.push(box('Magnetic founded lower perimeter',0,z,-2,43.5,4,.5,m.steel));
 // Split only the actual recovery stairwell; there is no floor over its head.
 floor('Magnetic west near bank outer',-21.5,-19.4,-20.5,20.5,0);
 floor('Magnetic west near bank inner',-17.6,-15.5,-20.5,20.5,0);
 floor('Magnetic west near bank south return',-19.4,-17.6,-12,20.5,0);
 floor('Magnetic west near bank north return',-19.4,-17.6,-20.5,-20,0);
 k.stairs(P(-18.5,-12,-4),P(-18.5,-20,0),1.8,m.floor);
 // Two ordinary flights share a real exchange with the enclosed shot pavilion.
 k.stairs(P(-20.4,18),P(-20.4,-18,8),1.8,m.floor);
 floor('Magnetic eight-metre stair exchange',-21.35,-15.8,-19.3,-16.7,8,m.ivory);
 k.stairs(P(-18,-18,8),P(-18,18,12),1.6,m.ivory);
 floor('Magnetic high release balcony',-21.35,-15.3,16.5,20.5,12,m.ivory);
 floor('Magnetic open-ended original freight tongue',-17,-15.2,12.65,16.5,12,m.copper);
 for(const x of[-17.08,-15.12])box('Magnetic release tongue side rail',x,14.5,12.58,.16,1.16,3.7,m.steel);
 for(const x of[-21.43,-15.22])box('Magnetic release balcony side rail',x,18.5,12.58,.16,1.16,4,m.steel);
 box('Magnetic release balcony rear rail',-18.3,20.42,12.58,6.2,1.16,.16,m.steel);
 // Partition the shield into real rectangular leaves around THREE openings:
 // an enclosed high passenger passage, closed viewing glass, powered service.
 const glass=k.mat(0x739caa,.5,.05);glass.transparent=true;glass.opacity=.35;glass.depthWrite=false;
 glass.name='Magnetic closed industrial observation glass';
 const shieldBoxes=[];
 const shield=(name,z0,z1,y0,y1,mat=m.wall)=>shieldBoxes.push(box(name,cfg.shieldX,(z0+z1)/2,(y0+y1)/2,.65,y1-y0,z1-z0,mat));
 for(const[a,b]of[[-21,-19.3],[-16.7,-6],[8,15],[18,21]])shield('Magnetic founded opaque shield',a,b,-4,15);
 shield('Magnetic pavilion passage foundation',-19.3,-16.7,-4,8);
 shield('Magnetic pavilion passage lintel',-19.3,-16.7,11.2,15);
 shield('Magnetic observation glass sill',-6,8,-4,1);
 shield('Magnetic observation glass crown',-6,8,12,15);
 const observationGlass=box('Magnetic real closed observation glass',cfg.shieldX,1,6.5,.65,11,14,glass);
 // Embedded mullions sit inside the glass's exact closed contact envelope.
 for(const z of[-5.92,1,7.92])box('Magnetic embedded observation mullion',cfg.shieldX,z,6.5,.65,11,.12,m.steel);
 for(const y of[1.08,11.92])box('Magnetic observation frame',cfg.shieldX,1,y,.65,.16,14,m.steel);
 const serviceDoor=box('Magnetic externally powered service door',cfg.shieldX,16.5,2.9,.25,5.8,3,m.copper,{dynamic:true});
 // The raised door fits BETWEEN these two real lintel leaves; no solid lintel
 // occupies its 6m stroke. All pieces stay below the existing room ceiling.
 for(const x of[cfg.shieldX-.25,cfg.shieldX+.25])box('Magnetic service door pocket cheek',x,16.5,10.4,.15,9.2,3,m.steel);
 floor('Magnetic service threshold',-15.5,-13,15,18,0,m.copper);
 // High pavilion, fully enclosed except a real .64 x .64 aiming aperture.
 floor('Magnetic high pavilion access',-15.5,-9,-19.3,-16.7,8,m.ivory);
 floor('Magnetic high shot pavilion',-13.8,-9,-16.7,-11.05,8,m.ivory);
 box('Magnetic pavilion outer east wall',-8.85,-15.2,11.5,.3,7,8.6,m.steel);
 box('Magnetic pavilion north wall',-11.4,-19.45,11.5,5.2,7,.3,m.steel);
 box('Magnetic pavilion west return',-13.95,-13.85,11.5,.3,7,5.7,m.steel);
 const sx=cfg.shotSlit[0],sy=cfg.shotSlit[1],slit=.64;
 const pavilionGlass=[];
 for(const[a,b]of[[-14.1,sx-slit/2],[sx+slit/2,-8.7]])pavilionGlass.push(box('Magnetic closed pavilion glass side pane',(a+b)/2,-11,(8+15)/2,b-a,7,.3,glass));
 pavilionGlass.push(box('Magnetic closed pavilion glass below slot',sx,-11,(8+sy-slit/2)/2,slit,sy-slit/2-8,.3,glass));
 pavilionGlass.push(box('Magnetic closed pavilion glass above slot',sx,-11,(sy+slit/2+15)/2,slit,15-sy-slit/2,.3,glass));
 for(const x of[sx-slit/2-.04,sx+slit/2+.04])box('Magnetic aiming slot embedded jamb',x,-11,sy,.08,slit+.16,.3,m.copper);
 for(const y of[sy-slit/2-.04,sy+slit/2+.04])box('Magnetic aiming slot embedded rail',sx,-11,y,slit,.08,.3,m.copper);
 // The freight outlet is genuinely too low for an upright capsule.
 const intake=k.panel('magnetic fixed gravity inlet',P(cfg.intake[0],cfg.intake[2],cfg.intake[1]+.035),[0,1,0],2,2);
 intake.mesh.userData.portalSize={width:.65,height:.7};
 const intakeBacking=parts.find(a=>a.name==='Magnetic west near bank inner');intake.mesh.userData.portalBackingIds=[intakeBacking.uuid];
 const outlet=k.panel('magnetic cargo-only tangent outlet',P(cfg.outlet[0],cfg.outlet[2],cfg.outlet[1]),[1,0,0],2,1.4);
 outlet.mesh.userData.portalSize={width:.65,height:.7};
 box('Magnetic outlet fixed foundation',-12.75,-4,1.85,.45,11.7,2.5,m.steel);
 // A wide real floor lip admits the descending tangent BEFORE the low roof.
 const receiverFloor=floor('Magnetic actual receiving contact plate',-6,-2,4,8,4,m.mint);
 for(const x of[-6.15,-1.85])box('Magnetic catcher closed side cheek',x,6,5.25,.3,2.5,4.6,m.steel);
 const receiverRoof=box('Magnetic catcher actual low roof',-4,6.05,5.95,4.6,.3,1.9,m.copper);
 const retrievalHatch=box('Magnetic powered rear cargo retrieval hatch',-4,cfg.hatchZ,5.25,4.6,2.5,.3,glass,{dynamic:true});
 // Service stairs have founded side walls, a closed low entrance and a high
 // exit. No low step is exposed to a player walking in the recovery basin.
 floor('Magnetic powered service forecourt',-14.475,-11.35,15,18,0,m.ivory);
 box('Magnetic service forecourt foundation',-12.9125,16.5,-2.2,3.125,3.6,3,m.steel);
 for(const x of[-14.5,-11.5])box('Magnetic service stair founded side enclosure',x,8.5,2,.3,12,13,m.wall);
 box('Magnetic stair upper exit foundation',-13,1.85,0,3.3,8,.3,m.steel);
 k.stairs(P(-13,16,0),P(-13,2,4),2.7,m.ivory);
 floor('Magnetic upper service exchange',-14.35,-9.8,.2,2,4,m.ivory);
 floor('Magnetic rear service walkway',-11.2,-9.8,2,9.4,4,m.ivory);
 floor('Magnetic accessible rear retrieval apron',-11.2,-1.7,7.4,9.4,4,m.ivory);
 // Fully real U coil: its segmented torus collision has no imaginary disc.
 const coil=k.ring(P(-7.5,9,6),6.6,m.copper,{normal:[0,0,1],tube:.24,arc:Math.PI});coil.name='Magnetic finite-field U coil';
 for(const x of[-14.1,-.9])box('Magnetic U coil grounded foundation',x,9,1,.75,10,.75,m.steel);
 const controls={
  supply:k.control('magnet:supply',P(-18.4,2),()=>{if(!available())return false;enabled=!enabled;field?.setEnabled(enabled);},'Внешнее питание магнитного поля',m.copper),
  polarity:k.control('magnet:polarity',P(-18.4,6),()=>{if(!available())return false;polarity*=-1;field?.setPolarity(polarity);},'Поменять направление магнитного изгиба',m.violet),
 };
 sign('ПОЛЕ ПОВОРАЧИВАЕТ СКОРОСТЬ · НЕ ТЯНЕТ К ЦЕЛИ\nВЫСОТА ПАДЕНИЯ И ПОЛЯРНОСТЬ МЕНЯЮТ КАСАТЕЛЬНУЮ',P(-15.17,-2,10.6),10,[-1,0,0],2);
 sign('НИЗКИЙ ВЫХОД — ТОЛЬКО ДЛЯ ДРУГА\nПОРТАЛЫ ПИТАЮТСЯ ИЗВНЕ: ПОДЪЁМ ДОБАВЛЯЕТ ЭНЕРГИЮ',P(-13.78,-15.6,11.7),5.5,[1,0,0],2);
 sign('РЕАЛЬНЫЙ КОНТАКТ ВКЛЮЧАЕТ СЕРВИСНЫЙ ПРИВОД\nВЕРНИ ТОГО ЖЕ ДРУГА ЧЕРЕЗ ЗАДНИЙ ЛЮК',P(-15.17,16.5,4.6),6,[-1,0,0],2);
 function original(){const b=branch.originalCargoBody,s=branch.originalCargoShape;return Boolean(owner&&game.physics===owner&&game.cargo===branch.originalCargo
  &&owner.cargoBody===b&&b.world===owner.world&&owner.world.bodies.includes(b)&&b.type===Body.DYNAMIC&&b.mass===3.2&&b.mass===branch.originalCargoMass
  &&b.shapes.length===1&&b.shapes[0]===s&&s.halfExtents&&s.halfExtents.x===.39&&s.halfExtents.y===.39&&s.halfExtents.z===.39);}
 function free(){return original()&&!game.heldCube&&!owner.carryTarget;}
 function liveContact(){
  if(!free())return null;const b=owner.cargoBody,solid=owner.solids.get(receiverFloor.uuid),support=solid?.body,c=receiverFloor.userData.collider;
  if(!support||support.world!==owner.world||!owner.world.bodies.includes(support)||!c?.enabled||!solid.inWorld||support.collisionResponse===false||!(support.collisionFilterMask&b.collisionFilterGroup))return null;
  const target=c.box.getCenter(V()),half=c.box.getSize(V()).multiplyScalar(.5),shape=support.shapes[0];
  if(target.distanceTo(V().copy(support.position))>1e-6||!shape?.halfExtents||half.distanceTo(V().copy(shape.halfExtents))>1e-6)return null;
  if(b.position.x<o.x-6+.2||b.position.x>o.x-2-.2||b.position.z<o.z+4+.2||b.position.z>o.z+7.1||b.velocity.length()>.35)return null;
  const contact=owner.world.contacts.find(a=>a.enabled&&a.multiplier>0&&((a.bi===b&&a.bj===support&&-a.ni.y>.95)||(a.bj===b&&a.bi===support&&a.ni.y>.95)));
  return contact?{worldStep:owner.world.stepnumber,originalCargoBodyId:b.id,originalCargoShapeId:b.shapes[0].id,receiverBodyId:support.id,receiverColliderId:receiverFloor.uuid,
   position:b.position.toArray(),velocity:b.velocity.toArray(),upwardNormal:contact.bi===b?contact.ni.negate().toArray():contact.ni.toArray(),normalForce:contact.multiplier}:null;
 }
 const branch={intake,outlet,receiverFloor,receiverRoof,retrievalHatch,serviceDoor,recoveryFloor,observationGlass,pavilionGlass,coil,controls,parts,shieldBoxes,
  get owner(){return owner;},get field(){return field;},get enabled(){return enabled;},get polarity(){return polarity;},get serviceProgress(){return serviceProgress;},get hatchProgress(){return hatchProgress;},get contact(){return liveContact();},
  ensure(){if(disposed||!game.physics?.cargoBody)return false;if(owner===game.physics)return true;if(owner)throw Error('Magnetic branch cannot change its physics owner');
   owner=game.physics;branch.originalCargo=game.cargo;branch.originalCargoBody=owner.cargoBody;branch.originalCargoShape=owner.cargoBody.shapes[0];branch.originalCargoMass=owner.cargoBody.mass;
   field=createCastleMagneticBend({body:owner.cargoBody,centre:C(o.x+cfg.fieldCentre[0],o.y+cfg.fieldCentre[1],o.z+cfg.fieldCentre[2]),halfExtents:C(...cfg.fieldHalf),qB:C(0,cfg.qB,0)});
   field.setEnabled(enabled);field.setPolarity(polarity);subsystem={update:()=>branch.updateForces(owner.world.dt)};owner.world.subsystems.push(subsystem);
   post=()=>{lastContact=liveContact();if(lastContact&&available())complete('magnet',{...lastContact,finiteLorentzField:true,magneticWork,foundationImpulse:foundationImpulse.toArray(),poweredServiceAccess:true});};
   owner.world.addEventListener('postStep',post);return true;
  },
  updateForces(dt){if(!(dt>0)||!branch.ensure()||!available()||!free())return;const result=field.apply(dt);if(!result.applied)return;
   appliedSteps++;magneticWork+=result.magneticWork;foundationImpulse.vsub(result.magneticImpulse,foundationImpulse);
   lastImpulse={worldStep:result.worldStep,bodyId:result.bodyId,cargoImpulse:result.magneticImpulse.toArray(),fixedFoundationImpulse:result.magneticImpulse.negate().toArray(),
    magneticWork:result.magneticWork,kineticBefore:result.kineticBefore,kineticAfter:result.kineticAfter,fixedFoundationVelocity:[0,0,0],fixedFoundationWork:0};
  },
  update(dt){branch.ensure();serviceProgress=THREE.MathUtils.damp(serviceProgress,isComplete()?1:0,4,dt);hatchProgress=THREE.MathUtils.damp(hatchProgress,isComplete()?1:0,4,dt);
   k.move(serviceDoor,P(cfg.shieldX,cfg.serviceZ,2.9+serviceProgress*6),dt);k.move(retrievalHatch,P(-4,cfg.hatchZ,5.25+hatchProgress*3),dt);
  },
  reset(){enabled=false;polarity=1;appliedSteps=0;magneticWork=0;foundationImpulse.setZero();lastImpulse=lastContact=null;serviceProgress=hatchProgress=0;
   field?.setEnabled(false);field?.setPolarity(1);field?.resetClock();k.move(serviceDoor,P(cfg.shieldX,cfg.serviceZ,2.9),0);k.move(retrievalHatch,P(-4,cfg.hatchZ,5.25),0);
  },
  diagnostics(){return{ready:original(),disposed,enabled,polarity,appliedSteps,magneticWork,foundationImpulse:foundationImpulse.toArray(),lastImpulse,lastContact,
   fieldCentre:field?.centre.toArray(),fieldHalf:field?.halfExtents.toArray(),originalCargoBodyId:branch.originalCargoBody?.id,originalCargoShapeId:branch.originalCargoShape?.id,
   receiverColliderId:receiverFloor.uuid,serviceProgress,hatchProgress,externalEnergyOwners:['ordinary elevated portal','prescribed field switching supply','completion-powered service actuators'],
   scope:'Magnetic operator preserves kinetic energy; portal height and service drives are externally powered. No route/history flags qualify the receiver.'};},
  dispose(){if(disposed)return;disposed=true;field?.dispose();if(owner){owner.world.removeEventListener('postStep',post);const i=owner.world.subsystems.indexOf(subsystem);if(i>=0)owner.world.subsystems.splice(i,1);}}
 };return branch;
}

/** Ordinary-input route preparation, also usable by a real negative prefix.
 * All movement, aiming, E pickup/release and waiting remain caller-owned.
 * The caller must arrive with the one original freight body in its hand. */
export async function releaseCastleMagneticFreight({state:s,P,walk,shoot,dropAt,pickup,use,wait,release}){
 await walk(P(-18.5,10));await dropAt(P(-18.5,10));
 await walk(P(-20.4,18));await walk(P(-20.4,-18,8));await walk(P(-10,-18,8));await walk(P(-10,-12.2,8));
 await shoot(1,s.outlet.center,{center:true});
 await walk(P(-10,-18,8));await walk(P(-20.4,-18,8));await walk(P(-20.4,18));
 await walk(P(-18.5,2));await use('magnet:supply');await walk(P(-16,10));await shoot(0,s.intake.center,{center:true});
 await walk(P(-18.5,10));await pickup();await walk(P(-20.4,18));await walk(P(-20.4,-18,8));
 await walk(P(-18,-18,8));await walk(P(-18,18,12));await walk(P(-16,18,12));
 await walk(P(-16,12.8,12),{sprint:false,tolerance:.025});await wait(.4);await release();await wait(1.4);
}

export async function retrieveCastleMagneticFreight({state:s,P,walk,until,pickup}){
 await until(()=>s.serviceProgress>.995&&s.hatchProgress>.995,6,'Magnetic contact did not power the service access');
 await walk(P(-16,18,12));await walk(P(-18,18,12));await walk(P(-18,-18,8));
 await walk(P(-20.4,-18,8));await walk(P(-20.4,18));await walk(P(-18,18));await walk(P(-18,16.5));
 await walk(P(-13,16.5));await walk(P(-13,16));await walk(P(-13,2,4));await walk(P(-13,1,4));
 await walk(P(-10.5,1,4));await walk(P(-10.5,9,4));await walk(P(-4.4,9,4));await walk(P(-4.4,7.82,4));await pickup();
 await walk(P(-4.4,9,4));await walk(P(-10.5,9,4));await walk(P(-10.5,1,4));await walk(P(-13,1,4));
 await walk(P(-13,2,4));await walk(P(-13,16));await walk(P(-13,16.5));await walk(P(-18,16.5));
}
