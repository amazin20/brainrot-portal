import * as THREE from 'three';
import {V,clamp} from './LabSingularityKit.js';
import {castleMachineCasingGeometry} from './LabVisualAuditCastle.js';

const HEIGHT=4.2,WIDTH=2.3,DEPTH=.24,TRAY_TOP=.14;
const penetrates=(a,b)=>['x','y','z'].every(axis=>Math.min(a.max[axis],b.max[axis])-Math.max(a.min[axis],b.min[axis])>1e-7);
export function freightGateOffset(progress){
 const p=clamp(progress,0,1);return{x:-.65*clamp(p/.2,0,1),spread:2.5*clamp((p-.2)/.8,0,1)};
}

/** Two real leaves leave the wall rebate before sliding behind its piers.
 * The same original free cargo releases the load interlock, then returns to
 * an independent near tray. The detent retains the opening without a load;
 * closing fully seats the bolt again. No achievement opens the mechanism. */
export function buildCastleFreightGate({game,k,room,standing,complete,plate,sign}){
 const {P}=room,m=k.m,parts=[],leaves=[];
 const box=(name,p,size,mat=m.steel,dynamic=false)=>{
  const mesh=k.box(P(...p),size,mat,{dynamic});mesh.name='Freight return / '+name;
  mesh.userData.keepMaterial=true;parts.push(mesh);return mesh;
 };
 const partition=(a,b)=>box('founded partition',[0,(a+b)/2,5],[.65,10,b-a]);
 for(const[a,b]of [[-18,-10.7],[-9.3,5.7],[10.3,18]])partition(a,b);
 box('aiming slit sill',[0,-10,.75],[.65,1.5,1.4]);
 box('aiming slit lintel',[0,-10,6.65],[.65,6.7,1.4]);
 box('return opening header',[0,8,7.1],[.65,5.8,4.6]);
 // The swept rear skins clear the original wall by 205 mm. The fixed covers
 // stop outside the doorway and below the rail, never inside that sweep.
 for(const [side,closedZ]of [[-1,6.85],[1,9.15]]){
  const leaf=box('opaque sliding leaf',[0,closedZ,HEIGHT/2],[DEPTH,HEIGHT,WIDTH],m.copper,true);
  leaf.geometry=k.geo(castleMachineCasingGeometry([DEPTH,HEIGHT,WIDTH],{axis:'x',sculpt:true}));
  leaf.material=k.mat(0x9b6848,.5,.5);leaf.material.vertexColors=true;
  leaves.push({mesh:leaf,side,closedZ});
  const pocketZ=closedZ+side*2.5;
  box('founded pocket back',[-1.05,pocketZ,2.23],[.22,4.46,2.65],m.dark);
  box('pocket closed end',[-.68,pocketZ+side*1.32,2.23],[.96,4.46,.18],m.steel);
  box('pocket roof',[-.68,pocketZ,4.48],[.96,.22,2.65],m.steel);
  // The guide is carried by the existing ten-metre partition, with a short
  // transverse return for the first stroke and one continuous rear track.
  box('wall borne runner',[-.33,closedZ,4.73],[1.15,.18,.22],m.steel);
 }
 // A real central relief lets the vertical bolt pass through the rear
 // track. Its load path detours behind the bolt and joins the founded rail.
 for(const[a,b]of [[2.95,7.82],[8.18,13.05]])box('rear rail',[-.65,(a+b)/2,4.73],[.22,.18,b-a],m.steel);
 box('rail bridge behind bolt',[-.94,8,4.73],[.18,.18,.84],m.steel);
 for(const z of [7.67,8.33])box('rail return around bolt',[-.795,z,4.73],[.47,.18,.18],m.steel);
 for(const z of [2.9,13.1])box('rail wall bracket',[-.37,z,4.72],[.75,.42,.42],m.dark);
 const bolt=box('visible retaining bolt',[-.52,8,4.32],[.18,.90,.20],m.mint,true);
 // Four founded cheeks surround an actual empty channel. A solid block here
 // would occupy the moving pin's upper stroke and conceal its release.
 for(const x of [-.66,-.38])box('open bolt guide cheek',[x,8,4.975],[.06,1.05,.34],m.dark);
 for(const z of [7.855,8.145])box('open bolt guide return',[-.52,z,4.975],[.22,1.05,.05],m.dark);
 box('bolt guide wall mounting',[-.25,8,5.6],[.88,.20,.62],m.dark);
 const receiver=P(-10,8,TRAY_TOP),returnReceiver=P(8,12,TRAY_TOP),contact=P(12,12);
 const receiverMesh=box('original load tray',[-10,8,TRAY_TOP/2],[3.2,TRAY_TOP,3.2],m.copper);
 const returnMesh=box('returned original load tray',[8,12,TRAY_TOP/2],[3.2,TRAY_TOP,3.2],m.copper);
 // Low perimeter lights stay outside each finite tray. They never put a
 // decorative false floor above the actual load contact.
 const trayLamps=([x,,z])=>[[x-1.66,z,.08,3.4],[x+1.66,z,.08,3.4],[x,z-1.66,3.24,.08],[x,z+1.66,3.24,.08]].map(([cx,cz,sx,sz])=>k.box([cx,.0175+room.def.at[1],cz],[sx,.035,sz],m.idle,{solid:false,dynamic:true}));
 const innerLamps=trayLamps(receiver),outerLamps=trayLamps(returnReceiver),arrivalLamp=plate(contact,2.7,m.rose);
 box('founded return readout',[-1.85,8,7.2],[.24,1.65,8.2],m.dark);
 for(const z of [4.4,11.6])box('readout wall suspension',[-.82,z,7.9],[2,.18,.18],m.steel);
 const status=sign?.('ПРИЁМНИК ОСВОБОЖДАЕТ ЗАТВОР',P(-2,8,7.2),8,[-1,0,0]);
 sign?.('ГРУЗ В ДАЛЬНЮЮ ЧАШУ · РЫЧАГ ОСВОБОЖДАЕТ ВОЗВРАТ\nПРИВЕЗИ ТОГО ЖЕ ДРУГА В БЛИЖНЮЮ ЧАШУ',P(.36,-2,4.8),10,[1,0,0],2);
 let owner=null,originalCargo=null,originalBody=null,originalShape=null,trays=null;
 let progress=0,boltLift=0,requestedOpen=false,released=false,blocked=false,releaseProof=null,finished=false;
 const ensure=()=>{
  if(owner)return owner===game.physics;
  const physics=game.physics;if(!physics?.cargoBody)return false;
  const entries=[receiverMesh,returnMesh].map(mesh=>physics.solids.get(mesh.uuid));
  if(entries.some(s=>!s?.body?.shapes[0]||s.body.world!==physics.world))return false;
  owner=physics;originalCargo=game.cargo;originalBody=physics.cargoBody;originalShape=originalBody.shapes[0];
  trays=entries.map(s=>({entry:s,body:s.body,shape:s.body.shapes[0]}));return true;
 };
 function load(index){
  if(!ensure()||game.cargo!==originalCargo||owner.cargoBody!==originalBody||originalBody.shapes[0]!==originalShape||game.heldCube||owner.carryTarget||originalBody.world!==owner.world||!owner.world.bodies.includes(originalBody)||originalBody.collisionResponse===false||originalShape.collisionResponse===false)return null;
  const mesh=index?returnMesh:receiverMesh,c=mesh.userData.collider,t=trays[index];
  if(owner.solids.get(mesh.uuid)!==t.entry||t.entry.body!==t.body||!t.entry.inWorld||t.body.world!==owner.world||!owner.world.bodies.includes(t.body)||t.body.shapes[0]!==t.shape||t.body.collisionResponse===false||t.shape.collisionResponse===false||c.enabled===false||!(t.body.collisionFilterMask&originalBody.collisionFilterGroup)||!(originalBody.collisionFilterMask&t.body.collisionFilterGroup))return null;
  const center=c.box.getCenter(V()),half=c.box.getSize(V()).multiplyScalar(.5);
  if(center.distanceTo(V().copy(t.body.position))>1e-7||half.distanceTo(V().copy(t.shape.halfExtents))>1e-7||Math.abs(t.body.quaternion.x)+Math.abs(t.body.quaternion.y)+Math.abs(t.body.quaternion.z)>1e-7||t.body.shapeOffsets[0].length()>1e-7)return null;
  let normalForce=0,contacts=0;
  for(const equation of owner.world.contacts){
   if(equation.enabled===false||!(equation.multiplier>1e-6)||![equation.bi,equation.bj].includes(originalBody)||![equation.bi,equation.bj].includes(t.body)||![equation.si,equation.sj].includes(originalShape)||![equation.si,equation.sj].includes(t.shape))continue;
   const ny=(equation.bi===originalBody?-1:1)*equation.ni.y;
   if(ny>.65){normalForce+=ny*equation.multiplier;contacts++;}
  }
  // Contact multipliers alone may survive a same-step move. Require the real
  // current oriented cargo bounds to rest on this finite tray as well.
  originalBody.updateAABB();const a=originalBody.aabb;
  if(!contacts||!(normalForce>0)||Math.abs(a.lowerBound.y-c.box.max.y)>.08||a.upperBound.x<c.box.min.x||a.lowerBound.x>c.box.max.x||a.upperBound.z<c.box.min.z||a.lowerBound.z>c.box.max.z)return null;
  return{worldStep:owner.world.stepnumber,originalCargoBodyId:originalBody.id,originalCargoShapeId:originalShape.id,supportBodyId:t.body.id,supportShapeId:t.shape.id,normalForce,contacts,freeOriginal:true};
 }
 const leafBounds=(leaf,p)=>{
  const o=freightGateOffset(p),center=V(...P(o.x,leaf.closedZ+leaf.side*o.spread,HEIGHT/2));
  return new THREE.Box3(center.clone().sub(V(DEPTH/2,HEIGHT/2,WIDTH/2)),center.clone().add(V(DEPTH/2,HEIGHT/2,WIDTH/2)));
 };
 const boltBounds=lift=>{
  const center=V(...P(-.52,8,4.32+.65*lift));
  return new THREE.Box3(center.clone().sub(V(.09,.45,.10)),center.clone().add(V(.09,.45,.10)));
 };
 function occupants(){
  const p=game.playerPosition,boxes=[];
  if(p)boxes.push(new THREE.Box3(V(p.x-.48,p.y,p.z-.48),V(p.x+.48,p.y+2.4,p.z+.48)));
  const body=game.physics?.cargoBody;
  if(body){
   body.updateAABB();const b=new THREE.Box3(V().copy(body.aabb.lowerBound),V().copy(body.aabb.upperBound));boxes.push(b.expandByScalar(.04));
   const target=game.physics.carryTarget;if(target){
    const q=target.quaternion??body.quaternion,half=body.shapes[0]?.halfExtents;
    if(half){const matrix=new THREE.Matrix4().makeRotationFromQuaternion(new THREE.Quaternion(q.x,q.y,q.z,q.w)),e=matrix.elements;
     const extent=V(Math.abs(e[0])*half.x+Math.abs(e[4])*half.y+Math.abs(e[8])*half.z,Math.abs(e[1])*half.x+Math.abs(e[5])*half.y+Math.abs(e[9])*half.z,Math.abs(e[2])*half.x+Math.abs(e[6])*half.y+Math.abs(e[10])*half.z).addScalar(.04),c=V().copy(target.position);
     boxes.push(new THREE.Box3(c.clone().sub(extent),c.clone().add(extent)));
    }
   }
  }
  return boxes;
 }
 function motionBlocked(next){
  const bodies=occupants();
  // The safety throat is broader than a closing leaf: an actor who has
  // entered it keeps the full opening until both bodies leave it.
  const throat=new THREE.Box3(V(...P(-1.15,5.6,0)),V(...P(.8,10.4,HEIGHT)));
  if(next<progress&&bodies.some(b=>penetrates(b,throat)))return true;
  return leaves.some(leaf=>{const sweep=leafBounds(leaf,progress).union(leafBounds(leaf,next));return bodies.some(b=>penetrates(b,sweep));});
 }
 function toggle(){
  const witness=load(0);
  if(!requestedOpen&&!released&&!witness)return false;
  if(!requestedOpen){requestedOpen=true;released=true;releaseProof??=witness;}
  else requestedOpen=false;
  return true;
 }
 const control=k.control('freight:return',P(-10,12),toggle,'Открыть / закрыть возврат · для снятия запора нужен друг на дальней чаше',m.copper);
 const outerControl=k.control('freight:return-outer',P(4,12),toggle,'Открыть / закрыть возврат · незакрытый затвор можно развернуть без груза',m.copper);
 const state={receiver,returnReceiver,contact,receiverMesh,returnMesh,leaves:leaves.map(l=>l.mesh),bolt,parts,
  get progress(){return progress;},get boltLift(){return boltLift;},get requestedOpen(){return requestedOpen;},get blocked(){return blocked;},
  get innerLoaded(){return Boolean(load(0));},get returnLoaded(){return Boolean(load(1));},
  get passable(){return boltLift>.95&&freightGateOffset(progress).spread*2>=4.35;},
 };
 function pose(dt){
  const o=freightGateOffset(progress);
  for(const l of leaves)k.move(l.mesh,P(o.x,l.closedZ+l.side*o.spread,HEIGHT/2),dt);
  k.move(bolt,P(-.52,8,4.32+.65*boltLift),dt);
 }
 function update(dt){
  ensure();const inner=load(0),outer=load(1);
  if(inner||outer)originalBody.wakeUp();
  blocked=false;
  if(dt>0&&Number.isFinite(dt)){
   const nextLift=boltLift+clamp((released?1:0)-boltLift,-3*dt,3*dt);
   if(nextLift!==boltLift){
    const sweep=boltBounds(boltLift).union(boltBounds(nextLift));
    blocked=occupants().some(b=>penetrates(b,sweep));
    if(!blocked)boltLift=nextLift;
   }
   let next=progress;
   if(!requestedOpen)next=Math.max(0,progress-.45*dt);
   else if(boltLift>=1)next=Math.min(1,progress+.45*dt);
   // A bounded update never combines the orthogonal phases into a diagonal
   // sweep through a fixed pier, even after a long display frame.
   if(progress<.2&&next>.2||progress>.2&&next<.2)next=.2;
   if(next!==progress){const leafBlocked=motionBlocked(next);blocked||=leafBlocked;if(!leafBlocked)progress=next;}
   if(progress===0&&!requestedOpen)released=false;
  }
  pose(dt);
  for(const lamp of innerLamps)lamp.material=inner?m.live:m.idle;
  for(const lamp of outerLamps)lamp.material=outer?m.live:m.idle;
  const ready=state.passable&&Boolean(outer);arrivalLamp.material=ready?m.live:m.rose;
  bolt.material=blocked?m.rose:released?m.mint:m.copper;
  status?.update(blocked?'ПРОХОД ЗАНЯТ · СТВОРКИ ОСТАНОВЛЕНЫ':state.passable?'ВОЗВРАТ ОТКРЫТ · ЗАТВОР УДЕРЖИВАЕТСЯ':requestedOpen?'ЗАТВОР СНЯТ · ОТКРЫВАЕТСЯ':inner?'ЧАША НАГРУЖЕНА · МОЖНО ОТКРЫТЬ':'ПРИЁМНИК ОСВОБОЖДАЕТ ЗАТВОР');
  const available=inner||released;
  for(const t of [control,outerControl])t.screen.material=blocked?m.rose:requestedOpen?m.live:available?m.cyan:m.idle;
  if(!finished&&dt>0&&ready&&standing(contact,1.3)){
   finished=true;complete('freight',{sameBody:true,physicalWall:true,physicalLoadRelease:releaseProof,returnedOriginalLoad:outer,returnGate:{progress,boltLift,clearWidth:freightGateOffset(progress).spread*2},readsAchievements:false});
  }
 }
 function reset(){progress=boltLift=0;requestedOpen=released=blocked=finished=false;releaseProof=null;pose(0);}
 function diagnostics(){return{progress,boltLift,requestedOpen,released,blocked,passable:state.passable,innerLoad:load(0),returnLoad:load(1),releaseProof,originalCargoBodyId:originalBody?.id??null,originalCargoShapeId:originalShape?.id??null,readsAchievements:false,checkpoint:false};}
 pose(0);
 return{state,update,reset,toggle,diagnostics,passiveSupport:()=>Boolean(load(0)||load(1))};
}
