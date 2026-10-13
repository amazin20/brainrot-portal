const check=(condition,message)=>{if(!condition)throw new Error(message);};
function carryingSlopeApproach(d,x,z){
 try{d.walk(x,z);}catch(error){
  // The held box reaches this sloping corner before its carrier can stand
  // exactly on the waypoint. Keep the reached physical approach; nothing
  // changes the body or advances it past the actual collision.
  if(!String(error).includes('Blocked walking')||Math.hypot(d.game.playerPosition.x-x,d.game.playerPosition.z-z)>.35)throw error;
  d.stop();
 }
}

/** A second energy-source plan from the ordinary Play spawn. The original
 * free body receives real capsule contacts; no gravity pair supplies motion.
 * Only walking, sprint, Space and E act on the production controller/Cannon.
 */
export function runRoom47ManualImpact(d){
 const {game:g,level:l}=d,cargo=g.cargo,body=g.physics.cargoBody;
 check(l.index===46&&l.fuse,'Manual impact requires the active brittle fuse');
 d.walk(-22.25,17);d.pickup();
 carryingSlopeApproach(d,-8,9);d.walk(-8,25.5);d.walk(-8,0);d.walk(0,0);
 check(g.playerGrounded&&g.playerPosition.y<.3,'Manual impact must use the real service floor');
 d.worldMove(0,-1);for(let n=0;n<100;n++)d.frame();d.stop();d.wait(.5);
 check(g.playerPosition.z<-2.7&&!l.fuse.broken,'Original held cargo must reach the intact ceramic face');
 check(g.interact()&&!g.heldCube,'Manual impact needs actual E release');d.wait(.5);
 d.mark('Free original cargo placed at the ceramic without a portal pair');
 for(let attempt=0;attempt<4&&!l.fuse.broken;attempt++){
  d.walk(0,1);g.input.keys.add('ShiftLeft');
  for(let n=0;n<180&&!l.fuse.broken;n++){
   if(n%35===0)g.input.jumpQueued=true;
   d.worldMove(0,-1);d.frame();
  }
  d.stop();d.wait(.8);d.mark('Real free-cargo sprint and jump contact '+(attempt+1));
 }
 check(l.fuse.broken&&l.fuse.energy>=175,'Direct free-body contact did not reach ceramic strength');
 check(!g.portals.ready&&g.teleportCount===0&&g.physics.portalTransports===0,'Manual energy must come without a portal transfer');
 d.mark('Direct free original cargo impact fractures the real ceramic');
 // Recover from the accessible southern face rather than walking into the
 // solid lateral rim beside a rolling cargo. The original body keeps moving.
 d.walk(0,1);d.wait(2.5);
 for(let n=0;n<8&&!g.heldCube;n++){
  const p=g.cargo.position.clone();d.walk(p.x,p.z+1.3);d.stop();d.wait(.2);
  if(g.playerPosition.distanceTo(g.cargo.position)<2.2)d.pickup();
 }
 check(g.heldCube===cargo,'Direct impact must recover the same original body');
 check(g.cargo===cargo&&g.physics.cargoBody===body,'Direct impact changed the original companion');
 d.mark('Same original cargo recovered after the direct fracture');
 d.walk(0,-21);
}
