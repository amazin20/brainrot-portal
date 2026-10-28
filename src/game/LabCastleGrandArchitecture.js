import * as THREE from 'three';
import {CASTLE_WING_FINISHES} from './LabCastleMaterials.js';

export const CASTLE_GRAND_REVISION='folded-castle-carved-arcades-v1';
const V=(...p)=>new THREE.Vector3(...p);
const installs=new WeakMap();

/** A continuous closed surface, not a collection of overlapping box skins.
 * Every bay is triangulated around its carved field. Matching edges share
 * positions; the front field never lies on top of a second front face. */
function sculptedPlate(width,height,depth,{columns=1,rows=1,arched=true,palette,backCarved=true}={}){
 if(![width,height,depth].every(v=>Number.isFinite(v)&&v>0))throw new RangeError('Positive plate dimensions required');
 const positions=[],colors=[],uv=[];
 const tones=Object.fromEntries(Object.entries(palette).map(([k,v])=>[k,new THREE.Color(v)]));
 const tri=(a,b,c,tone,sign)=>{
  const orientation=(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
  if(sign&&(orientation*sign<0||(Math.abs(orientation)<1e-12&&sign<0)))[b,c]=[c,b];
  for(const p of [a,b,c]){positions.push(...p);colors.push(tone.r,tone.g,tone.b);uv.push(p[0]/width+.5,p[1]/height+.5);}
 };
 const quad=(a,b,c,d,tone,sign)=>{tri(a,b,c,tone,sign);tri(a,c,d,tone,sign);};
 const face=(outline,holes,z,tone,sign)=>{
  const vertices=[...outline,...holes.flat()];
  const triangles=THREE.ShapeUtils.triangulateShape(outline.map(p=>new THREE.Vector2(...p)),holes.map(h=>h.map(p=>new THREE.Vector2(...p))));
  for(const indices of triangles)tri(...indices.map(i=>[...vertices[i],z]),tone,sign);
 };
 const rect=(l,r,b,t)=>[[l,b],[r,b],[r,t],[l,t]];
 function contour(l,r,b,t){
  if(!arched)return rect(l,r,b,t);
  const x=(l+r)/2,rx=(r-l)/2,spring=b+(t-b)*.57,rise=t-spring;
  const p=[[l,b],[r,b],[r,spring]];
  // Two gentle quadratics meet at the pointed crown; broad segments survive
  // distant gallery views without fine grille noise.
  for(let i=1;i<=6;i++){const u=i/6;p.push([x+rx*(1-u)*(1-.20*u),spring+rise*u]);}
  for(let i=1;i<=6;i++){const u=i/6;p.push([x-rx*u*(.80+.20*u),t-rise*u]);}
  return p;
 }
 const full=rect(-width/2,width/2,-height/2,height/2);
 for(const sign of [1,-1]){
  const front=sign*depth/2;
  if(sign===-1&&!backCarved){face(full,[],front,tones.stone,sign);continue;}
  for(let y=0;y<rows;y++)for(let x=0;x<columns;x++){
   const w=width/columns,h=height/rows,l=-width/2+x*w,r=l+w,b=-height/2+y*h,t=b+h;
   const rim=Math.min(w*.11,h*.13,.56),bevel=Math.min(.055,depth*.10,w*.015,h*.015),recess=Math.min(.16,depth*.30);
   const outer=rect(l,r,b,t),hole=contour(l+rim,r-rim,b+rim,t-rim),inner=contour(l+rim+bevel,r-rim-bevel,b+rim+bevel,t-rim-bevel);
   face(outer,[hole],front,tones.stone,sign);
   for(let j=0;j<hole.length;j++){
    const n=(j+1)%hole.length;
    quad([...hole[j],front],[...hole[n],front],[...inner[n],front-sign*bevel],[...inner[j],front-sign*bevel],tones.edge,sign);
    quad([...inner[j],front-sign*bevel],[...inner[n],front-sign*bevel],[...inner[n],front-sign*recess],[...inner[j],front-sign*recess],tones.shadow,sign);
   }
   face(inner,[],front-sign*recess,(x+y)%3===0?tones.field:tones.secondary,sign);
  }
 }
 // Outward-facing side walls close the whole plate, with no shared coplanar
 // faces between neighbouring bays and no artificial collision openings.
 for(let i=0;i<4;i++){
  const j=(i+1)%4,a=full[i],b=full[j];
  quad([...a,-depth/2],[...b,-depth/2],[...b,depth/2],[...a,depth/2],tones.stone);
 }
 const geometry=new THREE.BufferGeometry();
 geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
 geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
 geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
 geometry.computeVertexNormals();return geometry;
}

export function castleArcadeGeometry(size,{roof=false,exterior=false,palette={stone:0xc1b59c,edge:0xd3aa69,field:0x394a59,secondary:0x556270,shadow:0x27323d}}={}){
 const [sx,sy,sz]=size;if(!size.every(n=>Number.isFinite(n)&&n>0))throw new RangeError('Invalid castle envelope');
 const axis=roof?'y':sx<sz?'x':'z',width=axis==='x'?sz:sx,height=roof?sz:sy,depth=axis==='x'?sx:roof?sy:sz;
 const columns=Math.max(1,Math.ceil(width/(roof?8:exterior?13:7.5))),rows=roof?Math.max(1,Math.ceil(height/8)):exterior?6:Math.max(1,Math.ceil(height/16));
 const geometry=sculptedPlate(width,height,depth,{columns,rows,arched:!roof,palette,backCarved:!roof});
 if(axis==='x')geometry.rotateY(Math.PI/2);else if(roof)geometry.rotateX(Math.PI/2);
 geometry.scale(1/sx,1/sy,1/sz);
 // Preserve the exact source AABB despite float32 coordinate division.
 const p=geometry.attributes.position;
 for(let i=0;i<p.count;i++)for(let a=0;a<3;a++){const n=p.getComponent(i,a);if(Math.abs(Math.abs(n)-.5)<2e-6)p.setComponent(i,a,Math.sign(n)*.5);}
 geometry.computeBoundingBox();geometry.computeBoundingSphere();
 geometry.parameters={width:1,height:1,depth:1};geometry.userData.architecturalBatch=true;
 geometry.name=roof?'Castle / integral recessed ceiling coffers':'Castle / closed pointed stone arcade';
 return geometry;
}

/** Full-sized collars bound a slightly chamfered octagonal shaft. The maximum
 * recess from the old square side is 55 mm, never a new walk-through space. */
export function castlePierGeometry(size){
 const [sx,sy,sz]=size;if(!size.every(v=>Number.isFinite(v)&&v>0))throw new RangeError('Positive pier envelope required');
 const p=[],colors=[],uv=[],stone=new THREE.Color(0x4c4954),gold=new THREE.Color(0xc4a16b),light=new THREE.Color(0xb9aa91);
 const positions=[-sy/2,-sy/2+.35,-sy/2+.55];
 for(const y of [0,18,36,54,72,90]){const local=y-42;if(local>-sy/2+1&&local<sy/2-1)positions.push(local-.40,local-.28,local+.28,local+.40);}
 positions.push(sy/2-.55,sy/2-.35,sy/2);positions.sort((a,b)=>a-b);
 const ring=(y,full)=>{const x=sx/2-(full?0:.055),z=sz/2-(full?0:.055),c=full?0:Math.min(.075,sx*.045,sz*.045);
  return [[-x+c,y,-z],[x-c,y,-z],[x,y,-z+c],[x,y,z-c],[x-c,y,z],[-x+c,y,z],[-x,y,z-c],[-x,y,-z+c]];};
 const tri=(a,b,c,color)=>{if(V(...b).sub(V(...a)).cross(V(...c).sub(V(...a))).lengthSq()<1e-16)return;for(const v of [a,b,c]){p.push(v[0]/sx,v[1]/sy,v[2]/sz);colors.push(color.r,color.g,color.b);uv.push(v[0]/sx+.5,v[1]/sy+.5);}};
 const full=y=>Math.abs(y)>=sy/2-.351||[0,18,36,54,72,90].some(f=>Math.abs(y-(f-42))<=.281);
 for(let n=0;n<positions.length-1;n++){
  const a=ring(positions[n],full(positions[n])),b=ring(positions[n+1],full(positions[n+1])),collar=positions[n+1]-positions[n]<.7;
  const color=collar?gold:stone;
  for(let i=0;i<8;i++){const j=(i+1)%8;tri(a[i],b[i],b[j],i%2?light:color);tri(a[i],b[j],a[j],i%2?light:color);}
 }
 for(const side of [-1,1]){const r=ring(side*sy/2,true);for(let i=1;i<7;i++)side>0?tri(r[0],r[i+1],r[i],gold):tri(r[0],r[i],r[i+1],gold);}
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(p,3));geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geometry.computeVertexNormals();geometry.computeBoundingBox();geometry.computeBoundingSphere();geometry.parameters={width:1,height:1,depth:1};geometry.userData.architecturalBatch=true;geometry.name='Castle / chamfered full-height load pier';return geometry;
}

