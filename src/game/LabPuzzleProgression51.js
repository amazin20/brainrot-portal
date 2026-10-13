import * as THREE from 'three';
import {Body,Box,Vec3,Material,LockConstraint,ConvexPolyhedron} from 'cannon-es';
import {ResearchChamber} from './LabResearchArt.js';
import {TravellingPulseField} from './LabTravellingPulse.js';
import {buildTransferFunnel} from './LabTransferFunnel.js';
import {dressPuzzleProgression51} from './LabPuzzleProgression51Art.js';
const V=(...p)=>new THREE.Vector3(...p),Q=()=>new THREE.Quaternion();
export const PROGRESSION51_SPEC=Object.freeze({id:'puzzle-progression51-mechanical-echo',title:'Эхо горизонта · обратный двор',accent:0x8ce4da,assets:[1,2,11,22,23,24],
 concept:'Отправленный импульс переживает перестановку единственной пары. Два настоящих пружинных приёмника отводят физические упоры двери с контргрузом; исходный весовой груз нужно вернуть через новый сервисный двор.',
 description:'Закрытый весовой колодец питает ударник. Длинная и короткая ветви ведут к двум подпружиненным стопорам. За дверью находится возврат исходного груза.',
 hints:['Низкая щель допускает груз. Весовая чаша и ударник — настоящие движущиеся детали.','Вышедшее из портала кольцо продолжает свой полёт. Разные расстояния позволяют переставить ту же пару между ударами.','Два стопора возвращаются пружинами. Дверь с контргрузом проходит их только при совместном освобождении; сервисный двор возвращает исходный груз.']});
