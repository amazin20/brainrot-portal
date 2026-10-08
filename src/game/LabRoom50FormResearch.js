import * as THREE from 'three';
import {ResearchChamber} from './LabResearchArt.js';
import {movingMechanismBlock} from './LabLateCampaignMechanisms.js';
import {cargoLoadsPlate} from './LabPlateContact.js';

const V=(...p)=>new THREE.Vector3(...p),Y=4,L=6,W=3;
export const ROOM50_FORM_RESEARCH_SPEC=Object.freeze({id:'research-room50-form-access',title:'Память формы / исследование',concept:'Выбор формы меняет дорогу и прямой доступ к тому же грузу.',description:'Исследовательский стенд: короткая форма требует отдельного возврата груза; длинная подводит к нему настил.',accent:0xeac675,assets:[1,2,11,22,23,24],hints:['Груз лежит на рабочей опоре. Червячная передача сохраняет поворот после разгрузки.','Переключатель выбирает короткую или длинную форму; другой рычаг безопасно возвращает раму.','Низкий борт закрывает напольный адрес с юга. Дальний ракурс с севера и обычный подход с запада дают разные способы возврата.']});

/** Opt-in research builder. Cargo/controller/portal simulation is production.
 * The bounded quasi-static load transmission is deliberately not a finished
 * Cannon hinge/lock model and is not campaign/design acceptance evidence. */
