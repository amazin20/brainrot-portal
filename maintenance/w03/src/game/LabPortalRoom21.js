import * as THREE from 'three';
import {Workshop} from './LabWorkshopKit.js';
import {glass} from './LabPuzzleMechanics.js';
import {cargoLoadsPlate} from './LabPlateContact.js';
import {createArchitecturalGate} from './LabArchitecturalGate.js';
const V=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z);
export const ROOM21_SPEC={id:'gravity-pocket',title:'Гравитационный карман',
 concept:'Высота даёт запас скорости, направление даёт подъём; постоянная ниша освобождает пару',
 description:'Поднимись над перекрытием. Друг должен вернуться из грузового кармана вместе с тобой.',
 accent:0xe6b86b,assets:[1,2,11,23,24],
 hints:['Один колодец принимает падение с двух высот. Нижний настил возвращает к началу.',
 'Низкая трасса ведёт к грузовой опоре. Наклонная поверхность направляет полёт над поперечным перекрытием.',
 'Подготовь верхний подход и доставь друга на опору в любом порядке. С высокого края направь полёт вверх, затем приземлись в постоянную нишу и освободи друга новой парой.']};

/** W03 candidate. Every flight uses the production portal and gravity rules;
 * the loaded plate powers a visible aperture, never an actor/phase speed bonus. */
