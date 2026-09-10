import * as THREE from 'three';
import {Workshop} from './LabWorkshopKit.js';
import {counterweightHoist,counterweightOptics} from './LabRoom13Mechanics.js';

// Keep the persisted course identity; the layout is deliberately replaced.
export const ROOM13_SPEC={id:'optical-paradox',title:'Петля противовесов',concept:'Вес меняет высоту двух связанных кабин; порталы делят свет, грузовой путь и накопленную высоту',description:'Сохрани высоту, когда свету понадобится другой путь.',hints:['Большой и малый барабаны связаны. Свет отпускает тормоз, но не поднимает пустую кабину.','Тормоз удерживает достигнутую высоту, даже когда ты переставляешь порталы. У грузовых проёмов слишком низкий потолок для тебя.','Друг может опустить грузовую кабину, пока ты поднимаешься на другой. Сохрани высоту, доставь его отдельно и найди, откуда взять скорость для верхнего пересечения.'],accent:0xf0bd7e,assets:[1,2,11,23,24]};

/** An ideal free-running roller bed: the render mesh and Cannon wedge share
 * the exact same vertices/profile. Gravity, not a scripted impulse, moves cargo. */
function chute(k,name,x0,x1,z0,z1,high,low){
 const g=k.game,w=k.world,base=low-.2;
 const points=[[x0,base,z0],[x1,base,z0],[x1,high,z0],[x0,high,z0],[x0,base,z1],[x1,base,z1],[x1,low,z1],[x0,low,z1]];
 const faces=[[3,2,1,0],[4,5,6,7],[5,4,0,1],[2,3,7,6],[0,4,7,3],[1,2,6,5]],vertices=[];
 for(const [a,b,c,d] of faces)for(const index of [a,b,c,a,c,d])vertices.push(...points[index]);
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geometry.computeVertexNormals();
 const model=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({color:0x94a7ad,metalness:.66,roughness:.28,side:THREE.DoubleSide}));model.name=name;w.root.add(model);
 const rollers=new THREE.InstancedMesh(new THREE.CylinderGeometry(.045,.045,1,10),new THREE.MeshStandardMaterial({color:0x647e89,metalness:.8,roughness:.3}),14);
 rollers.name='Free-running gravity rollers';const rm=new THREE.Matrix4(),rq=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,0,1),Math.PI/2);
 for(let i=0;i<14;i++){const t=(i+.5)/14;rm.compose(new THREE.Vector3((x0+x1)/2,high+(low-high)*t-.04,z0+(z1-z0)*t),rq,new THREE.Vector3(1,x1-x0-.08,1));rollers.setMatrixAt(i,rm);}
 rollers.computeBoundingSphere();w.root.add(rollers);
 const ramp={id:model.uuid,model,rayProxy:model,minX:x0,maxX:x1,minZ:z0,maxZ:z1,lowY:low,highY:high,highAt:'minZ'};
 g.ramps.push(ramp);g.cameraBlockers.push(model);g.aimBlockers.push(model);
 let owner=null;k.ticks.push(()=>{if(owner===g.physics)return;const body=g.physics?.solids.get(model.uuid)?.body;if(body){body.material.friction=0;body.material.restitution=.02;owner=g.physics;}});
 return ramp;
}
function subtract(rect,cut){
 const [x0,x1,z0,z1]=rect,[a,b,c,d]=cut,loX=Math.max(x0,a),hiX=Math.min(x1,b),loZ=Math.max(z0,c),hiZ=Math.min(z1,d);
 if(loX>=hiX||loZ>=hiZ)return [rect];
 return [[x0,loX,z0,z1],[hiX,x1,z0,z1],[loX,hiX,z0,loZ],[loX,hiX,hiZ,z1]].filter(r=>r[1]-r[0]>.001&&r[3]-r[2]>.001);
}
export function buildRoom13(game,index=12){
 const k=new Workshop(game,ROOM13_SPEC,index),w=k.world;
 k.bounds={minX:-26,maxX:26,minZ:-23,maxZ:23};k.ceiling=32;w.walls(k.bounds,32,-4.4);
 const deck=(name,x0,x1,z0,z1,y)=>w.floor(x0,x1,z0,z1,y,{name});
 const carve=(name,rect,y,cuts)=>{let pieces=[rect];for(const cut of cuts)pieces=pieces.flatMap(r=>subtract(r,cut));return pieces.map(r=>deck(name,...r,y));};
 const loadPit=[-23,-17,14,20],fallPit=[-19,-13,5.8,11.8],shaftA=[-14.5,-9.5,-.5,4.5],shaftB=[6.5,11.5,-.5,4.5],core=[0,6,-8.3,6];
 // Continuous lower recovery, with sealed seams rather than lethal voids.
 carve('Lower return basin',[-26,26,-23,23],-4,[loadPit,fallPit]);
 carve('Loading court and two return loops',[-26,26,-23,23],0,[[-25.8,-17,14,20],[-21.8,-13,5.8,11.8],shaftA,shaftB,core]);
 const ceramicFloor=(name,x0,x1,z0,z1,y)=>{const s=w.floor(x0,x1,z0,z1,y,{name,portal:true,authored:true});k.panels[name]=s;return s;};
 ceramicFloor('loading-pan',...loadPit,-3.975);ceramicFloor('launch-well',...fallPit,-3.975);
 // Both pits have walkable recovery stairs in open side pockets; the high
 // drop still lands in the middle of its dedicated ceramic floor.
 for(const [name,x0,x1,z0] of [['Loading pit recovery',-25.8,-23.15,14],['Fall pit recovery',-21.8,-19.15,5.8]]){
  for(let i=0;i<16;i++)deck(name,x0,x1,z0+i*.35,z0+(i+1)*.35,-4+(i+1)*.25);
 }
 // The central receiving mass occupies otherwise unused volume, occludes
 // the final dock from early routes and gives the high fling a real landing.
 w.box([3,5.9,-1.15],[6,19.8,14.3],w.materials.wall);
 deck('Receiving dock',-.05,6,-3.85,6,16);
 // Cargo traverses a sloped, low-ceiling passage. A player may enter its
 // portal vestibule to retrieve a misplaced load, but cannot cross the throat.
 chute(k,'Gravity roller receiving chute',.1,6,-8,-3.85,17,16);
 k.panel('freight-final',[3,19,-8.04],[0,0,1],5.6,4.6);
 w.box([3,22.8,-8.3],[6.5,18.4,.4],w.materials.wall);
 w.box([6.3,17.6,-6],[.4,3.2,4.5],w.materials.wall);
 w.box([6.3,26.25,-6],[.4,11.5,4.5],w.materials.wall);
 // West wall has only a sight slit: projectiles see the inset, not a walk.
 w.box([-.2,17.05,-6],[.4,2.1,4.5],w.materials.wall);
 w.box([-.2,25.7,-6],[.4,12.6,4.5],w.materials.wall);
 w.box([3,24.875,-3.95],[6.5,14.25,.22],w.materials.wall);
 w.box([3,24,6],[6.2,16,.25],w.materials.wall);
 w.box([6.15,24,1],[.3,16,10],w.materials.wall);
 // West high pier has no staircase to the ground. Its two return routes
 // change with the hoist; the upper stair returns above the original court.
 deck('Passenger upper pier',-20,-14.5,2.5,4.5,14);
 deck('West observation spine',-26,-23,-16,16,14);
 deck('Optical overlook',-23,-7,-16,-12,14);
 deck('Pier neck',-23,-20,2.5,4.5,14);
 w.stairs(-23,-20,-12,10,14,23);
 deck('High returning drop gallery',-23,-13,10,18,23);
 deck('West cross-gallery approach',-13,-5,14,18,23);
 deck('Detached high inspection span',-2.3,25,14,18,23);
 // The cross-gallery returns to the freight side above the same lower court.
 // Full receiving walls prevent a sprint/drop from skipping the final fling.
 w.box([11.35,23.65,18],[27.3,1.3,.15],w.materials.wall);
 for(const [a,b] of [[-2.3,8],[11.5,17.5]])w.box([(a+b)/2,23.65,14],[b-a,1.3,.15],w.materials.wall);
 // The angled outlet is in a mechanical casing beyond the stair structure.
 // Its high front sill admits a genuine fast fling, but a slow exit falls
 // into a lower side-open recovery pocket rather than reaching the high pier.
 deck('Crossing outlet recovery pocket',-20,-14.5,-3.4,2.2,11.7);
 w.box([-20.1,21.85,-.6],[.2,20.3,5.9],w.materials.wall);
 w.box([-14.5,14.3,-.6],[.24,5.2,5.9],w.materials.wall); // top = 16.9
 w.box([-14.5,27.5,-.6],[.24,9,5.9],w.materials.wall); // header above flight
 w.box([-17.25,23.65,-3.55],[5.5,16.7,.2],w.materials.wall);
 // A narrow side sight slit is large enough for a shot, not the traveller.
 w.box([-17.25,15.45,2.35],[5.5,.3,.2],w.materials.wall);
 w.box([-17.25,24.8,2.35],[5.5,14.4,.2],w.materials.wall);
 const angle=Math.PI/12;
 k.panel('crossing-exit',[-19,17.3,-1.15],[Math.cos(angle),Math.sin(angle),0],3.2,4.6);
 // The optical gallery is useful before and after either loading route.
 deck('Mirror service gallery',-24,-22,-13,7,6);
 deck('Mirror observation landing',-22,-16,-13,-5,6);
 w.stairs(-25.8,-24,-18,-7,0,6);
 // East loading gallery: a second useful high layer, not a copy of the west
 // route. It returns to a mid-level balcony and then the original court.
 deck('Upper freight approach',11.5,24,-18,14,19.6);
 deck('Freight feeder vestibule',6.5,11.5,-6,-.5,19.6);
 k.panel('freight-feed',[9,21.95,-6.02],[0,0,1],4.8,4.6);
 // A safety grille: a low freight opening and a separate sight slot.
 // Both are physically too short for the traveller's full capsule.
 w.box([9,21.175,-.65],[5,.25,.25],w.materials.wall);
 w.box([9,27.3,-.65],[5,9.4,.25],w.materials.wall);
 for(const x of [6.6,11.4])w.box([x,21.95,-.65],[.2,1.3,.25],w.materials.wall);
 // The feed tray's west side stays open for the later sightline into
 // the receiving slit; a full-height partition here would hide the target.
 // Ground-level recovery path cannot jump back into the upper freight deck.
 deck('East return balcony',18,26,14,18,7);
 w.stairs(22,25,-8,14,0,7);
 // Useful inset locations; their directions are also distinct visual clues.
 for(const [name,position,normal] of [['access-low',[-25.97,1.85,20.8],[1,0,0]],['access-high',[15,21.45,-16],[-1,0,0]]]){
  k.panels[name]=w.surface({name,position,normal,width:5.6,height:3.7,portal:true,authored:true});
 }
 w.box([15.16,25.8,-16],[.3,12.4,5.8],w.materials.wall);
 k.panel('light-intake',[25.5,8,-16],[-1,0,0],5.6,4.6);
 k.panel('light-output',[-24.5,8,-3],[1,0,0],5.6,4.6);
 // The source is mounted on a real support. Its ceramic also permits
 // ordinary travel; it does not bypass the thirteen-metre gap above.
 w.box([20,3.7,-16],[.3,7.4,.3],w.materials.trim);
 const rig=counterweightHoist(k);counterweightOptics(k,rig);
 // Safe resting pockets preserve autonomous behaviour elsewhere. This only
 // suppresses wandering on a loading/receiving surface, not physical motion.
 k.state.receivingRest={loaded:()=>!game.heldCube&&game.physics?.grounded&&game.cargo.position.y>15.8&&game.cargo.position.y<18&&game.cargo.position.x>0&&game.cargo.position.x<7&&game.cargo.position.z>-8&&game.cargo.position.z<6};
 k.state.arrivalRest={loaded:()=>!game.heldCube&&game.physics?.grounded&&Math.abs(game.cargo.position.x+14)<2&&Math.abs(game.cargo.position.z-19)<2&&game.cargo.position.y<1};
 const level=k.finish([-11,0,20.5],[-14,.55,19],[3,16,0],{workshop:k,portalPuzzle:true,layoutRevision:30});
 level.puzzleGeometry={footprint:52*46,usefulLayers:[-4,0,6,7,11.7,14,16,19.6,23],orders:['cargo-first','scout-first'],
  portalRoles:{'access-low':'return to the original arrival court','access-high':'scout and load the high freight gallery','loading-pan':'turn a real four-metre cargo fall into delivery speed','freight-feed':'thread free cargo into the high hoist','light-intake':'capture the physical source ray','light-output':'light the load-driven mirror','mirror-cradle':'support weight and release the same cargo later','passenger-return':'recover physically retained cabin height after a fall','freight-final':'deliver or retrieve the original cargo through a low throat','launch-well':'convert the high return drop into momentum','crossing-exit':'redirect real falling velocity over the receiving mass'},
  deductions:['light releases a brake but supplies no lifting work','the drum ratio trades travel for load','retain height before changing the shared portal pair','free cargo fits a low physical passage','high fall and tilted exit combine to cross the final mass'],
  loops:['east freight deck → return balcony → arrival','west passenger pier → returning high gallery → lower basin']};
 const diagnostics=level.diagnostics;level.diagnostics=()=>({...diagnostics(),layoutRevision:30,counterweight:rig.diagnostics()});
 return level;
}
export {runRoom13} from './LabRoom13Journey.js';
