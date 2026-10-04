import * as THREE from 'three';
import {Body,Box,Vec3,Material,HingeConstraint} from 'cannon-es';
import {ResearchChamber} from './LabResearchArt.js';
import {tracePortalRay,rayTouches,beamDrawing} from './LabPuzzleMechanics.js';
import {movingMechanismBlock} from './LabLateCampaignMechanisms.js';
const V=(...a)=>new THREE.Vector3(...a),Q=()=>new THREE.Quaternion();
const assets=[1,2,11,22,23,24];
export const EXPANSION_B_SPECS=Object.freeze([
 {id:'expansion-brittle-fuse',title:'Хрупкий предохранитель',concept:'Падение оригинального спутника создаёт удар, разрушающий реальную предохранительную перегородку. Руками и прыжками стеклокерамика не ломается.',description:'Стеклокерамический предохранитель разделяет два крыла. Падение и удар ведут себя по настоящей физике; к выходу должны прийти оба путешественника.',accent:0xffb867,assets,hints:['Грузовой выход слишком низок для человека. Высокий балкон и колодец дают спутнику реальную скорость.','Предохранитель выдерживает медленный контакт: ему нужна энергия падения.','Осколки падают на настоящий сервисный пол. Забери того же спутника за разрушенным проёмом.']},
 {id:'expansion-contact-wedge',title:'Клиновый шлюз',concept:'Настоящий привод сжимает направляемую губку. Спутник физически препятствует её закрытию, и незавершённый ход открывает связанный проход.',description:'Ход прессового привода связан с дверью наблюдателя. В закрытом грузовом ложе видны направляющая, прижимная губка и инспекционный кожух. Северный выход ждёт обоих путешественников.',accent:0x8de0c9,assets,hints:['Человеку не пролезть под кожухом пресса. Белый выход в его ложе принимает только спутника.','Весовая кнопка здесь не помогает: открытый ход сохраняет контакт спутника с движущейся губкой.','С дальнего пульта вставь видимый стопор в направляющую и открой инспекционный кожух.']},
 {id:'expansion-gimbal-reflection',title:'Кривая отражения',concept:'Плечо настоящего груза задаёт момент на шарнире зеркала. Луч отражается от его живой нормали, затем удерживается механической струбциной.',description:'Свет, зеркало и плечо груза образуют одну живую систему. Дальняя линза следит за направлением отражения, а выход ждёт обоих путешественников.',accent:0x8edbf0,assets,hints:['Порталы меняют адрес света; зеркало меняет направление отражения.','Далёкое от оси положение спутника поворачивает зеркальную головку сильнее.','Струбцина удерживает реальный угол и работает в любом положении. При неудачной фиксации её можно освободить.']},
 {id:'expansion-toppling-bridge',title:'Падающая архитектура',concept:'Свободный спутник ударяет высокое плечо шарнирной панели. Настоящее вращение превращает вертикальную стену в горизонтальную переправу.',description:'Вертикальная стена стоит на настоящем шарнире, а северный причал отделён глубоким сервисным разрывом. Здесь сама архитектура может стать частью решения. На северный причал должны попасть оба путешественника.',accent:0xeab77d,assets,hints:['Нижний упор защищает основание. Удар выше упора создаёт большой момент на шарнире.','Панель становится полом в результате вращения, а не после включения кнопки.','Нижний пол возвращает спутника к единственному сервисному пандусу. Ошибка не требует перезапуска.']},
 {id:'expansion-address-relay',title:'Адресная эстафета',concept:'Спутник замыкает механическую муфту на грузовой кабине. Два разных причала перемещают один портальный адрес сначала поперёк комнаты, затем вверх.',description:'Один грузовой адрес принадлежит кабине с тремя причалами. Грузовая муфта, пульты разных крыльев и постоянный сервисный пол задают правила пространства. Верхний причал ждёт обоих путешественников.',accent:0xe7a4d1,assets,hints:['Привод работает только при оригинальном грузе на настоящем настиле кабины.','Дальний причал меняет маршрут кабины. Пульт последнего подъёма недоступен из стартового крыла.','Портал остаётся прикреплён к кабине. Сухой сервисный ярус и возвратный пандус позволяют повторить пересадку.']},
]);
function chamber(g,i,s,theme,bounds,base=0,roof=20){return new ResearchChamber(g,s,i,theme,bounds,base,roof);}
function finish(k,spawn,cargo,goal,extra,roles,deductions){
 const l=k.finishResearch(spawn,cargo,goal,{expansionB:true,researchChamber:false,foundationChamber:false,postCampaign:false,...extra});
 l.puzzleGeometry={noProgressFlags:true,recoveryFloor:k.base,footprint:(k.bounds.maxX-k.bounds.minX)*(k.bounds.maxZ-k.bounds.minZ),portalRoles:roles,deductions};
 l.getContextLesson=()=>['expansion-b-'+l.index,'ЛКМ / ПКМ · E',l.spec.description,false];return l;
}
function partition(k,z,{floor=k.base,left=-3,right=3,top=4.6,vent=null}={}){
 const b=k.bounds,h=k.ceiling,sections=[[b.minX,left,floor,h],[right,b.maxX,floor,h],[left,right,top,h]],cut=[];
 for(const a of sections){const [x0,x1,y0,y1]=a;if(vent&&vent.x-vent.w/2>x0&&vent.x+vent.w/2<x1){cut.push([x0,vent.x-vent.w/2,y0,y1],[vent.x+vent.w/2,x1,y0,y1],[vent.x-vent.w/2,vent.x+vent.w/2,y0,vent.y0],[vent.x-vent.w/2,vent.x+vent.w/2,vent.y1,y1]);}else cut.push(a);}
 for(const [x0,x1,y0,y1]of cut)if(x1>x0&&y1>y0)k.block([(x0+x1)/2,(y0+y1)/2,z],[x1-x0,y1-y0,.66],'shell');
 for(const x of [left-.18,right+.18])k.block([x,(floor+top)/2,z+.04],[.32,top-floor,.86],'metal');
}
function low(p,width=1.35,height=.65){p.mesh.userData.portalSize={width,height};return p;}
function syncProxy(c,box){if(!c.geometrySize){c.mesh.geometry.computeBoundingBox();c.geometrySize=c.mesh.geometry.boundingBox.getSize(V());}const size=box.getSize(V());box.getCenter(c.mesh.position);c.mesh.scale.set(size.x/c.geometrySize.x,size.y/c.geometrySize.y,size.z/c.geometrySize.z);c.mesh.updateWorldMatrix(true,false);c.box.copy(box);}
function moving(k,name,p,size,mat='secondary'){
 const mesh=movingMechanismBlock(k,name,p,size,mat),collider=k.game.collisionProxy(new THREE.Box3().setFromObject(mesh),{kinematic:true});
 return {mesh,collider,sync(dt=0){mesh.updateWorldMatrix(true,false);const bounds=new THREE.Box3().setFromObject(mesh);if(k.game.physics?.solids?.has(collider.mesh.uuid))k.game.syncCollision(collider,bounds,dt);else syncProxy(collider,bounds);}};
}
function lateShutter(k,name,p,size,offset){const m=moving(k,name,p,size),origin=V(...p),travel=V(...offset);const s={...m,progress:0,target:false,update(dt){this.progress=THREE.MathUtils.damp(this.progress,this.target?1:0,5,dt);this.mesh.position.copy(origin).addScaledVector(travel,this.progress);this.sync(dt);},reset(){this.progress=0;this.target=false;this.update(0);}};k.resets.push(()=>s.reset());return s;}
function disposeBodies(l,systems){const prior=l.dispose;l.dispose=()=>{for(const s of systems){if(s.listener&&s.owner?.cargoBody)s.owner.cargoBody.removeEventListener('collide',s.listener);if(s.constraint&&s.owner?.world)s.owner.world.removeConstraint(s.constraint);for(const b of [s.body,s.anchor,...(s.bodies||[])].filter(Boolean))s.owner?.world?.removeBody(b);}prior();};return l;}

