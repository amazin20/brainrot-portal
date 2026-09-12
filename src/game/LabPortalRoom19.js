import {Workshop,V,glass} from './LabWorkshopKit.js';
import {opticalLift} from './LabRoom13Mechanics.js';
import {cargoLoadsPlate} from './LabPlateContact.js';
import {createRoom19Drive,createRoom19Optics} from './LabRoom19Mechanics.js';
export const ROOM19_SPEC={id:'glass-air-inertia',title:'Свет проходит, воздух — нет',concept:'Свет пересекает герметичную камеру, воздух обходит её, а инерция освобождает порталы для живого груза',description:'Одна камера, два пути передачи. Сохрани то, что продолжает двигаться после разрыва связи.',hints:['Стекло пропускает луч. Поток воздуха упирается в него.','Поднятая кабина — ещё не постоянная опора. Обойди верхний машинный зал и посмотри на обратные стороны оборудования.','Маховик хранит движение. Его можно раскрутить, освободить порталы для друга и подключить тележку муфтой.'],accent:0xd0bb84,assets:[1,2,11,19,22,23,24,31,35]};
export function buildRoom19(game,index=18){
 const k=new Workshop(game,ROOM19_SPEC,index),w=k.world;k.shell({minX:-20,maxX:20,minZ:-18,maxZ:18},20);
 const deck=(name,x0,x1,z0,z1,y)=>{const f=w.floor(x0,x1,z0,z1,y,{name});w.box([(x0+x1)/2,y-.28,(z0+z1)/2],[x1-x0,.32,z1-z0],w.materials.trim);return f;};
 // Every pane is a normal solid collider with optical transmission only.
 const panes=[glass(w,[-4,3.0,0],[.22,6.0,8]),glass(w,[4,3.0,0],[.22,6.0,8]),glass(w,[0,3.0,-4],[8,6.0,.22]),glass(w,[0,3.0,4],[8,6.0,.22])];
 for(const x of [-4,4])for(const z of [-4,4])w.box([x,3.0,z],[.16,6.0,.16],w.materials.trim);
 const cargoFloor=k.panel('sealed-cradle',[0,.025,0],[0,1,0],5.6,5.6);cargoFloor.collider.kinematic=false;
 k.panel('service-intake',[-10,2.3,9],[-1,0,0],5.6,4.6);
 k.panel('optical-window',[-8,2.3,0],[1,0,0],5.6,4.6);
 const fan=k.fan('air-source',[-17,2.3,9],[1,0,0],{radius:1.1});fan.enabled=true;k.resets.push(()=>{fan.enabled=true;});
 const lift=opticalLift(k,'glass-observer',[-14,0,-8],{top:8,width:4,depth:4});
 const light=createRoom19Optics(k,{origin:[-16,2.3,8.7],direction:[1,0,0],receiver:[5.4,2.3,-.3],lift});
 k.wire([[5.4,1,-.3],[5.4,1,5],[-6,1,5],[-6,1,-8],[-12,1,-8]],()=>light.lit);
 // The lift has no latch. Stepping onto this ledge physically retains height.
 deck('Lift retaining ledge',-17,-8,-13,-10,8);deck('Folded upper service hall',-8,14,-17,-5,8);
 // A folded service hall reveals the reverse face; ground shots hit screens.
 for(const [z,len] of [[-15,4],[-7.5,5]])w.box([-8,10,z],[.35,20,len],w.materials.wall);
 w.box([-8,4,-11.5],[.35,8,3],w.materials.wall);w.box([-8,16,-11.5],[.35,8,3],w.materials.wall);
 w.box([-4,10,-9],[.45,20,8],w.materials.wall);
 w.box([3,10,-17.2],[22,20,.3],w.materials.wall);
 w.box([14.2,10,-11],[.3,20,12],w.materials.wall);
 w.box([3,4,-5],[22,8,.3],w.materials.wall);
 for(const [x,width] of [[-5,6],[4,4],[13,2]])w.box([x,14,-5],[width,12,.3],w.materials.wall);
 k.panel('open-air-duct',[-3.74,10.3,-8],[1,0,0],5.6,4.6);
 // One free-spinning drive moves a real kinematic deck across the shaft.
 const ferry=k.slider('inertial-ferry',[9,8,-3],[9,8,7],{width:4,depth:4,portal:false,asset:19,assetSize:3.3});
 const receiver=k.panel('ferry-receiver',[-.8,2.3,1.9],[0,0,-1],3.4,4.6,ferry.group,true);ferry.panel=receiver;k.ticks.push(dt=>{receiver.group.updateWorldMatrix(true,true);receiver.collider.box.setFromObject(receiver.mesh);game.physics?.updateStaticBox(receiver.mesh.uuid,receiver.collider.box,dt);});
 for(const x of [6,12])w.box([x,10,2],[.35,20,14],w.materials.wall);
 w.box([13,4,13.5],[14,8,9],w.materials.wall);deck('Far drive dock',6,20,9,18,8);
 w.box([16,14,9],[8,12,.3],w.materials.wall);
 // This normal gearbox changes force transmission, never a completion flag.
 const drive=createRoom19Drive(k,fan,ferry);
 const level=k.finish([-15,0,15],[0,.55,0],[16,8,13],{workshop:k,portalPuzzle:true,cargoOnAnyPad:()=>cargoLoadsPlate(game.cargo,game.heldCube,cargoFloor.getFrame())||ferry.loaded(),playerAcceleration:(p,v)=>fan.acceleration(p.clone().add(V(0,1.2,0)),v)});
 level.mechanismArt={projectors:[{position:light.origin.toArray(),direction:[1,0,0],radius:.38}],turbines:[fan],liftSurfaces:['glass-observer']};
 level.puzzleGeometry={footprint:1440,orders:['air-first','cargo-first'],glass:panes,portalRoles:{'service-intake':'shared optical and pneumatic source','optical-window':'light crosses the sealed cargo chamber','sealed-cradle':'independent retrieval through the only opening below the cargo','open-air-duct':'air route around impermeable glass','ferry-receiver':'moving cargo receiver after releasing the drive source'},deductions:['glass separates optical transmission from air transmission','the powered lift can be left on a permanent ledge','the upper outlet is reached from its reverse side','flywheel angular momentum persists without the portal feed','the same pair must retrieve the original cargo','a clutch applies actual traveller-dependent drive load','the moving receiver belongs to the ferry, not to the dock','cargo-first is possible by returning around the bulkhead to restore the original intake']};
 return level;
}
export {runRoom19} from './LabRoom19Journey.js';
