import * as THREE from 'three';
import {Workshop,V} from './LabWorkshopKit.js';
import {airAcceleration} from './LabAirForces.js';
import {createRoom14LightContact} from './LabRoom14LightContact.js';

export const ROOM14_DEFLECTOR_SPEC=Object.freeze({
 id:'light-weave',title:'Световой поворот',accent:0x76d9df,
 concept:'Направленная порталами световая грань меняет горизонтальное движение свободного спутника за непрозрачным углом',
 description:'Грузовой путь проходит под низким кожухом. Свет задаёт грань поворота; соседняя галерея служит пассажиру.',
 assets:[1,2,11,22,23,24,31],
 hints:[
  'Поток ведёт друга по прямому каналу. Узкий оптический рукав пропускает свет, но не вас с другом.',
  'Световая стенка должна встретить движущегося друга боковой гранью. За поворотом есть разрыв пола; спокойной ходьбы недостаточно.',
  'Соедини оптический источник с наклонным выходом, поставь друга в начало канала и включи вентилятор. Когда друг окажется в грузовом выходе, используй пару для перехода на соседнюю пассажирскую галерею.',
 ],
});

/** A spatial finish: the two visible exit lanes meet across a glass partition.
 * No contact-history flag, receiver switch or automatically opened door exists. */
export function room14FreightFinish(game){
 const c=game.cargo?.position,p=game.playerPosition;
 return Boolean(c&&game.playerGrounded
  &&c.x>-.5&&c.x<1.5&&c.z< -2.45&&c.z> -4.05&&c.y> -1.5&&c.y<-.2
  &&p.x>2.15&&p.x<4.4&&p.z< -2.1&&p.z> -4.2&&p.y> -1.5&&p.y<-.9
  &&p.distanceTo(c)<3.3);
}

