import * as THREE from 'three';
import {Workshop} from './LabWorkshopKit.js';
export const ROOM17_SPEC={id:'shifting-berth',title:'Подвижный адрес',concept:'Адрес портала путешествует с вагоном; вес, тормоз и новый ракурс меняют назначение одного пути',description:'Друг запускает вагон, но должен уехать вместе с тобой. Сохрани адрес и найди его второе назначение.',hints:['Портал остаётся на своём вагоне даже за непрозрачной опорой.','Тормоз у дальней платформы удерживает вагон без груза на исходной плите.','Галерея показывает другую сторону верхнего приёмника. Вагон может вернуть друга, пока ты ищешь этот ракурс.'],accent:0xb3ddd4,assets:[1,2,11,19,22,23,24,29]};
export function buildRoom17(game,index=16){
 const k=new Workshop(game,ROOM17_SPEC,index),w=k.world;k.bounds={minX:-24,maxX:24,minZ:-32,maxZ:24};k.ceiling=27;w.walls(k.bounds,27,-1);
 const deck=(name,x0,x1,z0,z1,y)=>{w.floor(x0,x1,z0,z1,y,{name});w.box([(x0+x1)/2,y-.3,(z0+z1)/2],[x1-x0,.34,z1-z0],w.materials.trim);};
 deck('West recovery court',-24,-2,-32,24,0);deck('East recovery court',2,24,-32,24,0);
 // The opaque spine is pierced by a rail tunnel and an offset upper crossing.
 // Neither opening can be entered from the recovery courts below it.
 w.box([0,13.5,19],[4,27,10],w.materials.wall);w.box([0,13.5,-3.5],[4,27,19],w.materials.wall);w.box([0,13.5,-24.5],[4,27,15],w.materials.wall);
 w.box([0,3.5,10],[4,7,8],w.materials.wall);w.box([0,20,10],[4,14,8],w.materials.wall);
 w.box([0,6,-15],[4,12,4],w.materials.wall);w.box([0,21.5,-15],[4,11,4],w.materials.wall);
 // A west structural bulkhead makes the observation side genuinely remote.
 w.box([-11.5,6,-8.15],[19,12,.3],w.materials.wall);w.box([-22.5,7.5,-8.15],[3,9,.3],w.materials.wall);
 deck('East permanent berth',10,23,13.5,21,7);
 for(let i=0;i<12;i++){const z=18-i*.5;deck('Initial sight stair',-24,-20,z-.5,z,(i+1)*.25);}
 deck('Initial sight shelf',-24,-20,8,12,3);
 // The upper return folds north around the spine; it finishes in a one-way
 // five-metre drop over the first berth, never an initial stair shortcut.
 for(let i=0;i<20;i++){const z=13.5-i*.45;deck('East folded stair',19,23,z-.45,z,7+(i+1)*.25);}
 deck('East observation arm',19,23,-17,4.5,12);deck('Offset spine crossing',-21,19,-17,-13,12);
 deck('West sight balcony',-22,-8,-13,-9,12);deck('Suspended west return',-17,-11,-9,5.8,12);
 // The receiver faces away from the entire arrival half of the chamber.
 // Its opaque back and west cheek require the upper observer to turn behind it.
 w.box([-11.5,13.5,-17.25],[19,27,.35],w.materials.wall);
 deck('West return behind the receiver',-24,-21,-25,-13,12);
 for(let i=0;i<8;i++){const z=-25-i*.5;deck('Reverse sight stair',-24,-21,z-.5,z,12+(i+1)*.25);}
 deck('Reverse receiving viewpoint',-24,-9,-32,-29,14);
 w.box([-20.6,13.5,-21],[.4,27,7.5],w.materials.wall);
 deck('Upper receiving chamber',-20,-10,-25,-18,17);w.box([-15,8.4,-21.5],[10,16.8,7],w.materials.wall);
 // Rails, buffers and bearing blocks mark the carriage's actual crossing.
 for(const z of [7,13]){w.box([0,6.48,z],[35,.18,.16],w.materials.trim,false);for(const x of [-17,-2,2,17])w.box([x,6.12,z],[.7,.65,.7],w.materials.trim,false);}
 for(const x of [-18,18])w.box([x,6.25,10],[.35,.35,6.4],w.materials.trim,false);
 const mover=k.slider('address',[-14,7,10],[14,7,10],{width:6,depth:7,portal:true,asset:19,assetSize:5});mover.rate=.19;
 const pad=k.pad('dispatch',[-17,0,20],4.4,4.4);
 // Only live contact drives the actuator; there are no visited-room flags.
 k.ticks.unshift(()=>{mover.target=pad.loaded()||pad.player()?1:0;});
 const brake=k.control('berth-brake',[20,7,18],()=>{mover.locked=!mover.locked;},'Стояночный тормоз вагона');
 const caliper=new THREE.Group();caliper.position.set(17.7,7.45,12.6);w.root.add(caliper);
 const shoe=w.box([0,0,0],[.38,.7,.85],w.materials.trim,false,caliper),lamp=w.box([0,.48,0],[.28,.1,.45],w.materials.accent.clone(),false,caliper);
 k.renders.push(()=>{shoe.position.x=mover.locked?-.18:.18;lamp.material.color.setHex(mover.locked?0xffbe69:0xb3ddd4);});
 k.wire([[-17,.1,20],[-21,.1,20],[-21,.1,8],[-21,6.3,8],[-17,6.3,8]],()=>pad.loaded()||pad.player());
 k.wire([[20,7.2,18],[20,7.2,13],[17.7,7.2,13]],()=>mover.locked);
 for(let i=0;i<12;i++){const z=4+i*.5;deck('East recovery sight stair',20,24,z,z+.5,(i+1)*.25);}
 deck('East recovery sight shelf',20,24,10,12,3);
 k.panel('recovery',[23.97,2.3,21],[-1,0,0],5.6,4.6);
 k.panel('arrival',[-23.97,2.3,21],[1,0,0],5.6,4.6);
 k.panel('upper-receiver',[-16,19.3,-18.15],[0,0,-1],6.4,4.6);
 const level=k.finish([-20,0,14],[-21,.55,21],[-16,17,-20.4],{workshop:k,portalPuzzle:true});
 level.mechanismArt={liftSurfaces:['address deck']};
 level.puzzleGeometry={footprint:2688,goalHeight:17,orders:['cargo-first','scout-first'],portalRoles:{recovery:'a physical return from the lower east catch court',address:'a travelling address behind the opaque spine',dispatch:'a live weight drives the rail',arrival:'return for the original load after parking', 'upper-receiver':'only the remote observation side reveals the final destination'},deductions:['a placed portal travels out of sight with its support','weight must stay behind during the first crossing','park the empty address before retrieving its power source','the return stroke transports the friend while the observer takes the upper fold','reuse the parked portal after discovering the far side of the high receiver'],noProgressionFlags:true};
 return level;
}
export {runRoom17} from './LabRoom17Journey.js';
