import * as THREE from 'three';
import {Workshop} from './LabWorkshopKit.js';
import {configureChapterWorld} from './LabChapterArt.js';
import {createPlanter,placeSolidModel} from './LabSolidModels.js';
import {buildGardenDoor} from './LabRoom24Garden.js';
export const ROOM24_SPEC={id:'garden-of-turning-doors',title:'Сад поворотных дверей',concept:'Портал помнит дверь, а не направление; один поворот открывает другой сад',description:'У каждого сада есть лицевая и обратная сторона. Посмотри, что меняется вместе с дверью и что остаётся на месте.',accent:0xffc75b,assets:[1,2,11,22,23,24],hints:['Одна керамическая дверь смотрит в два разных двора. Портал поворачивается вместе с ней.','Дверь можно повернуть двумя способами: грузом снизу или ручным приводом на южном балконе. Тормоз удерживает её настоящее положение.','Подними друга через его опору. Северная лестница меняет ракурс: за стеной видна обратная сторона жёлтого павильона.']};
export function buildRoom24(game,index=23){
 const k=new Workshop(game,ROOM24_SPEC,index),w=k.world;configureChapterWorld(w,'garden');k.bounds={minX:-24,maxX:24,minZ:-24,maxZ:24};k.ceiling=25;w.highFidelity=true;
 w.materials.wall.color.setHex(0xf2bb93);w.materials.floor.color.setHex(0x79bbb0);w.materials.trim.color.setHex(0x386c6b);w.materials.ceramic.color.setHex(0xfff4d9);w.walls(k.bounds,25,-1);
 const deck=(name,x0,x1,z0,z1,y)=>w.floor(x0,x1,z0,z1,y,{name});
 const block=(p,s,m=w.materials.wall)=>{const mesh=w.box(p,s,m);mesh.userData.keepMaterial=true;return mesh;};
 const mint=new THREE.MeshStandardMaterial({color:0x77c6ad,roughness:.85}),rose=new THREE.MeshStandardMaterial({color:0xe58f9c,roughness:.85}),yellow=new THREE.MeshStandardMaterial({color:0xf3cc65,roughness:.8});
 deck('Garden recovery paths',-24,24,-24,24,0);
 deck('South inspection balcony',-3.5,7,0,6,6);block([1.75,2.9,3],[10.5,5.8,6],rose);
 deck('West conservatory gallery',-24,0,-12,-5,6);block([-12,2.9,-8.5],[24,5.8,7],mint);deck('West garden return walk',-24,-18,-5,3.5,6);deck('Planter observation branch',-18,-10,0,3.5,6);
 block([1.9,6.4,5.9],[2.3,.8,.16],rose);
 // Shallow planting-bed kerbs catch loose arrivals on the west landing.
 block([-2.5,6.45,-5.1],[5,.9,.16],mint);block([-2.5,6.45,-11.85],[5,.9,.16],mint);
 // A thick, visible corner pier seals the diagonal between arrival sides.
 block([-2.4,13,2.4],[2.2,14,2.2],yellow);block([-3.5,13,13.75],[.35,14,20.5],rose);
 // Three metre wide inspection window over the real cargo planter.
 // Replace the lower part of the west/south wall with a broad sight opening.

 block([-20,13,3.5],[8,14,.35],mint);block([-5.75,13,3.5],[4.5,14,.35],mint);block([-12,17,3.5],[8,6,.35],mint);
 // The rotor hub is closed on the north and east. Its two southern/western
 // landings are distinct spaces, not painted regions of one open platform.
 block([3.5,13,-5],[.35,14,10],yellow);block([-10,13,-3.6],[12,14,.35],yellow);
 // Fold around the far west end of that wall, then climb the garden's
 // freestanding stair to the reverse inspection perch.
 deck('North return terrace',-24,-16,-20,-12,6);
 for(let i=0;i<20;i++){const z=-8-i*.5;deck('Garden folded stair',-23,-18,z-.5,z,6+(i+1)*.25);block([-20.5,6+(i+.5)*.25,z-.465],[5,.27,.07],mint);}
 deck('High reverse pergola',-24,-16,-24,-18,11);
 // A gold pavilion stands over the entrance court. Its receiving face points
 // north and sits behind its own tall east wall, hidden from the lower paths.
 deck('Yellow destination pavilion',8,24,-23,-12,15);block([16,7.4,-17.5],[16,14.8,11],yellow);
 block([24,19,-17.5],[.35,8,11],yellow);block([16,19,-12],[16,8,.35],yellow);block([8,7.5,-17.5],[.35,15,11],yellow);
 // A tall baffle admits the north high view and blocks every low diagonal.
 block([-4,5.65,-18],[.35,11.3,10],rose);block([-4,18.75,-18],[.35,7.5,10],rose);
 const pad=k.pad('garden-counterweight',[-12,0,12],6.4,6.4);
 k.panel('balcony-entry',[6.6,8.1,3.5],[-1,0,0],5,5);
 k.panel('garden-entry',[18,2.1,23.6],[0,0,-1],6.4,5);
 k.panel('pavilion-receiver',[23.6,17.3,-18],[-1,0,0],6.4,5);
 const door=buildGardenDoor(k,pad);
 // A manufactured planter, recessed soil and thick botanical blades share
 // the same explicit physical envelope; no more non-solid foliage blobs.
 for(const p of [[22,0,18],[21,0,-7],[-21,0,7],[11,0,14],[20,0,8],[-20,0,17],[-22.5,6,-1],[-22,11,-20],[20,15,-14]])
  placeSolidModel(k,createPlanter('garden'),p);
 for(const x of [-23,-17])block([x,13,-19],[.24,6,.24],yellow);for(const z of [-22,-19,-16])block([-20,15.8,z],[6.4,.24,.32],yellow);
 const level=k.finish([15,0,18],[11,.55,18],[16,15,-18],{workshop:k,spec:ROOM24_SPEC,portalPuzzle:true,gardenDoor:door});
 level.spawnView={yaw:.4,pitch:-.1};level.puzzleGeometry={footprint:2304,occupiedHeights:[0,6,11,15],goalHeight:15,orders:['carry-through','counterweight'],noProgressFlags:true,portalRoles:{'balcony-entry':'manual route from the south balcony through the orbiting door','garden-counterweight':'the original weight becomes its own return aperture','garden-entry':'stable entrance below the rotating door','revolving-door':'one persistent portal changes the courtyard it faces','pavilion-receiver':'a high reverse view into the gold pavilion'},deductions:['a portal retains the moving architectural face','a worm drive or a live counterweight can move the same doorway to a separate courtyard','the courtyard brake preserves orientation after the weight leaves','a floor aperture recovers that same weight','the folded stair exposes the pavilion from its reverse side']};
 return level;
}
export {runRoom24} from './LabRoom24Journey.js';
