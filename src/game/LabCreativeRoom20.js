import * as THREE from 'three';
import {ResearchChamber} from './LabResearchArt.js';
import {buildRoom20NearHook} from './LabRoom20NearHook.js';
import {buildRoom20RetainingFinger} from './LabRoom20RetainingFinger.js';

const V=(...p)=>new THREE.Vector3(...p),Q=()=>new THREE.Quaternion();
export const CREATIVE_ROOM20_SPEC=Object.freeze({
 id:'foundation-portal-tension',title:'Натянутое пространство',accent:0xe9bc76,assets:[1,2,11,22],
 concept:'Одна портальная пара проводит груз и видимый трос. Вес свободного подвеса разгружает ближний крюк; рука освобождает крюк, и натяжение двигает обе двери одного массивного затвора.',
 description:'Осмотри весовой карман через узкую щель. Отправь друга грузовым порталом, натяни трос и освободи ближний крюк. Задвинь дальний палец в настоящий зуб затвора, освободи подвес и выходите вместе.',
 hints:[
  'Обзорная лестница ведёт к двум узким щелям. Они пропускают заряд портала, но не тело. Белая панель внутри дальнего кармана — единственный грузовой адрес.',
  'Спутник должен свободно висеть на дальней ветви. Трос сначала снимает нагрузку с ближнего крюка. Тогда поверни его ближний барабан: рука освобождает крюк, а вес двигает дверь.',
  'Из открытого прохода доступен дальний рычаг стопора. Видимый палец удерживает зуб двери. После этого переставь дальний портал на соседнюю нижнюю сервисную панель, дождись падения друга на пол и забери его через боковой сервисный проём.'
 ]
});

function wallSpan(k,x0,x1,y0,y1,z,material='shell'){
 if(x1<=x0||y1<=y0)return null;
 k.block([(x0+x1)/2,(y0+y1)/2,z],[x1-x0,y1-y0,.7],material);
 return k.envelopes.at(-1);
}
function sightWall(k,x0,x1,z,roof){
 const slit={x:-16,width:8,bottom:6.88,top:7.52};
 wallSpan(k,x0,slit.x-slit.width/2,0,roof,z);
 wallSpan(k,slit.x+slit.width/2,x1,0,roof,z);
 wallSpan(k,slit.x-slit.width/2,slit.x+slit.width/2,0,slit.bottom,z,'dark');
 wallSpan(k,slit.x-slit.width/2,slit.x+slit.width/2,slit.top,roof,z,'dark');
 for(const x of [slit.x-4.1,slit.x+4.1])k.block([x,7.2,z+.39],[.09,.9,.1],'metal',false);
 return {...slit,z};
}
function ropeLine(k,material,name){
 const mesh=k.geometry(new THREE.CylinderGeometry(.055,.055,1,8),'metal',[0,0,0],Q(),{batch:false,name});mesh.material=material;
 return {mesh,set(a,b,visible){const delta=b.clone().sub(a),length=delta.length();mesh.visible=visible&&length>.01;if(!mesh.visible)return;mesh.position.copy(a).add(b).multiplyScalar(.5);mesh.quaternion.setFromUnitVectors(V(0,1,0),delta.normalize());mesh.scale.set(1,length,1);}};
}
/** A massless extensible cable follows the CURRENT portal aperture centres.
 * The two fairleads are manufactured parts, not remembered journey steps.
 * Each exterior cable span must be physically clear. An end behind a wall,
 * a erased pair or a slack line transmits no force. The only completion rule
 * is the existing joint goal volume; door and stop positions are geometry. */