export function buildRoom21(game,index=20){
 const k=new Workshop(game,ROOM21_SPEC,index),w=k.world;w.highFidelity=true;
 k.bounds={minX:-20,maxX:18,minZ:-17,maxZ:18};k.ceiling=29;
 w.walls(k.bounds,29,-1);w.floor(-20,18,-17,18,0,{name:'Connected recovery foundation'});
 const deck=(name,x0,x1,z0,z1,y)=>w.floor(x0,x1,z0,z1,y,{name});
 const block=(name,p,s)=>{const m=w.box(p,s,w.materials.wall);m.name=name;return m;};
 const stair=(name,x0,x1,z0,z1,lo,hi)=>{const n=Math.ceil((hi-lo)/.25);for(let i=0;i<n;i++){
  const a=z0+(z1-z0)*i/n,b=z0+(z1-z0)*(i+1)/n;deck(name,x0,x1,Math.min(a,b),Math.max(a,b),lo+(hi-lo)*(i+1)/n);
 }};
 deck('Low loading balcony',-10,1,9,16,4);
 stair('Short return stair',-13,-10,17,9,0,4);
 deck('Return stair landing',-13,-10,8,9,4);deck('Balcony return neck',-13,-8,8,9.4,4);
 deck('West observation gallery',-19,-14,-13,15,8);
 deck('Observation south turn',-19,-10,12,18,8);
 // Solid stair treads rise along x; no elevator or author-only transport.
 for(let i=0;i<24;i++)deck('Upper preparation stair',-10+i*.375,-10+(i+1)*.375,12,15,8+(i+1)*.25);
 deck('High fall balcony',-5,1,9,11.7,14);
 deck('Upper stair landing',-1,1,11.7,15,14);
 // The clear dividing window shows the destination but is a physical wall.
 block('Divider lower pier',[2,3,8.7],[.45,6,18.6]);
 block('Divider upper pier',[2,21,8.7],[.45,16,18.6]);
 block('Divider south return',[2,9.5,13],[.45,7,10]);
 glass(w,[2,9.5,3.8],[.45,7,8.4]).name='Sealed observation glazing';
 // The descent landing lies on the far side of a transverse structural rib.
 deck('Permanent receiving pocket',4.5,13,1,8.5,9);
 stair('Reverse-view inspection stair',3.9,5.7,1,-4,9,12);
 deck('Reverse-view inspection landing',3.9,5.7,-5.5,-4,12);
 block('Receiver load-bearing core',[8.75,4.3,4.75],[8.5,8.6,7.5]);
 block('Transverse structural lintel',[8.75,8.3,-2.5],[8.5,1,5]);
 block('Receiving pocket back wall',[8.75,16,8.7],[8.9,14,.35]);
 block('Receiving pocket outer wall',[13.2,15,4.5],[.35,12,8.4]);
 // Freight has its own low trajectory and broad resting plate, not a clone.
 deck('Freight catch pocket',-9,-3,-9,-3,3);
 const pad=k.pad('freight-rest',[-6,3,-6],5.6,5.6);
 block('Freight rear buffer',[-2.8,3.6,-6],[.35,1.2,6.5]);
 for(const z of [-9.2,-2.8])block('Freight return cheek',[-6,3.8,z],[6.6,1.6,.35]);
 // A low entrance passes the 0.78m cargo, not the 2.4m player capsule.
 block('Freight sill',[-9.2,1.85,-6],[.35,3.7,6.5]);
 block('Freight overhead lintel',[-9.2,9.475,-6],[.35,7.05,6.5]);
 deck('Freight feeder shelf',-14,-9.3,-9,-3,3.7);
 block('Freight launch backing',[-14.2,5.55,-6],[.4,4.8,6.3]);
 k.panel('freight',[-13.95,5.55,-6],[1,0,0],5.6,4.6);
 k.panel('well',[-2,.025,6.5],[0,1,0],6,6);
 k.panel('rise',[8,1.4,-11],[0,Math.cos(Math.PI/9),Math.sin(Math.PI/9)],6,4.6);
 k.panel('return',[-19.7,2.3,16],[1,0,0],5.6,4.6);
 k.panel('scout',[-14,12.5,15.5],[1,0,0],4.6,4.6);
 // A rescue outlet is placed on the reverse face of the pocket's own baffle.
 // From the launch/scout side the solid back is visible; a landed player sees ivory.
 block('Rescue sight baffle',[11,11.3,2.8],[4,4.6,.35]);
 k.panel('rescue',[11,11.3,3.01],[0,0,1],3.8,4.4);
 // The low plate controls ordinary hinged leaves across the rising trajectory.
 const aperture=createArchitecturalGate(game,{z:-7.3,width:6.2,height:15.8,roomWidth:10,roomHeight:17,floorY:0,constructWalls:false});
 aperture.art.position.x=8;w.root.attach(aperture.art);aperture.art.updateWorldMatrix(true,true);
 const gateColliders=aperture.mechanism.getLeafBoxes().map(b=>game.collisionProxy(b,{kinematic:true}));
 aperture.mechanism.getFrameBoxes().forEach(b=>game.collisionProxy(b));
 let progress=0,previous=0;
 const shutter={get progress(){return progress;},get loaded(){return pad.loaded()||pad.player();},aperture};k.state.shutter=shutter;
 k.ticks.push(dt=>{previous=progress;progress=THREE.MathUtils.damp(progress,shutter.loaded?1:0,6,dt);
  aperture.mechanism.update(progress,k.time);aperture.mechanism.getLeafBoxes().forEach((b,i)=>game.syncCollision(gateColliders[i],b,dt));});
 k.renders.push(alpha=>aperture.mechanism.update(THREE.MathUtils.lerp(previous,progress,alpha),k.time));
 k.resets.push(()=>{progress=previous=0;aperture.mechanism.update(0);});
 k.wire([[-6,3.25,-9.4],[-6,.25,-10],[4.5,.25,-10],[4.5,.25,-7.3],[4.5,2,-7.3]],()=>shutter.loaded);
 const level=k.finish([-6,4,14],[-3.8,4.55,12],[6.7,9,6.5],{workshop:k,portalPuzzle:true,
  cargoOnAnyPad:()=>pad.loaded()||w.floors.some(f=>f.y>=3&&cargoLoadsPlate(game.cargo,game.heldCube,{center:V((f.minX+f.maxX)/2,f.y,(f.minZ+f.maxZ)/2),normal:V(0,1,0),right:V(1,0,0),up:V(0,0,1),halfWidth:(f.maxX-f.minX)/2,halfHeight:(f.maxZ-f.minZ)/2}))});
 level.spec=ROOM21_SPEC;level.spawnView={yaw:.9,pitch:.12};
 level.puzzleGeometry={footprint:38*35,safeFloor:0,freightHeight:4,dropHeight:14,goalHeight:9,
  orders:['cargo-first','scout-first'],portalRoles:{well:'two fall heights share a floor entry',freight:'low cargo delivery into a resting pocket',rise:'fixed upward direction creates a descending landing arc',return:'recovery and observation access',scout:'independent high approach', 'freight-rest':'real load holds open the flight aperture; later retrieval',rescue:'reverse-face retrieval from the permanent landing'},
  deductions:['fall height and exit orientation are independent','park the same cargo before committing the shared pair','crest the structural lintel rather than aiming straight at the goal','land before reusing the pair for retrieval']};
 return level;
}
