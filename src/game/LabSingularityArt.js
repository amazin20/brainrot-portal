import * as THREE from 'three';
import {V} from './LabSingularityKit.js';
const UP=V(0,1,0),Z=V(0,0,1);

// Closed machined box: six broad faces, twelve edge chamfers, eight clipped
// corners. 44 triangles describe the silhouette without subdividing its face.
// Apparatus still uses the kit's genuinely rounded casing where it is visible.
function architecturalBevel(){
 const positions=[],normals=[],h=.44,outer=.5;
 function face(points,normal){
  const n=V(...normal).normalize(),cross=points[1].clone().sub(points[0]).cross(points[2].clone().sub(points[0]));
  if(cross.dot(n)<0)points.reverse();
  for(let i=1;i<points.length-1;i++)for(const p of [points[0],points[i],points[i+1]]){positions.push(...p.toArray());normals.push(...n.toArray());}
 }
 for(let axis=0;axis<3;axis++)for(const sign of [-1,1]){
  const other=[0,1,2].filter(i=>i!==axis),points=[];
  for(const [a,b]of [[-h,-h],[h,-h],[h,h],[-h,h]]){const p=V();p.setComponent(axis,sign*outer);p.setComponent(other[0],a);p.setComponent(other[1],b);points.push(p);}const n=[0,0,0];n[axis]=sign;face(points,n);
 }
 for(let free=0;free<3;free++)for(const sa of [-1,1])for(const sb of [-1,1]){
  const [a,b]=[0,1,2].filter(i=>i!==free),points=[];
  for(const [av,bv,fv]of [[outer,h,-h],[h,outer,-h],[h,outer,h],[outer,h,h]]){const p=V();p.setComponent(a,av*sa);p.setComponent(b,bv*sb);p.setComponent(free,fv);points.push(p);}const n=[0,0,0];n[a]=sa;n[b]=sb;face(points,n);
 }
 for(const sx of [-1,1])for(const sy of [-1,1])for(const sz of [-1,1])face([V(sx*outer,sy*h,sz*h),V(sx*h,sy*outer,sz*h),V(sx*h,sy*h,sz*outer)],[sx,sy,sz]);
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));geometry.computeBoundingBox();geometry.computeBoundingSphere();geometry.userData.architecturalBatch=true;return geometry;
}

/** Fittings live on a physical wall, above the clearance envelope, or inside
 * the existing machine volume. Large added cases retain collision. Permanent
 * labels share one atlas/draw call; repeated fittings share geometry batches. */
