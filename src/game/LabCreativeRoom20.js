import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {ResearchChamber} from './LabResearchArt.js';

const V=(...p)=>new THREE.Vector3(...p),Q=()=>new THREE.Quaternion();
export const CREATIVE_ROOM20_SPEC=Object.freeze({
 id:'foundation-portal-tension',title:'Натянутое пространство',accent:0xe9bc76,assets:[1,2,11,22],
 concept:'Одна портальная пара проводит груз и видимый тяговый трос. Свободный подвес удлиняет дальнюю ветвь; непрерывное натяжение укорачивает ближнюю и отодвигает пружинный затвор.',
 description:'Осмотри весовой карман через узкую щель. Отправь друга грузовым порталом, натяни трос и задвинь дальний стопор в настоящий зуб затвора. Затем освободи подвес и выходите вместе.',
 hints:[
  'Обзорная лестница ведёт к двум узким щелям. Они пропускают заряд портала, но не тело. Белая панель внутри дальнего кармана — единственный грузовой адрес.',
  'Спутник должен свободно висеть на дальней ветви. Пока две настоящие ветви троса провисают, пружина удерживает дверь. Подъём и перенос на ближней стороне её не открывают.',
  'Из открытого прохода доступен дальний рычаг стопора. Видимый палец удерживает зуб двери. После этого переставь дальний портал на свободное место грузовой площадки, дождись падения друга на пол и забери его через боковой сервисный проём.'
 ]
});