function movingProxy(k,mesh,name){mesh.name=name;mesh.updateWorldMatrix(true,false);const c={mesh,box:new THREE.Box3().setFromObject(mesh),enabled:true,kinematic:true};k.game.colliders.push(c);k.game.cameraBlockers.push(mesh);k.game.aimBlockers.push(mesh);return c;}
function apparatus(k){
 const g=k.game,mat=new Material({friction:.8,restitution:0}),parts=[],colliders=[],bodies=[],anchors=[],constraints=[];
 const part=(name,p,size,colour='metal')=>{const mesh=k.geometry(new THREE.BoxGeometry(...size),colour,p,Q(),{batch:false,name});parts.push(mesh);const collider=movingProxy(k,mesh,name);colliders.push(collider);return {mesh,collider,p,size};};
 const cupPart=part('51 / real live cargo weighing cup',[8,.44,19],[3,.28,3.2]);
 const gatePart=part('51 / actual counterweighted door',[0,4,-12],[6,8,.72],'secondary');
 const weightPart=part('51 / gravity counterweight',[8,12,-12],[2,2,1.6],'metal');
 const pistonPart=part('51 / real spring striker',[4.7,4.4,19],[.65,.65,.65],'secondary');
 const heads=[1,-1].map((sign,i)=>{const head=part(`51 / ${i?'short':'long'} spring receiver`,[sign*15,4.4,22],[1.8,1.8,.32],'secondary');const pin=part(`51 / ${i?'short':'long'} real door stopper`,[sign*2.2,8.35,-12],[.8,.5,1.2],'metal');const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute([[-.4,-.17,-.6],[.4,-.17,-.6],[.4,.25,-.6],[-.4,.25,-.6],[-.4,-.25,.6],[.4,-.25,.6],[.4,.25,.6],[-.4,.25,.6]].flat(),3));geo.setIndex([3,2,1,3,1,0,4,5,6,4,6,7,0,1,5,0,5,4,1,2,6,1,6,5,2,3,7,2,7,6,3,0,4,3,4,7]);geo.setAttribute('uv',new THREE.Float32BufferAttribute([0,0,1,0,1,1,0,1,0,0,1,0,1,1,0,1],2));geo.computeVertexNormals();pin.mesh.geometry.dispose();pin.mesh.geometry=geo;return {head,pin,sign,body:null,position:V(sign*15,4.4,22),normal:V(0,0,-1),radius:.7,name:i?'short':'long',index:i};});
 const a={owner:null,cup:null,gate:null,weight:null,piston:null,pistonLock:null,rewinding:false,heads,ready:false,impactCount:0,ropeTension:0,
  ensure(){if(!g.physics||this.owner===g.physics)return;this.owner=g.physics;for(const c of colliders)this.owner.removeStaticBox(c.mesh.uuid);
   const dynamic=(mass,p,size,factor)=>{const b=new Body({mass,position:new Vec3(...p),shape:new Box(new Vec3(...size.map(x=>x/2))),linearFactor:new Vec3(...factor),fixedRotation:true,allowSleep:false,linearDamping:.02,material:mat,collisionFilterGroup:1,collisionFilterMask:3});this.owner.world.addBody(b);bodies.push(b);return b;};
   this.cup=dynamic(6,cupPart.p,cupPart.size,[0,1,0]);this.gate=dynamic(15,gatePart.p,gatePart.size,[0,1,0]);this.weight=dynamic(18,weightPart.p,weightPart.size,[0,1,0]);this.piston=dynamic(2,pistonPart.p,pistonPart.size,[1,0,0]);
   for(const r of heads){r.body=dynamic(4,r.head.p,r.head.size,[0,0,1]);r.body.material=new Material({friction:0,restitution:0});r.body.addShape(new ConvexPolyhedron({vertices:[[-.4,-.17,-.6],[.4,-.17,-.6],[.4,.25,-.6],[-.4,.25,-.6],[-.4,-.25,.6],[.4,-.25,.6],[.4,.25,.6],[-.4,.25,.6]].map(p=>new Vec3(...p)),faces:[[3,2,1,0],[4,5,6,7],[0,1,5,4],[1,2,6,5],[2,3,7,6],[3,0,4,7]]}),new Vec3(r.sign*-12.8,3.95,-34));}
   const stop=(p,size,mask=1)=>{const b=new Body({mass:0,position:new Vec3(...p),shape:new Box(new Vec3(...size.map(x=>x/2))),collisionFilterGroup:1,collisionFilterMask:mask});this.owner.world.addBody(b);bodies.push(b);k.block(p,size,'metal',false);return b;};
   this.impactStop=stop([3.65,4.4,19],[.35,1.1,1.1]);stop([5.8,4.4,19],[.3,1.1,1.1]);stop([8,-.15,19],[3,.25,3.2]);stop([0,16.35,-12],[6,.45,.72]);stop([8,1.2,-12],[2,.35,1.6]);
   for(const r of heads){stop([r.sign*15,4.4,21.45],[2,.7,.22]);stop([r.sign*15,4.4,24.7],[2,.7,.22]);}
   this.anchor=new Body({mass:0,position:new Vec3(...pistonPart.p),collisionFilterMask:0});this.owner.world.addBody(this.anchor);anchors.push(this.anchor);
   this.capture();
   this.hit=e=>{if(e.body!==this.impactStop||this.rewinding||this.piston.velocity.x>-.2)return;this.impactCount++;this.rewinding=true;k.state.field?.emit(V(3.40,4.4,19),V(-1,0,0));g.audio?.mechanism?.('impact');};this.piston.addEventListener('collide',this.hit);
   this.preStep=()=>this.forces();this.owner.world.addEventListener('preStep',this.preStep);
  },loaded(){return !g.heldCube&&this.owner?.world.contacts.some(c=>(c.bi===this.cup&&c.bj===g.physics.cargoBody)||(c.bj===this.cup&&c.bi===g.physics.cargoBody));},
  powered(){return this.loaded()&&this.cup.position.y<.34;},
  capture(){if(this.pistonLock)return;this.anchor.position.copy(this.piston.position);this.pistonLock=new LockConstraint(this.anchor,this.piston,{maxForce:1e5,collideConnected:false});this.owner.world.addConstraint(this.pistonLock);constraints.push(this.pistonLock);this.rewinding=false;this.ready=true;},
  fire(){this.ensure();if(!this.powered()||!this.pistonLock)return false;this.owner.world.removeConstraint(this.pistonLock);this.pistonLock=null;this.ready=false;this.piston.wakeUp();return true;},
  forces(){
   const c=this.cup,p=this.piston; c.force.y+=c.mass*19.5+220*(.44-c.position.y)-40*c.velocity.y;
   p.force.x+=(this.rewinding?(this.powered()?140:0):-120*(p.position.x-3.5))-14*p.velocity.x;
   for(const r of heads)r.body.force.z+=-20*(r.body.position.z-22)-2.0*r.body.velocity.z;
   const extension=16-(this.gate.position.y+this.weight.position.y),speed=this.gate.velocity.y+this.weight.velocity.y;
   this.ropeTension=Math.max(0,1100*extension-130*speed);this.gate.force.y+=this.ropeTension-12*this.gate.velocity.y;this.weight.force.y+=this.ropeTension-12*this.weight.velocity.y;
  },update(){this.ensure();const map=[[cupPart,this.cup],[gatePart,this.gate],[weightPart,this.weight],[pistonPart,this.piston]];for(const r of heads){map.push([r.head,r.body]);r.pin.mesh.position.set(r.sign*2.2,8.35,r.body.position.z-34);r.position.set(r.body.position.x,r.body.position.y,r.body.position.z-.17);}
   for(const [part,b]of map)part.mesh.position.set(b.position.x,b.position.y,b.position.z);
   if(this.rewinding&&this.powered()&&this.piston.position.x>4.68&&this.piston.velocity.x>0)this.capture();
   for(const c of colliders){c.mesh.updateWorldMatrix(true,false);c.box.setFromObject(c.mesh);this.owner.removeStaticBox(c.mesh.uuid);}
  },reset(){this.ensure();if(this.pistonLock)this.owner.world.removeConstraint(this.pistonLock);this.pistonLock=null;for(const [b,p]of [[this.cup,cupPart.p],[this.gate,gatePart.p],[this.weight,weightPart.p],[this.piston,pistonPart.p],...heads.map(r=>[r.body,r.head.p])]){b.position.set(...p);b.velocity.setZero();b.force.setZero();b.quaternion.set(0,0,0,1);b.wakeUp();}this.impactCount=0;this.rewinding=false;this.capture();this.update();},
  dispose(){if(!this.owner)return;this.owner.world.removeEventListener('preStep',this.preStep);this.piston.removeEventListener('collide',this.hit);if(this.pistonLock)this.owner.world.removeConstraint(this.pistonLock);for(const b of [...bodies,...anchors])this.owner.world.removeBody(b);this.owner=null;},parts,colliders,bodies,get opened(){return (this.gate?.position.y??4)>7.1;}
 };
 k.ticks.push(()=>a.update());k.resets.push(()=>a.reset());k.state.apparatus=a;return a;
}
export function buildPuzzleProgression51(game,index=50){
 const k=new ResearchChamber(game,PROGRESSION51_SPEC,index,'current',{minX:-24,maxX:24,minZ:-30,maxZ:26},0,19);
 // A sealed freight well has a real low viewing throat, a roof and two cheeks.
 k.block([4.7,1.65,19],[.35,3.3,4.2],'shell');k.block([11.3,1.65,19],[.35,3.3,4.2],'shell');k.block([8,3.15,19],[6.8,.4,4.2],'secondary');
 k.block([8,.15,16.95],[6.8,.3,.28],'metal');k.block([8,2.7,16.95],[6.8,1.1,.28],'shell');k.block([8,1.6,21.1],[6.8,3.2,.35],'shell');
 const cargoInput=k.loadPad('cargo-feed',[-6,0,21],6);cargoInput.surface.mesh.userData.portalSize={width:2,height:2};
 const freight=k.panel('well-freight',[8,1.55,20.83],[0,0,-1],5,2.1);freight.mesh.userData.portalSize={width:2,height:.85};
 const source=k.panel('echo-source',[-3,4.4,19],[1,0,0],4.8,5.2);source.mesh.userData.portalSize={width:.65,height:.65};
 const long=k.panel('echo-long',[15,4.4,-8],[0,0,1],5.2,5.2),short=k.panel('echo-short',[-15,4.4,11],[0,0,1],5.2,5.2);for(const p of [long,short])p.mesh.userData.portalSize={width:.65,height:.65};
 k.projector([3.4,4.4,19],[-1,0,0],{radius:.65});
 const a=apparatus(k),field=new TravellingPulseField(game,{speed:10,lifetime:10,maxPackets:8,onArrival(sensor,event){const r=a.heads[sensor.index];r.body.wakeUp();r.body.applyImpulse(new Vec3(0,0,18));event.actualReceiverBody=r.body.id;game.audio?.mechanism?.('switch');}});field.receivers=a.heads;k.state.field=field;
 // Every opaque bulkhead has a visible, exact box. The only pedestrian opening
 // is physically occupied by the counterweighted dynamic door.
 k.block([-13.5,9.5,-12],[21,19,.72],'shell');k.block([13.5,9.5,-12],[21,19,.72],'shell');k.block([0,16,-12],[6,6,.72],'shell');
 for(const x of [-3.5,3.5])k.block([x,7,-12],[.4,14,1.1],'metal');
 // Receiver rails and measuring hoops reveal actual flight lengths.
 for(const [x,z0,z1]of [[15,-8,22],[-15,11,22]]){for(const side of [-1,1])k.block([x+side*.95,3.25,(z0+z1)/2],[.12,.12,z1-z0],'metal');for(let z=z0+3;z<z1-1;z+=5)k.geometry(new THREE.TorusGeometry(.75,.045,6,24),'secondary',[x,4.4,z],Q(),{name:'51 / real packet sight hoop'});}
 const striker=k.control('echo-striker',[0,0,16.5],()=>a.fire(),'E — отпустить взведённый пружинный ударник. Живой груз питает обратный взвод.');
 const returnPad=k.loadPad('return-freight',[12,0,-23],6);returnPad.surface.mesh.userData.portalSize={width:2,height:2};
 const returnField=buildTransferFunnel(k,{origin:[8,1.55,20.8],direction:[0,0,-1],radius:1.6,speed:4});returnField.enabled=false;returnField.reversed=true;
 const service=k.control('well-return',[5,0,-17],()=>{returnField.enabled=!returnField.enabled;returnField.reversed=true;returnField.update(0);},'E — включить / выключить реальный грузовой возврат.');
 k.forces.push(()=>{if(game.heldCube||!returnField.enabled||!game.physics?.cargoBody)return;const b=game.physics.cargoBody,v=returnField.acceleration(V(b.position.x,b.position.y,b.position.z),V(b.velocity.x,b.velocity.y,b.velocity.z),.39);b.force.x+=v.x*b.mass;b.force.y+=v.y*b.mass;b.force.z+=v.z*b.mass;if(v.lengthSq())b.wakeUp();});
 const rings=Array.from({length:field.maxPackets},()=>k.geometry(new THREE.TorusGeometry(.25,.065,6,20),'light',[0,0,0],Q(),{batch:false,name:'51 / finite travelling packet'}));
 k.ticks.push(dt=>field.step(dt));k.renders.push(alpha=>rings.forEach((m,i)=>{const p=field.packets[i];m.visible=!!p;if(p){m.position.lerpVectors(p.previous,p.position,alpha);m.quaternion.setFromUnitVectors(V(0,0,1),p.direction);}}));
 k.resets.push(()=>{field.reset();returnField.enabled=false;returnField.reversed=true;returnField.update(0);rings.forEach(m=>m.visible=false);});
 k.label('51 / ЭХО ГОРИЗОНТА',[0,15,-10.95],[0,0,1],21,1.1);k.label('ДАЛЬНИЙ ХОД',[15,8,-8],[0,0,1],8,.65);k.label('БЛИЖНИЙ ХОД',[-15,8,11],[0,0,1],8,.65);k.label('ЖИВОЙ ВЕС / ВЗВОД',[8,3.6,17],[0,0,-1],8,.6);k.label('ОБРАТНЫЙ ДВОР',[0,12,-28.5],[0,0,1],18,1);
 const art=dressPuzzleProgression51(k,{apparatus:a,field,striker,service});
 const l=k.finishResearch([-2,0,13],[-7,.6,24.5],[0,0,-25],{puzzleProgression:51,puzzleProgression51:true,apparatus:a,field,source,intake:source,long,short,cargoInput,freight,returnPad,returnField,striker,service,art,spawnView:{yaw:0,pitch:-.04},cargoOnAnyPad:()=>a.loaded()||cargoInput.loaded()||returnPad.loaded()});
 const dispose=l.dispose;l.dispose=()=>{a.dispose();dispose();};
 l.getContextLesson=()=>['progression51-mechanical-echo','ЛКМ / ПКМ · E',PROGRESSION51_SPEC.description,false];l.getObjective=()=>a.opened?'Сервисный двор открыт. Исходный груз остаётся в весовом колодце.':'Приёмники отводят настоящие подпружиненные стопоры. Контргруз поднимает дверь физически.';
 l.puzzleGeometry={noProgressFlags:true,phaseCount:13,recoveryFloor:0,cargoThroatHeight:1.85,dependencies:['address-low-freight-well-with-single-pair','deliver-original-cargo-to-actual-dynamic-weighing-cup','live-load-depresses-cup-and-powers-physical-rewind','address-source-and-long-branch','release-real-striker-lock','physical-striker-impact-emits-finite-packet','departed-packet-survives-pair-retarget','reuse-live-load-to-rewind-striker','time-short-path-by-visible-long-packet','two-dynamic-pushrods-withdraw-real-contact-stops','gravity-counterweight-lifts-real-door','new-service-view-reroutes-the-pair-to-retrieve-original-load','reunite-original-actors-in-return-court']};return l;
}
