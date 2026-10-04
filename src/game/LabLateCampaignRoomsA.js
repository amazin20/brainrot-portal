import * as THREE from 'three';
import {Body,Box,Vec3,Material} from 'cannon-es';
import {ResearchChamber} from './LabResearchArt.js';
import {tracePortalRay,beamDrawing} from './LabPuzzleMechanics.js';
import {airAcceleration} from './LabAirForces.js';
import {freightHood,lateShutter,movingMechanismBlock} from './LabLateCampaignMechanisms.js';
const V=(...p)=>new THREE.Vector3(...p);

function finish(k,spawn,cargo,goal,extra,roles,deductions){
 const l=k.finishResearch(spawn,cargo,goal,{postCampaign:true,...extra});
 l.puzzleGeometry={noProgressFlags:true,recoveryFloor:k.base,footprint:(k.bounds.maxX-k.bounds.minX)*(k.bounds.maxZ-k.bounds.minZ),portalRoles:roles,deductions};
 return l;
}

/** The air never pushes this rack directly. Only contact from the original
 * dynamic cargo body can move its guided mass; the visible rod carries that
 * displacement to a transverse deck above it. */
export function buildFreightRake(game,index,spec){
 const k=new ResearchChamber(game,spec,index,'current',{minX:-31,maxX:31,minZ:-28,maxZ:28},-4,23);
 k.deck('Ground loading apron',-29,-13,6,26,0);
 k.deck('Upper western inspection quay',-29,-12,-26,-13,6);
 k.deck('Upper eastern receiving quay',0,29,-26,-13,6);
 k.deck('Freight guide floor',-29,-6,4,12,0);
 k.deck('Ground viewing crossbar',-13,12,12,20,0);
 k.deck('Rack inspection window apron',-6,12,4,12,0);
 k.ramp('Active inspection ascent',-29,-21,-13,6,6,0);
 k.ramp('Dry freight recovery incline',20,28,-8,18,-4,0);
 k.deck('Eastern lower return quay',12,28,18,26,0);
 const dispatch=k.loadPad('rake-dispatch',[-20,0,20],8);
 const mouth=k.panel('rake-mouth',[-27,1.55,8],[1,0,0],4,3.0);
 const intake=k.panel('rake-air-intake',[18,1.55,20],[1,0,0],4,3.0);
 for(const p of [mouth,intake])p.mesh.userData.portalSize={width:1.4,height:.65};
 const roof=lateShutter(k,'Rack guide lifting inspection roof',[-16.5,2.37,8],[19,.24,6],[0,16,0]);
 const hood={minX:-26,maxX:-7,minZ:5,maxZ:11,ceiling:2.25,roof};
 k.label('КОЖУХ ОТКРЫЛСЯ → ПЕРЕПРЫГНИ УПОР',[-1,3.6,12.2],[0,0,1],16,.65);
 k.label('ГРУЗ ТОЛКАЕТ РЕЙКУ',[-16.5,3.0,11.1],[0,0,1],16,.6);
 k.block([-7.2,.35,8],[.22,.7,1.7],'metal');
 for(const z of [7.1,8.9])k.block([-16.5,.525,z],[19,1.05,.18],'metal');
 // Closed side guards make a hand-carried route into the rack impossible.
 for(const z of [5,11])k.block([-16.5,7,z],[21,14,.4],'shell');
 const inspection=lateShutter(k,'Rack inspection lower leaf',[-7,.6,8],[.4,1.2,6],[0,16,0]);
 const inspectionTop=lateShutter(k,'Rack inspection upper leaf',[-7,7.965,8],[.4,12.07,6],[0,16,0]);
 const edgeLeaves=[5.5,10.5].map(z=>lateShutter(k,'Rack inspection cheek',[-7,.965,z],[.4,1.93,1],[0,16,0]));
 // A broad upper slit gives a real viewing/shot line without a human-sized
 // passage. The rack and lower crate remain isolated from a pushing player.
 // The aperture faces the side gallery through the end inspection window.
 const bridge=k.carrier('rack-driven-crossing',[[-19,6,-1],[-6,6,-25]],{width:12,depth:12,portal:false});
 bridge.speed=200;
 const direction=V(13,0,-24),railCentre=V(-12.5,4.3,-13);for(const dx of [-4.8,4.8])k.geometry(new THREE.BoxGeometry(.16,.20,direction.length()+12),'metal',railCentre.clone().add(V(dx,0,0)).toArray(),new THREE.Quaternion().setFromUnitVectors(V(0,0,1),direction.clone().normalize()),{batch:false,name:'Inclined transverse bridge guide'});
 const mesh=movingMechanismBlock(k,'Cargo-driven rack contact',[-21,.62,8],[.36,1.24,2.8]);
 const collider=game.collisionProxy(new THREE.Box3().setFromObject(mesh),{kinematic:true});
 const rack={body:null,owner:null,stroke:0,latched:false,mesh,collider,bridge,
  ensure(){if(!game.physics||this.owner===game.physics)return;this.owner=game.physics;game.physics.removeStaticBox(collider.mesh.uuid);
   this.body=new Body({mass:3.6,position:new Vec3(-21,.62,8),shape:new Box(new Vec3(.18,.62,1.4)),fixedRotation:true,linearFactor:new Vec3(1,0,0),linearDamping:.03,material:new Material({friction:.05,restitution:.02}),collisionFilterGroup:1,collisionFilterMask:2});game.physics.world.addBody(this.body);
  },reset(){this.ensure();this.stroke=0;this.latched=false;if(this.body){this.body.type=Body.DYNAMIC;this.body.position.set(-21,.62,8);this.body.velocity.setZero();this.body.force.setZero();this.body.wakeUp();}this.sync(0);},
  forces(dt){this.ensure();const b=this.body;if(!b)return;this.stroke=THREE.MathUtils.clamp(b.position.x+21,0,13);
   if(this.stroke>12.96)this.latched=true;
   if(this.latched){b.type=Body.STATIC;b.position.x=-8;b.position.y=THREE.MathUtils.damp(b.position.y,-.75,7,dt);b.aabbNeedsUpdate=true;this.owner.world.broadphase.dirty=true;b.velocity.setZero();b.force.setZero();}
   else{b.type=Body.DYNAMIC;b.force.x-=this.stroke*.55+b.velocity.x*2.2;if(b.position.x<-21){b.position.x=-21;b.velocity.x=Math.max(0,b.velocity.x);}b.force.y+=b.mass*19.5;}
  },sync(dt){if(this.body){mesh.position.x=this.body.position.x;mesh.position.y=this.body.position.y;}mesh.updateWorldMatrix(true,false);const bounds=new THREE.Box3().setFromObject(mesh);bounds.getCenter(collider.mesh.position);collider.mesh.scale.set(1,1,1);collider.mesh.updateWorldMatrix(true,false);collider.box.copy(bounds);bridge.stations[1].x=-19+this.stroke;bridge.stations[1].z=-1-24*this.stroke/13;bridge.target=1;},
 };
 const fan=k.projector([25,1.0,20],[-1,0,0],{radius:.70,rotating:true});
 const drawing=beamDrawing(k.world,0xa3e6dc,.045),air={segments:[]};
 k.ticks.unshift(dt=>{rack.sync(dt);for(const cover of [inspection,inspectionTop,...edgeLeaves,roof]){cover.target=rack.latched;cover.update(dt);}air.segments=tracePortalRay(game,fan.position.clone().addScaledVector(fan.normal,.04),fan.normal,{medium:'air',length:100});drawing.update(air.segments);});
 k.forces.push(dt=>{rack.forces(dt);if(game.heldCube||!game.physics?.cargoBody)return;const b=game.physics.cargoBody,a=airAcceleration(air.segments,V(b.position.x,b.position.y,b.position.z),V(b.velocity.x,b.velocity.y,b.velocity.z),{speed:13,radius:1.1,response:8,maximum:75});if(a.lengthSq()){b.wakeUp();b.force.x+=a.x*b.mass;b.force.y+=a.y*b.mass;b.force.z+=a.z*b.mass;}});
 k.resets.push(()=>rack.reset());
 // The rod and the long rack scale are a displayed mechanical connection,
 // outside the walking face and behind the cargo contact plane.
 for(let i=0;i<=13;i++)k.block([-21+i,2.4,11.4],[.12,.32,.15],'metal',false);
 k.block([-14.5,2.14,11.4],[13.6,.12,.20],'metal');
 k.display([0,19,-27.0],()=>`РЕЙКА ${rack.stroke.toFixed(1)} / 13 м\n${rack.latched?'ХРАПОВИК УДЕРЖИВАЕТ МОСТ':'МОСТ ДВИЖЕТ РЕАЛЬНЫЙ ГРУЗ'}`,24,2);
 k.label('31 / ГРУЗОВОЙ РЕЙК',[0,21,-27],[0,0,1],23,1.1);
 // Full stroke lowers the contact shoe and raises the real inspection roof.
 // The stop still catches residual cargo speed; the observer jumps over it
 // to recover the same body before taking the separate western ascent.
 const l=finish(k,[-23,0,23],[-25,.6,21],[18,6,-20],{rack,bridge,dispatch,mouth,intake,inspection,hood,air,spawnView:{yaw:.2,pitch:-.1}},
  {'rake-dispatch':'send the original cargo into an isolated low guide','rake-mouth':'shared freight and air address, too short for the observer','rake-air-intake':'reroute actual air onto the original free body'},
  ['the load is a moving actuator rather than a pressure key','air alone exerts no force on the rack','continued cargo contact produces visible horizontal displacement','the ratchet preserves a real completed bridge after flow ends','full mechanical stroke opens a manufactured inspection face to recover the same actuator','the observer uses a separate ramp to reach the mechanically completed bridge']);
 const dispose=l.dispose;l.dispose=()=>{if(rack.body&&rack.owner?.world)rack.owner.world.removeBody(rack.body);dispose();};return l;
}
