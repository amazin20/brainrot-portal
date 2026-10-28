import {createHash} from 'node:crypto';
const numbers=value=>JSON.parse(JSON.stringify(value,(_key,v)=>typeof v==='number'?Math.round(v*1e8)/1e8:v));
const vector=v=>v?.toArray?.()??v;
function frame(f){return f?Object.fromEntries(Object.entries(f).filter(([k])=>['center','normal','up','right','halfWidth','halfHeight'].includes(k)).map(([k,v])=>[k,vector(v)])):null;}
export function castleBuildingContract(g){
 g.scene.updateMatrixWorld(true);
 const mesh=m=>({name:m.name,visible:m.visible,matrix:m.matrixWorld.toArray(),children:m.children.filter(n=>n.isMesh).map(n=>({name:n.name,visible:n.visible,matrix:n.matrixWorld.toArray()}))});
 const level=g.firstLevel;
 return numbers({id:level.id,index:level.index,spawn:vector(level.spawn),cargoSpawn:vector(level.cargoSpawn),spawnView:level.spawnView,
  rooms:[...level.rooms].map(([id,r])=>({id,def:r.def,bounds:r.b,door:r.door})),
  metrics:level.getTowerMetrics(),
  collision:g.colliders.map(c=>({mesh:mesh(c.mesh),min:vector(c.box.min),max:vector(c.box.max),enabled:c.enabled,kinematic:c.kinematic,ignorePropagation:c.ignorePropagation,opticallyTransparent:c.opticallyTransparent,front:frame(c.frontPlane?.())})),
  floors:g.floors.map(f=>({bounds:[f.minX,f.maxX,f.minZ,f.maxZ,f.y],enabled:f.enabled,mesh:mesh(f.mesh)})),
  camera:g.cameraBlockers.map(mesh),aim:g.aimBlockers.map(mesh),
  portals:g.portalPanels.map(m=>({mesh:mesh(m),frame:frame(m.userData.portalFrame?.()??{center:m.userData.center,normal:m.userData.normal,...m.userData.portalBounds})})),
  terminals:level.terminals.map(t=>({kind:t.kind,position:vector(t.position)})),
  bodies:g.physics.world.bodies.map(b=>({type:b.type,mass:b.mass,position:b.position.toArray(),quaternion:b.quaternion.toArray(),mask:b.collisionFilterMask,group:b.collisionFilterGroup,shapes:b.shapes.map((s,i)=>({type:s.type,half:vector(s.halfExtents),radius:s.radius,offset:vector(b.shapeOffsets[i]),orientation:vector(b.shapeOrientations[i])}))})),
  player:g.playerPosition.toArray(),cargo:g.cargo.position.toArray()});
}
export const castleContractHash=g=>createHash('sha256').update(JSON.stringify(castleBuildingContract(g))).digest('hex');
