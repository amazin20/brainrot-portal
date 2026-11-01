import * as THREE from 'three';
import {createHash} from 'node:crypto';

// These are explicitly assetless drawing fixtures. They do not stand in for
// imported GLBs, native Cannon bodies, shader compilation or rendered pixels.
export const mockCases=Object.freeze([
 {id:'room21-existing-cassettes',index:20},
 {id:'room29-existing-cassettes',index:28},
 {id:'room30-existing-cassettes',index:29},
 {id:'room30-fallback-visible-tiles',index:29,fallback:true,tiles:true},
 {id:'room30-fallback-no-tiles',index:29,fallback:true,tiles:false},
]);
const V=(...p)=>new THREE.Vector3(...p),Q=()=>new THREE.Quaternion();
export const sha=value=>createHash('sha256').update(typeof value==='string'?value:JSON.stringify(value)).digest('hex');

export function createDrawingMock(spec){
 const scene=new THREE.Scene(),root=new THREE.Group();scene.add(root);
 const world={root,surfaces:[]},sources=[];
 if(spec.fallback){
  // 19 x 12 genuine 6.5 m fallback cells: exactly 228 floor panels and
  // 912 unchanged 18 mm bronze Box instances in the original implementation.
  const group=new THREE.Group();group.rotation.x=-Math.PI/2;root.add(group);
  if(spec.tiles){const tile=new THREE.InstancedMesh(new THREE.BoxGeometry(1,1,1),new THREE.MeshStandardMaterial(),1);tile.name='Legacy floor tiles';group.add(tile);sources.push(tile);}
  scene.updateMatrixWorld(true);
  world.surfaces.push({portal:false,collider:{kinematic:false},width:123.5,height:78,group,getFrame:()=>({center:V(0,0,0),normal:V(0,1,0),right:V(1,0,0),up:V(0,0,-1),halfWidth:61.75,halfHeight:39})});
  for(const name of ['Solid hangar roof','Solid hangar side wall','Solid hangar end wall','Lower hangar service deck']){const m=new THREE.Mesh(new THREE.BoxGeometry(2,2,2),new THREE.MeshStandardMaterial({color:0x786543}));m.name=name;root.add(m);sources.push(m);}
 }else{
  const source=new THREE.InstancedMesh(new THREE.BoxGeometry(1,1,1),new THREE.MeshStandardMaterial(),4);source.name='Architectural coat / cassette';root.add(source);sources.push(source);
  const transforms=[
   [[0,0,0],Q().setFromAxisAngle(V(1,0,0),-Math.PI/2),[6,5,.08]],
   [[0,4,0],Q(),[4,5,.08]],
   [[6,7,0],Q().setFromAxisAngle(V(1,0,0),Math.PI/2),[5,4,.08]],
   [[-4,8,0],Q(),[5,6,.08]],
  ];
  transforms.forEach(([p,q,s],i)=>source.setMatrixAt(i,new THREE.Matrix4().compose(V(...p),q,V(...s))));
 }
 const hemi=new THREE.HemisphereLight(0xcadbee,0x28394a,.7),keyLight=new THREE.DirectionalLight(0xffdeba,2),fill=new THREE.DirectionalLight(0xcbe3e5,.3);fill.name='Architectural edge fill';scene.add(hemi,keyLight,fill);
 const game={chamberEdition:'foundation',scene,keyLight,colliders:[],aimBlockers:[],cameraBlockers:[],portalPanels:[],physics:{cargoBody:{mass:3.2,shapes:[{halfExtents:{x:.39,y:.39,z:.39}}]}},cargo:{position:V(1,.6,2)},playerPosition:V(-1,0,2),assets:new Map()};
 const level={index:spec.index,world,bounds:{base:0},update(){},renderUpdate(){},reset(){},dispose(){}};
 scene.updateMatrixWorld(true);
 return{game,level,sources,lights:[hemi,keyLight,fill]};
}

function materialState(m){
 const json=m.toJSON();delete json.uuid;delete json.metadata;
 return{json,compile:String(m.onBeforeCompile),cache:String(m.customProgramCacheKey)};
}
const vec=v=>v?.toArray()??null;
export function protectedDrawingSnapshot(mock){
 const a=mock.level.biosphereArchitecture;
 const geometryState=g=>({type:g.type,name:g.name,attributes:Object.fromEntries(Object.entries(g.attributes).map(([k,v])=>[k,{itemSize:v.itemSize,normalized:v.normalized,array:Array.from(v.array)}])),index:g.index?Array.from(g.index.array):null,bounds:g.boundingBox?{min:vec(g.boundingBox.min),max:vec(g.boundingBox.max)}:null,sphere:g.boundingSphere?{center:vec(g.boundingSphere.center),radius:g.boundingSphere.radius}:null});
 const meshes=a.root.children.map(m=>({
  // The sole declared delta is the fallback floor bronze's drawing bank and
  // material. Geometry/matrices/instance colours/bounds remain in this hash.
  name:m.name.replace('floorInlay:','metal:'),count:m.count,geometry:geometryState(m.geometry),matrix:Array.from(m.instanceMatrix.array),colors:Array.from(m.instanceColor.array),visible:m.visible,castShadow:m.castShadow,receiveShadow:m.receiveShadow,userData:m.userData,
  bounds:{min:vec(m.boundingBox.min),max:vec(m.boundingBox.max)},sphere:{center:vec(m.boundingSphere.center),radius:m.boundingSphere.radius},
  material:materialState(m.material===a.materials.floorInlay?a.materials.metal:m.material),
 }));
 return{stats:a.stats,records:a.records.map(r=>({...r,frame:r.frame.toArray()})),meshes,materials:Object.fromEntries(Object.entries(a.materials).filter(([k])=>k!=='floorInlay').map(([k,m])=>[k,materialState(m)])),sources:mock.sources.map(n=>({name:n.name,visible:n.visible,material:materialState(n.material)})),lights:mock.lights.map(n=>({type:n.type,intensity:n.intensity,color:n.color.getHex(),ground:n.groundColor?.getHex()??null}))};
}

export function ownershipSnapshot(mock){
 const g=mock.game;
 return{colliders:g.colliders,aim:g.aimBlockers,camera:g.cameraBlockers,portals:g.portalPanels,body:g.physics.cargoBody,shape:g.physics.cargoBody.shapes[0],cargo:g.cargo,player:g.playerPosition,assets:g.assets,physical:JSON.stringify({body:g.physics.cargoBody,cargo:g.cargo.position.toArray(),player:g.playerPosition.toArray()})};
}