export function buildCreative20(g,index=19){
 const k=new ResearchChamber(g,CREATIVE_ROOM20_SPEC,index,'kinetic',{minX:-28,maxX:28,minZ:-28,maxZ:30},0,14);
 k.deck('Tension inspection scaffold',-25,-12,5,17,6);
 k.ramp('Grounded inspection access',-25,-17,17,28,6,0);
 const feed=k.loadPad('rope-loading-floor',[-11,0,12],2.4);
 const recovery=k.loadPad('rope-recovery-floor',[-9,0,18],6);
 recovery.surface.mesh.userData.portalSize={width:.8,height:.8};
 feed.surface.mesh.userData.portalSize={width:.8,height:.8};
 // A full-height partition has one actual door and a 64 cm charge-only slit.
 const inspection=sightWall(k,-27,-4.25,0,14);
 wallSpan(k,4.25,11.75,0,14,0);
 wallSpan(k,20.25,27,0,14,0);
 wallSpan(k,11.75,20.25,6.5,14,0,'dark');
 // Adjacent entry and return courts share no near-side passage. Their two
 // leaves form one rigid gate train, joined above the walking headroom.
 // A 72 cm physical sleeve through the court divider clears the 65 cm
 // moving leaf. It cannot admit the 78 cm cargo or 86 cm capsule.
 k.block([8,7,(1.21+30)/2],[.7,14,30-1.21],'shell');
 k.block([8,7,.42],[.7,14,.14],'shell');
 k.block([8,(6.8+14)/2,.85],[.7,14-6.8,.72],'dark');
 wallSpan(k,-4.25,4.25,6.5,14,0,'dark');
 // The complete train and near hook are created below after the current
 // aperture cable callback exists. These founded covers clear the entire
 // physical sliding envelope rather than replacing it with moving AABBs.
 for(const y of [-.35,6.8])for(const x of [-7.8,8.2])k.block([x,y,1.5],[10,.25,.3],'dark');
 k.block([-13.1,3.2,.45],[1.3,6.4,1.4],'shell');
 const spring=k.geometry(new THREE.TorusGeometry(.45,.06,8,24),'metal',[-12.9,3,.95],Q(),{batch:false,name:'Return spring winding'});
 // The weighted pocket has a sealed front, a ground-level FAR service entry,
 // and a small manufactured portal. It cannot be fed through the sight slit.
 const pocketSight=sightWall(k,-21,-11,-8,11);
 k.block([-21,5.5,-15],[.7,11,14],'shell');
 k.block([-11,5.5,-20.7],[.7,11,2.6],'shell');
 k.block([-11,5.5,-9.0],[.7,11,2.0],'shell');
 k.block([-16,11.35,-15],[10.7,.7,14.7],'shell');
 k.block([-16,5.5,-22],[10.7,11,.7],'shell');
 const back=k.envelopes.at(-1);
 const outlet=k.panel('rope-weight-outlet',[-16,7.2,-21.58],[0,0,1],2.4,2.4);
 outlet.mesh.userData.portalSize={width:.8,height:.8};outlet.mesh.userData.portalBackingIds=[back.mesh.uuid];
 // Solid fairlead housings surround, rather than cover, the actual apertures.
 for(const x of [-17.8,-14.2])k.block([x,7.2,-21.1],[.25,3.9,.35],'metal');
 k.block([-16,9.15,-21.1],[3.85,.28,.35],'metal');
 // The hanging line has no low supporting bar: cargo weight stays on the
 // cable until the separate recovery reroute deliberately releases it.
 k.block([-2.8,.7,-2.1],[.8,1.4,.8],'dark');
 for(const x of [-3.1125,-2.4875])k.block([x,2.2,-1.4],[.175,1.3,1.2],'shell');
 for(const y of [1.4,3.0])k.block([-2.8,y,-1.4],[.8,.3,1.2],'shell');
 const cableMaterial=new THREE.MeshStandardMaterial({name:'Braided portal traction cable',color:0xd3b778,roughness:.74,metalness:.38});
 const nearLine=ropeLine(k,cableMaterial,'Current near cable branch');
 const farLine=ropeLine(k,cableMaterial,'Current far hanging cable branch');
 const entryLead=ropeLine(k,cableMaterial,'Near fairlead to active aperture');
 const exitLead=ropeLine(k,cableMaterial,'Active aperture to far fairlead');
 const dashpot=ropeLine(k,k.m.metal,'Founded one-way opening dashpot piston');
 k.geometry(new THREE.CylinderGeometry(.25,.25,1.1,20),'metal',[-12.9,3,1.39],Q().setFromAxisAngle(V(0,0,1),Math.PI/2),{batch:false,name:'Founded oil dashpot barrel inside protected housing'});
 k.geometry(new THREE.BoxGeometry(.20,.35,.28),'secondary',[-12.9,3.30,1.39],Q(),{batch:false,name:'Oil dashpot return check-valve housing'});
 const sleeve=k.geometry(new THREE.TorusGeometry(.50,.065,8,24),'metal',[0,0,0],Q(),{batch:false,name:'Cargo tether sleeve'});
 // Thin strands cannot serve as invisible stepping stones or walking props.
 const ignored=new Set([feed.surface.collider.mesh.uuid,outlet.collider.mesh.uuid,back.mesh.uuid]);
 const sourceOwner=feed.surface.mesh.uuid,targetOwner=outlet.mesh.uuid;
 function clearSpan(a,b){
  const delta=b.clone().sub(a),length=delta.length();if(length<.01)return true;
  const ray=new THREE.Ray(a.clone().addScaledVector(delta,.002),delta.normalize()),hit=V();
  for(const c of g.colliders){
   if(c.enabled===false||ignored.has(c.mesh.uuid))continue;
   if(ray.intersectBox(c.box,hit)&&hit.distanceTo(a)<length-.09&&hit.distanceTo(a)>.09)return false;
  }
  return true;
 }
 function currentCablePath(eye,bodyPosition){
  if(!g.portals.ready||!g.cargo)return null;
  const pair=g.portals.portals,entry=pair.find(p=>p?.surfaceId===sourceOwner),exit=pair.find(p=>p?.surfaceId===targetOwner);
  if(!entry||!exit||entry===exit)return null;
  const anchor=V(...eye.toArray()),cargo=V(...bodyPosition.toArray()),entryPoint=entry.position.clone(),exitPoint=exit.position.clone();
  const a=entryPoint.clone().addScaledVector(entry.normal,.8),b=exitPoint.clone().addScaledVector(exit.normal,.9);
  if(!clearSpan(anchor,a)||!clearSpan(b,cargo))return null;
  const near=a.clone().sub(anchor),far=cargo.clone().sub(b),nearLength=near.length(),farLength=far.length();
  if(nearLength<.01||farLength<.01)return null;
  return{anchor:anchor.toArray(),a:a.toArray(),b:b.toArray(),entryPoint:entryPoint.toArray(),exitPoint:exitPoint.toArray(),cargo:cargo.toArray(),near:near.divideScalar(nearLength).toArray(),far:far.divideScalar(farLength).toArray(),nearLength,farLength,length:nearLength+farLength+1.7};
 }
 const nearHook=buildRoom20NearHook(g,k,{currentCablePath}),stop=buildRoom20RetainingFinger(g,k,nearHook);
 const {leaf,returnLeaf,tie,tooth}=nearHook;
 // Self parts neither occlude their own cable eye nor supply fictitious
 // support. Every external structural span still passes the real ray test.
 for(const p of [...nearHook.gateParts,...nearHook.hookParts,...nearHook.fixedParts])ignored.add(p.collider.mesh.uuid);
 ignored.add(stop.collider.mesh.uuid);
 const rope={length:19.5,maxExtension:15.4,stiffness:110,damping:8,
  get opening(){return nearHook.opening;},get velocity(){return -(nearHook.gateBody?.velocity.x??0);},get tension(){return nearHook.diagnostics().tension;},get stretch(){return nearHook.diagnostics().stretch;},get path(){return nearHook.diagnostics().cablePath;},get pinTravel(){return stop.travel;},
  anchor(){return V(3-this.opening,3,1.36);},
  currentPath(){if(!nearHook.ensure())return null;const p=currentCablePath(nearHook.gateBody.position.vadd(new (nearHook.gateBody.position.constructor)(3,3,1.36)),g.physics.cargoBody.position);return p?{...p,reachable:p.length<=this.length+this.maxExtension,anchor:V(...p.anchor),a:V(...p.a),b:V(...p.b),entryPoint:V(...p.entryPoint),exitPoint:V(...p.exitPoint),cargo:V(...p.cargo),near:V(...p.near),far:V(...p.far)}:null;},
  loaded(){return !!this.path&&this.tension>1;},
  diagnostics(){return{...nearHook.diagnostics(),farFinger:stop.diagnostics()};},
  update(){nearHook.updateForces(1/120);stop.ensure();const p=this.currentPath();spring.rotation.z=-this.opening*.75;dashpot.set(V(-12.35,3,1.39),V(-4.15-this.opening,3,1.39),true);nearLine.set(this.anchor(),p?.a??feed.surface.getFrame().center,!!p);farLine.set(p?.b??outlet.getFrame().center,p?.cargo??outlet.getFrame().center,!!p?.reachable);entryLead.set(p?.a??this.anchor(),p?.entryPoint??this.anchor(),!!p);exitLead.set(p?.exitPoint??this.anchor(),p?.b??this.anchor(),!!p);sleeve.visible=!!p?.reachable;if(p?.reachable){sleeve.position.copy(p.cargo);sleeve.quaternion.setFromUnitVectors(V(0,0,1),p.far);}},
  reset(){nearHook.reset();stop.reset();nearLine.mesh.visible=farLine.mesh.visible=entryLead.mesh.visible=exitLead.mesh.visible=sleeve.visible=false;}
 };
 k.state.rope=rope;k.state.nearHook=nearHook;k.forces.push(dt=>nearHook.updateForces(dt));k.ticks.unshift(()=>rope.update());k.resets.push(()=>rope.reset());
 k.control('near-hook-control',[6,0,3.5],()=>nearHook.hand(),'E — повернуть настоящий освобождающий барабан. Трос должен разгрузить ближний крюк.');
 k.control('far-retaining-finger',[7,0,-4],()=>stop.hand(),'E — сдвинуть настоящий стопорный палец. Дождись совмещения зуба со шкалой.');
 k.display([0,9.8,1.0],()=>`ТРОС ${rope.path?.length.toFixed(2)??'—'} / ${rope.length.toFixed(1)} + ${rope.maxExtension.toFixed(1)} м\nТЯГА ${rope.tension.toFixed(0)} Н / ДВЕРЬ ${rope.opening.toFixed(2)} м`,13,2.2);
 k.label('20 / НАТЯНУТОЕ ПРОСТРАНСТВО',[-26.5,9,18],[1,0,0],15,1.0);
 k.label('ТОЛЬКО ОБЗОР · ВЫСОТА 64 см',[-16,11.3,.5],[0,0,1],7,.7);
 // The full eight-metre label stays in the entry court. Its former centre
 // at x=6 put the right-hand words behind the real court divider at x=7.65.
 k.label('БЛИЖНИЙ КРЮК · ОСВОБОЖДЕНИЕ',[3.5,4.8,5.0],[0,0,1],8,.7);
 k.label('СТОПОР ЗУБА · СЕРВИСНЫЙ ВХОД',[8,5,-6],[0,0,1],9,.7);
 k.routes.push({name:'continuous ground passage and far service return',width:8,headroom:6.5},{name:'charge-only double sight slit',width:8,headroom:.64,walkable:false});
 const l=k.finishResearch([3,0,23],[-3,0.6,23],[16,0,23],{creativeEarly:20,researchChamber:false,foundationChamber:false,rope,nearHook,leaf,returnLeaf,tie,tooth,stopFinger:stop,feed,recovery,outlet,inspection,pocketSight,spawnView:{yaw:0,pitch:-.1}});
 l.puzzleGeometry={noProgressFlags:true,recoveryFloor:0,portalRoles:{'rope-loading-floor':'free freight and source cable fairlead','rope-weight-outlet':'guarded high freight and far cable fairlead'},orders:['cargo-first','scout-first'],mechanism:'unilateral current-aperture cable, passive slip near-hook, one massive train with passive one-way opening dashpot and CANNON retaining-finger contact'};
 const dispose=l.dispose;l.dispose=()=>{stop.dispose();nearHook.dispose();cableMaterial.dispose();dispose();};
 return l;
}