export function buildSingularityArt({game,k,rooms,edges,solved}){
 const m=k.m,updates=[],lights=[];
 const enamel=k.mat(0xe3eee8,.82,.08),chalk=k.mat(0xf1e9d5,.86,.04),ink=k.mat(0x243d50,.86,.10),
  graphite=k.mat(0x435f70,.79,.16),brass=k.mat(0xdfae72,.70,.28),gasket=k.mat(0x182e3b,.96,.02),
  cool=k.mat(0x83c8d7,.80,.10),warm=k.mat(0xf3c074,.84,.08);
 // Matte paint/coil insulation does not turn into glitter in a distant portal.
 for(const material of [m.steel,m.copper,m.cyan,m.mint,m.rose,m.violet,m.ivory,m.ceramic]){
  material.roughness=Math.max(material.roughness,.66);material.metalness=Math.min(material.metalness,.30);
 }
 const ringGeometry=k.geo(new THREE.TorusGeometry(1,.07,6,36)),heavyRingGeometry=k.geo(new THREE.TorusGeometry(1,.13,6,36)),horseshoeGeometry=k.geo(new THREE.TorusGeometry(1,.07,6,18,Math.PI));
 const pipeGeometryCache=new Map([[1,k.cylinder]]);
 // Large architectural panels need an edge chamfer, not prop subdivisions.
 const bevel=k.geo(architecturalBevel());
 function box(p,s,material=enamel,{solid=false,round=false,dynamic=false}={}){return k.mesh(round?bevel:k.cube,material,p,s,{solid,dynamic});}
 function pipe(a,b,r=.12,material=brass,{solid=false}={}){
  const va=V(...a),vb=V(...b),d=vb.clone().sub(va),length=d.length(),segments=Math.max(1,Math.ceil(length/12));
  // Extremely long, thin side triangles produced MSAA/clipping precision dots
  // through distant floors. Subdivide one continuous tube, keeping its exact
  // silhouette, placement and end caps; repeated lengths share the geometry.
  if(!pipeGeometryCache.has(segments))pipeGeometryCache.set(segments,k.geo(new THREE.CylinderGeometry(1,1,1,24,segments)));
  const mesh=k.mesh(pipeGeometryCache.get(segments),material,va.clone().add(vb).multiplyScalar(.5).toArray(),[r,length,r],{solid});mesh.quaternion.setFromUnitVectors(UP,d.normalize());
  if(mesh.userData.collider){mesh.updateWorldMatrix(true,false);mesh.userData.collider.box.setFromObject(mesh);}return mesh;
 }
 function ring(p,r,material=brass,{normal=[0,1,0],heavy=false,dynamic=false,openBottom=false}={}){
  const mesh=k.mesh(openBottom?horseshoeGeometry:heavy?heavyRingGeometry:ringGeometry,material,p,[r,r,r],{solid:false,dynamic});mesh.quaternion.setFromUnitVectors(Z,V(...normal));return mesh;
 }
 function cap(p,r,h,material=graphite,normal=[0,1,0]){const mesh=k.drum(p,r,h,material,{solid:false});mesh.quaternion.setFromUnitVectors(UP,V(...normal));return mesh;}
 function bearing(p,r,normal=[0,0,1],material=enamel){
  cap(p,r,.16,gasket,normal);ring(V(...p).addScaledVector(V(...normal),.13).toArray(),r*.92,material,{normal,heavy:true});cap(V(...p).addScaledVector(V(...normal),.19).toArray(),r*.39,.17,brass,normal);
 }
 function child(parent,geometry,material,p,s){const mesh=new THREE.Mesh(geometry,material);mesh.position.fromArray(p);mesh.scale.fromArray(s);mesh.receiveShadow=true;parent.add(mesh);k.meshes.push(mesh);if(!parent.userData.collider?.kinematic)k.static.push(mesh);return mesh;}

 // Wide labels carry information inside the architecture. The changing puzzle
 // monitors stay in level code. No fine hatch pattern, floor arrows or extra HUD.
 const labels=[];
 function plaque(title,p,width=11,normal=[0,0,1],subtitle=''){labels.push({title,subtitle,p,width,normal});}
 function finishPlaques(){
  if(typeof document==='undefined'||typeof document.createElement!=='function'||!labels.length)return;
  const cellW=512,cellH=96,height=THREE.MathUtils.ceilPowerOfTwo(Math.ceil(labels.length/2)*cellH),canvas=document.createElement('canvas');canvas.width=1024;canvas.height=height;const ctx=canvas.getContext('2d');if(!ctx)return;
  ctx.fillStyle='#203848';ctx.fillRect(0,0,1024,height);const positions=[],uvs=[],normals=[];
  labels.forEach((label,i)=>{
   const cx=(i%2)*cellW,cy=Math.floor(i/2)*cellH;ctx.fillStyle='#dcb782';ctx.fillRect(cx+8,cy+12,5,72);ctx.textAlign='left';ctx.textBaseline='middle';ctx.font='bold 24px sans-serif';ctx.fillStyle='#f4eddb';ctx.fillText(label.title,cx+25,cy+34,470);ctx.font='14px sans-serif';ctx.fillStyle='#a4d1d7';ctx.fillText(label.subtitle,cx+25,cy+69,470);
   const q=new THREE.Quaternion().setFromUnitVectors(Z,V(...label.normal)),right=V(1,0,0).applyQuaternion(q),up=UP.clone().applyQuaternion(q),origin=V(...label.p),h=label.width*cellH/cellW;
   const points=[[-.5,-.5],[.5,-.5],[.5,.5],[-.5,.5]].map(([x,y])=>origin.clone().addScaledVector(right,x*label.width).addScaledVector(up,y*h));
   const uv=[[cx/1024,1-(cy+cellH)/height],[(cx+cellW)/1024,1-(cy+cellH)/height],[(cx+cellW)/1024,1-cy/height],[cx/1024,1-cy/height]];
   for(const j of [0,1,2,0,2,3]){positions.push(...points[j].toArray());uvs.push(...uv[j]);normals.push(...label.normal);}
  });
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=Math.min(8,game.renderer?.capabilities?.getMaxAnisotropy?.()??4);k.textures.push(texture);const material=new THREE.MeshBasicMaterial({map:texture});k.materials.add(material);
  const geometry=k.geo(new THREE.BufferGeometry());geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));geometry.computeBoundingSphere();const mesh=new THREE.Mesh(geometry,material);mesh.name='Permanent instrument plaques / single texture atlas';k.root.add(mesh);
 }
 const identities={
  orrery:{band:chalk,profile:'orbital',sub:'ОБСЕРВАТОРИЯ / АЗИМУТ И СОСЕДНЯЯ ПЕРЕДАЧА'},
  drydock:{band:warm,profile:'gantry',sub:'МЕХАНИЧЕСКИЙ ДОК / ГРУЗ · ПОДЪЁМ · ФИКСАТОР'},
  optics:{band:cool,profile:'optical',sub:'ОПТИЧЕСКИЙ ТРАКТ / ПОРТАЛ · ЗЕРКАЛО · ПРИЁМНИК'},
  reservoir:{band:m.mint,profile:'hydraulic',sub:'ЗАМКНУТЫЙ КОНТУР / НИ ОДНА КАПЛЯ НЕ ИСЧЕЗАЕТ'},
  echo:{band:m.rose,profile:'acoustic',sub:'ПАМЯТЬ ПРОСТРАНСТВА / ЗАПИСЬ · ВСТРЕЧА · ЭХО'},
  magnet:{band:cool,profile:'coil',sub:'МАГНИТНЫЙ ПРИВОД / ТРИ КАТУШКИ И ОДНО ТЕЛО'},
  transmission:{band:brass,profile:'gantry',sub:'СИЛОВАЯ ПЕРЕДАЧА / ИМПУЛЬС · ОТНОШЕНИЕ · НАГРУЗКА'},
  accumulator:{band:m.violet,profile:'capacitor',sub:'НАКОПИТЕЛЬ / ЗАПАС ЭНЕРГИИ И ВРЕМЯ'},
  manifold:{band:m.mint,profile:'hydraulic',sub:'ВОЗДУШНЫЙ КОНТУР / КАНАЛ · СБРОС · ТУРБИНА'},
  eclipse:{band:m.rose,profile:'optical',sub:'ДВА ЗАТМЕНИЯ / СРЕДНИЙ СВИДЕТЕЛЬ ДОЛЖЕН ВИДЕТЬ СВЕТ'},
  fulcrum:{band:brass,profile:'gantry',sub:'МОМЕНТ СИЛЫ / ПОЛОЖЕНИЕ МЕНЯЕТ РАВНОВЕСИЕ'},
  archive:{band:m.rose,profile:'archive',sub:'ПОДВИЖНАЯ АРХИТЕКТУРА / ПРОХОДЫ МОЖНО ИЗМЕНИТЬ'},
  migrant:{band:m.mint,profile:'rail',sub:'ПОРТАЛЬНАЯ КАРЕТКА / ВЫХОД ПЕРЕМЕЩАЕТСЯ С ПОВЕРХНОСТЬЮ'},
  parallax:{band:m.rose,profile:'optical',sub:'ТРИ АПЕРТУРЫ / ОДНА ЛИНИЯ ВЗГЛЯДА'},
  inertia:{band:cool,profile:'velocity',sub:'ВЫСОТА → СКОРОСТЬ → ДАЛЬНОСТЬ'},
  inversion:{band:m.violet,profile:'field',sub:'ВЕРТИКАЛЬНОЕ ПОЛЕ / ДРУГОЕ НАПРАВЛЕНИЕ УСКОРЕНИЯ'},
 };
 function wallPoint(r,side,along,height,depth=.40){const {b,def:d}=r,[x,y,z]=d.at;
  return side==='n'?[x+along,y+height,b.z0+depth]:side==='s'?[x+along,y+height,b.z1-depth]:side==='w'?[b.x0+depth,y+height,z+along]:[b.x1-depth,y+height,z+along];
 }
 const wallNormal=side=>side==='n'?[0,0,1]:side==='s'?[0,0,-1]:side==='w'?[1,0,0]:[-1,0,0];
 function wallBox(r,side,along,height,width,tall,depth,material,offset=.40,{solid=false,round=false}={}){return box(wallPoint(r,side,along,height,offset),side==='w'||side==='e'?[depth,tall,width]:[width,tall,depth],material,{solid,round});}
 function instrument(r,side,along,height,width=5.6,tall=2.7){
  // High-mounted instruments have solid cases; they cannot occupy the path.
  wallBox(r,side,along,height,width,tall,.62,graphite,.43,{solid:true,round:true});wallBox(r,side,along,height,width-.36,tall-.34,.10,gasket,.79,{round:true});
  for(const s of [-1,1]){const p=wallPoint(r,side,along+s*width*.24,height,.89),n=wallNormal(side);cap(p,tall*.28,.10,chalk,n);ring(V(...p).addScaledVector(V(...n),.08).toArray(),tall*.27,brass,{normal:n});const needle=wallBox(r,side,along+s*width*.24,height+.10,.08,tall*.30,.045,ink,.98);if(side==='w'||side==='e')needle.rotation.x=.38;else needle.rotation.z=-.38;}
  wallBox(r,side,along,height-tall*.33,width*.42,.12,.07,m.live,.91);
 }
 for(const r of rooms.values()){
  const {def:d,P}=r,[,y]=d.at,id=identities[d.id]??{band:m[d.color]??cool,profile:'service',sub:'ИССЛЕДОВАТЕЛЬСКИЙ КОНТУР / ОТДЕЛЬНЫЙ МЕХАНИЗМ'},color=id.band;
  for(const side of ['n','s','w','e']){
   const length=side==='w'||side==='e'?d.d:d.w,bays=Math.max(3,Math.round(length/9)),step=length/bays;
   for(let i=0;i<bays;i++){
    const along=-length/2+(i+.5)*step;if(side===d.entry&&Math.abs(along)<step*.5+4)continue;
    const panelHeight=d.h*.64,center=d.h*.45;
    wallBox(r,side,along,center,step-.42,panelHeight,.19,i%3===1?graphite:enamel,.39,{round:true});wallBox(r,side,along+step*.5-.17,center,.14,panelHeight+.14,.12,gasket,.41);
    wallBox(r,side,along,1.02,step-.56,.40,.20,color,.52,{round:true});wallBox(r,side,along,d.h*.76,step-.76,.17,.16,chalk,.53);
    if((i+['n','s','w','e'].indexOf(side))%3===0){wallBox(r,side,along,d.h*.46,step*.56,d.h*.22,.12,ink,.56,{round:true});wallBox(r,side,along,d.h*.59,step*.43,.25,.12,color,.64);}
    // The atrium sees finished architecture, rather than the backs of boxes.
    // Exterior cladding is backed by this same physical wall and leaves every
    // entrance bay open, including the unusually high inversion doorway.
    wallBox(r,side,along,d.h*.56,step-.48,d.h*.68,.30,graphite,-.40,{round:true});
    wallBox(r,side,along,d.h*.56,step-.92,d.h*.51,.14,enamel,-.61,{round:true});
    wallBox(r,side,along,d.h*.33,step-1.2,.60,.12,color,-.71,{round:true});
    wallBox(r,side,along,d.h*.78,step-1.2,.22,.12,gasket,-.71);
   }
   wallBox(r,side,0,d.h-.62,length-.65,.55,.48,graphite,.40,{round:true});wallBox(r,side,0,d.h-.27,length-.9,.10,.12,m.lamp,.55);
  }
  const top=d.h-1.3;
  if(['gantry','rail','archive','service'].includes(id.profile))for(const zz of [-d.d*.28,d.d*.28]){box(P(0,zz,top),[d.w-1.4,.65,1.1],graphite,{round:true});box(P(0,zz,top-.47),[d.w-2,.16,.54],color,{round:true});}
  else if(['optical','velocity'].includes(id.profile))for(const xx of [-d.w*.29,0,d.w*.29]){box(P(xx,0,top),[1.8,.44,d.d-1.2],enamel,{round:true});box(P(xx,0,top-.30),[.5,.14,d.d-2],color,{round:true});}
  else for(const s of [-1,1])pipe(P(s*(d.w*.5-1.2),-d.d*.5+.9,top),P(s*(d.w*.5-1.2),d.d*.5-.9,top),.28,color);
  const nameSide=d.entry==='n'?'s':'n',nameWidth=Math.min(18,d.w*.65),nameHeight=Math.min(d.h-2.9,9.4);
  wallBox(r,nameSide,0,nameHeight,nameWidth+.5,nameWidth*96/512+.4,.13,ink,.58,{round:true});plaque(d.name,wallPoint(r,nameSide,0,nameHeight,.68),nameWidth,wallNormal(nameSide),id.sub);
  instrument(r,d.entry==='w'?'e':'w',-d.d*.28,Math.min(d.h-3.5,6.6));
  const normal=d.entry==='w'?[-1,0,0]:d.entry==='e'?[1,0,0]:d.entry==='n'?[0,0,-1]:[0,0,1],door=V(...r.door).addScaledVector(V(...normal),.48),vertical=d.entry==='w'||d.entry==='e';
  const lamp=box([door.x,y+3,door.z],[vertical?.18:4.8,.19,vertical?4.8:.18],m.idle,{dynamic:true});updates.push(()=>{lamp.material=solved.has(d.id)?m.live:m.idle;});
  for(const s of [-1,1]){const p=door.clone().add(V(vertical?0:s*3.75,2.8,vertical?s*3.75:0));box(p.toArray(),vertical?[.3,5.6,.55]:[.55,5.6,.3],enamel,{round:true});}
  box([door.x,y+5.75,door.z],vertical?[.32,.42,8]:[8,.42,.32],graphite,{round:true});
 }
 // Under-deck girders describe existing catwalks without changing their width.
 for(const [a,b]of edges){
  const delta=V(...b).sub(V(...a)),horizontal=V(delta.x,0,delta.z);if(horizontal.lengthSq()<.01)continue;horizontal.normalize();const side=V(-horizontal.z,0,horizontal.x);
  for(const s of [-1,1]){const aa=V(...a).addScaledVector(side,s*2.05).add(V(0,-.82,0)),bb=V(...b).addScaledVector(side,s*2.05).add(V(0,-.82,0));pipe(aa.toArray(),bb.toArray(),.25,graphite);pipe(aa.clone().add(V(0,-.33,0)).toArray(),bb.clone().add(V(0,-.33,0)).toArray(),.09,cool);}
 }
 for(const z of [-73,-49,-25,25,49,69]){box([0,-1.6,z],[16,2.2,.75],graphite,{solid:true});for(const x of [-7.5,7.5])box([x,-8.8,z],[.85,14.4,.85],graphite,{solid:true,round:true});}
 // Broad sleeves, flanges and service windows replace the thin neon cylinder.
 // The suspended machine leaves the ground concourse completely unobstructed.
 k.drum([0,36,0],3.5,48,gasket);k.drum([0,11.1,0],4.5,2.3,graphite);
 for(let y=15;y<=63;y+=8){
  cap([0,y,0],3.8,5.9,enamel);ring([0,y-3.1,0],4.2,graphite,{heavy:true});ring([0,y+3.1,0],4.2,brass,{heavy:true});
  for(let i=0;i<8;i++){const a=i*Math.PI/4,n=V(Math.cos(a),0,Math.sin(a)),p=n.clone().multiplyScalar(3.77).add(V(0,y,0));const panel=box(p.toArray(),[1.25,3.55,.20],gasket,{round:true});panel.quaternion.setFromUnitVectors(Z,n);const slit=box(p.clone().addScaledVector(n,.13).toArray(),[.48,2.7,.12],m.cyan,{round:true});slit.quaternion.copy(panel.quaternion);}
 }
 for(let i=0;i<8;i++){const a=i*Math.PI/4,x=Math.cos(a)*5.2,z=Math.sin(a)*5.2;box([x,39,z],[.48,59,.48],graphite,{solid:true,round:true});for(const y of [13,29,45,61])bearing([x,y,z],.42,[Math.cos(a),0,Math.sin(a)],brass);}
 ring([0,9.8,0],4,brass,{heavy:true});
 // Roof clerestory/trusses make the enclosing building visible. Broad openings
 // survive minification; there is no dense grating or hairline roof pattern.
 for(const z of [-88,-44,0,44,88]){box([0,89.5,z],[225,1.15,1.15],graphite,{round:true});for(const x of [-82,-28,28,82])box([x,93.36,z],[33,.20,14],chalk,{round:true});}
 for(const x of [-113,113])for(const z of [-102,-58,-14,30,74,112]){box([x,42,z],[.85,93,1.2],graphite,{solid:true,round:true});box([x,48,z],[1.14,23,1.5],enamel,{round:true});}
 box([0,7.4,4.7],[11.4,2.5,.2],ink,{round:true});plaque('СИНГУЛЯРНОСТЬ',[0,7.4,4.83],11,[0,0,1],'РАЗНЫЕ МАШИНЫ / ОБЩАЯ ВЕРШИНА');
 {
  const {P}=rooms.get('orrery');for(const x of [-12,0,12]){cap(P(x,0,-1.25),1.5,2.1,graphite);bearing(P(x,0,-.48),1.1,[0,1,0]);}
  // All bridge bearings/ticks remain under the traversable deck.
  for(const x of [-12,0,12])for(let i=0;i<8;i++){const a=i*Math.PI/4;box(P(x+Math.cos(a)*5.2,Math.sin(a)*5.2,-.57),[.45,.16,.45],chalk,{round:true});}
  for(const r of [5,9,13])ring(P(0,0,15.65),r,r===9?m.violet:graphite);
  pipe(P(-19,-3.5,4),P(-21,-3.5,5.1),.75,chalk);bearing(P(-19,-3.5,4),.78,[1,0,0]);
 }
 {
  const {P}=rooms.get('drydock');for(const x of [-4,4]){bearing(P(x,0,12.55),.85,[0,0,1]);pipe(P(x,0,1),P(x,0,12.45),.12,brass);}
  for(const x of [-15,-10,-5,0,5,10])box(P(x,6,7.66),[.38,.55,12.8],graphite);
  for(const x of [-14,-8,-2,4,10])box(P(x,19.5,8.10),[2.6,.12,.42],warm,{round:true});box(P(18,18,1.7),[.23,.18,5],brass);
 }
 {
  const r=rooms.get('optics'),{P}=r;box(P(-26,-5,1),[1.3,2,1.3],graphite,{solid:true,round:true});bearing(P(-26,-5,2.4),.65,[1,0,0]);box(P(0,5,.2),[3,.4,3],graphite,{solid:true,round:true});bearing(P(0,5,.45),1.02,[0,1,0]);
  for(const x of [-22,-11,0,11,22])wallBox(r,'n',x,5,5,4.4,.14,ink,.63,{round:true});
 }
 {
  const {P}=rooms.get('reservoir');for(const [x,h]of [[-14,8],[0,5],[14,3]]){ring(P(x,-10,h+.1),3.06,brass);cap(P(x,-10,h+.30),2.8,.38,chalk);pipe(P(x,-12,h+.25),P(x,-12,11.6),.32,brass);bearing(P(x,-12,11.6),.54,[0,0,1]);for(let i=1;i<=h;i++)box(P(x+2.43,-6.80,i),[.56,.14,.18],chalk,{round:true});}pipe(P(-14,-12,11.6),P(14,-12,11.6),.32,brass);
 }
 {
  const r=rooms.get('echo'),{P}=r;for(const [x,z]of [[-19,-9],[22,12]])for(const s of [-1,1])box(P(x+s*2.2,z,.16),[.22,.16,3.5],chalk,{round:true});
  wallBox(r,'s',0,5,26,6.6,.22,gasket,.53,{round:true});for(let i=0;i<15;i++)wallBox(r,'s',(i-7)*1.5,5,1,1.2+Math.sin(i*1.7)**2*3.9,.16,m.rose,.76,{round:true});
 }
 {
  const {P}=rooms.get('magnet');for(const [x,z]of [[-12,0],[0,11],[12,0]])for(const dx of [-.045,.045])ring(P(x+dx,z,4.8),3,brass,{normal:[1,0,0],openBottom:true});
 }
 {
  const {P}=rooms.get('transmission');box(P(0,-13.8,4),[25,8.5,1.2],ink,{solid:true,round:true});box(P(0,-13.8,.6),[28,1.2,3],graphite,{solid:true,round:true});
  for(const [x,r]of [[-8,3.9],[0,2.6],[7,3.2]]){bearing(P(x,-10.76,4),r*.26,[0,0,1]);pipe(P(x,-13,4),P(x,-10.65,4),r*.12,brass);}for(const x of [-12,12])box(P(x,-13.11,4.7),[.40,6.8,.20],warm,{round:true});
 }
 {
  const {P}=rooms.get('accumulator');for(const x of [-13,-9,-5]){box(P(x,-19.8,2.6),[2.2,5.2,1.7],ink,{solid:true,round:true});box(P(x,-18.90,2.7),[1.2,3.5,.15],gasket,{round:true});box(P(x,-18.78,2.7),[.42,2.6,.12],m.violet,{round:true});cap(P(x,-19.8,5.38),.73,.35,brass);}pipe(P(-13,-20.5,6),P(-5,-20.5,6),.25,brass);
 }
 {
  const {P}=rooms.get('archive');for(const z of [-13,13])pipe(P(-19,z,10.3),P(19,z,10.3),.28,brass);
  for(const mesh of k.meshes.filter(mesh=>mesh.userData.collider?.kinematic&&mesh.material===m.rose)){if(Math.abs(mesh.position.y-18.7)>.1)continue;for(let i=0;i<6;i++)child(mesh,k.round,gasket,[.51,0,(i-2.5)/6],[.08,.80,.105]);child(mesh,k.cube,chalk,[.55,.36,0],[.04,.06,.87]);}
 }
 {
  const {P}=rooms.get('migrant');for(const z of [-.6,.6])pipe(P(-15,z,10.6),P(15,z,10.6),.22,brass);for(const x of [-14,14])box(P(x,-15,6.5),[.85,13,.85],graphite,{solid:true,round:true});
 }
 {
  const {P}=rooms.get('parallax');for(const x of [-8,2,13])for(const z of [-14,-7,7,14])box(P(x,z,.18),[1.2,.30,.40],graphite,{round:true});
 }
 {
  const {P}=rooms.get('inertia');for(const y of [1,4,7,10])box(P(-29,-9,y),[.25,.25,4],warm,{round:true});box(P(4.5,-7,4),[.24,8,4],cool,{round:true});
 }
 {
  const {P}=rooms.get('inversion');for(const x of [-4,4])for(const z of [-4,4])for(const y of [2,6,10,14])box(P(x,z,y),[.80,.30,.80],brass,{round:true});for(const z of [-5.8,5.8])pipe(P(-4,z,18),P(4,z,18),.28,m.violet);
 }
 if(rooms.has('fulcrum')){
  // The gallery brake is a ceiling-mounted console, with its support behind
  // the player's approach rather than a floating box or a new walking obstacle.
  const {P,def}=rooms.get('fulcrum');pipe(P(0,2,9.65),P(0,2,def.h-1.3),.16,graphite);
 }
 // Terminal fascia stays inside the physical case, with the same interaction.
 for(const t of k.terminals){if(!t.art)continue;child(t.art,k.round,enamel,[0,.01,.49],[.75,.64,.035]);child(t.art,k.round,gasket,[0,.06,.515],[.54,.32,.024]);child(t.art,k.cube,cool,[-.12,.08,.532],[.20,.04,.015]);child(t.art,k.cube,brass,[.12,-.04,.532],[.16,.08,.015]);}
 finishPlaques();const fill=new THREE.HemisphereLight(0xd7eff8,0x547184,.42);game.scene.add(fill);lights.push(fill);
 return {update(){updates.forEach(f=>f());},dispose(){lights.forEach(l=>{l.removeFromParent();l.dispose?.();});}};
}