/** A fracture is driven only by real Cannon contact energy. The plane is
 * physically removed and its pieces become independently falling bodies. */
export function buildBrittleFuse(g,index=46,spec=EXPANSION_B_SPECS[0]){
 const k=chamber(g,index,spec,'launch',{minX:-29,maxX:29,minZ:-26,maxZ:28},0,23);
 k.deck('High ceramic acceleration balcony',-27,-11,8,24,12);
 k.ramp('Broad observer return incline',-11,-3,8,25,12,0);
 k.deck('South observer inspection head',-11,-3,18,26,0);
 const well=k.loadPad('fuse-gravity-well',[-16,0,6.2],8);
 const outlet=low(k.panel('fuse-projectile-outlet',[0,3.4,5],[0,0,-1],7,6.8),1.8,1.1);
 partition(k,-4,{left:-3.3,right:3.3,top:5.2});
 const shellMat=k.m.ceramic.clone();shellMat.name='Sacrificial glass ceramic';shellMat.color.setHex(0xb9e6df);shellMat.roughness=.18;shellMat.metalness=.18;
 const plate=moving(k,'Brittle safety partition',[0,2.6,-4],[6.6,5.2,.18],shellMat);
 for(let n=0;n<5;n++)k.block([-2.8+n*1.4,2.6,-3.89],[.035,4.8,.025],'metal',false);
 // A recessed lower jet lane clears the ceramic sheet and its rim.
 for(const x of [-5,5])k.block([x,-.12,1],[.28,.20,11],'metal',false);
 const pieces=[];for(let row=0;row<4;row++)for(let col=0;col<4;col++){
  const m=movingMechanismBlock(k,'Ceramic fracture fragment '+row+' '+col,[-2.475+col*1.65,.65+row*1.3,-4],[1.60,1.25,.13],shellMat);m.visible=false;const c=g.collisionProxy(new THREE.Box3().setFromObject(m),{kinematic:true});c.enabled=false;pieces.push({mesh:m,collider:c});
 }
 const fuse={owner:null,bodies:[],listener:null,energy:0,broken:false,ensure(){if(!g.physics||this.owner===g.physics)return;this.owner=g.physics;
  this.listener=e=>{if(e.body.labId!==plate.collider.mesh.uuid||this.broken||g.heldCube)return;const v=Math.abs(e.contact.getImpactVelocityAlongNormal());this.energy=Math.max(this.energy,.5*e.target.mass*v*v);if(this.energy>=175)this.break(v);};g.physics.cargoBody.addEventListener('collide',this.listener);},
  break(speed){this.broken=true;plate.mesh.visible=false;plate.collider.enabled=false;this.owner.setStaticEnabled(plate.collider.mesh.uuid,false);
   for(let n=0;n<pieces.length;n++){const piece=pieces[n],m=piece.mesh;m.visible=true;piece.collider.enabled=true;this.owner.removeStaticBox(piece.collider.mesh.uuid);const b=new Body({mass:.12,shape:new Box(new Vec3(.80,.625,.065)),position:new Vec3(...m.position.toArray()),material:new Material({friction:.75,restitution:.04}),collisionFilterGroup:4,collisionFilterMask:1});b.velocity.set((n%4-1.5)*1.0,1.2+(n%3)*.3,-Math.min(4,speed*.16));b.angularVelocity.set((n%3)*.7,.5,.2);this.owner.world.addBody(b);this.bodies.push(b);}
  },update(){this.ensure();this.bodies.forEach((b,n)=>{const {mesh,collider}=pieces[n];mesh.position.set(b.position.x,b.position.y,b.position.z);mesh.quaternion.set(b.quaternion.x,b.quaternion.y,b.quaternion.z,b.quaternion.w);mesh.updateWorldMatrix(true,false);syncProxy(collider,new THREE.Box3().setFromObject(mesh));});},
  reset(){this.ensure();this.broken=false;this.energy=0;plate.mesh.visible=true;plate.collider.enabled=true;this.owner.setStaticEnabled(plate.collider.mesh.uuid,true);this.bodies.forEach(b=>this.owner.world.removeBody(b));this.bodies=[];pieces.forEach(({mesh:m,collider:c},n)=>{m.visible=false;c.enabled=false;this.owner.setStaticEnabled(c.mesh.uuid,false);m.position.set(-2.475+n%4*1.65,.65+Math.floor(n/4)*1.3,-4);m.quaternion.identity();});}
 };
 k.ticks.push(()=>fuse.update());k.resets.push(()=>fuse.reset());
 k.label('47 / ХРУПКИЙ ПРЕДОХРАНИТЕЛЬ',[0,20,-24.6],[0,0,1],26,1.2);
 k.display([26.5,8,8],()=>`УДАР ${fuse.energy.toFixed(0)} Дж / ПОРОГ 175 Дж\n${fuse.broken?'ПРЕДОХРАНИТЕЛЬ РАЗРУШЕН':'СТЕКЛОКЕРАМИКА ЦЕЛА'}`,16,2,[-1,0,0]);
 const l=finish(k,[-23,12,19],[-21,12.6,17],[0,0,-21],{well,outlet,fuse,spawnView:{yaw:.1,pitch:-.08}},
  {'fuse-gravity-well':'gravity supplies impact energy','fuse-projectile-outlet':'cargo-height projectile crosses the ceramic safety plane'},['carried and low speed cargo cannot fracture the plane','real contact energy exceeds the visible material strength','independent fragments fall while the original cargo remains intact','observer descends a separate dry incline']);
 const old=l.dispose;l.dispose=()=>{shellMat.dispose();old();};return disposeBodies(l,[fuse]);
}

