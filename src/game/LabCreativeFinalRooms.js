import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {Body,Box,Vec3,Material} from 'cannon-es';
import {ResearchChamber} from './LabResearchArt.js';
import {tracePortalRay,rayTouches,beamDrawing} from './LabPuzzleMechanics.js';

const V=(...p)=>new THREE.Vector3(...p),Q=()=>new THREE.Quaternion();
const assets=[1,2,11,22,23,24];
export const CREATIVE_FINAL_SPECS=Object.freeze({
 36:{id:'post-angular-cassette',title:'Удар по касательной',concept:'Падающий спутник переносит скорость через порталы и ударяет по плечу настоящего вращающегося барабана. Угол барабана механически передвигает мост.',description:'Устрой падение спутника на боковую лопасть. Храповик сохранит поворот, а мост выдвинется к верхней галерее. Верни того же спутника снизу.',accent:0xe8b96b,assets,hints:['Высота падения даёт удару энергию. Портальная панель напротив барабана направлена в сторону лопасти, смещённой от оси.','Прямое падение на ось не поворачивает барабан. Удар должен прийти на длинное плечо.','Поворот виден на шкале и сохраняется храповиком. После удара забери спутника с нижнего пола и возвращайся по настоящему пандусу.']},
 37:{id:'post-magnetic-u-channel',title:'Магнитный обход',concept:'Спутник проходит низкий изогнутый канал под действием трёх переключаемых полей. Человек идёт по отдельной наблюдательной галерее.',description:'Отправь спутника порталом в низкий канал, затем передавай его между катушками. Вес в приёмном гнезде открывает настоящий проход.',accent:0x8cdcca,assets,hints:['Сначала положи спутника на большую белую загрузочную панель. Выходной портал прицельно поставь через узкую смотровую амбразуру под низким кожухом, затем открой портал под грузом.','Каждая включённая катушка светится и тянет спутника к себе. Переключай поле после прохождения поворота; через стекло видно оригинальный груз, а стены остаются твёрдыми.','Когда спутник загрузит дальнее гнездо, проход откроется. За ним есть фиксатор двери и выключатель поля, чтобы забрать спутника.']},
 40:{id:'post-differential-optical-calibration',title:'Дифференциальный калибратор',concept:'Рычаг груза сдвигает два настоящих световых окна в противоположные стороны; общая регулировка сдвигает их вместе. Один портальный луч должен пройти оба окна.',description:'Совмести два независимых окна одним положением спутника и общей регулировкой. Зажми физические салазки перед тем, как забрать груз.',accent:0x8bd4e8,assets,hints:['Вес спутника учитывается вместе с расстоянием до оси рычага. На двух шкалах это даёт противоположные смещения.','Пульт общей регулировки меняет оба окна одинаково. Свет от портала должен пройти сначала ближний, затем дальний проём.','Когда дальний приёмник загорится, зажми салазки. Их настоящие окна останутся на месте, и спутника можно будет забрать.']},
});

function movingBox(k,p,size,mat='shell',name='Moving manufactured part'){
 const mesh=k.geometry(new RoundedBoxGeometry(...size,2,.08),mat,p,Q(),{batch:false,name});
 const collider=k.game.collisionProxy(new THREE.Box3().setFromObject(mesh),{kinematic:true});
 return {mesh,collider,move(next,dt){mesh.position.fromArray(next);mesh.updateWorldMatrix(true,false);k.game.syncCollision(collider,new THREE.Box3().setFromObject(mesh),dt);}};
}
function slidingDoor(k,z,{vent=null}={}){
 const b=k.bounds,roof=k.ceiling;
 const span=(a,c)=>{if(c>a)k.block([(a+c)/2,roof/2,z],[c-a,roof,.65],'shell');};
 span(b.minX,-2.7);
 if(vent){span(2.7,vent.x-vent.w/2);span(vent.x+vent.w/2,b.maxX);k.block([vent.x,(roof+vent.h)/2,z],[vent.w,roof-vent.h,.65],'shell');}
 else span(2.7,b.maxX);
 k.block([0,(roof+4.4)/2,z],[5.4,roof-4.4,.65],'dark');
 const leaf=movingBox(k,[0,2.2,z],[5.4,4.4,.7],'secondary','Recessed horizontal pressure door');
 for(const dx of [-2.45,2.45])k.block([dx,0,.46],[.12,4.1,.10],'metal',false,leaf.mesh);
 let travel=0;
 return {leaf,get progress(){return travel;},update(open,dt){const occupied=[k.game.playerPosition,k.game.cargo?.position].some(p=>p&&Math.abs(p.x)<2.6&&Math.abs(p.z-z)<1.3);travel=THREE.MathUtils.damp(travel,open||(occupied&&travel>.8)?1:0,5,dt);leaf.move([travel*6,2.2,z],dt);},reset(){travel=0;leaf.move([0,2.2,z],0);}};
}
function finish(k,spawn,cargo,goal,extra,roles,orders){
 const l=k.finishResearch(spawn,cargo,goal,{...extra,postCampaign:true,researchChamber:false,foundationChamber:false});
 l.puzzleGeometry={noProgressFlags:true,recoveryFloor:k.base,footprint:(k.bounds.maxX-k.bounds.minX)*(k.bounds.maxZ-k.bounds.minZ),portalRoles:roles,orders};
 l.getContextLesson=()=>['creative-final-'+l.index,'ЛКМ / ПКМ · E',l.spec.description,false];
 return l;
}