function movingPart(k,p,size,material,name){
 const mesh=k.geometry(new RoundedBoxGeometry(...size,1,.035),material,p,Q(),{batch:false,name});
 const collider=k.game.collisionProxy(new THREE.Box3().setFromObject(mesh),{kinematic:true});
 k.game.cameraBlockers.push(mesh);k.game.aimBlockers.push(mesh);
 return {mesh,collider,move(p,dt){mesh.position.fromArray(p);mesh.updateWorldMatrix(true,false);k.game.syncCollision(collider,new THREE.Box3().setFromObject(mesh),dt);}};
}
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
 const feed=k.loadPad('rope-loading-floor',[-9,0,18],6);
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
 const leaf=movingPart(k,[0,3.25,.85],[8.5,6.5,.65],'secondary','Tension-driven horizontal bulkhead');
 const returnLeaf=movingPart(k,[16,3.25,.85],[8.5,6.5,.65],'secondary','Rigidly linked return-court bulkhead');
 const tie=movingPart(k,[8,6.25,.85],[24.5,.28,.5],'metal','Solid overhead connection between both door leaves');
 const tooth=movingPart(k,[3.7,2.2,.25],[.30,1.0,.30],'metal','Actual far-side stop tooth');
 const stop=movingPart(k,[-2.8,2.2,-.80],[.35,1.2,.32],'metal','Retractable solid retaining finger');
 // Founded rails and a protected spring housing are outside the crossing.
 for(const y of [-.35,6.8])for(const x of [-7.8,8.2])k.block([x,y,1.5],[10,.25,.3],'dark');
 k.block([-13.1,3.2,.45],[1.3,6.4,1.4],'shell');
 k.geometry(new THREE.TorusGeometry(.18,.055,8,20),'metal',[3,-.25,.5],Q(),{parent:leaf.mesh,batch:false,name:'Founded moving cable eye'});
 const spring=k.geometry(new THREE.TorusGeometry(.45,.06,8,24),'metal',[-12.9,3,.95],Q(),{batch:false,name:'Return spring winding'});
 for(const x of [-4.1,4.1])k.block([x,0,.342],[.14,5.8,.035],'metal',false,leaf.mesh);
 // The weighted pocket has a sealed front, a ground-level FAR service entry,
 // and a small manufactured portal. It cannot be fed through the sight slit.
 const pocketSight=sightWall(k,-21,-11,-8,11);
 k.block([-21,5.5,-15],[.7,11,14],'shell');
 k.block([-11,5.5,-20.7],[.7,11,2.6],'shell');
 k.block([-11,5.5,-9.0],[.7,11,2.0],'shell');
 k.block([-16,11.35,-15],[10.7,.7,14.7],'shell');
 k.block([-16,5.5,-22],[10.7,11,.7],'shell');
 const back=k.envelopes.at(-1);
 const outlet=k.panel('rope-weight-outlet',[-16,7.2,-21.58],[0,0,1],4.2,4.2);
 outlet.mesh.userData.portalSize={width:.8,height:.8};outlet.mesh.userData.portalBackingIds=[back.mesh.uuid];
 // Solid fairlead housings surround, rather than cover, the actual apertures.
 for(const x of [-17.8,-14.2])k.block([x,7.2,-21.1],[.25,3.9,.35],'metal');
 k.block([-16,9.15,-21.1],[3.85,.28,.35],'metal');
 k.block([-16,1.0,-21.1],[3.7,.25,.45],'dark');
 k.block([-2.8,.7,-2.1],[.8,1.4,.8],'dark');
 for(const x of [-3.1125,-2.4875])k.block([x,2.2,-1.4],[.175,1.3,1.2],'shell');
 for(const y of [1.4,3.0])k.block([-2.8,y,-1.4],[.8,.3,1.2],'shell');
 const cableMaterial=new THREE.MeshStandardMaterial({name:'Braided portal traction cable',color:0xd3b778,roughness:.74,metalness:.38});
 const nearLine=ropeLine(k,cableMaterial,'Current near cable branch');
 const farLine=ropeLine(k,cableMaterial,'Current far hanging cable branch');
 const entryLead=ropeLine(k,cableMaterial,'Near fairlead to active aperture');
 const exitLead=ropeLine(k,cableMaterial,'Active aperture to far fairlead');
 const sleeve=k.geometry(new THREE.TorusGeometry(.50,.065,8,24),'metal',[0,0,0],Q(),{batch:false,name:'Cargo tether sleeve'});
 // Thin strands cannot serve as invisible stepping stones or walking props.
 const ignored=new Set([leaf.collider.mesh.uuid,returnLeaf.collider.mesh.uuid,tie.collider.mesh.uuid,tooth.collider.mesh.uuid,stop.collider.mesh.uuid,feed.surface.collider.mesh.uuid,outlet.collider.mesh.uuid,back.mesh.uuid]);
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
 const rope={length:24.8,maxExtension:7,stiffness:110,damping:8,opening:0,velocity:0,tension:0,stretch:0,path:null,pinTarget:0,pinTravel:0,
  anchor(){return V(3-this.opening,3,1.36);},
  currentPath(){
   if(!g.portals.ready||!g.cargo)return null;
   const pair=g.portals.portals;
   const entry=pair.find(p=>p?.surfaceId===sourceOwner),exit=pair.find(p=>p?.surfaceId===targetOwner);
   if(!entry||!exit||entry===exit)return null;
   const anchor=this.anchor(),cargo=g.cargo.position.clone(),entryPoint=entry.position.clone(),exitPoint=exit.position.clone();
   const a=entryPoint.clone().addScaledVector(entry.normal,.8),b=exitPoint.clone().addScaledVector(exit.normal,.9);
   // Current points are on the actual active apertures, including deliberately
   // offset shots. Solid walls still reject the exterior half of a cable.
   if(!clearSpan(anchor,a)||!clearSpan(b,cargo))return null;
   const near=a.clone().sub(anchor),far=cargo.clone().sub(b),nearLength=near.length(),farLength=far.length();
   if(nearLength<.01||farLength<.01)return null;
   return {anchor,a,b,entryPoint,exitPoint,cargo,near:near.divideScalar(nearLength),far:far.divideScalar(farLength),length:nearLength+farLength+1.7,reachable:nearLength+farLength+1.7<=this.length+this.maxExtension};
  },
  loaded(){return !!this.path&&this.tension>1;},
  forces(){
   const body=g.physics?.cargoBody;if(!body)return;
   this.path=this.currentPath();this.tension=this.stretch=0;
   if(!this.path?.reachable){this.path=null;return;}
   this.stretch=Math.max(0,this.path.length-this.length);
   const rate=V(body.velocity.x,body.velocity.y,body.velocity.z).dot(this.path.far)+this.velocity*this.path.near.x;
   this.tension=Math.min(180,Math.max(0,this.stretch*this.stiffness+rate*this.damping));
   // Held-body support already cancels gravity in the shared physics engine.
   // No special "was freely portalled" predicate is used here: walls prevent
   // a near-side held endpoint from making a valid remote hanging branch.
   body.force.x-=this.path.far.x*this.tension;body.force.y-=this.path.far.y*this.tension;body.force.z-=this.path.far.z*this.tension;
   if(this.tension>0)body.wakeUp();
  },
  update(dt){
   const pull=this.path? -this.path.near.x*this.tension:0;
   const acceleration=(pull-(4+this.opening*1.2)-this.velocity*1.1)/1.2;
   this.velocity+=acceleration*dt;
   let next=THREE.MathUtils.clamp(this.opening+this.velocity*dt,0,7.2);
   this.pinTravel=THREE.MathUtils.clamp(this.pinTravel+Math.sign(this.pinTarget-this.pinTravel)*Math.min(Math.abs(this.pinTarget-this.pinTravel),dt*2.2),0,1);
   stop.move([-2.8,2.2,-.80+this.pinTravel*1.05],dt);
   // The swept stop tooth is blocked by the visible extended finger. The
   // contact value comes from their actual box faces, not a latching flag.
   const toothBox=tooth.collider.box,pin=stop.collider.box;
   const overlapsYZ=pin.min.y<toothBox.max.y&&pin.max.y>toothBox.min.y&&pin.min.z<toothBox.max.z&&pin.max.z>toothBox.min.z;
   const contact=3.7+.15-pin.min.x;
   if(overlapsYZ&&this.opening>=contact-.01&&next<contact){next=contact;this.velocity=Math.max(0,this.velocity);}
   if(next===0||next===7.2)this.velocity=0;
   this.opening=next;leaf.move([-next,3.25,.85],dt);returnLeaf.move([16-next,3.25,.85],dt);tie.move([8-next,6.25,.85],dt);tooth.move([3.7-next,2.2,.25],dt);
   spring.rotation.z=-next*.75;
   const p=this.currentPath();nearLine.set(this.anchor(),p?.a??feed.surface.getFrame().center,!!p);const farEnd=p?.reachable?p.cargo:p?p.b.clone().addScaledVector(p.far,Math.max(0,this.length+this.maxExtension-p.a.distanceTo(p.anchor)-1.7)):outlet.getFrame().center;farLine.set(p?.b??outlet.getFrame().center,farEnd,!!p);
   entryLead.set(p?.a??this.anchor(),p?.entryPoint??this.anchor(),!!p);exitLead.set(p?.exitPoint??this.anchor(),p?.b??this.anchor(),!!p);
   sleeve.visible=!!p?.reachable;if(p?.reachable){sleeve.position.copy(p.cargo);sleeve.quaternion.setFromUnitVectors(V(0,0,1),p.far);}
  },
  reset(){this.opening=this.velocity=this.tension=this.stretch=this.pinTarget=this.pinTravel=0;this.path=null;leaf.move([0,3.25,.85],0);returnLeaf.move([16,3.25,.85],0);tie.move([8,6.25,.85],0);tooth.move([3.7,2.2,.25],0);stop.move([-2.8,2.2,-.80],0);nearLine.mesh.visible=farLine.mesh.visible=entryLead.mesh.visible=exitLead.mesh.visible=sleeve.visible=false;}
 };
 k.state.rope=rope;k.forces.push(()=>rope.forces());k.ticks.unshift(dt=>rope.update(dt));k.resets.push(()=>rope.reset());
 k.control('far-retaining-finger',[7,0,-4],()=>{rope.pinTarget=rope.pinTarget?0:1;},'E — задвинуть или убрать настоящий стопорный палец. Дождись совмещения зуба со шкалой.');
 k.display([0,9.8,1.0],()=>`ТРОС ${rope.path?.length.toFixed(2)??'—'} / ${rope.length.toFixed(1)} + ${rope.maxExtension.toFixed(0)} м\nТЯГА ${rope.tension.toFixed(0)} Н / ДВЕРЬ ${rope.opening.toFixed(2)} м`,13,2.2);
 k.label('20 / НАТЯНУТОЕ ПРОСТРАНСТВО',[-26.5,9,18],[1,0,0],15,1.0);
 k.label('ТОЛЬКО ОБЗОР · ВЫСОТА 64 см',[-16,11.3,.5],[0,0,1],7,.7);
 k.label('СТОПОР ЗУБА · СЕРВИСНЫЙ ВХОД',[8,5,-6],[0,0,1],9,.7);
 k.routes.push({name:'continuous ground passage and far service return',width:8,headroom:6.5},{name:'charge-only double sight slit',width:8,headroom:.64,walkable:false});
 const l=k.finishResearch([3,0,23],[-3,0.6,23],[16,0,23],{creativeEarly:20,researchChamber:false,foundationChamber:false,rope,leaf,returnLeaf,tie,tooth,stopFinger:stop,feed,outlet,inspection,pocketSight,spawnView:{yaw:0,pitch:-.1}});
 l.puzzleGeometry={noProgressFlags:true,recoveryFloor:0,portalRoles:{'rope-loading-floor':'free freight and source cable fairlead','rope-weight-outlet':'guarded high freight and far cable fairlead'},orders:['cargo-first','scout-first'],mechanism:'continuous portal cable tension and actual stop-tooth contact'};
 const dispose=l.dispose;l.dispose=()=>{cableMaterial.dispose();dispose();};
 return l;
}
