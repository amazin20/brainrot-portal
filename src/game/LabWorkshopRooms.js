import * as THREE from 'three';
import {glass, V} from './LabPuzzleMechanics.js';
import {cargoLoadsPlate} from './LabPlateContact.js';
import {buildExtensionBridgeModel} from './LabWorkshopModels.js';

// These rooms keep the supplied mechanism as the centre of the puzzle. The
// surrounding construction explains its load path and gives the player room
// to observe it with the ordinary shoulder camera.
function finishes(k) {
  const w=k.world;
  w.materials.wall.color.setHex(0x52616a);
  w.materials.floor.color.setHex(0x75838a);
  w.materials.trim.color.setHex(0x30434d);
  w.materials.ceramic.color.setHex(0xfffbed);
}
function deck(k,x0,x1,z0,z1,y) {
  const w=k.world;
  w.box([(x0+x1)/2,y/2-.10,(z0+z1)/2],[x1-x0,y-.20,z1-z0],w.materials.trim);
  return w.floor(x0,x1,z0,z1,y);
}
function glassLift(k,p,size,travel,open) {
  const mesh=glass(k.world,p,size),collider=k.game.colliders.find(c=>c.mesh===mesh);
  collider.kinematic=true;
  const base=V(...p);let previous=p[1],current=p[1];
  k.ticks.push(dt=>{
    previous=current;
    current=THREE.MathUtils.damp(current,base.y+(open()?travel:0),4,dt);mesh.position.y=current;
    k.game.syncCollision(collider,new THREE.Box3().setFromObject(mesh),dt);
  });
  k.renders.push(a=>{mesh.position.y=THREE.MathUtils.lerp(previous,current,a);});
  k.resets.push(()=>{mesh.position.copy(base);previous=current=base.y;});
  return {mesh,collider};
}

export function buildSpringMailRoom(k,{baseWalls,closedExit}) {
  const w=k.world;finishes(k);baseWalls();
  const spring=k.spring('piston',[0,1.25,-5],{
    presentation:{position:[-4.35,0,-5],size:4.5,yaw:Math.PI/2},
  });
  k.panel('drop-ceiling',[0,10.6,-5],[0,-1,0],6.2,5.6);
  k.panel('loading-floor',[-7,.025,6],[0,1,0],5,5);
  // A gantry carries the overhead ceramic target; the falling path stays open.
  for(const x of [-3.4,3.4]) {
    w.box([x,6,-8.2],[.22,12,.24]);
    w.box([x,10.8,-5],[.22,.28,6.5]);
  }
  w.box([0,10.8,-8.2],[7,.28,.28]);
  w.box([0,10.8,-1.8],[7,.28,.28]);
  // Visible corner guides explain where the protective glass retracts.
  for(const x of [-1.94,1.94])for(const z of [-6.94,-3.06]) {
    w.box([x,1.9,z],[.12,3.8,.12]);
    w.box([x,.12,z],[.36,.24,.36]);
  }
  const guards=[];
  // The grounded machine stops before the left glass. Its working crank
  // passes through an open-top slot, measured over the complete .72 m stroke.
  // A closed hole would sweep its top edge through the crank as the guard
  // retracts. These three pieces share the exact same vertical travel.
  for(const [p,size] of [
    [[-1.94,1.8,-6.625],[.08,3.6,.63]],
    [[-1.94,1.8,-4.525],[.08,3.6,2.93]],
    [[-1.94,1.14,-6.15],[.08,2.28,.32]],
    [[1.94,1.8,-5],[.08,3.6,3.88]],
    [[0,1.8,-6.94],[3.88,3.6,.08]],[[0,1.8,-3.06],[3.88,3.6,.08]],
  ]) guards.push(glassLift(k,p,size,-3.75,()=>spring.latched));
  k.state.springGuards=guards;
  // A low service tread raises the player's hands above the compressed cup's
  // rim. Retrieval is an ordinary E interaction after the glass retracts.
  w.box([0,.08,-3.05],[3.4,.16,1.3],w.materials.trim);
  w.floor(-1.7,1.7,-3.7,-2.4,.28);
  k.control('release',[-5.8,0,-1.8],()=>spring.reset(),'E — освободить защёлку. Пружина вернёт приёмную чашу.');
  closedExit(()=>spring.latched);
  k.wire([[1.6,.07,-5],[4.4,.07,-5],[4.4,.07,-11.5],[0,.07,-11.5]],()=>spring.latched);
  k.state.presentation={kind:'spring-and-bell-crank',cupRest:1.9,ceiling:10.6};
}

