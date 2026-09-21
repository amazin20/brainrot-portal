import * as THREE from 'three';
import {Workshop,V} from './LabWorkshopKit.js';
import {configureChapterWorld} from './LabChapterArt.js';
import {buildRoom29Gravity} from './LabRoom29Gravity.js';

export const ROOM29_SPEC={id:'inverted-orchard',title:'Небо под ногами',concept:'Друг исследует нижнюю сторону сада, а наблюдатель — верхнюю',description:'Два сада смотрят друг на друга. Найди место, где их пути снова встретятся.',accent:0xe8de76,assets:[1,2,11,22,23,24],hints:['Кристаллы меняют притяжение только свободного друга. Положение стрелок показывает направление силы.','Из верхней беседки видны поверхности, скрытые с нижнего сада. Низкий потолочный ход рассчитан на маленького путешественника.','Можно разделить ваши пути или провести друга длинной дорогой через беседку. Портальная пара не обязана всё время соединять одни и те же сады.']};

export function buildRoom29(game,index=28){
 const k=new Workshop(game,ROOM29_SPEC,index),w=k.world;configureChapterWorld(w,'inversion',{openSky:true});
 k.bounds={minX:-22,maxX:22,minZ:-22,maxZ:22};k.ceiling=21;w.walls(k.bounds,21,-1);
 w.floor(-22,22,0,22,0,{name:'Lower violet garden'});
 w.floor(-22,22,-22,0,0,{name:'Recoverable lower undercroft'});
 w.floor(4,22,-22,-7,9,{name:'Receiving citrus garden'});
 // A wall has two superimposed, human-readable routes: a narrow viewing
 // aperture at eye level and a low cargo gallery immediately below the crown.
 w.box([-8,10.5,0],[28,21,.5],w.materials.wall);
 w.box([21,10.5,0],[2,21,.5],w.materials.wall);
 w.box([13,3.5,0],[14,7,.5],w.materials.wall);
 w.box([13,16.15,0],[14,9.7,.5],w.materials.wall);
 // Wide stepped promenade bends twice; its landings expose new sight lines.
 w.stairs(-21,-16,5,15,0,3);w.floor(-21,-16,15,17,3,{name:'West turn landing'});w.floor(-21,-6,17,20,3,{name:'First promenade landing'});
 for(let i=0;i<12;i++)w.floor(-11,-6,7+i*10/12,7+(i+1)*10/12,6-i*.25,{name:'Folded promenade tread'});w.floor(-11,19,3,7,6,{name:'Observation ribbon'});
 
 // Safe lower access to the first stair and an obvious airy south overlook.
 w.box([-14,3.4,17.8],[3,.25,.5],w.materials.trim,false);
 const source=k.panel('root-ceiling',[-12,16.2,8],[0,-1,0],5.6,5.6);
 const crown=k.panel('crown-ceiling',[9,16.2,-13],[0,-1,0],5.6,5.6);
 // The receiving portal sits in a 1.7 m high ceiling pocket. A free cargo
 // body crosses it; a full-height player cannot walk through the low passage.
 w.floor(5.8,14,-18.5,-12,14.5,{name:'Underside violet cargo gallery'});
 w.box([12.5,16.4,-13],[15,.35,11],w.materials.wall);
 w.box([5.6,15.45,-13],[.4,2.2,11],w.materials.wall);
 w.box([12.5,15.45,-18.6],[14,.35,.35],w.materials.trim);
 w.box([12.5,15.45,-7.4],[14,.35,.35],w.materials.trim);
 k.panel('observatory-return',[-8,7.8,4.0],[0,0,1],5.8,4.6);
 k.panel('garden-return',[17,11.4,-20],[0,0,1],5.8,4.6);
 const gravity=buildRoom29Gravity(k);
 k.control('root-reverse',[-5,0,12],()=>{gravity.source.up=!gravity.source.up;},'E — перевернуть притяжение корневого сада');
 k.control('crown-reverse-upper',[17,6,5.5],()=>{gravity.crown.up=!gravity.crown.up;},'E — перевернуть притяжение потолочного сада');
 k.control('crown-reverse-inside',[18,9,-8.5],()=>{gravity.crown.up=!gravity.crown.up;},'E — вернуть друга на землю');
 // Broad sculptural rings make paired landmarks readable without more lights.
 const lilac=new THREE.MeshStandardMaterial({color:0x9c75de,roughness:.55}),citrus=new THREE.MeshStandardMaterial({color:0xe9d865,roughness:.57}),sapphire=new THREE.MeshStandardMaterial({color:0x527ec9,roughness:.5});
 const ringGeo=new THREE.TorusGeometry(3.2,.24,6,32);
 for(const [x,y,z,mat] of [[-12,.26,8,lilac],[-12,15.82,8,citrus],[16,9.27,-13,citrus],[16,15.85,-13,lilac]]){const mesh=new THREE.Mesh(ringGeo,mat);mesh.rotation.x=Math.PI/2;mesh.position.set(x,y,z);mesh.userData.keepMaterial=true;w.root.add(mesh);}
 const crystalGeo=new THREE.OctahedronGeometry(1,0);
 for(const [x,z] of [[-19,-14],[-15,-7],[-3,15],[3,14],[20,17]])for(const ceiling of [false,true]){const mesh=new THREE.Mesh(crystalGeo,ceiling?citrus:sapphire);mesh.position.set(x,ceiling?18:1.9,z);mesh.scale.set(.85,ceiling?2.1:1.7,.85);mesh.userData.keepMaterial=true;w.root.add(mesh);}
 const level=k.finish([-3,0,19],[-16,.55,10],[17,9,-13],{workshop:k,portalPuzzle:true,visualProfile:'inversion'});
 level.puzzleGeometry={footprint:44*44,goalHeight:9,safeFloor:0,noProgressFlags:true,orders:['split-ceiling-route','carry-observation-route'],portalRoles:{'root-ceiling':'launch the original free companion against ordinary gravity','crown-ceiling':'receive the small body in a low ceiling passage','observatory-return':'the human-scale return from the observation garden','garden-return':'a high receiver visible only through the observation aperture'},deductions:['gravity changes the free companion, not the observer','the same landmark is both a floor and a ceiling','a low upper passage connects the companion route to an otherwise isolated garden','the observation ribbon reveals a different portal route','one pair can be borrowed after the ceiling traveller has reached solid support','reversing a finite field brings the same body back down'],gravityChangesPlayer:false};
 return level;
}
export {runRoom29} from './LabRoom29Journey.js';