/** The angular rotor is a real dynamic Cannon body. Only an off-centre
 * collision with the original free cargo transfers angular momentum to it.
 * Its retained angle drives a bridge cassette, never a completion checklist. */
export function buildCreative36(g,index=35){
 const k=new ResearchChamber(g,CREATIVE_FINAL_SPECS[36],index,'kinetic',{minX:-31,maxX:31,minZ:-27,maxZ:29},-4,25);
 k.deck('Western gravity balcony',-28,-9,-20,-6,10);
 k.deck('Western loading promenade',-28,-20,-6,2,10);
 k.ramp('Wide return and gravity approach',-28,-20,2,26,10,-4);
 k.deck('East receiving gallery',9,28,-20,-6,10);
 const bridge=k.carrier('angular-bridge-cassette',[[0,10,10],[0,10,-18]],{width:18,depth:12,portal:false});bridge.speed=8;
 const fall=k.loadPad('gravity-well',[-18,-4,-5],8);
 const outlet=k.panel('tangential-outlet',[-12,2,-13],[0,0,1],8,5.8);
 // The paddle's axis is offset four metres to the right of the portal jet;
 // the jet also clears the western balcony's actual corner support.
 const pivot=V(-8,2,-5),paddle=movingBox(k,pivot.toArray(),[8,3,.65],'secondary','Angular impact paddle');
 const rotorArt=new THREE.Group();rotorArt.position.copy(pivot);k.world.root.add(rotorArt);
 k.geometry(new THREE.CylinderGeometry(.38,.38,7,16),'metal',[-8,.2,-5],Q(),{batch:false,name:'Vertical rotor spindle'});
 for(const y of [-.9,4.9])k.geometry(new THREE.TorusGeometry(1.0,.12,8,32),'metal',[-8,y,-5],Q().setFromAxisAngle(V(1,0,0),Math.PI/2),{batch:false,name:'Rotor thrust bearing'});
 for(let i=0;i<12;i++){
  const t=i*Math.PI/6;k.geometry(new RoundedBoxGeometry(.25,.28,.35,1,.04),'metal',[Math.cos(t)*1.8,2.6,Math.sin(t)*1.8],Q().setFromAxisAngle(V(0,1,0),-t),{parent:rotorArt,batch:false,name:'Visible ratchet tooth'});
 }
 const pawl=k.geometry(new RoundedBoxGeometry(.9,.22,.42,1,.05),'metal',[-6.1,4.6,-5],Q(),{batch:false,name:'One-way rotor pawl'});
 const rotor={body:null,angle:0,omega:0,owner:null,previousAngle:0,ensure(){
  if(!g.physics||this.owner===g.physics)return;this.owner=g.physics;
  g.physics.removeStaticBox(paddle.collider.mesh.uuid);
  this.body=new Body({mass:14,position:new Vec3(...pivot.toArray()),shape:new Box(new Vec3(4,1.5,.325)),linearFactor:new Vec3(0,0,0),angularFactor:new Vec3(0,1,0),angularDamping:.55,material:new Material({friction:.25,restitution:.22}),collisionFilterGroup:1,collisionFilterMask:2});
  g.physics.world.addBody(this.body);
 },update(dt){this.ensure();if(!this.body)return;
  const b=this.body,e=new THREE.Euler().setFromQuaternion(new THREE.Quaternion(b.quaternion.x,b.quaternion.y,b.quaternion.z,b.quaternion.w),'YXZ');
  let delta=e.y-this.previousAngle;if(delta>Math.PI)delta-=Math.PI*2;if(delta< -Math.PI)delta+=Math.PI*2;
  if(delta>0)this.angle=Math.min(Math.PI/2,this.angle+delta);this.previousAngle=e.y;
  if(b.angularVelocity.y<0)b.angularVelocity.y=0;
  if(this.angle>=Math.PI/2){b.angularVelocity.y=0;b.torque.y=0;}
  this.omega=b.angularVelocity.y;
  paddle.mesh.quaternion.copy(new THREE.Quaternion(b.quaternion.x,b.quaternion.y,b.quaternion.z,b.quaternion.w));paddle.mesh.updateWorldMatrix(true,false);paddle.collider.box.setFromObject(paddle.mesh);
  // Player/ray collision uses the same rotating volume; no duplicate static
  // physics body is introduced on top of the dynamic rotor.
  rotorArt.rotation.y=this.angle;pawl.rotation.y=Math.sin(this.angle*12)*.1;
  bridge.stations[1].z=10-28*THREE.MathUtils.clamp(this.angle/(Math.PI/2),0,1);bridge.target=1;
 },reset(){this.ensure();this.angle=this.omega=this.previousAngle=0;if(this.body){this.body.quaternion.set(0,0,0,1);this.body.angularVelocity.setZero();this.body.velocity.setZero();this.body.force.setZero();this.body.torque.setZero();this.body.wakeUp();}paddle.mesh.quaternion.identity();paddle.collider.box.setFromObject(paddle.mesh);bridge.stations[1].z=10;bridge.reset();}};
 k.ticks.unshift(dt=>rotor.update(dt));k.resets.push(()=>rotor.reset());
 k.control('rotor-service-release',[-1,-4,4],()=>rotor.reset(),'E — освободить храповик и вернуть мост. Спутник остаётся в комнате.');
 // A cage protects the spindle while keeping the tangential impact lane open.
 for(const x of [-13.1,-2.9])k.block([x,2,-5],[.35,6,7],'dark');
 k.display([0,18,-25.5],()=>`УГОЛ ${THREE.MathUtils.radToDeg(rotor.angle).toFixed(0)}° / 90°\nМОСТ ${bridge.position.z.toFixed(1)} м / УГЛОВАЯ СКОРОСТЬ ${rotor.omega.toFixed(1)}`,22,2.2);
 k.label('36 / УДАР ПО КАСАТЕЛЬНОЙ',[-29.5,16,12],[1,0,0],17,1.2);
 return finish(k,[-24,10,-13],[-22,10.6,-11],[19,10,-13],{rotor,bridge,fallPad:fall,outlet,spawnView:{yaw:.1,pitch:-.08}},
  {'gravity-well':'the actual fall supplies kinetic energy','tangential-outlet':'horizontal cargo jet hits a real rotor away from its spindle'},['off-centre-impact','scout-impact-first']);
}

