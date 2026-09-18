import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/** Dedicated receiver, local XY deck with +Z the existing contact normal.
 * The entire outlined 12.5 × 8 m deck senses load, not just its weight icon.
 * All relief ends below the original collision plane; the deck never depresses.
 * Runtime geometry is batched; the two small mechanical needles alone move. */
export function createPocketReceiverModel(width = 12.5, depth = 8) {
  if (![width, depth].every(Number.isFinite) || width < 10 || depth < 8) throw new RangeError('This receiver layout needs at least 10 by 8 m');
  const root = new THREE.Group(); root.name = 'Cargo receiver / full-area weighing deck';
  root.userData.keepMaterial = true;
  root.userData.source = 'src/game/LabPocketReceiver.js';
  root.userData.contactBounds = { width, depth, plane: 0 };
  const materials = {
    body: new THREE.MeshStandardMaterial({ name: 'Receiver graphite deck', color: 0x233f46, metalness: .20, roughness: .73 }),
    metal: new THREE.MeshStandardMaterial({ name: 'Receiver brushed edge', color: 0x86a6a4, metalness: .40, roughness: .58 }),
    mark: new THREE.MeshStandardMaterial({ name: 'Receiver load and boundary marks', color: 0xf3c45c, metalness: .10, roughness: .67 }),
  };
  const pieces = new Map(Object.values(materials).map(m => [m, []]));
  function bake(geometry, material, position, angle = 0) {
    const g = geometry.index ? geometry.toNonIndexed() : geometry;
    if (g !== geometry) geometry.dispose();
    g.rotateZ(angle); g.translate(...position); pieces.get(material).push(g);
  }
  const box = (size, pos, mat, angle = 0, rounded = false) => bake(rounded
    ? new RoundedBoxGeometry(...size, 1, Math.min(.04, size[2] * .2))
    : new THREE.BoxGeometry(...size), mat, pos, angle);
  const flat = (points, position, material, scale = 1) => {
    const s = new THREE.Shape(); points.forEach(([x,y], i) => i ? s.lineTo(x*scale,y*scale) : s.moveTo(x*scale,y*scale)); s.closePath();
    bake(new THREE.ShapeGeometry(s), material, position);
  };
  const hx = width / 2, hy = depth / 2;
  // The base reaches the existing structural floor 10 cm below the contact plane.
  box([width, depth, .094], [0, 0, -.052], materials.body, 0, true);
  // A continuous outlined edge exactly matches the sensor area. Contrast plus
  // diagonals distinguish it from both ordinary tiles and portal ceramics.
  for (const x of [-hx+.13, hx-.13]) box([.26, depth, .015], [x, 0, -.0105], materials.mark);
  for (const y of [-hy+.13, hy-.13]) box([width-.52, .26, .015], [0, y, -.0105], materials.mark);
  for (const x of [-hx+.45, hx-.45]) {
    box([.34, depth-.60, .012], [x, 0, -.009], materials.metal);
    for (let y=-hy+.6; y<hy-.45; y+=.65) box([.34,.17,.004],[x,y,-.004],materials.body,.32);
  }
  // Broad cross-ribs are inset surface details, not a stack of floating shelves.
  for (let x=-hx+1.35; x<hx-1; x+=1.2) {
    box([.07,depth-1.25,.008],[x,0,-.007],materials.metal);
    for (const y of [-hy+.78,hy-.78]) bake(new THREE.CylinderGeometry(.055,.055,.012,8).rotateX(Math.PI/2),materials.metal,[x,y,-.009]);
  }
  // Same weight-and-support silhouette as the cable sender, with an actual hole
  // in its handle; geometrical icon rather than a colour-only change.
  function weight(x,y,scale) {
    // Opaque ground under the insignia prevents cross-ribs visually crossing it.
    box([2.2*scale,2.1*scale,.011],[x,y,-.007],materials.body);
    flat([[-.68,-.34],[-.46,.46],[.46,.46],[.68,-.34]],[x,y,-.0005],materials.mark,scale);
    const ring = new THREE.Shape(); ring.absarc(0,0,.16*scale,0,Math.PI*2,false);
    const hole = new THREE.Path(); hole.absarc(0,0,.085*scale,0,Math.PI*2,true); ring.holes.push(hole);
    bake(new THREE.ShapeGeometry(ring,16),materials.mark,[x,y+.57*scale,-.0004]);
    box([1.65*scale,.13*scale,.003],[x,y-.57*scale,-.0015],materials.mark);
    for (const sx of [-.62,.62]) box([.12*scale,.24*scale,.003],[x+sx*scale,y-.72*scale,-.0015],materials.mark);
  }
  weight(0,0,1.55);
  for(const y of [-2.65,2.65])weight(0,y,.88);
  // Two mechanical dials belong to the deck edge and use the same supported
  // contact as the remote pointer. No fictitious moving collision floor.
  const needles=[];
  for (const x of [-hx+1.65,hx-1.65]) {
    const y=hy-1.2;
    box([1.50,1.48,.014],[x,y,-.009],materials.body);
    for(const a of [-.85,0,.85])box([.07,.19,.003],[x+Math.sin(a)*.58,y+Math.cos(a)*.58,-.0015],materials.mark,-a);
    box([.30,.05,.003],[x-.52,y+.40,-.0015],materials.metal);
    box([.30,.15,.003],[x+.52,y+.40,-.0015],materials.mark);
    const s=new THREE.Shape();s.moveTo(-.09,-.10);s.lineTo(0,.59);s.lineTo(.09,-.10);s.closePath();
    const needle=new THREE.Mesh(new THREE.ShapeGeometry(s),materials.mark);
    needle.name='Receiver contact needle';needle.position.set(x,y,-.0002);root.add(needle);needles.push(needle);
  }
  for(const [material,parts] of pieces){
    const geometry=mergeGeometries(parts);if(!geometry)throw new Error('Receiver mesh batching failed');
    parts.forEach(g=>g.dispose());geometry.computeBoundingBox();geometry.computeBoundingSphere();
    const mesh=new THREE.Mesh(geometry,material);mesh.name=material.name+' / batched';mesh.receiveShadow=true;root.add(mesh);
  }
  const set=value=>{if(!Number.isFinite(value)||value<0||value>1)throw new RangeError('Contact display must be in [0,1]');for(const n of needles)n.rotation.z=.85-1.7*value;};
  set(0);return {root,needles,set,materials,width,depth};
}

