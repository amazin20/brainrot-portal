import {createHash} from 'node:crypto';

const array=v=>v?.toArray?.()??v;
const rounded=value=>JSON.parse(JSON.stringify(value,(_key,v)=>typeof v==='number'?Math.round(v*1e9)/1e9:v));
export const digest=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const box=b=>b?{min:array(b.min),max:array(b.max)}:null;
const numeric=value=>Object.fromEntries(Object.entries(value??{}).flatMap(([key,v])=>{
 if(['number','boolean','string'].includes(typeof v))return [[key,v]];
 if(v?.isVector3||v?.isQuaternion)return [[key,v.toArray()]];
 return [];
}));
const frame=f=>f?{center:array(f.center),right:array(f.right),up:array(f.up),normal:array(f.normal),halfWidth:f.halfWidth,halfHeight:f.halfHeight}:null;
const authored=value=>{
 if(value?.isObject3D)return {name:value.name,matrix:value.matrixWorld.toArray()};
 if(value?.toArray)return value.toArray();
 if(Array.isArray(value))return value.map(authored);
 if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([key,v])=>[key,authored(v)]));
 return value;
};

/** Deliberately excludes render descendants, UUIDs and diagnostic art counts.
 * It records the actual collision registries and authored interaction frames. */
export function gameplayContract(game){
 const level=game.firstLevel;game.scene.updateMatrixWorld(true);
 const mesh=m=>{
  const raycastChildren=[];m.traverse(n=>{
   if(n!==m&&n.isMesh)raycastChildren.push({name:n.name,visible:n.visible,matrix:n.matrixWorld.toArray(),portalable:n.userData.portalable});
  });
  const ancestry=[];for(let p=m;p;p=p.parent)ancestry.push(p.visible);
  return {name:m.name,visible:m.visible,ancestorsVisible:ancestry.every(Boolean),raycastChildren,
   matrix:m.matrixWorld.toArray(),portalable:m.userData.portalable,frame:m.userData.portalFrame?frame(m.userData.portalFrame()):null};
 };
 return rounded({
  room:{id:level.id,index:level.index,spawn:level.spawn,cargoSpawn:level.cargoSpawn,bounds:level.bounds,
   spawnView:level.spawnView,goal:array(level.goal.position),momentum:level.momentum,puzzle:authored(level.puzzleGeometry)},
  colliders:game.colliders.map(c=>({mesh:mesh(c.mesh),box:box(c.box),enabled:c.enabled,kinematic:c.kinematic,
    ignorePropagation:c.ignorePropagation,opticallyTransparent:c.opticallyTransparent,frontPlane:c.frontPlane?frame(c.frontPlane()):null})),
  floors:game.floors.map(f=>({...numeric(f),mesh:f.mesh?.name})),
  camera:game.cameraBlockers.map(mesh),aim:game.aimBlockers.map(mesh),portalRegistry:game.portalPanels.map(mesh),
  panels:Object.fromEntries(Object.entries(level.panels).map(([name,p])=>[name,frame(p.getFrame())])),
  terminals:level.terminals.map(t=>({position:array(t.position),kind:t.kind})),
  state:Object.fromEntries(Object.entries(level.state??{}).flatMap(([key,v])=>{
   if(['number','boolean','string'].includes(typeof v))return [[key,v]];
   // Render-only metadata lives outside the mechanics state; body IDs are
   // engine allocation counters, while shape/position are checked separately.
   if(v&&!v.isObject3D&&!Array.isArray(v))return [[key,numeric(v)]];
   return [];
  })),
  pads:level.pads.map(numeric),lift:numeric(level.lift),receiverPanel:numeric(level.receiverPanel),
  player:array(game.playerPosition),cargo:array(game.cargo.position),won:level.isWon(),
 });
}

/** Source-scene workload, NOT GPU submissions or an FPS measurement. */
export function sceneWorkload(game){
 const geometries=new Set(),materials=new Set();let nodes=0,meshes=0,visibleMeshes=0,triangles=0,lights=0;
 game.scene.traverse(n=>{
  nodes++;if(n.isLight)lights++;if(!n.isMesh)return;meshes++;geometries.add(n.geometry);
  for(const m of Array.isArray(n.material)?n.material:[n.material])if(m)materials.add(m);
  let visible=true;for(let p=n;p;p=p.parent)visible&&=p.visible;
  const mats=Array.isArray(n.material)?n.material:[n.material];visible&&=mats.some(m=>m?.visible!==false);
  if(visible){visibleMeshes++;triangles+=(n.geometry.index?.count??n.geometry.attributes.position?.count??0)/3*(n.isInstancedMesh?n.count:1);}
 });
 return {nodes,meshes,visibleMeshes,triangles,lights,materials:materials.size,geometries:geometries.size};
}
