import * as THREE from 'three';
import {Workshop} from './LabWorkshopKit.js';
import {configureChapterWorld} from './LabChapterArt.js';
import {SolidAssembly,createPlanter,placeSolidModel} from './LabSolidModels.js';
import {buildGardenDoor} from './LabRoom24Garden.js';
export const ROOM24_SPEC={id:'garden-of-turning-doors',title:'Сад поворотных дверей',concept:'Портал помнит дверь, а не направление; один поворот открывает другой сад',description:'У каждого сада есть лицевая и обратная сторона. Посмотри, что меняется вместе с дверью и что остаётся на месте.',accent:0xffc75b,assets:[1,2,11,22,23,24],hints:['Одна керамическая дверь смотрит в два разных двора. Портал поворачивается вместе с ней.','Дверь можно повернуть двумя способами: грузом снизу или ручным приводом на южном балконе. Тормоз удерживает её настоящее положение.','Подними друга через его опору. Северная лестница меняет ракурс: за стеной видна обратная сторона жёлтого павильона.']};

/** The existing thick walls already own collision. Their shallow folded face
 * and inlaid stair nosings are finish, not separate walkable architecture.
 * The top conservatory, however, has real posts and beams with matching
 * physical envelopes. All ivory portal faces remain unobscured. */
function buildGardenAtelier(k,panels){
 const w=k.world,facade=new SolidAssembly('Garden atelier / structural wall bays','garden');
 facade.materials[0].color.setHex(0xbe795e);
 facade.materials[1].color.setHex(0x23454c);
 facade.materials[2].color.setHex(0xf3c96e);
 facade.materials[3].color.setHex(0x3b6760);
 const veneer=(p,s,mat=1)=>facade.box(p,s,mat,.035,false);
 // The full-height destination is an inhabited pavilion, rather than a flat
 // yellow cube. These pilasters sit against the *existing* solid south face.
 veneer([16,1.18,-11.84],[15.85,2.3,.26],3);
 for(const x of [8.55,12.2,16,19.8,23.45])veneer([x,8.55,-11.78],[.23,12.4,.27]);
 for(const y of [2.42,7.35,14.55])veneer([16,y,-11.75],[15.9,y===14.55?.36:.13,.16],y===7.35?2:1);
 // Lower court and six-metre gallery share one family of bearing ribs;
 // their dark soffits make the actual accessible decks readable from below.
 for(const x of [-3.1,.3,3.55,6.65])veneer([x,2.92,6.075],[.19,5.68,.23]);
 veneer([1.75,5.57,6.10],[10.38,.32,.30]);
 // The south inspection balcony fills the player's opening view. Three
 // recessed botanical instrument bays break up its formerly blank coral
 // block. Every inset is less than a palm's width from its solid backing.
 for(const x of [-1.62,1.75,5.12]){
  veneer([x,2.85,6.072],[3.03,4.95,.052],0);
  veneer([x,3.55,6.106],[2.62,2.73,.026],3);
  veneer([x,1.42,6.108],[2.72,.82,.020],1);
  for(const y of [1.95,2.45])veneer([x,y,6.130],[2.46,.085,.025],2);
  veneer([x,5.37,6.125],[2.94,.12,.040],2);
 }
 // On the tall internal screen the three dark counterweight pockets expose
 // the rhythm of the door machine from the starting court. Their shallow
 // skin stays glued to the existing yellow wall and cannot catch the camera.
 for(const z of [-8.3,-5,-1.7]){
  veneer([3.698,13,z],[.036,12.3,2.55],1);
  veneer([3.722,13,z],[.028,10.9,1.95],3);
  for(const y of [7.9,13,18.1])veneer([3.741,y,z],[.022,.12,2.35],2);
 }
 for(const x of [-23.35,-18.8,-14.25,-9.7,-5.15,-.6])veneer([x,2.9,-4.87],[.19,5.6,.27]);
 veneer([-12,5.56,-4.83],[23.9,.34,.30]);
 veneer([-20.5,10.65,-17.89],[7.8,.32,.28]);
 // The twenty actual treads stay where their colliders have always been.
 // Flush warm nosings trace the sole climb to the reverse viewing perch.
 for(let i=0;i<20;i++){
  const z=-8-i*.5,y=6+(i+1)*.25;
  veneer([-20.5,y+.013,z-.458],[4.7,.018,.048],i%5===4?2:1);
 }
 // The western face of the sight baffle reads as a three-bay shutter above
 // an open observation slot. All cladding lies against the existing blocks:
 // the gap between y=11.3 and y=15 stays completely unobstructed.
 for(const z of [-21.18,-18,-14.82]){
  veneer([-4.194,18.75,z],[.032,7.06,2.92],3);
  for(const y of [16.15,18.72,21.29])veneer([-4.214,y,z],[.026,.105,2.66],1);
  veneer([-4.223,18.75,z-1.29],[.025,6.63,.035],2);
 }
 for(const z of [-22.79,-19.59,-16.41,-13.21])veneer([-4.226,18.75,z],[.040,7.33,.12],1);
 for(const y of [15.12,22.37])veneer([-4.222,y,-18],[.042,.13,9.7],2);
 // A real sill and lintel identify the view opening without filling it.
 veneer([-4.205,11.20,-18],[.035,.13,9.68],2);
 veneer([-4.205,15.10,-18],[.035,.12,9.68],2);
 for(const z of [-22.72,-18,-13.28])veneer([-4.197,5.65,z],[.032,11.12,.17],1);
 for(const y of [1.42,5.62,9.82])veneer([-4.191,y,-18],[.027,.10,9.65],3);
 // The west and north walls have broad, recessed light wells instead of
 // repeating opaque panels all the way to the generic shell ceiling. These
 // pieces sit against the existing perimeter collision and leave the lower
 // planting-bed observation window entirely open.
 for(const z of [-19,-9,1,11,20]){
  veneer([-23.89,18.6,z],[.10,8.6,7.5],3);
  veneer([-23.82,18.6,z],[.025,7.65,6.45],1);
  for(const edge of [-3.55,3.55])veneer([-23.785,18.6,z+edge],[.028,8.75,.17],2);
  veneer([-23.785,22.72,z],[.028,.13,7.3],2);
 }
 for(const x of [-17,-7,3,13,22]){
  veneer([x,18.5,-23.89],[8.2,8.7,.10],3);
  for(const edge of [-3.75,3.75])veneer([x+edge,18.5,-23.82],[.16,8.65,.035],1);
  veneer([x,22.83,-23.79],[8.12,.13,.035],2);
 }
 const shell=facade.finish();shell.userData.visualOnly=true;shell.userData.solidModel=false;delete shell.userData.collisionParts;
 shell.traverse(node=>{if(node.isMesh)node.castShadow=false;});w.root.add(shell);

 // A suspended conservatory canopy makes the courtyard a complete interior.
 // It stays above every accessible level, so the overhead framing cannot
 // become an invisible floor or obstruct any playable portal mouth.
 const canopy=new SolidAssembly('Garden laboratory / overhead daylight coffers','garden');
 canopy.materials[0].color.setHex(0xdda885);
 canopy.materials[1].color.setHex(0x244b50);
 canopy.materials[2].color.setHex(0xffd57c);
 canopy.materials[3].color.setHex(0x456e68);
 for(const z of [-22,-13,-4,5,14,22]){
  canopy.box([0,24.60,z],[46.8,.30,.26],1,.045,false);
  for(const x of [-18,-6,6,18]){
   canopy.box([x,24.44,z+1.12],[7.7,.09,.24],3,.03,false);
   canopy.box([x,24.35,z+1.12],[6.6,.025,.10],2,.005,false);
  }
 }
 for(const x of [-23.05,-11.5,0,11.5,23.05])
  canopy.box([x,24.70,0],[.22,.28,46.5],1,.04,false);
 // A single overhead orbit marks the rotating door as this hall's centre.
 // The circular negative space remains open to the third-person camera.
 const flat=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),Math.PI/2);
 canopy.arc(7.35,.28,.14,1,[4,23.12,-4],flat,0,Math.PI*2,false);
 for(let n=0;n<4;n++)canopy.arc(7.35,.09,.11,2,[4,23.04,-4],flat,n*Math.PI/2+.10,Math.PI*.37,false);
 const canopyModel=canopy.finish();canopyModel.userData.visualOnly=true;canopyModel.userData.solidModel=false;delete canopyModel.userData.collisionParts;
 // The narrow overhead members produced aliased, repeating shadow bands on
 // the yellow pavilion and floor. Their modeled depth supplies the silhouette;
 // omitting only their shadow-map draw removes the visible shimmer in motion.
 canopyModel.traverse(node=>{if(node.isMesh)node.castShadow=false;});
 w.root.add(canopyModel);

 const frames=new THREE.Group();frames.name='Recessed fixed-portal doorways';frames.userData.visualOnly=true;w.root.add(frames);
 for(const [panel,highlight] of [[panels['garden-entry'],false],[panels['balcony-entry'],false],[panels['pavilion-receiver'],true]]){
  const f=panel.getFrame(),a=new SolidAssembly(panel.name+' / manufactured doorway','garden');
  a.materials[1].color.setHex(0x305760);a.materials[2].color.setHex(highlight?0xd2ac68:0x77b7a9);
  const hw=panel.width/2,hh=panel.height/2;
  for(const x of [-hw-.25,hw+.25]){
   a.box([x,0,.03],[.22,panel.height+.57,.18],1,.035,false);
   a.box([x,hh+.16,.095],[.28,.12,.12],2,.025,false);
  }
  a.box([0,hh+.25,.03],[panel.width+.87,.24,.20],1,.035,false);
  a.box([0,hh+.40,.11],[panel.width*.46,.06,.07],2,.015,false);
  const model=a.finish();model.userData.visualOnly=true;model.userData.solidModel=false;delete model.userData.collisionParts;
  model.traverse(node=>{if(node.isMesh)node.castShadow=false;});
  model.position.copy(f.center).addScaledVector(f.normal,.04);
  model.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(f.right,f.up,f.normal));
  frames.add(model);
 }

 // The destination is now visibly a greenhouse on a *real* upper deck.
 // Its roof is open between narrow rafters; no pane or full-size proxy blocks
 // the receiver, and every post/ridge has a short physical envelope.
 const roof=new SolidAssembly('Upper conservatory / open timber trellis','garden');
 roof.materials[0].color.setHex(0xc67b6e);roof.materials[1].color.setHex(0x305760);
 roof.materials[2].color.setHex(0xd2ac68);
 for(const x of [9.05,23.05])for(const z of [-22.4,-12.85]){
  roof.box([x,17.45,z],[.36,4.9,.36],1,.06);
  roof.box([x,15.15,z],[.72,.30,.72],0,.08);
 }
 for(const z of [-22.4,-18.7,-15.8,-12.85]){
  for(const [from,to] of [[[9.05,19.95,z],[16.05,21.48,z]],[[16.05,21.48,z],[23.05,19.95,z]]]){
   const a=new THREE.Vector3(...from),b=new THREE.Vector3(...to);
   for(let i=0;i<5;i++)roof.beam(a.clone().lerp(b,i/5).toArray(),a.clone().lerp(b,(i+1)/5).toArray(),.17,1);
  }
 }
 for(const x of [9.05,16.05,23.05])roof.beam([x,x===16.05?21.48:19.95,-22.4],[x,x===16.05?21.48:19.95,-12.85],.15,1);
 const binding=placeSolidModel(k,roof.finish());
 // The rafters are thinner than a shadow-map pixel at courtyard distance.
 // Their real collision and silhouette remain, while the main shell supplies
 // the room's stable shadows.
 binding.model.traverse(node=>{if(node.isMesh)node.castShadow=false;});
 return {facade:shell,frames,roof:binding.model,canopy:canopyModel};
}
export function buildRoom24(game,index=23){
 const k=new Workshop(game,ROOM24_SPEC,index),w=k.world;configureChapterWorld(w,'garden');k.bounds={minX:-24,maxX:24,minZ:-24,maxZ:24};k.ceiling=25;w.highFidelity=true;
 w.materials.wall.color.setHex(0xe7b898);w.materials.floor.color.setHex(0x90b8ac);w.materials.trim.color.setHex(0x274e53);w.materials.ceramic.color.setHex(0xfff4d9);w.walls(k.bounds,25,-1);
 const deck=(name,x0,x1,z0,z1,y)=>w.floor(x0,x1,z0,z1,y,{name});
 const block=(p,s,m=w.materials.wall)=>{const mesh=w.box(p,s,m);mesh.userData.keepMaterial=true;return mesh;};
 const mint=new THREE.MeshStandardMaterial({color:0x60a69b,roughness:.69,metalness:.06}),rose=new THREE.MeshStandardMaterial({color:0xc78370,roughness:.72,metalness:.035}),yellow=new THREE.MeshStandardMaterial({color:0xdab967,roughness:.68,metalness:.035});
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
 const startingBay=new SolidAssembly('Garden laboratory / entrance floor inlay','garden');
 startingBay.materials[1].color.setHex(0x2a5a61);
 startingBay.materials[2].color.setHex(0xf2c96d);
 for(const z of [14.45,21.55])startingBay.box([14.45,.019,z],[7,.018,.095],2,.005,false);
 for(const x of [10.95,17.95])startingBay.box([x,.019,18],[.095,.018,7],1,.005,false);
 const startingInlay=startingBay.finish();startingInlay.userData.visualOnly=true;startingInlay.userData.solidModel=false;delete startingInlay.userData.collisionParts;w.root.add(startingInlay);
 // A manufactured planter, recessed soil and thick botanical blades share
 // the same explicit physical envelope; no more non-solid foliage blobs.
 for(const p of [[22,0,18],[21,0,-7],[-21,0,7],[23,0,9],[20,0,8],[-20,0,17],[-22.5,6,-1],[-22,11,-20],[20,15,-14]])
  placeSolidModel(k,createPlanter('garden'),p);
 for(const x of [-23,-17])block([x,13,-19],[.24,6,.24],yellow);for(const z of [-22,-19,-16])block([-20,15.8,z],[6.4,.24,.32],yellow);
 const atelier=buildGardenAtelier(k,k.panels);
 const level=k.finish([15,0,18],[11,.55,18],[16,15,-18],{workshop:k,spec:ROOM24_SPEC,portalPuzzle:true,gardenDoor:door});
 level.gardenAtelier=atelier;
 level.spawnView={yaw:.4,pitch:-.1};level.puzzleGeometry={footprint:2304,occupiedHeights:[0,6,11,15],goalHeight:15,orders:['carry-through','counterweight'],noProgressFlags:true,portalRoles:{'balcony-entry':'manual route from the south balcony through the orbiting door','garden-counterweight':'the original weight becomes its own return aperture','garden-entry':'stable entrance below the rotating door','revolving-door':'one persistent portal changes the courtyard it faces','pavilion-receiver':'a high reverse view into the gold pavilion'},deductions:['a portal retains the moving architectural face','a worm drive or a live counterweight can move the same doorway to a separate courtyard','the courtyard brake preserves orientation after the weight leaves','a floor aperture recovers that same weight','the folded stair exposes the pavilion from its reverse side']};
 return level;
}
export {runRoom24} from './LabRoom24Journey.js';