/** Low guarded U duct: the companion is driven by forces, not teleported
 * between waypoints. The fixed partitions stop carrying it across the bend. */
export function buildCreative37(g,index=36){
 const k=new ResearchChamber(g,CREATIVE_FINAL_SPECS[37],index,'tidal',{minX:-28,maxX:28,minZ:-27,maxZ:24},0,16);
 const ownedMaterials=[],glass=new THREE.MeshStandardMaterial({name:'Solid magnetic observation glass',color:0x9fd4cf,transparent:true,opacity:.22,roughness:.24,metalness:.08,depthWrite:false});ownedMaterials.push(glass);
 const restore=k.restoreLight.bind(k);k.restoreLight=()=>{ownedMaterials.forEach(m=>m.dispose());restore();};
 const entry=k.loadPad('magnetic-feed',[-16,0,15],8);
 const mouth=k.loadPad('low-channel-mouth',[-16,0,2],3.2).surface;mouth.mesh.userData.portalSize={width:1.35,height:1.35};
 const receiver=k.loadPad('magnetic-receiver',[16,0,-20],3.2);
 const door=slidingDoor(k,-12,{vent:{x:16,w:3.4,h:1.70}});
 // The tunnel has one continuous floor and a low solid roof, with no grate
 // pretending to be passable scenery. Its three legs are separate volumes.
 const legs=[{x:-16,z:-1,w:3.2,d:10},{x:0,z:-6,w:35.2,d:3.2},{x:16,z:-11.5,w:3.2,d:11}];
 for(const leg of legs)k.block([leg.x,1.98,leg.z],[leg.w,.55,leg.d],'shell');
 for(const [i,[p,s]] of [
  [[-18,1,-2],[.55,2,12]], [[-14,1,0],[.55,2,7.4]],
  [[-1.8,1,-8],[31.6,2,.55]], [[0,1,-4],[27.2,2,.55]],
  [[14,1,-12],[.55,2,10]], [[18,1,-10.5],[.55,2,13]],
 ].entries()){
  const observerWall=[1,3,4].includes(i);
  k.block(p,s,observerWall?glass:'dark');
  if(observerWall){
   const across=s[0]>s[2];
   for(const y of [.09,1.92])k.block([p[0],y,p[2]],across?[s[0],.16,.62]:[.62,.16,s[2]],'metal',false);
  }
 }
 // A portal charge can see the floor through this .73 m high inspection
 // slot; the .78 m companion and the human capsule cannot be hand-fed.
 k.block([-16,.15,4.25],[4.55,.3,.55],'dark');
 k.block([-16,1.64,4.25],[4.55,1.22,.55],'shell');
 for(const x of [-17.56,-14.44])k.block([x,.665,4.25],[1.43,.73,.55],'metal');
 const targets=[V(-16,.65,-6),V(16,.65,-6),V(16,.65,-20)];let selected=-1,latched=false;
 const coils=targets.map((p,i)=>{
  const winding=k.m.metal.clone();winding.name='Visible magnetic winding '+(i+1);ownedMaterials.push(winding);
  const ring=k.geometry(new THREE.TorusGeometry(1.35,.18,8,32),winding,[p.x,1.01,p.z],Q().setFromAxisAngle(V(1,0,0),Math.PI/2),{batch:false,name:'Magnetic field winding '+(i+1)});
  k.label('КАТУШКА '+(i+1),[p.x,3.6,p.z],[0,0,1],5,.65);return ring;
 });
 const positions=[[-9,0,4],[0,0,-1],[8,0,-1]];
 positions.forEach((p,i)=>k.control('magnetic-coil-'+i,p,()=>{selected=selected===i?-1:i;},'E — переключить поле катушки '+(i+1)+'. Магнит тянет свободного спутника, стены остаются твёрдыми.'));
 k.control('receiver-door-pawl',[4,0,-17],()=>{if(door.progress>.85&&receiver.loaded())latched=true;},'E — зафиксировать открытую приёмную дверь.');
 k.control('receiver-field-off',[10,0,-18],()=>{selected=-1;},'E — выключить поле и забрать того же спутника.');
 k.forces.push(()=>{
  const b=g.physics?.cargoBody;if(!b||g.heldCube||selected<0)return;const t=targets[selected];
  if(b.position.y>1.8||b.position.x< -20||b.position.x>20||b.position.z>6||b.position.z< -24)return;
  const dx=t.x-b.position.x,dz=t.z-b.position.z;
  b.force.x+=b.mass*THREE.MathUtils.clamp(dx*50-b.velocity.x*10,-70,70);
  b.force.z+=b.mass*THREE.MathUtils.clamp(dz*50-b.velocity.z*10,-70,70);
  b.wakeUp();
 });
 k.ticks.push(dt=>{door.update(receiver.loaded()||latched,dt);coils.forEach((coil,i)=>{const active=selected===i;coil.rotation.z=k.time*(active?1.5:0);coil.material.emissive.setHex(active?0x49a99a:0x000000);coil.material.emissiveIntensity=active?.8+.15*Math.sin(k.time*4):0;});});
 k.resets.push(()=>{selected=-1;latched=false;door.reset();});
 k.display([0,12,-25.6],()=>`ПОЛЕ ${selected<0?'ВЫКЛЮЧЕНО':selected+1}\nПРИЁМНОЕ ГНЕЗДО ${receiver.loaded()?'НАГРУЖЕНО':'СВОБОДНО'} / ДВЕРЬ ${door.progress>.85?'ОТКРЫТА':'ЗАКРЫТА'}`,22,2.2);
 return finish(k,[-8,0,18],[-11,.6,16],[0,0,-22],{entry,mouth,receiver,door,getMagnet:()=>selected,isLatched:()=>latched,spawnView:{yaw:.14,pitch:-.05}},
  {'magnetic-feed':'loads the original cargo into the low hood through a floor portal','low-channel-mouth':'cargo-only outlet followed by a physical two-bend magnetic duct','magnetic-receiver':'the original mass opens the remote door'},['coil-by-coil','prepare-fields-first']);
}

