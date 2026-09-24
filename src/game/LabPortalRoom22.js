import * as THREE from 'three';
import {Workshop} from './LabWorkshopKit.js';
import {buildRoom22Shutters} from './LabRoom22Mechanics.js';
export const ROOM22_SPEC={id:'opposed-freight-lock',title:'Обратная сторона шлюза',concept:'Один груз меняет два прохода в противоположных направлениях; постоянная высота позволяет забрать источник нагрузки',description:'Нижний проход и верхний обзор связаны одним противовесом. Найди место, где можно сохранить высоту и вернуть друга.',accent:0xa2d2bd,assets:[1,2,11,22,23,24,39],hints:['Кабели связывают белую грузовую опору с двумя противоположными створками.','Верхняя галерея не зависит от груза. Из её окна видна та самая опора внизу.','Верни друга с грузовой плиты на галерею, чтобы открыть верхний обзор. У высокой пары можно либо пройти вместе, либо сначала отправить друга с грузовой ступени.']};

/** A single continuous machine, not three unrelated glowing puzzle markers.
 * Its heavy frame and cable trunk have physical collision. The thin inlaid
 * status bands live on the corresponding real moving shutter meshes. */
function buildFreightArchitecture(k,shutters){
 const {world:w}=k,root=w.root;
 const staticParts=[];let staticBatched=false;
 const steel=new THREE.MeshStandardMaterial({color:0x334b52,roughness:.54,metalness:.36});
 const copper=new THREE.MeshStandardMaterial({color:0xb89165,roughness:.48,metalness:.32});
 const sleeve=new THREE.MeshStandardMaterial({color:0x182f36,roughness:.7,metalness:.20});
 const illuminated=new THREE.MeshBasicMaterial({color:0x94ead4,toneMapped:true});
 const idle=new THREE.MeshBasicMaterial({color:0xb9a276,toneMapped:true});
 const solid=(name,p,s,material=steel)=>{const mesh=w.box(p,s,material);mesh.name=name;staticParts.push(mesh);return mesh;};
 const inlay=(name,p,s,material=illuminated,parent=root)=>{const mesh=new THREE.Mesh(new THREE.BoxGeometry(...s),material);mesh.name=name;mesh.position.fromArray(p);parent.add(mesh);if(parent===root&&!staticBatched)staticParts.push(mesh);return mesh;};
 // A real, collidable maintenance gantry stands just behind the portal pad.
 // Its near face ends behind z=-3.2, so neither the pad nor its shot is covered.
 for(const x of [-16,-8]){
  solid('Freight press upright',[x,2.45,-5.75],[.38,4.9,.65]);
  inlay('Freight press copper sleeve',[x,2.9,-5.40],[.18,3.4,.08],copper);
 }
 solid('Freight press overhead yoke',[-12,4.95,-5.75],[8.35,.55,.70]);
 solid('Freight winch footing',[-12,.45,-5.75],[3.8,.9,1.8],sleeve);
 const winch=k.staticFixture(39,[-12,.95,-5.75],3.2,Math.PI/2);
 winch.art.name='Opposed shutter cable winch';
 // Visible sheathed pipes run from the freight machine above head height,
 // along the west spine, through it, and across the upper gate's lintel.
 const conduit=(name,p,s)=>{
  const shell=solid(name,p,s,sleeve);
  if(s[1]>s[0]&&s[1]>s[2])inlay(name+' / inset copper',[p[0]-.16,p[1],p[2]],[.035,s[1]-.06,.12],copper);
  else inlay(name+' / inset copper',[p[0],p[1]+s[1]/2+.02,p[2]],[Math.max(.025,s[0]-.035),.035,Math.max(.025,s[2]-.035)],copper);
  return shell;
 };
 conduit('Rising cable trunk',[-12,6.85,-5.75],[.28,3.45,.28]);
 conduit('West cable bridge',[-6.3,8.58,-5.75],[11.4,.28,.28]);
 conduit('Lower gate return',[-.53,8.58,3.15],[.28,.28,17.8]);
 conduit('Upper transfer link',[-.53,8.58,-6.75],[.28,.28,2.0]);
 conduit('Lower shutter downlead',[-.53,7.3,12],[.28,2.6,.28]);
 conduit('Upper transfer riser',[-.53,11.8,-7.75],[.28,6.2,.28]);
 // The lintel sits in front of the solid wall face (z=-7.675), never
 // intersecting the upper shutter when its physical slab parks overhead.
 conduit('Upper gate lintel',[10.95,14.84,-7.48],[22.6,.28,.28]);
 // The route through the lower throat stays six metres wide; the fittings
 // are anchored to the existing solid wall on the sides of the opening.
 for(const z of [8.63,15.37]){
  solid('Lower shutter jamb',[-.58,2.7,z],[.38,5.4,.35]);
  inlay('Lower shutter jamb cap',[-.80,2.7,z],[.035,4.95,.17],copper);
 }
 // The high gate is a separate, opposite-facing mouth. Each jamb fits
 // outside the x=3..22 gallery circulation, with a complete central opening.
 for(const x of [2.52,21.52]){
  solid('Upper shutter jamb',[x,10.55,-7.48],[.38,7.05,.35]);
  inlay('Upper shutter jamb cap',[x,10.55,-7.29],[.17,6.55,.035],illuminated);
 }
 // Merge every fixed casing and finish into one instanced draw per material.
 // The original boxes stay in the physics, aim and camera registries as
 // invisible proxies, exactly like other chambers' collision envelopes.
 const staticBatches=[],byMaterial=new Map();
 for(const mesh of staticParts){
  const group=byMaterial.get(mesh.material)??[];group.push(mesh);byMaterial.set(mesh.material,group);
 }
 for(const [material,parts] of byMaterial){
  const batch=new THREE.InstancedMesh(new THREE.BoxGeometry(1,1,1),material,parts.length);
  batch.name='Freight lock fixed machine batch';batch.userData.visualOnly=true;
  batch.receiveShadow=true;
  const matrix=new THREE.Matrix4(),scale=new THREE.Vector3(),quaternion=new THREE.Quaternion();
  parts.forEach((mesh,i)=>{
   const {width,height,depth}=mesh.geometry.parameters;
   matrix.compose(mesh.position,quaternion,scale.set(width,height,depth));batch.setMatrixAt(i,matrix);
   mesh.visible=false;
  });
  batch.computeBoundingBox();batch.computeBoundingSphere();root.add(batch);staticBatches.push(batch);
 }
 staticBatched=true;
 // Keep the painted bands outside the moving meshes' hierarchy. The physics
 // layer measures whole object trees for door colliders, so a child band
 // would silently enlarge a real shutter even though it is only paint.
 const lowerBand=inlay('Lower freight counterweight stripe',[0,0,0],[.05,4.95,5.4],illuminated);
 const upperBand=inlay('High inspection counterweight stripe',[0,0,0],[18.3,.37,.05],idle);
 const signal=[
  inlay('Lower gate connected indicator',[-.83,5.7,8.67],[.07,.16,.45],illuminated),
  inlay('Upper gate connected indicator',[12,14.62,-7.30],[1.1,.07,.05],idle),
 ];
 const updateDisplay=()=>{
  winch.spin(shutters.progress*Math.PI*1.35,'z');
  lowerBand.position.copy(shutters.lower.mesh.position).x-=.35;
  upperBand.position.copy(shutters.upper.mesh.position).z+=.35;
  signal[0].material=shutters.progress>.95?illuminated:idle;
  signal[1].material=shutters.progress<.05?illuminated:idle;
 };
 k.ticks.push(updateDisplay);updateDisplay();
 return {winch,conduitNames:['Rising cable trunk','West cable bridge','Lower gate return','Upper transfer link','Lower shutter downlead','Upper transfer riser','Upper gate lintel'],signals:signal,bands:[lowerBand,upperBand],staticBatches,staticSourceDraws:staticParts.length};
}