export function buildRoom14Deflector(game,index=13){
 const k=new Workshop(game,ROOM14_DEFLECTOR_SPEC,index),w=k.world;
 const material=(name,color,roughness=.66,metalness=.16)=>{
  const m=new THREE.MeshStandardMaterial({name:'Room14 / '+name,color,roughness,metalness});
  m.userData.keepMaterial=true;return m;
 };
 const palette={enamel:material('petrol enamel',0x315d69,.48,.26),
  graphite:material('graphite service casting',0x263c48,.70,.24),
  floor:material('cool mineral court',0x9fadb2,.86,.035),
  aluminium:material('satin aluminium edge',0x9eafb2,.42,.48)};
 const authored=(mesh,m)=>{mesh.material=m;mesh.userData.keepMaterial=true;return mesh;};
 k.bounds={minX:-18,maxX:18,minZ:-13,maxZ:14};k.ceiling=9;
 w.walls(k.bounds,9,-3.8);
 const floor=(...args)=>{
  const a=w.floor(...args);a.group.userData.keepMaterial=true;
  a.group.traverse(mesh=>{
   if(!mesh.isInstancedMesh||mesh.userData.portalTile)return;
   authored(mesh,palette.floor);
   for(let i=0;i<mesh.count;i++)mesh.setColorAt(i,new THREE.Color(0xffffff));
  });return a;
 };
 floor(-18,18,-13,14,-3.5,{name:'14 / continuous recovery basement'});
 const solid=(name,p,s,m=palette.graphite)=>{
  const chosen=m===w.materials.wall?palette.enamel:m===w.materials.floor?palette.graphite:m===w.materials.trim?palette.aluminium:m;
  const mesh=authored(w.box(p,s,chosen),chosen);mesh.name='14 / '+name;mesh.userData.firstChapterStructuralRole='room14-deflector';return mesh;
 };
 const deck=(name,x0,x1,z0,z1,y)=>{
  const a=floor(x0,x1,z0,z1,y,{name:'14 / '+name});
  solid(name+' foundation',[(x0+x1)/2,(y-3.5)/2,(z0+z1)/2],[x1-x0,y+3.5,z1-z0],w.materials.floor);
  return a;
 };
 deck('blower service court',-18,-8,-3,12,-.8);
 deck('north observation court',-8,15,1.1,12,0);
 w.stairs(-10,-7,3,5,-.8,0);
 deck('loading tongue',-8,-5.8,-.8,.8,0);
 deck('straight freight floor',-6,9,-.8,.8,0);
 deck('east retry catch',9,16,-7,12,0);
 // A missed turn reaches this open catch court. Its exposed end remains
 // several metres from the bend, beyond the ordinary pickup radius.
 solid('freight south wall',[-4.1,.8,-.9],[3.8,1.6,.2],w.materials.wall);
 solid('east freight south wall',[5.4,.8,-.9],[7.2,1.6,.2],w.materials.wall);
 const inspectionGlass=new THREE.MeshStandardMaterial({name:'Room14 / freight inspection glass',color:0xb4dbe0,
  transparent:true,opacity:.16,roughness:.18,metalness:.08,depthWrite:false});
 inspectionGlass.userData.keepMaterial=true;
 const inspection=[];
 const inspectionRail=(name,x0,x1)=>{
  const pane=solid(name,[(x0+x1)/2,.8,.9],[x1-x0,1.6,.2],inspectionGlass);
  const collider=game.colliders.find(c=>c.mesh===pane);inspection.push({mesh:pane,collider});
  const trim=(p,s)=>authored(w.box(p,s,palette.aluminium,false),palette.aluminium);
  trim([(x0+x1)/2,1.55,.9],[x1-x0,.10,.18]);trim([(x0+x1)/2,.06,.9],[x1-x0,.12,.18]);
  for(let x=x0+.05;x<x1;x+=3)trim([x,.8,.9],[.10,1.4,.18]);
  trim([x1-.05,.8,.9],[.10,1.4,.18]);
  return pane;
 };
 inspectionRail('west north rail',-6,-1.6);inspectionRail('east north rail',-.3,9);
 // The freight lane has a continuous low roof. Its separate passenger pod
 // remains enclosed even if the player walks over this roof.
 solid('freight roof mass',[1.5,1.69,0],[15,.18,1.8],w.materials.wall);
 // The lateral branch has a real gap, then a lower freight travel bay.
 // Curiosity walking sees no support across it; lateral momentum must carry
 // the original body over the edge rather than walking round an L-shaped floor.
 solid('branch west cheek',[-.85,.1,-2.7],[.3,3,3.6],w.materials.wall);
 solid('branch east cheek',[1.95,.1,-2.7],[.3,3,3.6],w.materials.wall);
 solid('branch roof mass',[.55,1.69,-2.7],[2.8,.18,3.6],w.materials.wall);
 // The 1.60m unsupported span exceeds even the unchanged cube's complete
 // 1.351m space diagonal, so rotating corners cannot bridge the two ledges.
 deck('freight exit lower floor',-.7,1.8,-4.4,-2.4,-1.4);
 // The lip begins on the receiving support, never inside the 1.60m gap.
 // Incoming lateral flight clears its top; a landed friend stays in the bay.
 solid('freight receiving retaining lip',[.55,-1.15,-2.49],[2.5,.5,.18],w.materials.trim);
 solid('freight exit end', [.55,.1,-4.5],[2.8,3,.2],w.materials.wall);
 // Glass is an actual solid for hands, cargo, camera and shots. It admits
 // the view of the original companion, not an E interaction through a window.
 const glass=new THREE.MeshStandardMaterial({name:'14 / freight observation glass',color:0x8fc4cc,transparent:true,opacity:.18,roughness:.22,metalness:.08,depthWrite:false});
 const window=solid('freight observation window',[1.95,1.5,-3.1],[.2,5.8,2.4],glass);
 const wc=game.colliders.find(c=>c.mesh===window);wc.opticallyTransparent=true;
 // Replace only the glass section of the thick cheek, leaving sealed ends.
 const cheek=game.colliders.find(c=>c.mesh.name==='14 / branch east cheek');cheek.enabled=false;cheek.mesh.visible=false;
 solid('observation front jamb',[1.95,.1,-1.6],[.3,3,.6],w.materials.wall);
 solid('observation rear jamb',[1.95,.1,-4.4],[.3,3,.4],w.materials.wall);
 solid('observation upper wall',[1.95,4.4,-3.1],[.3,.18,2.4],w.materials.wall);
 deck('passenger exit gallery',2.1,6.6,-9,-1.9,-1.4);
 solid('passenger west end',[1.95,1.5,-6.7],[.3,5.8,4.8],w.materials.wall);
 solid('passenger north end',[4.35,1.5,-9.1],[4.8,5.8,.2],w.materials.wall);
 solid('passenger south end',[4.35,1.5,-1.8],[4.8,5.8,.2],w.materials.wall);
 solid('passenger roof',[4.35,4.49,-5.5],[4.8,.18,7.2],w.materials.wall);
 solid('passenger east north wall',[6.7,1.5,-8.45],[.2,5.8,1.3],w.materials.wall);
 solid('passenger east south wall',[6.7,1.5,-4],[.2,5.8,4.4],w.materials.wall);
 solid('passenger aim slot sill',[6.7,-.35,-7],[.2,2.1,1.6],w.materials.wall);
 solid('passenger aim slot lintel',[6.7,2.9,-7],[.2,3,1.6],w.materials.wall);
 // No upper passenger crossing spans this separation: the only white
 // passenger address is contained in the far gallery's east wall.
 const passenger=k.panel('passenger-arrival',[2.12,.9,-7],[1,0,0],4.0,4.5);
 k.panel('passenger-departure',[-17.96,1.6,8],[1,0,0],5.0,4.6);
 const intake=k.panel('contact-intake',[-10,1.4,7],[-1,0,0],1.45,2.8);
 intake.mesh.userData.portalSize={width:.30,height:1.1};
 const outlet=k.panel('contact-turn',[-3.6,1.4,3.6],[Math.SQRT1_2,0,-Math.SQRT1_2],1.45,2.8);
 outlet.mesh.userData.portalSize={width:.30,height:1.1};
 const field=createRoom14LightContact(k,{origin:[-13.1,.6,7],direction:[1,0,0],span:[0,1,0],width:1.0,length:42});
 field.addSolid(outlet.mesh,outlet.collider);
 // A finite 72 cm diagonal conduit lets the projected sheet reach the elbow,
 // while keeping both the cargo and the player's hands outside that space.
 const direction=V(Math.SQRT1_2,0,-Math.SQRT1_2),across=V(Math.SQRT1_2,0,Math.SQRT1_2),center=V(-1.75,.8,1.75);
 for(const sign of [-1,1]){
  const p=center.clone().addScaledVector(across,sign*.46),mesh=solid('optical conduit cheek '+sign,p.toArray(),[.20,1.6,1.7],w.materials.trim);
  mesh.quaternion.setFromUnitVectors(V(0,0,1),direction);mesh.updateWorldMatrix(true,false);
  const c=game.colliders.find(c=>c.mesh===mesh);c.box.setFromObject(mesh);field.addSolid(mesh,c);
 }
 const conduitCap=solid('optical conduit upper mass',[-1.75,1.69,1.75],[.72,.18,1.7],w.materials.wall);
 conduitCap.quaternion.setFromUnitVectors(V(0,0,1),direction);conduitCap.updateWorldMatrix(true,false);
 const capCollider=game.colliders.find(c=>c.mesh===conduitCap);capCollider.box.setFromObject(conduitCap);field.addSolid(conduitCap,capCollider);
 solid('projector pedestal',[-13.6,-.2,7],[1.0,1.2,1.0],w.materials.trim);
 solid('projector barrel',[-13.6,.45,7],[.8,.5,.7],w.materials.floor);
 w.box([-13.16,.6,7],[.06,.18,.55],w.materials.accent,false);
 const fan=k.fan('deflector-blower',[-10.7,1.3,0],[1,0,0],{asset:31,radius:1.15});
 const fanControl=k.control('deflector-fan',[-7.6,0,2.8],()=>{fan.enabled=!fan.enabled;},'E — подать воздух в грузовой канал.');
 // Catch-recovery stairs are separate from the sealed freight target.
 // A full metre of basement lies before the first riser. Starting a stair
 // directly on the outer wall leaves no capsule-sized bottom approach.
 w.stairs(12.5,15.5,-12,-7,-3.5,0);
 w.stairs(-16,-12,-11,-3,-3.5,-.8);
 const cargoTarget=new THREE.Box3(V(-.5,-1.5,-4.05),V(1.5,-.2,-2.45));
 const passengerTarget=new THREE.Box3(V(2.15,-1.5,-4.2),V(4.4,-.9,-2.1));
 w.goal([.5,-1.4,-3.4],[2.0,1.2]);
 const level=k.finish([-14.7,-.8,3.6],[-14.5,-.41,2.0],[4.4,-1.4,-4.0],{
  workshop:k,deflectorRoom:true,dispose:()=>field.dispose(),isWon:()=>room14FreightFinish(game),
 });
 level.spawnView={yaw:.15,pitch:.06};
 level.puzzleGeometry={kind:'portal-routed-horizontal-light-contact',cargoTarget,passengerTarget,
  requiredGeometry:['low freight channel','actual oblique light face','unsupported horizontal turn','adjacent visible travel bays'],
  deductions:['a light portal transports a solid contact face without admitting either actor','only the configured surface normal transfers the needed lateral momentum','the single pair then becomes the passenger route beside the original cargo'],
  orders:['freight-first','scout-first']};
 level.readability={field,fan,fanControl,intake,outlet,passenger,window,inspection,cargoTarget,passengerTarget,palette};
 k.forces.push(()=>{
  if(game.heldCube||!game.physics)return;
  const a=airAcceleration(fan.segments,game.cargo.position,game.cargo.velocity,{strength:fan.enabled?1:0,speed:12,radius:1.15,bodyRadius:.55});
  if(a.lengthSq()>1e-8){const b=game.physics.cargoBody;b.material.friction=.06;b.force.x+=a.x*b.mass;b.force.y+=a.y*b.mass;b.force.z+=a.z*b.mass;b.wakeUp();}
 });
 return level;
}
