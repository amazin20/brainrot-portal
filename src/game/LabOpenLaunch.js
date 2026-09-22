import * as THREE from 'three';
import {OpenChamber} from './LabOpenArchitecture.js';
import {addSky,applyDeckFinish,reinforceDeck,sign} from './LabOpenStationArt.js';
const V=(...v)=>new THREE.Vector3(...v),Q=()=>new THREE.Quaternion();
export const LAUNCH_SPEC={id:'open-horizon-rewire',title:'За горизонтом',concept:'Разгон открывает ракурс. Во время одного полёта поменяй оба конца пути.',description:'Закрепи друга клавишей E. С высокой площадки набери скорость; за энергоблоком откроется новый ракурс.',accent:0xffaa54,assets:[1,2,11,22,23,24],hints:['Низкий спуск не даёт нужной дальности. Подъём широким пандусом меняет запас энергии, а наклонный выход — направление.','До полёта выпускная панель спрятана за энергоблоком. В полёте сначала перенеси вход на дальний экран, затем выход — на верхний причал.','На нижней площади нет тупика: широкий пандус возвращает к началу. Закреплённый друг проходит порталы вместе с тобой, руки остаются свободными.']};
export function buildOpenLaunch(game,index=29){
 const k=new OpenChamber(game,LAUNCH_SPEC,index,'launch');k.bounds={minX:-64,maxX:98,minZ:-60,maxZ:56};k.ceiling=82;addSky(k);
 k.deck('Lower rescue square',-62,96,-58,54,-9,{color:'dark'});
 k.deck('Observatory approach',-52,-14,16,44,8);
 k.ramp('First twelve-metre ascent',-52,-40,-44,16,31,8);
 k.deck('Panoramic northern landing',-52,-28,-56,-44,31);
 k.ramp('Second twelve-metre ascent',-40,-28,-44,2,31,54);
 k.deck('High launch terrace',-40,-16,2,18,54);
 k.deck('Portal fall court',-34,-18,-8,8,0);
 k.loadPad('fall-court',[-26,0,0],14);
 const launch=k.panel('inclined-outlet',[-10,5,28],[.751265,.66,0],12,10);
 k.panel('far-catch',[80,20.5,26],[-1,0,0],18,18);
 k.deck('Upper terminal square',52,78,-34,-6,26);
 k.panel('terminal-outlet',[77.8,28.85,-20],[-1,0,0],10,5.8);
 // The building is a large authored spatial turn, not a corridor or a hidden
 // completion flag. Its normal silhouette occludes the final face from ascent.
 k.block([23,29,-20],[14,78,80],'dark',true,k.world.root,.18);
 for(let z=-55;z<=15;z+=10){
  for(const x of [15.75,30.25]){
   for(const y of [-3,62])k.block([x,y,z],[.6,9,8.8],'shell');
   for(const side of [-1,1])k.block([x,29,z+side*4.5],[.6,60,.44],'secondary');
   for(let y=6;y<59;y+=6.5)k.block([x, y,z],[.74,3.4,8.0],'shell');
  }
  for(const y of [2,23,44,65]){
   k.block([15.23,y,z],[.16,.30,7.6],'light',false);k.block([30.77,y,z],[.16,.30,7.6],'light',false);
  }
 }
 k.block([23,68.8,-20],[16.8,2.0,82],'secondary');
 for(const y of [5,24,43,61])k.block([23,y,20.3],[12.5,15,.55],'secondary');
 // Broad recovery climb stays outside the tower and rejoins the original square.
 k.ramp('Recovery promenade',-62,-52,12,44,-9,8);k.deck('Recovery bridge',-62,-52,44,54,8);k.deck('Entry return apron',-52,-14,44,54,8);
 for(const d of k.decks.filter(d=>d.y>0))reinforceDeck(k,d,{legs:false});
 for(const [x,z,top]of [[-50,-50,30],[-50,38,7],[-38,4,53],[-18,4,53],[55,-30,25],[74,-30,25]])k.column(x,z,-9,top,1.2);
 // Closed collars carry the inclined launch dish without obstructing its centre.
 k.ring([-10,5,28],8,.9,1.5,Q().setFromUnitVectors(V(0,0,1),V(.751265,.66,0).normalize()));
 for(const z of [21,35])k.column(-10,z,-9,2,1.0);
 for(const z of [15,37])k.column(81,z,-9,32.5,1.1);
 k.block([81,31.5,26],[2.4,1.8,25],'shell');
 sign(k,'REWIRE IN FLIGHT',[78.9,31.5,26],[-1,0,0],12,1.0);
 sign(k,'54 m / FALL TERRACE',[-26,53.05,18.14],[0,0,1],10,.64);
 applyDeckFinish(k);
 const l=k.finishOpen([-29,8,31],[-31,.6+8,28],[64,26,-20],{kineticCourse:true,launchSurface:launch,spawnView:{yaw:-.25,pitch:-.16}});
 l.getContextLesson=()=>{if(!game.velocityCompanion?.connected&&game.playerPosition.distanceTo(game.cargo.position)<4.5)return ['open-tether','E','Закрепи друга: он полетит рядом, а руки останутся свободными для выстрелов.',false];if(!game.playerGrounded&&game.playerVelocity.length()>12)return ['open-flight-focus','Q','Удерживай Q, чтобы замедлить полёт и точнее переставить порталы.',false];return null;};
 l.puzzleGeometry={orders:['airborne-double-rewire'],launchHeight:54,goalHeight:26,noProgressFlags:true,minimumFlightSpan:90};return l;
}
