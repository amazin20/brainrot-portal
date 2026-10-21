import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';

const V = (...v) => new THREE.Vector3(...v);
const clamp = THREE.MathUtils.clamp;

/** The uploaded bridge shares smoothed normals between its wide steel sheets
 * and dark perimeter rolls. Those normals bend a nearly planar deck into a
 * quilted/mattress highlight. Restore the machined sheet normals on the local
 * copies only: positions, source triangles, colours, ray heights and physical
 * slices are unchanged. Curved bearings retain their authored smooth normals. */
export function finishBridgeSheetNormals(geometry){
  const p=geometry.attributes.position,n=geometry.attributes.normal;
  if(!p||!n||geometry.index)return 0;
  const a=V(),b=V(),c=V(),face=V();let sheets=0;
  for(let i=0;i<p.count;i+=3){
    a.fromBufferAttribute(p,i);b.fromBufferAttribute(p,i+1);c.fromBufferAttribute(p,i+2);
    face.crossVectors(b.sub(a),c.sub(a)).normalize();
    // Broad top and underside skins only. Avoid faceting the casing's rounded
    // sides, rails, gaskets or the small lamps in the same imported primitive.
    if(Math.abs(face.y)<.985)continue;
    const y=Math.sign(face.y);for(let k=0;k<3;k++)n.setXYZ(i+k,0,y,0);sheets++;
  }
  n.needsUpdate=true;geometry.userData.bridgeMachinedSheets=sheets;return sheets;
}

// The derived GLBs' old Frame/Moving split was a spatial mask, not a rig:
// it moved a spring's end bearing and half of the bridge cassette. Work in
// normalized game.model(id, 1) space and keep every supplied triangle rigid.
function assembly(game, parent, id, { position, size, yaw }, moves) {
  const source = game.model(id, 1); source.updateWorldMatrix(true, true);
  const art = new THREE.Group(); art.name = `Supplied mechanism ${id}`;
  art.position.fromArray(position); art.rotation.y = yaw; parent.add(art);
  const fixed = new THREE.Group(), moving = new THREE.Group();
  fixed.name = 'Stationary supplied frame'; moving.name = 'Complete supplied moving assembly';
  art.add(fixed, moving);
  let sourceTriangles = 0, fixedTriangles = 0, movingTriangles = 0;
  const center = V(), vertex = V();
  source.traverse(node => {
    if (!node.isMesh) return;
    const geometry = node.geometry.clone().applyMatrix4(node.matrixWorld);
    const p = geometry.attributes.position, index = geometry.index, groups = [[], []];
    for (let i = 0; i < (index?.count ?? p.count); i += 3) {
      const ids = [0, 1, 2].map(k => index ? index.getX(i + k) : i + k);
      center.set(0, 0, 0);
      for (const id of ids) center.add(vertex.fromBufferAttribute(p, id));
      center.multiplyScalar(1 / 3);
      groups[moves(center) ? 1 : 0].push(...ids); sourceTriangles++;
    }
    for (const [part, ids] of groups.entries()) {
      if (!ids.length) continue;
      const indexed = geometry.clone(); indexed.setIndex(ids);
      const piece = indexed.toNonIndexed(); indexed.dispose();
      piece.scale(size, size, size); piece.computeBoundingBox(); piece.computeBoundingSphere();
      if(id===37)finishBridgeSheetNormals(piece);
      const mesh = new THREE.Mesh(piece, node.material);
      mesh.receiveShadow = true; mesh.castShadow = node.castShadow;
      mesh.name = part ? 'Supplied moving triangles' : 'Supplied stationary triangles';
      (part ? moving : fixed).add(mesh);
      if (part) movingTriangles += ids.length / 3; else fixedTriangles += ids.length / 3;
    }
    geometry.dispose();
  });
  art.updateWorldMatrix(true, true);
  return { id, art, fixed, moving, uniformScale: size, sourceTriangles, fixedTriangles, movingTriangles };
}

