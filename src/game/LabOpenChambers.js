import * as THREE from 'three';
import {buildOpenHydraulics,HYDRAULIC_SPEC} from './LabOpenHydraulics.js';
import {buildOpenLaunch,LAUNCH_SPEC} from './LabOpenLaunch.js';
import {OpenChamber} from './LabOpenArchitecture.js';
import {finishOrbitalArchitecture} from './LabOpenStationArt.js';
const V=(...v)=>new THREE.Vector3(...v),Q=()=>new THREE.Quaternion();

export const OPEN_SPECS=Object.freeze({
 27:HYDRAULIC_SPEC,29:LAUNCH_SPEC,
 23:{id:'open-orbital-post',title:'Почта между небесами',concept:'Один груз выбирает причал. Портал путешествует вместе с кареткой, тормоз сохраняет адрес.',description:'У трёх причалов одна каретка. Найди, как груз может выбрать её маршрут и потом догнать её.',accent:0xf6ad49,assets:[1,2,11,22,23,24],hints:['Вес в нижнем приёмнике отправляет каретку к западному причалу. Войти можно пешком на платформу или через установленный на ней портал.','Западный приёмник отправляет ту же каретку дальше. Тормоз на причале держит её в любой точке, даже когда груз забран.','Останови каретку, используй напольный портал для возврата груза. Один и тот же груз должен выбрать оба адреса и добраться к выходу.']},
});

/** Hand-authored spacious replacement, not a coordinate-scaled old garden. */
export function buildOpenOrbital(game,index=23){
 const k=new OpenChamber(game,OPEN_SPECS[23],index,'orbital');
 k.recovery({y:-9});
 k.deck('Departure plaza',-16,16,18,42,0);
 k.deck('Western sorting terrace',-44,-16,0,24,10);
 k.deck('Eastern destination terrace',16,44,-16,8,24);
 k.rail(-44,-16,0,24,10,'west');k.rail(16,44,-16,8,24,'east');
 const low=k.loadPad('ground-load',[9,0,31],8);
 const high=k.loadPad('west-load',[-23,10,14],8);
 k.panel('departure',[-10,2.85,40],[0,0,-1],8,5.8);
 k.panel('west-return',[-37,12.85,22],[0,0,-1],8,5.8);
 k.panel('recovery',[48,-6.15,42],[0,0,-1],8,5.8);
 const car=k.carrier('postal-carriage',[[0,0,6],[-30,10,-12],[30,24,-28]],{interchange:[0,16,-30]});
 const resetCar=car.reset.bind(car);car.reset=()=>{resetCar();car.braked=true;};car.reset();
 // This is live load selection, not a latched stage/checklist.
 k.ticks.unshift(()=>{car.target=high.loaded()?2:low.loaded()?1:0;});
 k.control('carriage-brake',[-38,10,7],()=>{car.braked=!car.braked;},'Тормоз удерживает каретку. E — зажать / отпустить.');
 k.column(-4,17,-9,0,.35);
 k.control('departure-release',[-4,0,17],()=>{car.braked=false;},'E — отпустить тормоз и вернуть управление грузу.');
 // Main machine: an open transfer gantry, not enclosing walls.
 for(const x of [-50,50])for(const z of [-36,38])k.column(x,z,-9,53,1.2);
 for(const z of [-36,38])k.block([0,52.4,z],[102,1.4,2.2],'shell');
 for(const x of [-50,50])k.block([x,52.4,1],[2.2,1.4,74],'shell');


 // Fixed gantry rails and hanging cables give the travelling dock its mechanism.
 const junction=V(0,48,-30);
 for(const end of [V(0,48,6),V(-30,48,-12),V(30,48,-28)]){
  const axis=end.clone().sub(junction).normalize(),side=V(-axis.z,0,axis.x);
  for(const sign of [-1,1]){
   const a=junction.clone().addScaledVector(side,sign*.8),b=end.clone().addScaledVector(side,sign*.8),v=b.clone().sub(a);
   k.geometry(new THREE.CylinderGeometry(.19,.19,v.length(),12),'metal',a.add(b).multiplyScalar(.5).toArray(),Q().setFromUnitVectors(V(0,1,0),v.normalize()),{solid:true,name:'Switchable overhead rail'});
  }
 }
 k.block([0,49.25,-30],[7,1.0,7],'secondary');
 const tethers=[];for(const x of [-5.1,5.1])for(const z of [1,10.8]){
  const mesh=k.geometry(new THREE.CylinderGeometry(.045,.045,1,8),'metal',[0,0,0],Q(),{batch:false,name:'Carriage suspension cable'});tethers.push({mesh,x,z});
 }
 const syncCables=()=>{for(const {mesh,x,z}of tethers){const y=car.group.position.y,top=48;mesh.position.set(car.group.position.x+x,(y+top)/2,car.group.position.z+z);mesh.scale.y=top-y;}};
 k.renders.push(syncCables);k.ticks.push(syncCables);
 // Port-front aprons are twelve metres deep, no narrow arrival ledges.
 k.routes.push({name:'west pier circulation',width:12,headroom:18},{name:'destination apron',width:12,headroom:14});
 finishOrbitalArchitecture(k,car);
 const level=k.finishOpen([-5,0,33],[-2,.58,31],[30,24,-2],{car,loadPads:[low,high],spawnView:{yaw:.05,pitch:-.18}});
 level.puzzleGeometry={footprint:116*104,goalHeight:24,orders:['ride-first','portal-first'],noProgressFlags:true,portalRoles:{departure:'permanent entrance', 'postal-carriage':'one moving address', 'ground-load':'first live load and recovery aperture','west-load':'second live load and delivery aperture','west-return':'permanent route after the carriage leaves',recovery:'restore any reachable moving address from the lower concourse'}};
 return level;
}
export const OPEN_BUILDERS=Object.freeze({23:buildOpenOrbital,27:buildOpenHydraulics,29:buildOpenLaunch});