/** Replace only the generic visible tiles; keep their collision proxy/backing,
 * sensor frame, registry entries and broad partial-contact behavior untouched. */
export function attachPocketReceiver(k, seat) {
  const surface=seat.surface, model=createPocketReceiverModel(surface.width,surface.height);
  for(const child of [...surface.group.children])if(child.isInstancedMesh){surface.group.remove(child);child.dispose();}
  surface.group.add(model.root);
  let previous=0,current=0;
  const state={...model,value:0,loaded:false,
    tick(dt){if(!Number.isFinite(dt)||dt<0)throw new RangeError('Finite nonnegative dt required');previous=current;state.loaded=Boolean(seat.loaded());current=THREE.MathUtils.damp(current,Number(state.loaded),12,dt);state.value=current;},
    render(alpha=1){if(!Number.isFinite(alpha))throw new TypeError('Finite alpha required');model.set(THREE.MathUtils.lerp(previous,current,THREE.MathUtils.clamp(alpha,0,1)));},
    reset(){previous=current=state.value=0;state.loaded=false;model.set(0);},
  };
  k.ticks.push(state.tick);k.renders.push(state.render);k.resets.push(state.reset);k.state.receiverDeck=state;return state;
}

/** Two visibly framed observation panes in the existing front wall.
 * Their boxes and the central sender pier exactly tile the OLD wall volume;
 * glazing is a solid shot/actor/camera blocker, not a new passage. The upper
 * roof and the 2.1 m freight opening stay unchanged. */
export function buildReceiverObservationBand(k) {
  const w=k.world, shell=w.materials.wall;
  const glass=new THREE.MeshStandardMaterial({name:'Receiver observation glass',color:0x9cbebc,transparent:true,opacity:.13,depthWrite:false,roughness:.48,metalness:0,side:THREE.DoubleSide});
  const solids=[];
  const add=(name,position,size,mat)=>{const m=w.box(position,size,mat);m.name=name;m.userData.keepMaterial=true;solids.push(m);return m;};
  add('Receiver upper wall',[5.5,12.8,6],[.7,6.8,8],shell); // y9.4..16.2
  add('Receiver sender pier',[5.5,8.3,6],[.7,2.2,2.5],shell);
  const panes=[add('Receiver observation pane south',[5.5,8.3,8.625],[.7,2.2,2.75],glass),
    add('Receiver observation pane north',[5.5,8.3,3.375],[.7,2.2,2.75],glass)];
  // Frames lie inside the unchanged wall's thickness, including the lower rail.
  // They make the glass barrier readable while leaving its broad centre clear.
  const rails=[];
  const rail=(p,s)=>rails.push(new THREE.BoxGeometry(...s).translate(...p));
  for(const z of [3.375,8.625]){
    for(const y of [7.28,9.32])rail([5.18,y,z],[.05,.16,2.75]);
    for(const dz of [-1.29,1.29])rail([5.18,8.3,z+dz],[.05,2.04,.17]);
  }
  const frame=new THREE.Mesh(mergeGeometries(rails),w.materials.trim);rails.forEach(g=>g.dispose());
  frame.name='Receiver observation window frames';w.root.add(frame);
  k.state.receiverObservation={panes,solids};return k.state.receiverObservation;
}