export function buildFreightBridgeRoom(k,{baseWalls,closedExit}) {
  const game=k.game,w=k.world;finishes(k);baseWalls();
  const model=buildExtensionBridgeModel(game,w.root,{position:[-3,0,1.5],size:12,yaw:Math.PI/2,stroke:3.6});
  k.fixtures.push(model);
  model.supportBoxes.forEach(box=>game.collisionProxy(box));
  game.aimBlockers.push(model.moving);game.cameraBlockers.push(model.moving);
  // Both banks are founded down to the floor, not black slabs hanging at eye
  // height. The open front approach reveals the cassette, deck and receiving bay.
  const bankY=1.82;
  deck(k,-11.6,-5.15,-1.8,5.8,bankY);
  deck(k,-5.15,-1.25,3.12,5.8,bankY);
  deck(k,2.3,8.8,-1.8,4.9,bankY);
  // This flight ascends towards -Z. Author each tread with positive extents:
  // a negative surface depth produces no tile instances and inverted bounds.
  // Each foundation stops at the recessed backing's underside, so there is
  // one exposed face at every height instead of overlapping riser skins.
  for(let i=0;i<7;i++){
    const h=bankY*(i+1)/7,z0=10.2-(i+1)*4.4/7,z1=10.2-i*4.4/7,foundation=h-.1451;
    w.box([-9.5,foundation/2,(z0+z1)/2],[2.4,foundation,z1-z0],w.materials.trim);
    w.floor(-10.7,-8.3,z0,z1,h,{name:`Dock stair tread ${i+1}`});
  }
  k.panel('loading-dock',[-11.7,bankY+2.1,3.8],[1,0,0],5.8);
  k.panel('unloading-dock',[8.65,bankY+2.1,1.5],[-1,0,0],5.8);

  const slabBox=new THREE.Box3(),matrix=new THREE.Matrix4(),rotation=new THREE.Matrix4();
  function bounds(s){
    rotation.makeRotationX(s.rotationX);
    matrix.copy(model.moving.matrixWorld).multiply(new THREE.Matrix4().makeTranslation(...s.center.toArray())).multiply(rotation);
    return slabBox.set(s.size.clone().multiplyScalar(-.5),s.size.clone().multiplyScalar(.5)).applyMatrix4(matrix).clone();
  }
  const colliders=model.deck.slabs.map(s=>{
    const c=game.collisionProxy(bounds(s),{kinematic:true});c.walkablePlane=true;return c;
  });
  const floor={minX:0,maxX:0,minZ:0,maxZ:0,y:bankY,mesh:model.deck.mesh,enabled:true,
    heightAt(x,z){const b=model.deck.bounds();if(x<b.min.x||x>b.max.x||z<b.min.z||z>b.max.z)return null;const y=model.deck.heightAt(x,z);return Number.isFinite(y)?y:null;},
  };
  game.floors.push(floor);w.floors.push(floor);
  const localUp=V(0,1,0),localRight=V(1,0,0),localForward=V(0,0,1);
  function frame(){
    model.moving.updateWorldMatrix(true,true);
    return {center:model.deck.center.clone().applyMatrix4(model.moving.matrixWorld),normal:localUp.clone(),
      right:localRight.clone().transformDirection(model.moving.matrixWorld),up:localForward.clone().transformDirection(model.moving.matrixWorld),
      halfWidth:model.deck.width/2,halfHeight:model.deck.depth/2};
  }
  let prior=0;
  const bridge={name:'freight',model,art:model,progress:0,target:0,rate:.22,position:frame().center,group:model.moving,
    loaded:()=>cargoLoadsPlate(game.cargo,game.heldCube,frame()),
    floor,collider:colliders[0],mesh:model.deck.mesh,
  };
  k.state.freight=bridge;
  function update(dt){
    // Restore the simulation transform after interpolated rendering first.
    model.setProgress(bridge.progress);
    const wasOn=game.playerGrounded&&floor.heightAt(game.playerPosition.x,game.playerPosition.z)!==null&&
      Math.abs(game.playerPosition.y-floor.heightAt(game.playerPosition.x,game.playerPosition.z))<.18;
    prior=bridge.progress;const previous=frame().center;
    bridge.progress+=THREE.MathUtils.clamp(bridge.target-bridge.progress,-bridge.rate*dt,bridge.rate*dt);
    model.setProgress(bridge.progress);bridge.position.copy(frame().center);
    if(wasOn&&dt){const delta=bridge.position.clone().sub(previous);game.playerPosition.add(delta);game.previousPlayerPosition.add(delta);}
    const b=model.deck.bounds();Object.assign(floor,{minX:b.min.x,maxX:b.max.x,minZ:b.min.z,maxZ:b.max.z});
    colliders.forEach((c,i)=>game.syncCollision(c,bounds(model.deck.slabs[i]),dt));
  }
  k.ticks.push(update);k.renders.push(a=>model.setProgress(THREE.MathUtils.lerp(prior,bridge.progress,a)));
  k.resets.push(()=>{bridge.target=bridge.progress=prior=0;model.setProgress(0);});
  k.control('dispatch',[-6.8,bankY,4.65],()=>bridge.target=bridge.target?0:1,'E — выдвинуть пролёт или вернуть его в кассету.');

  // The friend can travel through the low transfer hood. Its fixed receiving
  // contact, rather than an abstract completed-route flag, opens the enclosure.
  const lock={engaged:false};k.state['dock-lock']=lock;
  const receiver={center:V(2.5,bankY,1.5),normal:V(0,1,0),right:V(1,0,0),up:V(0,0,1),halfWidth:.85,halfHeight:1.2};
  k.ticks.push(()=>{if(bridge.progress>.98&&cargoLoadsPlate(game.cargo,game.heldCube,receiver))lock.engaged=true;});
  k.resets.push(()=>lock.engaged=false);
  const hood=[];
  for(const [p,size] of [
    [[3.8,bankY+1.34,1.5],[8.8,.12,3.0]],
    [[3.8,bankY+.65,-.01],[8.8,1.3,.10]],[[3.8,bankY+.65,3.01],[8.8,1.3,.10]],
    [[8.2,bankY+.65,1.5],[.12,1.3,3.0]],
  ])hood.push(glassLift(k,p,size,3.8,()=>lock.engaged));
  for(const x of [-.6,8.2])for(const z of [-.10,3.10])w.box([x,3.7,z],[.14,7.4,.14]);
  w.box([3.8,7.32,-.1],[9,.16,.16]);w.box([3.8,7.32,3.1],[9,.16,.16]);
  const indicator=w.box([2.5,bankY+.025,3.5],[1.3,.04,.12],new THREE.MeshStandardMaterial({color:0xb49462}),false);
  // The same contact colour outlines the supported receiving end of the bay;
  // the incoming edge stays open to the telescopic deck.
  for(const z of [.3,2.7])w.box([2.84,bankY+.008,z],[1.02,.016,.05],indicator.material,false);
  w.box([3.35,bankY+.008,1.5],[.05,.016,2.45],indicator.material,false);
  k.ticks.push(()=>indicator.material.color.setHex(lock.engaged?0x80dabc:0xb49462));
  k.state.freightHood=hood;k.state.presentation={kind:'telescopic-cargo-transfer',bankY,loadingPoint:[-1.55,bankY,1.5],receiver};
  closedExit(()=>lock.engaged);
  // The dock contact feeds the indicator, then follows the bank surface,
  // drops down its visible end face and reaches the fixed door-frame lamp.
  // wire() uses axis-aligned strips: a simultaneous Y/Z change would create
  // an opaque wall rather than a cable. All bends here lie on real surfaces.
  k.wire([
    [2.5,bankY+.015,2.7],[2.5,bankY+.015,3.5],[7.6,bankY+.015,3.5],
    [7.6,bankY+.015,-1.823],[7.6,.015,-1.823],[7.6,.015,-11.6975],
    [2.49,.015,-11.6975],[2.49,1.3,-11.6975],[2.445,1.3,-11.6975],
  ],()=>lock.engaged);
}
