import * as THREE from 'three';
import {Body,Box,Vec3,Material} from 'cannon-es';
import {ResearchChamber} from './LabResearchArt.js';
import {cargoLoadsPlate} from './LabPlateContact.js';
import {dressPuzzleProgression48} from './LabPuzzleProgression48Art.js';
const V=(...p)=>new THREE.Vector3(...p);
export const PROGRESSION48_SPEC=Object.freeze({
 id:'puzzle-progression48-open-rail',title:'Разомкнутый рельс',accent:0xe8b98b,assets:[1,2,11,22,23,24],
 concept:'Свободный спутник двигает пружинную каретку магнитом. Настоящий поперечный штифт сохраняет первый причал и открывает грузовое окно. Тот же спутник становится упором второго причала.',
 description:'Белый адрес находится на подвижной каретке. Под ней видны грузовой канал, катушка, пружина и поперечный фиксатор.',
 hints:['Магнит тянет свободного спутника по каналу. Его контакт с башмаком сдвигает белый адрес к первому причалу.','Поперечный штифт входит в настоящий паз. Он удерживает каретку и отводит крышку грузового окна; постоянная галерея сохраняет новый ракурс.','Верни спутника через открытое окно. Низкое гнездо на другом конце рельса имеет твёрдую заднюю стенку: свободный вес может остановить обратный ход.'],
});
/** Every moving machine body stays DYNAMIC. Guides are linear factors, travel
 * limits and retention are actual body contacts. No target-coordinate clamp,
 * STATIC latch or actor/cargo placement is used during ordinary stepping. */