export function buildRoom50FormResearch(g,index=49){
 const k=new ResearchChamber(g,ROOM50_FORM_RESEARCH_SPEC,index,'kinetic',{minX:-23,maxX:18,minZ:-20,maxZ:24},-4,17);
 function deck(name,x0,x1,z0,z1,y=Y){
  const mesh=movingMechanismBlock(k,name,[(x0+x1)/2,y-.16,(z0+z1)/2],[x1-x0,.32,z1-z0],'floor');
  const c=g.collisionProxy(new THREE.Box3().setFromObject(mesh));
  const floor={minX:x0,maxX:x1,minZ:z0,maxZ:z1,y,mesh:c.mesh,enabled:true};g.floors.push(floor);k.world.floors.push(floor);return {mesh,c,floor};
 }
 deck('Permanent south preparation shelf',-10,10,-13,-2);
 deck('Narrow fixed hinge apron',-1.6,1.6,-2,0);
 deck('West service landing',-8,-4,6.1,13.6);
 deck('North return span',-8,4,10.5,13.6);
 deck('Permanent north receiving dock',-4,8,12,21);
 k.ramp('Physical recovery incline',-20,-12,-13,7,Y,-4);
 deck('South recovery ramp head',-20,-10,-18,-10);
 deck('South head connector',-12,-8,-13,-10);

 const source=k.panel('form-dispatch',[-5,Y+1.10,-8],[0,0,1],4,2.6);source.mesh.userData.portalSize={width:1.4,height:1.05};
 const receiver=k.panel('form-low-delivery',[-3.40,Y+2.25,6.0],[0,0,-1],3,2.6);receiver.mesh.userData.portalSize={width:1.2,height:1.05};
 const bay=deck('Original cargo working shelf',-4.7,-1.3,.9,6.1);
 const retrieve=k.panel('form-bay-return',[-3,Y+.015,3.5],[0,1,0],4.2,5.2);retrieve.mesh.userData.portalSize={width:1,height:1};
 // The source-facing solid lip intercepts a downward shot into the bay floor,
 // while the higher horizontal delivery shot fits below the real low roof.
 const accessMesh=movingMechanismBlock(k,'Form-linked west bay access wall',[-4.95,Y+1.15,3],[.30,2.30,4.8],'secondary');
 const accessCollider=g.collisionProxy(new THREE.Box3().setFromObject(accessMesh),{kinematic:true});
 k.block([-2.90,Y+1.275,2.15],[3.5,.25,3.1],'shell');
 k.block([-3,Y+.62,.75],[3.8,1.24,.30],'secondary');
 k.block([-2.90,Y+2.425,2.35],[3.2,.25,3.5],'shell');
 k.block([-3,Y+3.625,5.3],[3.8,.25,2.4],'shell');
 k.block([-3,Y+1.625,6.55],[3.8,.25,1.1],'shell');
 k.block([-1.13,Y+1.15,3],[.30,2.30,4.4],'secondary');
 k.block([-2.40,Y+.70,4.1],[.25,1.40,3.3],'metal');
 // The north hood admits a .78 m cargo and blocks the full 2.4 m capsule.
 // The west access wall moves with the first leaf's actual angle; no actor-
 // specific collision or achievement permission selects either approach.
 const north=k.panel('form-north-freight',[3,Y+1.1,18],[0,0,-1],3.5,2.6);north.mesh.userData.portalSize={width:1.2,height:1.05};
 const form={first:Math.PI/12,second:Math.PI/2,selection:'short',unwinding:false,stroke:0,strokeVelocity:0,loadForce:0,supportSamples:0};
 const leaves=[];
 for(let n=0;n<2;n++){
  const mesh=movingMechanismBlock(k,'Articulated form leaf '+(n+1),[0,Y-.16,3],[W,.32,L],'secondary');
  const pieces=Array.from({length:24},()=>g.collisionProxy(new THREE.Box3().setFromCenterAndSize(V(0,Y-.16,0),V(W,.32,L/24)),{kinematic:true}));
  const floor={minX:-15,maxX:15,minZ:-8,maxZ:16,y:Y,mesh:mesh,enabled:true,heightAt(x,z){const p=V(x,0,z).sub(this.start).applyAxisAngle(V(0,1,0),-this.angle);return Math.abs(p.x)<=W/2&&p.z>=0&&p.z<=L?Y:null;}};
  g.floors.push(floor);k.world.floors.push(floor);leaves.push({mesh,pieces,floor});
 }
 function pose(dt=0){
  let start=V(0,0,0);
  leaves.forEach((leaf,i)=>{
   const a=i?form.second:form.first,dir=V(Math.sin(a),0,Math.cos(a));leaf.floor.start=start.clone();leaf.floor.angle=a;
   leaf.mesh.position.copy(start).addScaledVector(dir,L/2).setY(Y-.16);leaf.mesh.rotation.y=a;leaf.mesh.updateWorldMatrix(true,false);
   leaf.pieces.forEach((c,j)=>{const p=start.clone().addScaledVector(dir,(j+.5)*L/24).setY(Y-.16),q=new THREE.Quaternion().setFromAxisAngle(V(0,1,0),a),box=new THREE.Box3().setFromCenterAndSize(V(),V(W,.32,L/24));g.syncCollision(c,box.applyMatrix4(new THREE.Matrix4().compose(p,q,V(1,1,1))),dt);});
   start.addScaledVector(dir,L);
  });form.tip=start;const opening=THREE.MathUtils.clamp(-form.first/(Math.PI/2),0,1);accessMesh.position.x=-4.95-6*opening;accessMesh.updateWorldMatrix(true,false);g.syncCollision(accessCollider,new THREE.Box3().setFromObject(accessMesh),dt);
 }
 // A contact footprint on the real original body supplies its static weight.
 // Continuous spring stroke drives a visible, bounded gear; no solved flag,
 // timer, portal identity, cargo proximity permit or achievement is consulted.
 const loaded=()=>cargoLoadsPlate(g.cargo,g.heldCube,retrieve.getFrame());
 k.ticks.push(dt=>{
  form.loadForce=loaded()?g.physics.cargoBody.mass*Math.abs(g.physics.world.gravity.y):0;if(form.loadForce)form.supportSamples++;
  const acceleration=(form.loadForce-220*form.stroke-25*form.strokeVelocity)/7;
  form.strokeVelocity+=acceleration*dt;form.stroke=THREE.MathUtils.clamp(form.stroke+form.strokeVelocity*dt,0,.42);if(form.stroke===0&&form.strokeVelocity<0)form.strokeVelocity=0;
  const target=form.unwinding?[Math.PI/12,Math.PI/2]:form.selection==='short'?[0,0]:[-Math.PI/2,0];
  const step=(form.unwinding?.9:Math.max(0,form.stroke-.02)*4)*dt;
  for(const [key,i]of [['first',0],['second',1]])form[key]+=THREE.MathUtils.clamp(target[i]-form[key],-step,step);
  pose(dt);
 });
 k.control('form-select',[4.5,Y,-3.6],()=>{form.selection=form.selection==='short'?'long':'short';form.unwinding=false;},'E — передача: короткая / длинная. Усилие даёт груз на рабочей опоре.');
 k.control('form-unwind',[7.2,Y,-7.8],()=>{form.unwinding=!form.unwinding;},'E — разгрузить червячный привод и безопасно вернуть раму.');
 k.resets.push(()=>{Object.assign(form,{first:Math.PI/12,second:Math.PI/2,selection:'short',unwinding:false,stroke:0,strokeVelocity:0,loadForce:0,supportSamples:0});pose();});pose();
 const level=k.finishResearch([1,Y,-8],[-1,Y+.6,-8],[2,Y,16.1],{formResearch:true,form,leaves,source,receiver,retrieve,north,bay,spawnView:{yaw:Math.PI,pitch:-.08}});
 level.clearance.minimumWalkway=W;level.cargoOnAnyPad=loaded;level.getObjective=()=>`Исследовательская рама: ${form.selection}, ход опоры ${form.stroke.toFixed(2)} м. Форма сохраняется после разгрузки.`;
 level.researchScope={activeCampaign:false,cargoActuation:'bounded quasi-static weight/spring linkage; real Cannon hinge/lock acceptance open',portalAndActorPhysics:'production, unchanged',geometry:'two actual live leaves and independently reachable cargo bay',nativeAndUniqueness:'open'};
 return level;
}