/** A guided motor cannot complete its stroke because the original rigid
 * cargo occupies the jaw gap. The door follows that measured displacement. */
export function buildContactWedge(g,index=47,spec=EXPANSION_B_SPECS[1]){
 const k=chamber(g,index,spec,'tidal',{minX:-28,maxX:28,minZ:-26,maxZ:26},0,18);
 const feed=k.loadPad('wedge-feed',[-17,0,18],8),mouth=low(k.panel('wedge-cradle',[0,.95,-6],[0,0,1],4,2.2),1.4,.8);
 partition(k,2,{left:-3,right:3,top:4.6,vent:{x:-7,w:7,y0:1.0,y1:1.65}});
 const door=lateShutter(k,'Press interlocked horizontal door',[0,2.3,2],[6,4.6,.65],[7,0,0]);
 const roof=lateShutter(k,'Press inspection hood',[0,2.875,-5],[6.4,.35,4.2],[0,4,0]);
 k.block([2.0,.9,-5],[.25,1.8,3.6],'dark');
 k.block([-.8,1.35,-7],[5.5,2.7,.24],'shell');for(const x of [-3.2,3.2])k.block([x,1.35,-5],[.24,2.7,4.2],'shell');
 // The .55 m viewing slot passes a charge but excludes a carried rigid box.
 const cheeks=[lateShutter(k,'Press lower inspection cheek',[0,.35,-2.8],[6.5,.70,.35],[0,4,0]),lateShutter(k,'Press upper inspection cheek',[0,2.05,-2.8],[6.5,1.30,.35],[0,4,0])];
 const shoe=moving(k,'Force driven press jaw',[-2.4,.76,-4.6],[.4,1.52,2.0],'secondary');
 const pawl=moving(k,'Visible transverse press stop',[3,.35,-5],[.28,.7,2.0],'metal');
 const press={body:null,owner:null,running:false,pinned:false,heldX:-2.4,gap:3.725,ensure(){if(!g.physics||this.owner===g.physics)return;this.owner=g.physics;g.physics.removeStaticBox(shoe.collider.mesh.uuid);this.body=new Body({mass:6,position:new Vec3(-2.4,.76,-4.6),shape:new Box(new Vec3(.2,.76,1.0)),linearFactor:new Vec3(1,0,0),fixedRotation:true,linearDamping:.04,material:new Material({friction:.55,restitution:0}),collisionFilterGroup:1,collisionFilterMask:2});g.physics.world.addBody(this.body);},
  force(){this.ensure();const b=this.body;if(this.pinned){b.type=Body.STATIC;b.position.x=this.heldX;b.velocity.setZero();b.force.setZero();return;}b.type=Body.DYNAMIC;b.force.y+=b.mass*19.5;if(this.running){b.wakeUp();b.force.x+=65-b.velocity.x*24;}else{b.wakeUp();b.force.x+=(-2.4-b.position.x)*95-b.velocity.x*30;}if(b.position.x>1.675){b.position.x=1.675;b.velocity.x=Math.min(0,b.velocity.x);}if(b.position.x<-2.4){b.position.x=-2.4;b.velocity.x=Math.max(0,b.velocity.x);}},
  update(dt){this.ensure();shoe.mesh.position.x=this.body.position.x;shoe.sync(0);this.gap=1.875-(this.body.position.x+.2);door.target=this.running&&this.gap>.68;door.update(dt);roof.target=this.pinned;roof.update(dt);for(const c of cheeks){c.target=this.pinned;c.update(dt);}pawl.mesh.position.x=this.pinned?this.heldX-.35:3;pawl.sync(dt);},
  loaded(){return !g.heldCube&&this.owner?.world?.contacts.some(c=>(c.bi===this.body&&c.bj===g.physics.cargoBody)||(c.bj===this.body&&c.bi===g.physics.cargoBody));},
  pin(){if(this.running&&this.gap>.68&&door.progress>.9){this.pinned=true;this.heldX=this.body.position.x;}},
  reset(){this.ensure();this.running=this.pinned=false;this.heldX=-2.4;this.body.type=Body.DYNAMIC;this.body.position.set(-2.4,.76,-4.6);this.body.velocity.setZero();this.body.force.setZero();this.update(0);}
 };
 k.state.press=press;
 k.control('press-cycle',[-18,0,8],()=>{press.running=!press.running;},'E — включить или отвести прижимной привод.');
 k.control('press-pawl',[8,0,-12],()=>press.pin(),'E — вставить стопор в незавершённый ход пресса.');
 k.forces.push(()=>press.force());k.ticks.push(dt=>press.update(dt));k.resets.push(()=>press.reset());
 k.label('48 / КЛИНОВЫЙ ШЛЮЗ',[0,15,-24.5],[0,0,1],22,1.15);
 k.display([25.8,8,8],()=>`ЗАЗОР ${press.gap.toFixed(2)} м\nПРИВОД ${press.running?'ПРИЖИМ':'ОТВЕДЁН'} / СТОПОР ${press.pinned?'ВСТАВЛЕН':'СВОБОДЕН'}`,16,2,[-1,0,0]);
 const l=finish(k,[-10,0,21],[-13,.6,19],[0,0,-21],{feed,mouth,press,door,roof,spawnView:{yaw:.05,pitch:-.04}},
  {'wedge-feed':'cargo is lowered into an inaccessible jaw bed','wedge-cradle':'the rigid companion wedges the real motor driven jaw'},['the motor force acts on a guided body','cargo contact arrests the real closing stroke','displacement opens the separate observer door','the far stop preserves displacement before cargo retrieval']);return disposeBodies(l,[press]);
}