export function buildRoom22(game,index=21){
 const k=new Workshop(game,ROOM22_SPEC,index),w=k.world;w.highFidelity=true;k.bounds={minX:-22,maxX:22,minZ:-24,maxZ:24};k.ceiling=24;w.walls(k.bounds,24,-1);
 const deck=(name,x0,x1,z0,z1,y,color=null)=>{
  const surface=w.floor(x0,x1,z0,z1,y,{name});
  if(color){
   // The existing authored floor is the colour field, not a coplanar skin.
   // The art pipeline respects this material and the original collider.
   const coat=new THREE.MeshStandardMaterial({color,roughness:.73,metalness:.13});
   surface.group.userData.keepMaterial=true;
   surface.group.traverse(node=>{if(node.isInstancedMesh&&!node.userData.portalTile)node.material=coat;});
  }
  w.box([(x0+x1)/2,y-.25,(z0+z1)/2],[x1-x0,.30,z1-z0],w.materials.trim);
 };
 const block=(p,s)=>w.box(p,s,w.materials.wall);
 deck('West freight court',-22,0,-24,24,0,0x769a97);
 deck('East inspection court',0,22,-24,24,0,0xa69475);
 // Three deliberate openings in the structural spine: ground passage,
 // steep retrieval view, and high reverse view. Everything else is solid.
 block([0,12,19.5],[.65,24,9]);block([0,15.3,12],[.65,17.4,6]);
 block([0,12,6.5],[.65,24,5]);block([0,1.45,0],[.65,2.9,8]);block([0,16,0],[.65,16,8]);
 block([0,12,-9.25],[.65,24,10.5]);
 block([0,5.65,-18],[.65,11.3,7]);block([0,20,-18],[.65,8,7]);
 block([0,12,-22.75],[.65,24,2.5]);
 deck('Permanent observation gallery',3,22,-24,8,7,0x75a292);
 // A small receiving step aligns a separately released companion with the
 // high wall aperture. It remains joined to the ordinary observation floor.
 for(let i=0;i<4;i++)deck('Freight loading stair',15+i*.55,15+(i+1)*.55,1,5,7+(i+1)*.25);
 deck('Freight loading shelf',17.2,20.4,1,5,8);
 // A genuine stair from the far side of the closed ground throat.
 for(let i=0;i<28;i++){const z=22-i*.5;deck('Freight inspection stair',16,21,z-.5,z,(i+1)*.25);block([18.5,(i+1)*.125,z-.25],[5,(i+1)*.25,.5]);}
 // The last stair already meets the observation gallery; no coplanar overlay.
 for(let i=0;i<12;i++){const z=-11-i*.5;deck('Reverse inspection stair',9,15,z-.5,z,7+(i+1)*.25);}
 deck('Reverse high viewpoint',3,22,-24,-17,10,0x92b6a3);
 block([12,3.5,-8],[20,7,.65]);block([12,19.1,-8],[20,9.8,.65]);
 // Arrival is enclosed above and behind; only the high east-facing aperture
 // is portalable. Its undersides cannot be climbed from the recovery floor.
 deck('Reverse upper receiving chamber',-22,-8,-23,-13,14,0xbba77a);
 // A free companion exits the high wall aperture with horizontal momentum;
 // this joined shelf catches it beside the normal goal gallery.
 deck('Freight receiving step',-8,-6,-23,-13,13.65);
 deck('Freight receiving extension',-6,-4,-23,-13,13.3);
 block([-4.1,15.5,-18],[.35,3,10]);
 block([-15,6.9,-18],[14,13.8,10]);block([-21.8,18,-18],[.4,8,10]);
 block([-15,18,-23.2],[14,8,.4]);block([-15,18,-12.8],[14,8,.4]);
 const pad=k.pad('freight-weight',[-12,0,0],5.6,6.4);
 k.panel('upper-return',[21.65,9.3,3],[-1,0,0],6,4.6);
 k.panel('reverse-receiver',[-21.55,16.3,-18],[1,0,0],6,4.6);
 k.panel('lower-return',[-21.65,2.3,18],[1,0,0],5.6,4.6);
 const shutters=buildRoom22Shutters(k,pad);
 const architecture=buildFreightArchitecture(k,shutters);
 const level=k.finish([-17,0,18],[-15,.55,17],[-14,14,-18],{workshop:k,spec:ROOM22_SPEC,portalPuzzle:true,shutters});
 level.freightArchitecture=architecture;
 level.spawnView={yaw:-.25,pitch:-.1};
 level.puzzleGeometry={footprint:44*48,occupiedHeights:[0,7,14],orders:['carry-through-upper-return','send-companion-ahead'],noProgressFlags:true,portalRoles:{'freight-weight':'the original live load becomes its own outgoing aperture','upper-return':'stable cargo receiving gallery and final player entry','reverse-receiver':'destination seen only through the high reverse inspection slot','lower-return':'recover from the shared lower court'},deductions:['a load opens one path and closes another','carrying the load removes the force that holds the first passage open','a permanent gallery preserves progress when the mechanism reverses','a portal below the original load retrieves it without a second object','the reverse high observation slot reveals a previously hidden destination','a joined service step lets the companion use the high return independently of the player']};
 return level;
}
export {runRoom22} from './LabRoom22Journey.js';