export function buildCreative40(g,index=39){
 const k=new ResearchChamber(g,CREATIVE_FINAL_SPECS[40],index,'optical',{minX:-29,maxX:29,minZ:-27,maxZ:26},0,18);
 const lever=k.loadPad('differential-load',[-17,0,17],8);
 const input=k.panel('calibration-source',[13,3,18],[1,0,0],8,5.8);
 const outlet=k.panel('calibration-outlet',[0,3,13],[0,0,-1],8,5.8);
 k.projector([22,3,18],[-1,0,0],{radius:.8});
 const drawing=beamDrawing(k.world,0x9be1e6,.045),target=V(0,3,-11);
 k.projector([0,3,-11],[0,0,1],{radius:.65});
 const shutters=[5,-5].map((z,i)=>{
  const parts=[movingBox(k,[0,1.0,z],[18,2,.6],'dark','Optical sill '+i),movingBox(k,[0,6,z],[18,4,.6],'shell','Optical overhead '+i),
   movingBox(k,[-5.5,3,z],[7.2,2,.6],'secondary','Left calibrated slit jaw '+i),movingBox(k,[5.5,3,z],[7.2,2,.6],'secondary','Right calibrated slit jaw '+i)];
  k.block([0,8.8,z],[20,.5,1.0],'metal');
  for(const x of [-10,10])k.block([x,4.5,z],[.6,9,.8],'shell');
  return {z,parts,offset:i===0?2.7:.3};
 });
 let trim=1.5,clamped=false,lit=false,arm=0;
 const door=slidingDoor(k,-17);
 const syncSlits=dt=>{
  const c=g.cargo?.position;
  if(!clamped){arm=lever.loaded()?THREE.MathUtils.clamp(c.x-lever.position.x,-3.5,3.5):0;
   shutters[0].offset=THREE.MathUtils.damp(shutters[0].offset,1.2+arm*.6+trim,8,dt);
   shutters[1].offset=THREE.MathUtils.damp(shutters[1].offset,-1.2-arm*.6+trim,8,dt);
  }
  for(const s of shutters){const x=s.offset;s.parts[2].move([x-4.25,3,s.z],dt);s.parts[3].move([x+4.25,3,s.z],dt);}
  const segments=tracePortalRay(g,V(21.96,3,18),V(-1,0,0),{length:110});drawing.update(segments);
  lit=segments.some(s=>s.kind==='portal')&&rayTouches(segments,target,.38);
  door.update(lit,dt);
 };
 k.ticks.push(syncSlits);
 k.control('common-rack',[6,0,8],()=>{if(!clamped){trim-=.5;if(trim< -1.6)trim=1.5;}},'E — общая регулировка: сдвинуть оба световых окна на 0.5 м.');
 k.control('slit-clamp',[-5,0,8],()=>{if(clamped||lit)clamped=!clamped;},'E — зажать освещённые салазки или освободить их. Затем спутника можно забрать.');
 k.resets.push(()=>{trim=1.5;clamped=lit=false;arm=0;shutters[0].offset=2.7;shutters[1].offset=.3;door.reset();syncSlits(0);});
 k.display([-26.9,10,10],()=>`ПЛЕЧО ${arm.toFixed(1)} м / ОБЩИЙ СДВИГ ${trim.toFixed(1)} м\nОКНО I ${shutters[0].offset.toFixed(1)} / II ${shutters[1].offset.toFixed(1)}\n${lit?'ПРИЁМНИК ОСВЕЩЁН':'ЛУЧ ПЕРЕКРЫТ'} / ${clamped?'САЛАЗКИ ЗАЖАТЫ':'СВОБОДНЫЙ РЫЧАГ'}`,20,3,[1,0,0]);
 k.label('40 / ДИФФЕРЕНЦИАЛЬНЫЙ КАЛИБРАТОР',[0,15.4,-25.7],[0,0,1],24,1.2);
 return finish(k,[-10,0,22],[-12,.6,20],[0,0,-23],{lever,input,outlet,shutters,door,getCalibration:()=>({trim,arm,clamped,lit}),spawnView:{yaw:.1,pitch:-.06}},
  {'differential-load':'cargo lever arm displaces the two real windows in opposite directions','calibration-source':'intercepts the sole source ray','calibration-outlet':'routes it physically through both slits'},['balance-then-trim','trim-then-balance']);
}