/** Optical reflection uses the mirror's actual continuously moving normal.
 * A parallel-arm tray stays level while load moment rotates the remote head. */
export function buildGimbalReflection(g,index=48,spec=EXPANSION_B_SPECS[2]){
 const k=chamber(g,index,spec,'optical',{minX:-28,maxX:28,minZ:-27,maxZ:27},0,20);
 const tray=k.loadPad('gimbal-load-tray',[-6,0,18],8);
 const input=k.panel('mirror-light-source',[-21,3,12],[0,0,1],8,5.8);
 const outlet=k.panel('mirror-light-outlet',[0,3,8],[0,0,-1],8,5.8);
 const source=k.projector([-21,3,20],[0,0,-1],{radius:.8});
 const position=V(0,3,-3),receiver=V(17,3,-3);
 const mirror=movingMechanismBlock(k,'Load steered polished mirror',position.toArray(),[6,5,.18],'metal');
 const mirrorMat=k.m.metal.clone();mirrorMat.name='Polished gimbal reflector';mirrorMat.color.setHex(0xc8e5e3);mirrorMat.roughness=.08;mirrorMat.metalness=.96;mirror.material=mirrorMat;
 for(const x of [-3.6,3.6])k.block([x,3.2,-4.2],[.4,6.4,.4],'shell');k.block([0,6.3,-4.2],[7.6,.4,.4],'metal');k.block([0,.9,-3],[1.0,1.8,1.0],'secondary');
 const sensor=k.projector(receiver.toArray(),[-1,0,0],{radius:1.0}),drawing=beamDrawing(k.world,0xc7f4df,.055);
 partition(k,-13,{left:-3,right:3,top:4.8});const door=lateShutter(k,'Reflection receiver sliding door',[0,2.4,-13],[6,4.8,.64],[7,0,0]);
 const head={angle:0,omega:0,arm:0,clamped:false,lit:false,normal:V(0,0,1),segments:[],update(dt){
  this.arm=tray.loaded()?THREE.MathUtils.clamp(g.cargo.position.x+6,-3.6,3.6):0;
  if(!this.clamped&&dt){const torque=3.2*19.5*this.arm-160*this.angle-80*this.omega;this.omega+=torque/35*dt;this.angle=THREE.MathUtils.clamp(this.angle+this.omega*dt,-.95,.95);}
  mirror.rotation.y=this.angle;this.normal.set(Math.sin(this.angle),0,Math.cos(this.angle));
  this.segments=tracePortalRay(g,source.position.clone().addScaledVector(source.normal,.04),source.normal,{length:120,reflectors:[{position,normal:this.normal,radius:3.0}]});drawing.update(this.segments);
  this.lit=this.segments.some(s=>s.kind==='portal')&&this.segments.some(s=>s.kind==='mirror')&&rayTouches(this.segments,receiver,1.7);door.target=this.lit;door.update(dt);
 },reset(){this.angle=this.omega=this.arm=0;this.clamped=this.lit=false;this.update(0);}};
 k.control('gimbal-clamp',[8,0,9],()=>{head.clamped=!head.clamped;head.omega=0;},'E — зажать или освободить реальный угол зеркальной головки.');
 k.ticks.push(dt=>head.update(dt));k.resets.push(()=>head.reset());
 // Visible parallelogram and cable torque transmitter have a purpose.
 for(const z of [14.0,22.0]){k.block([-6,-.45,z],[8.4,.25,.25],'metal');k.block([-6,.8,z],[.2,2.1,.2],'secondary');}
 k.wire([[-6,.4,18],[-6,.4,4],[0,.4,4],[0,.4,-3]],()=>tray.loaded());
 k.label('49 / КРИВАЯ ОТРАЖЕНИЯ',[0,17,-25.5],[0,0,1],22,1.2);
 k.display([25.7,9,9],()=>`ПЛЕЧО ${head.arm.toFixed(2)} м / УГОЛ ${THREE.MathUtils.radToDeg(head.angle).toFixed(1)}°\n${head.clamped?'СТРУБЦИНА ЗАЖАТА':'ШАРНИР СВОБОДЕН'} / ${head.lit?'ЛИНЗА ОСВЕЩЕНА':'ЛИНЗА ТЁМНАЯ'}`,19,2.2,[-1,0,0]);
 const l=finish(k,[-12,0,22],[-10,.6,20],[0,0,-22],{tray,input,outlet,head,door,sensor,spawnView:{yaw:.07,pitch:-.04}},
  {'mirror-light-source':'capture the sole continuous light ray','mirror-light-outlet':'route light to a continuously rotated reflecting plane','gimbal-load-tray':'actual load lever arm supplies gimbal torque'},['portal redirection and optical reflection are independent transformations','load placement changes angular equilibrium','the mechanical clamp preserves the exact mirror pose before retrieving cargo']);const old=l.dispose;l.dispose=()=>{mirrorMat.dispose();old();};return l;
}