/** A rigid closed load plate with pigment IN its single upper face. The
 * uploaded37 had up to22cm of dents and a scanned vertex-AO pattern across
 * the walking field. Neither another skin nor different normals can fix that
 * shape. Every upper vertex here lies on the same physical support plane. */
export function rigidBridgeDeckGeometry(width,start,end,top,thickness){
 const positions=[],normals=[],colors=[],uv=[],bottom=top-thickness,half=width/2;
 const frame=new THREE.Color(0x365564),deck=new THREE.Color(0xb5c6c8),joint=new THREE.Color(0x879fa7);
 const quad=(a,b,c,d,normal,color)=>{
  for(const p of [a,b,c,a,c,d]){positions.push(...p);normals.push(...normal);colors.push(color.r,color.g,color.b);uv.push(p[0]/width+.5,(p[2]-start)/(end-start));}
 };
 const rim=Math.min(.11,width*.04),seam=.012;
 const xs=[-half,-half+rim,half-rim,half];
 const zs=[start,start+rim];
 for(const t of [1/3,2/3]){const z=start+(end-start)*t;zs.push(z-seam/2,z+seam/2);}
 zs.push(end-rim,end);
 for(let x=0;x<xs.length-1;x++)for(let z=0;z<zs.length-1;z++){
  const color=x===0||x===xs.length-2||z===0||z===zs.length-2?frame:zs[z+1]-zs[z]<seam*1.1?joint:deck;
  quad([xs[x],top,zs[z]],[xs[x],top,zs[z+1]],[xs[x+1],top,zs[z+1]],[xs[x+1],top,zs[z]],[0,1,0],color);
 }
 quad([-half,bottom,start],[half,bottom,start],[half,bottom,end],[-half,bottom,end],[0,-1,0],frame);
 quad([-half,bottom,start],[-half,bottom,end],[-half,top,end],[-half,top,start],[-1,0,0],frame);
 quad([half,bottom,end],[half,bottom,start],[half,top,start],[half,top,end],[1,0,0],frame);
 quad([half,bottom,start],[-half,bottom,start],[-half,top,start],[half,top,start],[0,0,-1],frame);
 quad([-half,bottom,end],[half,bottom,end],[half,top,end],[-half,top,end],[0,0,1],frame);
 const geometry=new THREE.BufferGeometry();geometry.name='Rigid telescopic deck / one planar load surface';
 geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));
 geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
 geometry.computeBoundingBox();geometry.computeBoundingSphere();return geometry;
}

/** The cassette and its span are rebuilt as manufactured parts in the
 * uploaded model's exact local system. The source GLB cache stays intact,
 * but none of its deformed triangles remains under the new drawing. */
