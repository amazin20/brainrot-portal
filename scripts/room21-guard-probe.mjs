import * as THREE from 'three';

/** Explicit initial-condition contact fixture, not a playable route.
 * It grants the known high source to isolate the carried first transfer.
 * Production portal clearance, cargo transport, collision and air control run.
 * No fixture can count as a pass unless it actually transfers and lands. */
export function probeRoom21ClosedGuard(game, { offset = 0, yaw = 0, steer = 0 } = {}) {
  if (![offset,yaw,steer].every(Number.isFinite) || Math.abs(offset)>1.4 || Math.abs(steer)>1)
    throw new RangeError('Unsupported declared guard fixture');
  const V=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z),oldMove=game.input.getMove;
  game.resetRun(true);
  const level=game.firstLevel,p=level.panels,exit=p['rising-out'].getFrame();
  if(!p['shared-drop']||!p['rising-out'])throw new Error('Room21 expected');
  game.yaw=yaw;
  if(!game.placeOnPanel(0,p['shared-drop'].mesh,p['shared-drop'].getFrame().center.clone().setZ(7))
    ||!game.placeOnPanel(1,p['rising-out'].mesh,exit.center.clone().addScaledVector(exit.right,offset)))
    throw new Error('Invalid fixture: requested portal was not placed');
  game.playerPosition.set(-10,18,11.49);game.previousPlayerPosition.copy(game.playerPosition);
  game.playerGroup.position.copy(game.playerPosition);game.playerVelocity.set(0,0,-2.9);game.playerGrounded=true;
  game.facing=Math.PI;game.cameraRig.reset(game.playerPosition,game.yaw,game.pitch);
  game.physics.resetCargo({position:game.playerPosition.clone().add(V(0,1.06,-.72))});
  game.cargo.position.copy(game.physics.cargoBody.position);game.cargo.group.position.copy(game.cargo.position);
  if(!game.interact()||!game.heldCube)throw new Error('Invalid fixture: carried cargo required');
  const bodyId=game.physics.cargoBody.id,meshId=game.cargo.group.uuid,move=new THREE.Vector2();
  game.input.getMove=()=>move;
  let maxX=-Infinity,maxY=0,maxGuard=0,firstTransfer=null,ticks=0;
  try {
    for(;ticks<900;ticks++) {
      const world=game.teleportCount?V(0,0,steer):game.playerGrounded?V(0,0,-1):V();
      world.applyAxisAngle(V(0,1,0),-game.yaw);move.set(world.x,world.z);
      game.updatePlaying(1/120);
      if(game.physics.cargoBody.id!==bodyId||game.cargo.group.uuid!==meshId)throw new Error('Cargo identity changed');
      maxX=Math.max(maxX,game.playerPosition.x);maxY=Math.max(maxY,game.playerPosition.y);
      maxGuard=Math.max(maxGuard,level.state.freightGuard.progress);
      if(game.teleportCount&&!firstTransfer)firstTransfer=game.playerPosition.toArray();
      if(game.teleportCount&&game.playerGrounded){ticks++;break;}
    }
    const transferred=game.teleportCount===1,landed=!!firstTransfer&&game.playerGrounded;
    const bypass=landed&&game.playerPosition.x>5.5&&game.playerPosition.y>=11.9;
    return {offset,yaw,steer,ticks,transferred,landed,firstTransfer,maxX,maxY,maxGuard,
      landing:game.playerPosition.toArray(),held:!!game.heldCube,bodyId,meshId,bypass,
      pass:transferred&&landed&&!bypass&&maxGuard===0&&!!game.heldCube&&game.state==='playing'};
  } finally {game.input.getMove=oldMove;}
}