/** One real constrained rigid wall falls under gravity after a high cargo
 * impact. Segmented player envelopes follow its rotation, not a broad AABB. */
export function buildTopplingBridge(g,index=49,spec=EXPANSION_B_SPECS[3]){
 const k=chamber(g,index,spec,'kinetic',{minX:-29,maxX:29,minZ:-29,maxZ:28},-4,24);
 k.deck('South structural approach',-12,12,15,25,0);k.deck('West recovery gallery',-12,-4,3,15,0);k.deck('East recovery gallery',4,12,3,15,0);k.deck('Hinge threshold gallery',-12,12,-5,3,0);k.ramp('Inner dry cargo return',-4,4,3,15,-4,0);k.deck('North structural dock',-12,12,-27,-19,0);
 k.deck('Western impact balcony',-27,-11,10,25,12);k.ramp('Western dry recovery incline',-27,-19,-15,10,-4,12);
 const well=k.loadPad('hinge-gravity-well',[-16,-4,8.3],8);well.surface.mesh.userData.portalSize={width:1.4,height:1.4};
 const outlet=low(k.panel('hinge-high-impact',[0,8,8],[0,0,-1],8,5.8),1.8,1.1);
 const wall=movingMechanismBlock(k,'Hinged wall becomes structural bridge',[0,7,-5],[8,14,.5],'secondary');
 const hinge=V(0,0,-5),pieceBoxes=[];
 for(let n=0;n<28;n++)pieceBoxes.push(g.collisionProxy(new THREE.Box3().setFromCenterAndSize(V(0,(n+.5)*.5,-5),V(8,.5,.5)),{kinematic:true}));
 for(const x of [-4.5,4.5])k.geometry(new THREE.CylinderGeometry(.45,.45,.7,16),'metal',[x,0,-5],Q().setFromAxisAngle(V(0,0,1),Math.PI/2),{batch:false,name:'Structural hinge bearing'});
 k.ramp('Bolted structural hinge threshold',-4,4,-5.3,-4.3,.25,0);
 const bumper=lateShutter(k,'Low impact guard and bridge threshold',[0,1.4,-4.2],[9,2.8,.40],[0,-4.5,0]);
 const top={owner:null,body:null,anchor:null,constraint:null,angle:0,ensure(){if(!g.physics||this.owner===g.physics)return;this.owner=g.physics;
  this.anchor=new Body({mass:0,position:new Vec3(...hinge.toArray()),collisionFilterMask:0});
  this.body=new Body({mass:30,position:new Vec3(0,7,-5),shape:new Box(new Vec3(4,7,.25)),angularDamping:.18,material:new Material({friction:.72,restitution:.05}),collisionFilterGroup:1,collisionFilterMask:2});
  this.owner.world.addBody(this.anchor);this.owner.world.addBody(this.body);this.constraint=new HingeConstraint(this.anchor,this.body,{pivotA:new Vec3(0,0,0),pivotB:new Vec3(0,-7,0),axisA:new Vec3(1,0,0),axisB:new Vec3(1,0,0),collideConnected:false});this.owner.world.addConstraint(this.constraint);
  pieceBoxes.forEach(c=>this.owner.removeStaticBox(c.mesh.uuid));
 },force(){this.ensure();const b=this.body;
  // The manufactured over-centre detent resists hand-height nudges. Above
  // eight degrees gravity carries the entire wall toward its floor stop.
  if(this.angle>-.14)b.torque.x+=-this.angle*950-b.angularVelocity.x*55;
  if(this.angle<-Math.PI/2){b.quaternion.setFromAxisAngle(new Vec3(1,0,0),-Math.PI/2);b.position.set(0,0,-12);b.angularVelocity.setZero();}
 },update(dt){this.ensure();const q=Q().set(this.body.quaternion.x,this.body.quaternion.y,this.body.quaternion.z,this.body.quaternion.w);this.angle=new THREE.Euler().setFromQuaternion(q,'XYZ').x;
  wall.position.set(this.body.position.x,this.body.position.y,this.body.position.z);wall.quaternion.copy(q);wall.updateWorldMatrix(true,false);
  for(let n=0;n<pieceBoxes.length;n++){const local=new THREE.Box3().setFromCenterAndSize(V(0,-7+(n+.5)*.5,0),V(8,.5,.5));const bounds=local.applyMatrix4(wall.matrixWorld);const c=pieceBoxes[n];syncProxy(c,bounds);}
  bumper.target=this.angle< -1.43;bumper.update(dt);
 },reset(){this.ensure();this.angle=0;this.body.position.set(0,7,-5);this.body.quaternion.set(0,0,0,1);this.body.velocity.setZero();this.body.angularVelocity.setZero();this.body.force.setZero();this.body.torque.setZero();this.body.wakeUp();this.update(0);}
 };
 // The north dock is isolated laterally by full-height structural partitions;
 // the service floor always returns to the same south dock via the incline.
 for(const x of [-12.5,12.5])k.block([x,8.5,-17],[.65,25,25],'shell');
 k.forces.push(()=>top.force());k.ticks.push(dt=>top.update(dt));k.resets.push(()=>top.reset());
 k.label('50 / ПАДАЮЩАЯ АРХИТЕКТУРА',[0,21,-27.5],[0,0,1],26,1.2);
 k.display([26.8,9,7],()=>`СТЕНА ${THREE.MathUtils.radToDeg(-top.angle).toFixed(1)}°\n${top.angle< -1.43?'ПЕРЕПРАВА ОПУЩЕНА':'СТРУКТУРНЫЙ ШАРНИР / УПОР АКТИВЕН'}`,18,2,[-1,0,0]);
 const l=finish(k,[-23,12,21],[-21,12.6,19],[0,0,-24],{well,outlet,top,bumper,spawnView:{yaw:.10,pitch:-.06}},
  {'hinge-gravity-well':'original cargo acquires speed from a real fall','hinge-high-impact':'the high impact produces hinge torque while low hands meet a solid guard'},['a rigid wall rotates through physical hinge constraints','gravity makes the fallen wall into the only structural crossing','segmented colliders track the real panel at every angle','the same cargo is recovered from the dry floor']);return disposeBodies(l,[top]);
}