export function buildExtensionBridgeModel(game, parent, {
  position = [0, 0, 0], size = 12, yaw = 0, stroke = 3.6,
} = {}) {
  if (!(size > 0 && stroke >= 0 && stroke <= size * .32)) throw new RangeError('Bridge stroke exceeds its cassette');
  const item = assembly(game, parent, 37, { position, size, yaw }, p => p.z > -.17);
  const { art, fixed, moving } = item;
  fixed.name = 'Bridge stationary cassette'; moving.name = 'Bridge rigid telescoping span';
  const width = .24 * size, start = -.15 * size, end = .46 * size, depth = end - start;
  const cassette=new THREE.Box3();
  for(const mesh of fixed.children)cassette.union(mesh.geometry.boundingBox);
  item.originalPartition={fixedTriangles:item.fixedTriangles,movingTriangles:item.movingTriangles};
  for(const group of [fixed,moving])for(const mesh of [...group.children]){mesh.removeFromParent();mesh.geometry.dispose();}
  const top=size*(1.82/12),thickness=size*.02;
  const materials={
    enamel:new THREE.MeshStandardMaterial({name:'Bridge rigid baked enamel',color:0x91aeb7,roughness:.53,metalness:.28}),
    frame:new THREE.MeshStandardMaterial({name:'Bridge machined load frame',color:0x294654,roughness:.46,metalness:.62}),
    metal:new THREE.MeshStandardMaterial({name:'Bridge satin guide alloy',color:0xadb9b7,roughness:.38,metalness:.68}),
    signal:new THREE.MeshStandardMaterial({name:'Bridge inset cassette markers',color:0xe1b66b,roughness:.5,metalness:.28}),
    deck:new THREE.MeshStandardMaterial({name:'Bridge rigid mineral load plate',color:0xffffff,vertexColors:true,roughness:.71,metalness:.17}),
  };
  const box=(name,p,span,material,bevel=.018)=>{
    const geometry=bevel?new RoundedBoxGeometry(...span,1,Math.min(bevel*size/12,...span.map(n=>n*.12))):new THREE.BoxGeometry(...span);
    const mesh=new THREE.Mesh(geometry,materials[material]);mesh.name=name;mesh.position.fromArray(p);mesh.castShadow=mesh.receiveShadow=true;fixed.add(mesh);return mesh;
  };
  const s=cassette.getSize(V()),c=cassette.getCenter(V()),h=cassette.max.y,foot=size*.03,cheek=size*.06;
  // These extreme planes also preserve the former stationary collision box.
  box('Cassette / grounded continuous machine bed',[c.x,foot/2,c.z],[s.x,foot,s.z],'frame',0);
  box('Cassette / folded rear bulkhead',[c.x,h/2,cassette.min.z+size*.018],[s.x,h,size*.036],'frame');
  for(const sign of [-1,1]){
    const x=c.x+sign*(s.x-cheek)/2;
    box('Cassette / structural side cheek',[x,(h+foot)/2,c.z],[cheek,h-foot,s.z-size*.03],'enamel');
    box('Cassette / front guide shoe',[x,top-size*.018,cassette.max.z-size*.023],[cheek*.87,size*.055,size*.045],'metal');
    box('Cassette / recessed marker housing',[x,h-size*.029,cassette.max.z-size*.018],[cheek*.73,size*.025,size*.033],'frame');
    box('Cassette / amber inset marker',[x,h-size*.029,cassette.max.z-size*.0025],[cheek*.48,size*.010,size*.005],'signal',.008);
  }
  box('Cassette / flat removable top cover',[c.x,h-size*.008,c.z],[s.x,size*.016,s.z-size*.025],'enamel');
  box('Cassette / transverse motor housing',[c.x,(foot+top-size*.035)/2,c.z],[s.x-cheek*1.5,top-size*.035-foot,s.z-size*.05],'frame');
  const loadGeometry=rigidBridgeDeckGeometry(width,start,end,top,thickness);
  const loadMesh=new THREE.Mesh(loadGeometry,materials.deck);loadMesh.name='Rigid single-surface telescoping load deck';loadMesh.castShadow=loadMesh.receiveShadow=true;moving.add(loadMesh);
  item.retainedSourceTriangles=0;item.replacedSourceTriangles=item.sourceTriangles;
  const triangles=group=>{let n=0;group.traverse(m=>{if(m.isMesh)n+=(m.geometry.index?.count??m.geometry.attributes.position.count)/3;});return n;};
  item.fixedTriangles=triangles(fixed);item.movingTriangles=triangles(moving);item.presentationRevision='rigid-telescopic-deck-v66';
  const ray = new THREE.Ray(),plane=new THREE.Plane(),origin=V(),down=V(0,-1,0),local=V(),hit=V(),normal=V(),planePoint=V();
  const worldHeight = (x, z) => {
    moving.updateWorldMatrix(true,false);normal.set(0,1,0).transformDirection(moving.matrixWorld);planePoint.set(0,top,0).applyMatrix4(moving.matrixWorld);
    plane.setFromNormalAndCoplanarPoint(normal,planePoint);origin.set(x,planePoint.y+size*2,z);ray.set(origin,down);
    if(!ray.intersectPlane(plane,hit))return -Infinity;
    local.copy(hit);moving.worldToLocal(local);
    return Math.abs(local.x)<=width/2+1e-6&&local.z>=start-1e-6&&local.z<=end+1e-6?hit.y:-Infinity;
  };
  // One closed exact body replaces twelve approximations to a dented sheet.
  const center = V(0,top,(start+end)/2),slabs=[{center:V(0,top-thickness/2,(start+end)/2),size:V(width,thickness,depth),rotationX:0}];
  const deck = { width, depth, center, mesh: loadMesh, slabs, start, end, top, thickness,
    heightAt: worldHeight,
    bounds() {
      moving.updateWorldMatrix(true, true);
      const box = new THREE.Box3();
      for (const x of [-width / 2, width / 2]) for (const z of [start, end]) {
        const p = V(x, top, z).applyMatrix4(moving.matrixWorld);
        box.expandByPoint(p);
      }
      return box;
    },
  };
  item.deck = deck;
  item.supportBoxes = [new THREE.Box3().setFromObject(fixed)];
  item.setProgress = t => {
    item.progress = clamp(Number.isFinite(t) ? t : 0, 0, 1);
    moving.position.z = -stroke * (1 - item.progress);
    moving.updateWorldMatrix(true, true);
    return item.progress;
  };
  item.role = 'Manufactured telescopic bridge: stationary source-sized cassette, rigid planar sliding deck';
  art.userData.gameplayRole = item.role;
  item.setProgress(0);
  return item;
}