/** Called after the old equipment audit and BEFORE the ordinary static batch.
 * Changes only original fixed building meshes. The twelve puzzles, their
 * actors, control points and collision owners remain completely unchanged. */
export function buildCastleGrandArchitecture({game,k,rooms,solved}){
 if(installs.has(k))return installs.get(k);
 const changed=[],cache=new Map(),wingMaterials=new Map();
 const stats={revision:CASTLE_GRAND_REVISION,exteriorWalls:0,wingSlabs:0,roofSlabs:0,piers:0,triangles:0,newColliders:0,newLights:0};
 const made=(name)=>{const m=k.mat(0xffffff,.77,.12);m.name=name;m.vertexColors=true;return m;};
 const outer=made('Castle grand / basalt and limestone arcade'),roof=made('Castle grand / amber coffered soffit'),pier=made('Castle grand / fluted load pier');
 for(const mesh of k.static){
  const c=mesh.userData.collider;if(!c||c.kinematic||mesh.userData.floor||mesh.userData.collisionProxy||k.panels.includes(mesh))continue;
  const size=mesh.scale.toArray(),[x,y,z]=size;
  let role=null,id=null,palette=null,replacement=null;
  if(y>110&&Math.min(x,z)<=1.3&&Math.max(x,z)>140){role='exteriorWalls';replacement=outer;}
  else if(mesh.userData.castlePerimeterCoffer){
   id=mesh.material.name.replace('Castle wing wall / ','');const wing=CASTLE_WING_FINISHES[id];if(!wing)continue;
   role='wingSlabs';palette={stone:wing.face,edge:wing.accent,field:0x273944,secondary:wing.wall,shadow:0x1f2b35};
   if(!wingMaterials.has(id)){const m=made(mesh.material.name);m.emissive.setHex(wing.accent);m.emissiveIntensity=0;wingMaterials.set(id,m);}
   replacement=wingMaterials.get(id);
  }else if(mesh.userData.castleRoofFinish&&x>8&&z>8&&y<=.8&&x<100){role='roofSlabs';replacement=roof;palette={stone:0x8d8070,edge:0xd0ad77,field:0x22303c,secondary:0x334858,shadow:0x17212b};}
  else if(y>110&&Math.abs(x-2.2)<.01&&Math.abs(z-2.2)<.01){role='piers';replacement=pier;}
  if(!role)continue;
  mesh.geometry.computeBoundingBox();const oldBox=mesh.geometry.boundingBox;
  const key=JSON.stringify([role,id,size,oldBox.min.toArray(),oldBox.max.toArray()]);
  if(!cache.has(key)){
   const geo=role==='piers'?castlePierGeometry(size):castleArcadeGeometry(size,{roof:role==='roofSlabs',exterior:role==='exteriorWalls',...(palette?{palette}:{})});
   // Source coffer arithmetic sometimes lands one float32 ULP inside .5.
   // Keep that exact established support envelope, not a freshly rounded one.
   const p=geo.attributes.position;
   for(let i=0;i<p.count;i++)for(let a=0;a<3;a++)p.setComponent(i,a,oldBox.min.getComponent(a)+(p.getComponent(i,a)+.5)*(oldBox.max.getComponent(a)-oldBox.min.getComponent(a)));
   geo.computeBoundingBox();geo.computeBoundingSphere();cache.set(key,k.geo(geo));
  }
  const geometry=cache.get(key);changed.push({mesh,geometry,originalGeometry:mesh.geometry,originalMaterial:mesh.material,bounds:c.box.clone(),role,id});mesh.geometry=geometry;mesh.material=replacement;mesh.userData.castleGrandFinish=true;stats[role]++;stats.triangles+=geometry.attributes.position.count/3;
 }
 let last=0,disposed=false;const powers=new Map([...wingMaterials.keys()].map(id=>[id,0]));
 const result={stats,changed,wingMaterials,powers,update(){
  if(disposed)return;const now=Math.max(0,Number(game.elapsed)||0);
  if(now<last){for(const id of powers.keys())powers.set(id,0);}
  const dt=Math.max(0,Math.min(.1,now-last));last=now;
  for(const [id,m]of wingMaterials){const value=THREE.MathUtils.damp(powers.get(id),solved.has(id)?1:0,3.5,dt);powers.set(id,value);m.emissiveIntensity=.07*value;}
 },dispose(){if(disposed)return;disposed=true;},get disposed(){return disposed;}};
 // Diagnostics contain no object references; camera review can serialize them.
 k.root.userData.castleGrandArchitecture={stats};installs.set(k,result);return result;
}