/** Three real berths require two independent dispatches. The cargo closes a
 * live weight clutch on the carrier; attached portal coordinates follow it. */
export function buildAddressRelay(g,index=50,spec=EXPANSION_B_SPECS[4]){
 const k=chamber(g,index,spec,'gravity',{minX:-33,maxX:33,minZ:-30,maxZ:29},-4,28);
 k.deck('South portal departure promenade',-30,-12,7,27,0);
 k.deck('East intermediate dispatch gallery',12,30,-26,-14,7);k.deck('East recall side gallery',24,32,-14,-5,7);
 k.deck('North final unloading gallery',-5,11,-27,-17,16);
 k.ramp('Dry relay return incline',-30,-22,-17,7,-4,0);
 k.deck('Lower western return landing',-30,-12,-27,-17,-4);
 const entry=k.panel('relay-ground-entry',[-23,2.9,9],[0,0,1],8,5.8);
 const shuttle=k.carrier('relay-live-address',[[-22,7,-14],[18,7,-14],[3,16,-17]],{width:12,depth:12,portal:true});shuttle.speed=9;
 const s=shuttle.panel;s.group.quaternion.setFromAxisAngle(V(0,1,0),Math.PI/2);s.group.position.x=3;s.group.position.z=6;s.sync(0);const clutch={loaded:()=>{const p=g.cargo?.position,f=shuttle.floor;return p&&!g.heldCube&&Math.abs(p.y-.39-f.y)<.32&&p.x>f.minX+.4&&p.x<f.maxX-.4&&p.z>f.minZ+.4&&p.z<f.maxZ-.4;}};
 const guards=[];for(const [p,size]of [[[6,.5,6],[.25,1.0,12]],[[-6,.5,6],[.25,1.0,12]],[[0,.5,12],[12,1.0,.25]],[[-5.5,.5,0],[1,1.0,.25]],[[3.5,.5,0],[5,1.0,.25]]]){const m=k.block(p,size,'metal',false,shuttle.group);m.updateWorldMatrix(true,false);const c=g.collisionProxy(new THREE.Box3().setFromObject(m),{kinematic:true});guards.push({m,c});}k.ticks.push(dt=>{for(const {m,c}of guards){m.updateWorldMatrix(true,false);const box=new THREE.Box3().setFromObject(m);if(g.physics?.solids?.has(c.mesh.uuid))g.syncCollision(c,box,dt);else syncProxy(c,box);}});
 k.state.relayClutch=clutch;k.ticks.unshift(()=>{shuttle.braked=!clutch.loaded();});
 k.control('relay-south-dispatch',[-16,0,19],()=>{shuttle.target=1;},'E — поперечный ход к восточному причалу. Муфта замкнута только свободным грузом в кабине.');
 k.control('relay-east-elevation',[27,7,-20],()=>{shuttle.target=2;},'E — направить кабину к верхнему разгрузочному причалу.');
 k.control('relay-east-recall',[26,7,-8],()=>{shuttle.target=0;},'E — вернуть нагруженную кабину к западному причалу.');
 k.control('relay-upper-recall',[8,16,-23],()=>{shuttle.target=1;},'E — вернуть кабину к среднему причалу.');
 // A full-height freight wing prevents reaching the upper control by climbing
 // its column or the intermediate dock's decorative frame.
 k.block([12,17,-24],[.6,22,10],'shell');
 k.block([3,23,-28.4],[16,1.0,.6],'secondary');
 k.label('51 / АДРЕСНАЯ ЭСТАФЕТА',[0,25,-28.5],[0,0,1],26,1.15);
 k.display([30.8,12,15],()=>`МУФТА ${clutch.loaded()?'ЗАМКНУТА ГРУЗОМ':'РАЗОМКНУТА'}\nПРИЧАЛ ${shuttle.at(0)?'ЗАПАД':shuttle.at(1)?'ВОСТОК':shuttle.at(2)?'ВЕРХНИЙ':'ДВИЖЕНИЕ'}`,19,2,[-1,0,0]);
 const l=finish(k,[-22,0,22],[-24,.6,20],[3,16,-23],{entry,shuttle,clutch,spawnView:{yaw:.1,pitch:-.07}},
  {'relay-ground-entry':'the observer reaches an isolated cabin by portal','relay-live-address':'one real portal address migrates between three separate physical berths'},['an empty carrier cannot transmit motor motion','only the eastern berth has the vertical dispatch','the observer and cargo travel independently before the last unloading','a live cargo clutch can be recalled without recreating either traveller']);return l;
}
export const EXPANSION_B_BUILDERS=Object.freeze([buildBrittleFuse,buildContactWedge,buildGimbalReflection,buildTopplingBridge,buildAddressRelay]);