function railMachine(k,cargoRailProxy){
 const g=k.game,carGroup=new THREE.Group(),pinGroup=new THREE.Group(),roofGroup=new THREE.Group(),stopGroup=new THREE.Group(),trapGroup=new THREE.Group();
 carGroup.name='48 / dynamic spring rail carriage';pinGroup.name='48 / removable transverse contact pin';roofGroup.name='48 / physical pin-operated freight roof';k.world.root.add(carGroup,pinGroup,roofGroup,stopGroup,trapGroup);
 const parts=[];
 const piece=(p,s,mat,parent)=>{const m=k.block(p,s,mat,false,parent,.045);parts.push(m);return m;};
 // A two-sided notch is open at the rear. The transverse pin is narrower than
 // the actual gap, but meets both X walls when the spring applies its load.
 const carShapes=[{p:[-1.05,.1,0],s:[.9,1.3,2.4]},{p:[1.05,.1,0],s:[.9,1.3,2.4]},{p:[0,-.15,2.4],s:[3,1.3,.4]},{p:[-1.05,-1.35,-1.2],s:[.9,.6,.6]},{p:[1.05,-1.35,-1.2],s:[.9,.6,.6]},{p:[-1.05,-.9,-1.2],s:[.9,.4,.3]},{p:[1.05,-.9,-1.2],s:[.9,.4,.3]}];
 for(const s of carShapes)piece(s.p,s.s,'metal',carGroup);
 // The portal frame is attached above the real shoe. Its ordinary moving
 // backing is separate from the dynamic shoe and can open for portal transit.
 for(const x of [-2.7,2.7])piece([x,3.45,2.2],[.3,7,.3],'shell',carGroup);
 const moving=k.panel('moving-address',[0,6.85,3],[0,0,1],7.6,5.8,carGroup,true);moving.mesh.userData.portalSize={width:2.0,height:2.1};
 const pinMesh=piece([0,0,0],[.5,.4,4.8],'secondary',pinGroup);
 const roof=piece([0,0,0],[2.8,.45,3.2],'secondary',roofGroup),roofSkirt=piece([0,-1,-1.9],[2.8,2,.3],'secondary',roofGroup);roofGroup.position.set(10.3,5.7,-14.6);roofGroup.updateWorldMatrix(true,true);
 const roofSkirtProxy=g.collisionProxy(new THREE.Box3().setFromObject(roofSkirt),{kinematic:true});roofSkirtProxy.mesh.name='48 / pin-lid real rear inspection skirt';
 const roofProxy=g.collisionProxy(new THREE.Box3().setFromObject(roof),{kinematic:true});roofProxy.mesh.name='48 / pin-linked roof actual capsule and ray collider';
 const stopMesh=piece([0,0,0],[.35,1.4,.3],'secondary',stopGroup);stopGroup.position.set(3.5,2.0,-12.15);stopGroup.updateWorldMatrix(true,true);const stopProxy=g.collisionProxy(new THREE.Box3().setFromObject(stopMesh),{kinematic:true});stopProxy.mesh.name='48 / real movable rear socket back';
 const trapMesh=piece([0,0,0],[1.3,.4,3.0],'metal',trapGroup),trapGuard=piece([.05,-.10,1.65],[2.0,.4,.3],'secondary',trapGroup);trapGroup.rotation.x=-.08;trapGroup.position.set(4.45,3.15,-12.9);trapGroup.updateWorldMatrix(true,true);const trapProxy=g.collisionProxy(new THREE.Box3().setFromObject(trapMesh),{kinematic:true});trapProxy.mesh.name='48 / real force-driven cargo support release';const trapGuardProxy=g.collisionProxy(new THREE.Box3().setFromObject(trapGuard),{kinematic:true});trapGuardProxy.mesh.name='48 / real moving cargo cradle front guard';
 const carProxies=carShapes.map((s,i)=>{const c=g.collisionProxy(new THREE.Box3().setFromObject(parts[i]),{kinematic:true});c.mesh.name='48 / actual dynamic carriage shape '+i;return c;}),pinProxy=g.collisionProxy(new THREE.Box3().setFromObject(pinMesh),{kinematic:true});pinProxy.mesh.name='48 / actual dynamic transverse pin';
 const machine={trapGuard,trapGuardProxy,trapGroup,trapProxy,roofSkirtProxy,carProxies,pinProxy,carGroup,pinGroup,roofGroup,stopGroup,stopMesh,stopProxy,moving,roofProxy,owner:null,body:null,pinBody:null,roofBody:null,stopBody:null,trapBody:null,trapLowered:false,bodies:[],flux:0,magnet:false,pinRequested:false,stopRaised:false,contacts:{cargoCarriage:0,pinCarriage:0,cargoStop:0},
  ensure(){if(!g.physics||this.owner===g.physics)return;this.disposeBodies();this.owner=g.physics;g.physics.removeStaticBox(cargoRailProxy.mesh.uuid);g.physics.removeStaticBox(roofProxy.mesh.uuid);g.physics.removeStaticBox(roofSkirtProxy.mesh.uuid);g.physics.removeStaticBox(stopProxy.mesh.uuid);g.physics.removeStaticBox(trapProxy.mesh.uuid);g.physics.removeStaticBox(trapGuardProxy.mesh.uuid);for(const c of [...carProxies,pinProxy])g.physics.removeStaticBox(c.mesh.uuid);const world=g.physics.world,material=new Material({friction:.08,restitution:0});
   const add=(mass,p,linearFactor,shapes)=>{const b=new Body({mass,position:new Vec3(...p),linearFactor:new Vec3(...linearFactor),fixedRotation:true,allowSleep:false,linearDamping:.025,material,collisionFilterGroup:1,collisionFilterMask:3});for(const s of shapes)b.addShape(new Box(new Vec3(...s.s.map(n=>n/2))),new Vec3(...s.p));world.addBody(b);this.bodies.push(b);return b;};
   this.body=add(6,[0,4.6,-15],[1,0,0],carShapes);
   this.pinBody=add(4,[12,3.2,-20],[0,0,1],[{p:[0,0,0],s:[.5,.4,4.8]}]);
   this.roofBody=add(3,[10.3,5.7,-14.6],[1,0,0],[{p:[0,0,0],s:[2.8,.45,3.2]},{p:[0,-1,-1.9],s:[2.8,2,.3]}]);
   // These supports are not distant-streamed LabPhysics solids. They retain
   // mutual contacts with the own dynamic carriage and the original cargo.
   const stop=(p,s,name)=>{const b=add(0,p,[0,0,0],[{p:[0,0,0],s}]);b.name=name;return b;};
   stop([3.9,4.35,-13.1],[2.6,1.0,.3],'solid cargo pocket rear guide');stop([-1.9,4.6,-15.9],[.5,1.4,.4],'left spring travel buffer');stop([13.8,4.6,-15.9],[.6,1.4,.4],'right spring travel buffer');
   this.stopBody=add(4,[3.5,1.5,-12.15],[0,1,0],[{p:[0,0,0],s:[.35,1.4,.3]}]);this.stopBody.name='solid rear cargo stop socket';this.trapBody=add(5,[4.45,3.15,-12.4],[0,1,0],[{p:[0,0,0],s:[1.3,.4,3.0]},{p:[.05,-.10,1.65],s:[2.0,.4,.3]}]);this.trapBody.material=new Material({friction:0,restitution:0});this.trapBody.quaternion.setFromAxisAngle(new Vec3(1,0,0),-.08);
   this.preStep=()=>{const b=this.body,p=this.pinBody,r=this.roofBody,s=this.stopBody,t=this.trapBody;for(const x of [b,p,r,s,t])x.force.y+=x.mass*19.5;
    b.force.x+=-b.position.x*8-b.velocity.x*19;t.force.y+=((this.trapLowered?2.1:3.15)-t.position.y)*5000-t.velocity.y*350;s.force.y+=((this.stopRaised?4.2:1.5)-s.position.y)*5000-s.velocity.y*350;
    p.force.z+=((this.pinRequested?-14.7:-20)-p.position.z)*100-p.velocity.z*38;
    const extension=THREE.MathUtils.clamp((p.position.z+20)/5.3,0,1);
    r.force.x+=(10.3+5.2*extension-r.position.x)*100-r.velocity.x*35;
    this.flux+=((this.magnet?1:0)-this.flux)*(1-Math.exp(-5/120));if(this.flux>1e-5&&!g.heldCube){const cargo=g.physics.cargoBody;if(cargo.position.y>2.9&&cargo.position.y<5.3&&cargo.position.z>-16&&cargo.position.z<-13.7){cargo.wakeUp();cargo.force.y+=this.flux*cargo.mass*(19.5+THREE.MathUtils.clamp((4.4-cargo.position.y)*55-cargo.velocity.y*14,-30,70));cargo.force.x+=this.flux*THREE.MathUtils.clamp((15-cargo.position.x)*50-cargo.velocity.x*12,-70,70)*cargo.mass;cargo.force.z+=this.flux*THREE.MathUtils.clamp((-14.6-cargo.position.z)*30-cargo.velocity.z*10,-30,30)*cargo.mass;}}
    for(const c of world.contacts){const pair=(a,b)=>(c.bi===a&&c.bj===b)||(c.bi===b&&c.bj===a);if(pair(this.body,g.physics.cargoBody))this.contacts.cargoCarriage++;if(pair(this.body,this.pinBody))this.contacts.pinCarriage++;if((c.bi===g.physics.cargoBody&&c.bj.name==='solid rear cargo stop socket')||(c.bj===g.physics.cargoBody&&c.bi.name==='solid rear cargo stop socket'))this.contacts.cargoStop++;}
   };world.addEventListener('preStep',this.preStep);this.sync(0);
  },
  sync(dt){this.ensure();if(!this.body)return;trapGroup.position.copy(this.trapBody.position);trapGroup.updateWorldMatrix(true,true);trapProxy.box.setFromObject(trapMesh);trapProxy.mesh.position.copy(trapProxy.box.getCenter(V()));trapProxy.mesh.updateWorldMatrix(true,false);trapGuardProxy.box.setFromObject(trapGuard);trapGuardProxy.mesh.position.copy(trapGuardProxy.box.getCenter(V()));trapGuardProxy.mesh.updateWorldMatrix(true,false);carGroup.position.copy(this.body.position);pinGroup.position.copy(this.pinBody.position);roofGroup.position.copy(this.roofBody.position);stopGroup.position.copy(this.stopBody.position);stopGroup.updateWorldMatrix(true,true);stopProxy.box.setFromObject(stopMesh);stopProxy.mesh.position.copy(stopProxy.box.getCenter(V()));stopProxy.mesh.updateWorldMatrix(true,false);carGroup.updateWorldMatrix(true,true);for(let i=0;i<carProxies.length;i++){carProxies[i].box.setFromObject(parts[i]);carProxies[i].mesh.position.copy(carProxies[i].box.getCenter(V()));carProxies[i].mesh.updateWorldMatrix(true,false);}pinGroup.updateWorldMatrix(true,true);roofGroup.updateWorldMatrix(true,true);pinProxy.box.setFromObject(pinMesh);pinProxy.mesh.position.copy(pinProxy.box.getCenter(V()));pinProxy.mesh.updateWorldMatrix(true,false);moving.sync(dt);roofSkirtProxy.box.setFromObject(roofSkirt);roofSkirtProxy.mesh.position.copy(roofSkirtProxy.box.getCenter(V()));roofSkirtProxy.mesh.updateWorldMatrix(true,false);roofProxy.box.setFromObject(roof);roofProxy.mesh.position.copy(roofProxy.box.getCenter(V()));roofProxy.mesh.updateWorldMatrix(true,false);},
  reset(){this.ensure();this.magnet=this.pinRequested=this.stopRaised=this.trapLowered=false;this.flux=0;this.contacts={cargoCarriage:0,pinCarriage:0,cargoStop:0};for(const [b,p]of [[this.body,[0,4.6,-15]],[this.pinBody,[12,3.2,-20]],[this.roofBody,[10.3,5.7,-14.6]],[this.stopBody,[3.5,1.5,-12.15]],[this.trapBody,[4.45,3.15,-12.4]]])if(b){b.position.set(...p);b.previousPosition.copy(b.position);b.interpolatedPosition.copy(b.position);b.velocity.setZero();b.force.setZero();b.aabbNeedsUpdate=true;}this.sync(0);},
  disposeBodies(){if(this.owner){if(this.preStep)this.owner.world.removeEventListener('preStep',this.preStep);for(const b of this.bodies)this.owner.world.removeBody(b);}this.bodies=[];this.owner=null;},
  get x(){return this.body?.position.x??0;},get pinExtension(){return this.pinBody?.position.z+20||0;},get roofOpen(){return this.roofBody?.position.x>14.0;},
 };
 k.ticks.push(dt=>machine.sync(dt));k.resets.push(()=>machine.reset());k.renders.push(()=>machine.sync(0));return machine;
}
export function buildPuzzleProgression48(g,index=47){
 const k=new ResearchChamber(g,PROGRESSION48_SPEC,index,'tidal',{minX:-28,maxX:30,minZ:-36,maxZ:27},0,26);
 const entry=k.deck('Rail departure and ordinary service court',-26,26,10,25,8);
 k.ramp('Physical lower service return',-26,-18,-6,10,0,8);
 const gallery=k.deck('Permanent eastern inspection gallery',9,28,-10,8,8);
 const goal=k.deck('Separate final receiving laboratory',-8,8,-10,6,8);
 k.deck('Permanent final west inspection arm',-22,-10,-24,-10,8);k.deck('Permanent final dogleg connector',-22,8,-10,-2,8);
 k.block([-11,10,-24],[22,4,.4],'shell');k.block([-9.8,7,-20.75],[.4,14,6.5],'shell');
 // The two landing bores are separated by a real roof-high partition. Neither
 // the moving frame nor an arbitrary time in its stroke opens a walking path.
 k.block([8.5,13,-5],[.8,26,16],'shell');k.block([8.5,13,9.5],[.8,26,3],'shell');k.block([8.5,14.6,5.5],[.8,22.8,5],'shell');
 const intake=k.panel('departure',[-18,10.85,22],[0,0,-1],8,5.8);
 // Cargo channel lies four metres above the recovery floor and under a low
 // roof: the original traveller can drive the shoe, a standing person cannot.
 const freightFloors=[],freightFrontFloors=[];for(const [a,b,y]of [[-10,2.6,4],[2.6,5.6,2.7],[5.6,8.0,4],[8.0,11.5,2.7],[11.5,20,4]]){k.block([(a+b)/2,y-.3,-14.825],[b-a,.6,3.05],'floor');freightFloors.push(k.envelopes.at(-1));k.block([(a+b)/2,2.4,-12.175],[b-a,.6,2.25],'floor');freightFrontFloors.push(k.envelopes.at(-1));}
 const inspectionGlass=new THREE.MeshStandardMaterial({name:'48 / solid magnetic inspection glass',color:0xaad9cc,transparent:true,opacity:.22,roughness:.24,metalness:.08,depthWrite:false});
 for(const [a,b]of [[-10,8.9],[11.7,20]])k.block([(a+b)/2,4.6,-16.65],[b-a,1.2,.4],'shell');k.block([10.3,3.25,-16.65],[2.8,.9,.4],'shell');
 for(const [a,b]of [[-10,3],[7.9,20]]){k.block([(a+b)/2,4,-10.75],[b-a,.3,.4],'shell');k.block([(a+b)/2,5.8,-10.75],[b-a,1.1,.4],'shell');k.block([(a+b)/2,4.75,-10.75],[b-a,1.2,.4],inspectionGlass);}k.block([5.45,5.975,-10.75],[4.9,.75,.4],'shell');
 const restoreGlass=k.restoreLight.bind(k);k.restoreLight=()=>{inspectionGlass.dispose();restoreGlass();};
 k.block([-10.2,5.1,-13.7],[.4,2.2,6],'shell');k.block([20.2,5.1,-13.7],[.4,2.2,6],'shell');
 // Roof has two actual inspection apertures. The east one is pin operated;
 // the west one only addresses the solid-backed second stop socket.
 for(const [x,w]of [[-7,6],[6.6,3.2],[15.6,8.8]])k.block([x,5.7,-13.7],[w,.45,5.7],'shell');
 const recover=k.loadPad('original-cargo-window',[9.5,2.7,-14.6],3.0);recover.surface.mesh.userData.portalSize={width:1.28,height:1.16};recover.surface.mesh.userData.portalBackingIds=[freightFloors[3].mesh.uuid];
 const socket=k.loadPad('shore-stop',[3.8,2.7,-12.5],2.8);socket.surface.mesh.userData.portalSize={width:1.16,height:1.16};socket.surface.mesh.userData.portalBackingIds=[freightFrontFloors[1].mesh.uuid];
 // Freight floor windows have recessed physical rims: a horizontal cargo
 // must meet the drive shoe, not stop on a raised decorative portal curb.
 for(const pad of [recover,socket]){for(const c of pad.surface.frameColliders){c.local.translate(V(0,0,-.36));g.syncCollision(c,c.local.clone().applyMatrix4(pad.surface.group.matrixWorld),0);}for(const mesh of pad.surface.group.children)if(mesh!==pad.surface.mesh&&mesh.position.z===-.2)mesh.position.z-=.36;}
 k.block([3.9,4.35,-13.1],[2.6,1.0,.3],'secondary');const cargoRailProxy=k.envelopes.at(-1);
 const socketMouth=k.panel('socket-mouth',[4.5,4.5,-10.6],[0,0,-1],4,2.3);socketMouth.mesh.userData.portalSize={width:.95,height:1.0};
 const reunion=k.panel('gallery-reunion',[20,9.5,-19.5],[0,0,-1],4,3);reunion.mesh.userData.portalSize={width:1.5,height:1.0};
 k.ramp('Freight loading threshold slope',16,24,-24,-22,8,8.7);
 const loadingStep=k.block([20,8.35,-21.225],[4,.7,1.55],'floor');g.floors.push({minX:18,maxX:22,minZ:-22,maxZ:-20.45,y:8.7,mesh:k.envelopes.at(-1).mesh,enabled:true});loadingStep.name='48 / low freight loading threshold';
 const goalEntry=k.panel('final-address',[-14,10.85,-17.5],[0,0,-1],7,5.8);
 // Moving portal sits behind a physical wall with just two six-metre-tall
 // bores. The rest of its stroke faces solid mineral, including home X=0.
 for(const [a,b]of [[-27,-20.8],[-16.2,3],[7.9,9.8],[14.3,25.5]]){k.block([(a+b)/2,2,-10.6],[b-a,4,.45],'shell');k.block([(a+b)/2,4.75,-10.6],[b-a,1.5,.45],inspectionGlass);k.block([(a+b)/2,15.75,-10.6],[b-a,20.5,.45],'shell');}
 for(const [a,b]of [[-20.8,-16.2],[3,7.9],[9.8,14.3],[25.5,29]]){k.block([(a+b)/2,a===25.5?3.6:a===3?1.7:2,-10.6],[b-a,a===25.5?.8:a===3?3.4:4,.45],'shell');if(a!==3)k.block([(a+b)/2,4.75,-10.6],[b-a,1.5,.45],inspectionGlass);k.block([(a+b)/2,a===3?6.75:6.7,-10.6],[b-a,a===3?2.3:2.4,.45],'shell');k.block([(a+b)/2,20,-10.6],[b-a,12,.45],'shell');}
 // A cargo-height observation band and a two-metre shooting slit keep
 // the departure court separate from the retained gallery. A standing
 // capsule cannot jump through the same view used to address the carriage.
 k.block([6,2,9],[46,4,.5],'shell');k.block([6,5,9],[46,2,.5],inspectionGlass);k.block([6,7.45,9],[46,2.9,.5],inspectionGlass);k.block([6,18.5,9],[46,15,.5],'shell');
 for(const [name,a,b,z0,z1]of [['First physical dock rear apron',9.8,14.3,-12,-9],['Final dock solid landing strip',5.4,7.9,-12,-10],['Final dock front apron',3,7.9,-10,-9]]){const m=k.block([(a+b)/2,7.7,(z0+z1)/2],[b-a,.6,z1-z0],'floor');m.name=name;const c=k.envelopes.at(-1);g.floors.push({minX:a,maxX:b,minZ:z0,maxZ:z1,y:8,mesh:c.mesh,enabled:true});}
 const machine=railMachine(k,cargoRailProxy);
 // The permanent inspection finger goes behind the carriage wall; its view
 // is retained after the same portal pair is released for original cargo.
 const arm=k.deck('Fixed rear inspection finger',22,30,-34,-10,8);
 k.deck('Fixed northern inspection bridge',-1,30,-34,-26,8);const rearDeck=k.deck('Fixed eastern rear connector',14,30,-34,-20,8);
 k.block([20,8.015,-24],[7.8,.025,7.8],'secondary',false);
 k.block([13.7,12,-16],[8.6,8,.45],'shell');
 k.control('magnet-drive',[-20,8,17],()=>{machine.magnet=!machine.magnet;},'E — включить / выключить катушку');
 k.control('transverse-pin',[17,8,-24],()=>{machine.pinRequested=!machine.pinRequested;},'E — выдвинуть / убрать настоящий штифт');
 k.control('shore-socket-back',[26,8,-24],()=>{machine.stopRaised=!machine.stopRaised;},'E — поднять / опустить задний упор гнезда');
 k.control('cargo-support-release',[5.5,8,-4],()=>{machine.trapLowered=!machine.trapLowered;},'E — опустить / поднять грузовую опору');
 k.control('final-socket-back',[5.5,8,3],()=>{machine.stopRaised=!machine.stopRaised;},'E — поднять / опустить задний упор гнезда');
 k.control('gallery-magnet',[26,8,-27],()=>{machine.magnet=!machine.magnet;},'E — включить / выключить катушку');
 // A visible descending window allows an observer to target the stop socket.
 const lower=k.loadPad('recovery-return',[-22,0,5],5);
 dressPuzzleProgression48(k,{entry,gallery,goal,arm,machine});
 const level=k.finishResearch([-18,8,20],[-2,4.6,-14.6],[0,8,1],{puzzleProgression:48,puzzleProgression48:true,machine,recover,socket,socketMouth,intake,reunion,goalEntry,lower,spawnView:{yaw:.05,pitch:.05},
 cargoOnAnyPad:()=>recover.loaded()||socket.loaded()||cargoLoadsPlate(g.cargo,g.heldCube,{center:V(4.45,machine.trapBody.position.y+.2,-12.4),normal:V(0,Math.cos(-.08),Math.sin(-.08)),right:V(1,0,0),up:V(0,-Math.sin(-.08),Math.cos(-.08)),halfWidth:.65,halfHeight:1.5})||cargoLoadsPlate(g.cargo,g.heldCube,{center:V(20,8.7,-21.225),normal:V(0,1,0),right:V(1,0,0),up:V(0,0,-1),halfWidth:2,halfHeight:.78})||cargoLoadsPlate(g.cargo,g.heldCube,{center:V(20,8,-24),normal:V(0,1,0),right:V(1,0,0),up:V(0,0,-1),halfWidth:4,halfHeight:4})||cargoLoadsPlate(g.cargo,g.heldCube,{center:V(10.3,2.88,-14.6),normal:V(0,1,0),right:V(1,0,0),up:V(0,0,-1),halfWidth:1.1,halfHeight:1.5})||cargoLoadsPlate(g.cargo,g.heldCube,{center:V(5,4,-13.7),normal:V(0,1,0),right:V(1,0,0),up:V(0,0,-1),halfWidth:15,halfHeight:1.9}),
 });
 const dispose=level.dispose;level.dispose=()=>{machine.disposeBodies();dispose();};
 level.getContextLesson=()=>['progression48-rail','ЛКМ / ПКМ · E','Катушка тянет свободный вес. Каретка движется от настоящего контакта и возвращается пружиной. Штифт и грузовой упор остаются обычными физическими телами.',false];
 level.puzzleGeometry={noProgressFlags:true,noCheckpoints:true,phases:9,recoveryFloor:0,physicalPin:true,physicalCargoStop:true,portalRoles:{departure:'same-pair departure', 'moving-address':'actual dynamic carriage transform', 'original-cargo-window':'pin-opened original cargo retrieval','gallery-reunion':'permanent new-view cargo receiving address','shore-stop':'original cargo contact stop at the final alignment','recovery-return':'ordinary lower floor recovery','final-address':'joint physical destination'}};
 return level;
}
