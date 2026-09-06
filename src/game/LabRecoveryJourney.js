import * as THREE from 'three';
/** Ordinary controls from the level-10 spawn into the pit and up its staircase.
 * No actor coordinates, velocities or mechanism states are assigned by this
 * route. Reset is used only once to begin the run, not to escape the pit. */
export async function runRecoveryJourney(game,{onMilestone=()=>{}}={}){
 const oldMove=game.input.getMove,move=new THREE.Vector2();game.input.getMove=()=>move.clone();
 game.resetRun(true);
 const id=game.cargo.group.uuid,body=game.physics.cargoBody.id;
 const report={level:10,pass:false,milestones:[],respawns:0,resets:0,frames:0};
 const respawn=game.respawn,resetCargo=game.physics.resetCargo;
 game.respawn=function(...args){report.respawns++;return respawn.apply(this,args);};
 game.physics.resetCargo=function(...args){report.resets++;return resetCargo.apply(this,args);};
 const check=(v,m)=>{if(!v)throw Error(m);};
 function frame(){
  if(game.state==='playing'){game.updatePlaying(1/120);if(game.state==='playing')game.updatePlaying(1/120);}
  game.updateVisuals(1/60,1);report.frames++;
  check(!report.respawns&&!report.resets,'Recovery reset an actor');
  check(game.cargo.group.uuid===id&&game.physics.cargoBody.id===body,'Companion identity changed');
 }
 function stop(){move.set(0,0);game.input.keys.clear();}
 function input(x,z){const v=new THREE.Vector3(x,0,z).applyAxisAngle(new THREE.Vector3(0,1,0),-game.yaw);move.set(v.x,v.z);}
 function wait(seconds){stop();for(let n=0;n<seconds*60;n++)frame();}
 function walk(x,z){
  for(let n=0;n<1500;n++){
   const dx=x-game.playerPosition.x,dz=z-game.playerPosition.z,d=Math.hypot(dx,dz);
   if(d<.11){stop();return;}
   const pace=Math.min(1,d*1.5);input(dx/d*pace,dz/d*pace);frame();
  }
  throw Error(`Recovery walk blocked at ${game.playerPosition.toArray()} toward ${x},${z}`);
 }
 function mark(name){const m={name,player:game.playerPosition.toArray(),cargo:game.cargo.position.toArray(),teleports:game.teleportCount};report.milestones.push(m);onMilestone(m,game);}
 try{
  wait(.5);walk(-10,11);walk(-10,8);wait(.4);
  // Cautious analogue movement leaves the gallery into the service gap; air
  // steering counters residual drift rather than teleporting onto a fixture.
  for(let n=0;n<500&&!(game.playerGrounded&&game.playerPosition.y< -4);n++){
   input(THREE.MathUtils.clamp((-8.88-game.playerPosition.x)*1.3-game.playerVelocity.x*.95,-.35,.35),0);frame();
  }
  stop();check(game.playerGrounded&&game.playerPosition.y< -4,'Did not enter lower area');
  check(!game.portals.ready,'Recovery must start without a prepared pair');mark('ordinary fall with no prepared portals');
  walk(-10,-9.5);walk(-13,-9.5);walk(-13,9.9);walk(-10,11);
  check(game.playerGrounded&&Math.abs(game.playerPosition.y-3)<.05,'Stairs did not return to ring');
  mark('returned by physical staircase without resetting');report.pass=true;return report;
 }finally{stop();game.input.getMove=oldMove;game.respawn=respawn;game.physics.resetCargo=resetCargo;}
}
