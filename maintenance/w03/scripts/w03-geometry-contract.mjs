import crypto from 'node:crypto';
/** Stable gameplay geometry only. UUIDs/render-only art are deliberately absent. */
export function geometryContract(game){
 const l=game.firstLevel,coord=v=>v?.toArray?.()??v;
 const geometry={id:l.id,spawn:coord(l.spawn),cargo:coord(l.cargoSpawn),goal:l.goal.position.toArray(),bounds:l.bounds,momentum:l.momentum,
  colliders:game.colliders.map(c=>({min:c.box.min.toArray(),max:c.box.max.toArray(),enabled:c.enabled,kinematic:c.kinematic})),
  floors:game.floors.map(f=>({minX:f.minX,maxX:f.maxX,minZ:f.minZ,maxZ:f.maxZ,y:f.y,enabled:f.enabled})),
  panels:game.portalPanels.map(m=>{const f=m.userData.portalFrame?.();return{matrix:m.matrixWorld.toArray(),normal:coord(f?.normal??m.userData.normal),center:coord(f?.center??m.userData.center),bounds:m.userData.portalBounds};})};
 const text=JSON.stringify(geometry,(_k,v)=>typeof v==='number'?Math.round(v*1e8)/1e8:v);
 return {id:l.id,colliders:game.colliders.length,floors:game.floors.length,sha256:crypto.createHash('sha256').update(text).digest('hex')};
}