function rod(parent, name, material, radius = .055) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, 1, 10), material);
  mesh.name = name; mesh.receiveShadow = true; parent.add(mesh);
  const up = V(0, 1, 0), delta = V();
  return { mesh, set(a, b) {
    delta.copy(b).sub(a); mesh.position.copy(a).add(b).multiplyScalar(.5);
    mesh.quaternion.setFromUnitVectors(up, delta.clone().normalize()); mesh.scale.y = delta.length();
  } };
}

/** The original 32 remains horizontal and grounded. A visible, fixed-pivot
 * bell crank transmits the impact plate's vertical travel to the true central
 * ram. Both source end bearings and the base stay still. Added links have
 * constant physical lengths; their endpoints solve the two slider constraints.
 * `position` is the frame's floor origin; `plateCenter` is the world rest center
 * of the physical impact plate. All animation is driven by its compression. */
export function buildSpringRamModel(game, parent, {
  position = [-3.9, 0, -5], size = 4.5, yaw = Math.PI / 2,
  plateCenter = [0, 1.8, -5], stroke = .72,
} = {}) {
  const item = assembly(game, parent, 32, { position, size, yaw }, p =>
    p.y > .185 && ((p.z > -.15 && p.z < -.025) || (p.z >= -.025 && p.z < .23 && Math.abs(p.x) < .055)));
  const { art, fixed, moving } = item;
  fixed.name = 'Spring fixed bed and both end bearings'; moving.name = 'Spring central ram and rod';
  const plate = art.worldToLocal(V(...plateCenter));
  // Linkage runs on the near side of the supplied frame, clear of the falling
  // companion. A transverse pin joins each slider to this one working plane.
  const planeX = size * .255, ramZ = -.085 * size, ramY = .28 * size;
  const direction = Math.sign(plate.z - ramZ) || 1, pivotZ = ramZ + direction * .7;
  const inputRadius = Math.max(1.3, Math.abs(plate.z - pivotZ));
  const outputRadius = Math.min(inputRadius * .6, 1.6), pivotY = ramY + outputRadius;
  const inputZ = pivotZ + direction * inputRadius;
  const verticalOffset = plate.y - pivotY, verticalSign = Math.sign(verticalOffset) || -1;
  const inputLength = Math.max(.9, Math.abs(verticalOffset));
  // If the actual plate is close to the pivot height, a rigid downstand keeps
  // the connecting link long enough throughout the allowed stroke.
  const downstand = verticalOffset - verticalSign * inputLength;
  const outputLength = Math.abs(pivotZ - ramZ);
  const links = new THREE.Group(); links.name = 'Physical bell crank linkage'; art.add(links);
  const metal = new THREE.MeshStandardMaterial({ color: 0x394651, metalness: .65, roughness: .35 });
  const accent = new THREE.MeshStandardMaterial({ color: 0xdcb254, metalness: .42, roughness: .4 });
  const pivot = V(planeX, pivotY, pivotZ);
  const inputArm = rod(links, 'Rigid input crank arm', accent, .09);
  const outputArm = rod(links, 'Rigid output crank arm', accent, .09);
  const inputLink = rod(links, 'Rigid impact connecting rod', metal);
  const outputLink = rod(links, 'Rigid ram connecting rod', metal);
  const platePin = rod(links, 'Impact plate transverse pin', metal, .07);
  const ramPin = rod(links, 'Ram transverse pin', metal, .07);
  const plateStand = rod(links, 'Impact plate rigid downstand', metal, .07);
  const support = rod(links, 'Bell crank grounded bearing pedestal', metal, .14);
  support.set(V(planeX, 0, pivotZ), pivot);
  const axle = new THREE.Mesh(new THREE.CylinderGeometry(.18, .18, .24, 16), accent);
  axle.rotation.z = Math.PI / 2; axle.position.copy(pivot); links.add(axle);
  const a = V(), b = V(), inputSlider = V(), outputSlider = V(), platePoint = V();
  function plateAt(angle) {
    const side = inputRadius * (1 - Math.cos(angle));
    return pivotY + inputRadius * Math.sin(angle) + verticalSign * Math.sqrt(Math.max(0, inputLength ** 2 - side ** 2));
  }
  item.setCompression = value => {
    const compression = clamp(Number.isFinite(value) ? value : 0, 0, stroke);
    const target = plate.y - downstand - compression;
    let lo = -.85, hi = 0;
    for (let i = 0; i < 32; i++) { const mid = (lo + hi) / 2; if (plateAt(mid) < target) lo = mid; else hi = mid; }
    const angle = (lo + hi) / 2;
    a.set(planeX, pivotY + inputRadius * Math.sin(angle), pivotZ + direction * inputRadius * Math.cos(angle));
    b.set(planeX, pivotY - outputRadius * Math.cos(angle), pivotZ + direction * outputRadius * Math.sin(angle));
    const dy = ramY - b.y;
    const shaftZ = b.z - direction * Math.sqrt(Math.max(0, outputLength ** 2 - dy ** 2));
    moving.position.z = shaftZ - ramZ;
    inputSlider.set(planeX, target, inputZ); outputSlider.set(planeX, ramY, shaftZ);
    platePoint.copy(plate); platePoint.y -= compression;
    inputArm.set(pivot, a); outputArm.set(pivot, b);
    inputLink.set(a, inputSlider); outputLink.set(b, outputSlider);
    plateStand.set(V(planeX, platePoint.y, inputZ), inputSlider);
    platePin.set(platePoint, V(planeX, platePoint.y, inputZ));
    ramPin.set(V(0, ramY, shaftZ), outputSlider);
    item.compression = compression; item.ramTravel = moving.position.z;
    item.linkLengths = [inputArm, outputArm, inputLink, outputLink].map(l => l.mesh.scale.y);
    art.updateWorldMatrix(true, true);
    return compression;
  };
  item.linkage = links;
  // Separate feet/bearings leave the working gap empty; an AABB around the
  // whole machine would falsely block the linkage and the open central bed.
  item.supportBoxes = [];
  for (const [z0, z1, y0, y1] of [[-.5, .45, 0, .1], [-.5, -.16, .1, .45], [.24, .5, .1, .38]]) {
    const box = new THREE.Box3(V(-.2 * size, y0 * size, z0 * size), V(.2 * size, y1 * size, z1 * size));
    item.supportBoxes.push(box.applyMatrix4(art.matrixWorld));
  }
  item.role = 'Uploaded horizontal spring ram driven by the impact plate through a fixed bell crank';
  art.userData.gameplayRole = item.role;
  item.setCompression(0);
  return item;
}
