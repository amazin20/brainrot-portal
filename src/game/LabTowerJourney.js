import * as THREE from 'three';

const DT=1/120,UP=new THREE.Vector3(0,1,0);
const check=(condition,message)=>{if(!condition)throw new Error(message);};
const position=value=>value?.toArray?.()??value;
const round=value=>Math.round(value*10000)/10000;
const angle=value=>Math.atan2(Math.sin(value),Math.cos(value));
function continuousWaypoints(points){
 return points.filter((point,index)=>{
  if(!index||index===points.length-1||point.action||point.label)return true;
  const a=points[index-1].position,b=point.position,c=points[index+1].position;
  const abx=b[0]-a[0],abz=b[2]-a[2],bcx=c[0]-b[0],bcz=c[2]-b[2];
  // Stair heights are handled by real collision. Their intermediate straight
  // points must not make a speedrun brake once per tread.
  return Math.abs(abx*bcz-abz*bcx)>.00001||abx*bcx+abz*bcz<=0;
 });
}

/** Continuous production-physics route. The only commands are movement,
 * sprint, jump, camera orientation and the ordinary companion interaction.
 * In particular this driver does not reset the run at its starting frame. */
export async function runTowerJourney(game,{onMilestone=()=>{}}={}){
 const level=game.firstLevel,stages=level.towerStages;
 check(level.towerChallenge&&stages?.length===500,'The full tower must expose 500 physical stages');
 check(game.state==='playing'&&!game.externalBlocked,'Start the tower through its normal Play control first');
 check(level.completedStages===0,'A tower recording must begin before stage one');
 const spawn=position(level.spawn);
 check(spawn&&game.playerPosition.distanceTo(new THREE.Vector3(...spawn))<2,'A tower recording must begin at its ordinary spawn');
 const report={level:game.levelIndex+1,id:level.id,kind:'continuous-tower',pass:false,
  frames:0,physicsSteps:0,simulatedSeconds:0,durationSeconds:0,activeMovementSeconds:0,
  distanceTravelled:0,distance:0,maxIdleSeconds:0,maxNoInputSeconds:0,stagesCompleted:0,
  respawns:0,resets:0,cargoResets:0,teleports:0,jumps:0,interactions:0,cameraTurnRadians:0,
  stageEvents:[],telemetry:[],inputEvents:[],milestones:[],
  method:'Ordinary movement/sprint/jump/interact commands; 120 Hz production physics and 60 Hz visual updates; no actor placement, stage assignment, collision bypass, checkpoint, or initial reset.'};
 const original={move:game.input.getMove,respawn:game.respawn,resetRun:game.resetRun,resetCargo:game.physics.resetCargo};
 const move=new THREE.Vector2(),identity=game.cargo.group.uuid,body=game.physics.cargoBody.id;
 const initialTeleports=game.teleportCount,initialElapsed=game.elapsed;
 let idle=0,noInput=0,completed=0,lastTelemetry=-1,lastYaw=game.yaw;
 game.input.getMove=()=>move.clone();
 game.respawn=function(...args){report.respawns++;return original.respawn.apply(this,args);};
 game.resetRun=function(...args){report.resets++;return original.resetRun.apply(this,args);};
 game.physics.resetCargo=function(...args){report.cargoResets++;return original.resetCargo.apply(this,args);};
 const snapshot=()=>({stage:completed,completedStages:completed,frame:report.frames,
  simulatedSeconds:round(report.physicsSteps*DT),player:game.playerPosition.toArray(),cargo:game.cargo.position.toArray(),
  distanceTravelled:round(report.distanceTravelled),activeMovementSeconds:round(report.activeMovementSeconds)});
 function stop(){move.set(0,0);game.input.keys.clear();}
 function worldMove(x,z){
  const direction=new THREE.Vector3(x,0,z).applyAxisAngle(UP,-game.yaw);
  move.set(direction.x,direction.z);
 }
 function viewToward(dx,dz){
  if(Math.hypot(dx,dz)<.001)return;
  const desired=Math.atan2(-dx,-dz);
  game.yaw+=THREE.MathUtils.clamp(angle(desired-game.yaw),-.07,.07);
  game.pitch+=THREE.MathUtils.clamp(-.14-game.pitch,-.025,.025);
 }
 function mark(name){
  const item={name,...snapshot()};report.milestones.push(item);onMilestone(item,game);
 }
 function samplePhysics(){
  const before=game.playerPosition.clone(),input=move.length();
  game.updatePlaying(DT);report.physicsSteps++;
  const delta=game.playerPosition.clone().sub(before),horizontal=Math.hypot(delta.x,delta.z);
  report.distanceTravelled+=delta.length();
  const moving=horizontal/DT>.2;
  if(moving&&input>.05)report.activeMovementSeconds+=DT;
  idle=moving?0:idle+DT;noInput=input>.05?0:noInput+DT;
  report.maxIdleSeconds=Math.max(report.maxIdleSeconds,idle);
  report.maxNoInputSeconds=Math.max(report.maxNoInputSeconds,noInput);
  check(report.respawns===0&&report.resets===0&&report.cargoResets===0,'Tower run reset before completion');
  check(game.cargo.group.uuid===identity&&game.physics.cargoBody.id===body,'The original companion changed');
  check(game.teleportCount===initialTeleports,'The tower route unexpectedly used a portal');
  check(level.completedStages===completed||level.completedStages===completed+1,'Tower stages must complete one at a time, in order');
  if(level.completedStages!==completed){
   completed=level.completedStages;report.stagesCompleted=completed;
   report.stageEvents.push({stage:completed,...snapshot()});
  }
 }
 async function frame(){
  check(game.state==='playing'||game.state==='won',`Tower stopped in state ${game.state}`);
  check(!game.externalBlocked,'Tower must remain in an active, unblocked game session');
  for(let step=0;step<2&&game.state==='playing';step++)samplePhysics();
  game.updateVisuals(1/60,1);report.frames++;
  report.cameraTurnRadians+=Math.abs(angle(game.yaw-lastYaw));lastYaw=game.yaw;
  if(report.frames%60===0){
   const second=Math.floor(report.physicsSteps*DT+1e-7);
   if(second!==lastTelemetry){
    report.telemetry.push({...snapshot(),input:[move.x,move.y],sprint:game.input.keys.has('ShiftLeft'),
     grounded:game.playerGrounded,yaw:game.yaw,pitch:game.pitch,speed:Math.hypot(game.playerVelocity.x,game.playerVelocity.z)});
    lastTelemetry=second;
   }
   await globalThis.__NESI_TOWER_FLUSH_FRAMES__?.(snapshot());
  }
  check(report.maxIdleSeconds<=5,'Tower route stalled for over five seconds');
 }
 async function walk(point,{label='waypoint',tolerance=.2}={}){
  const target=new THREE.Vector3(...point);let best=Infinity,stuck=0;
  for(let n=0;n<60*25&&game.state==='playing';n++){
   const dx=target.x-game.playerPosition.x,dz=target.z-game.playerPosition.z,d=Math.hypot(dx,dz);
   if(d<tolerance&&Math.abs(target.y-game.playerPosition.y)<.55)return;
   if(d<best-.006){best=d;stuck=0;}else stuck++;
   check(stuck<240,`Tower ${completed+1} blocked at ${label}: ${game.playerPosition.toArray()} target ${point}`);
   viewToward(dx,dz);
   game.input.keys.add('ShiftLeft');
   if(d<tolerance)worldMove(0,0); // Brake only while a real jump lands.
   else worldMove(dx/Math.max(d,.0001),dz/Math.max(d,.0001));
   await frame();
  }
  check(game.state==='won',`Tower ${completed+1} timed out at ${label}: ${game.playerPosition.toArray()} target ${point}`);
 }
 try{
  report.telemetry.push({...snapshot(),input:[0,0],sprint:false,grounded:game.playerGrounded,yaw:game.yaw,pitch:game.pitch,speed:0});
  if(!game.heldCube){
   const cargo=game.cargo.position,dx=cargo.x-game.playerPosition.x,dz=cargo.z-game.playerPosition.z,d=Math.hypot(dx,dz);
   if(d>1.5)await walk([cargo.x-dx/Math.max(d,.001)*1.25,game.playerPosition.y,cargo.z-dz/Math.max(d,.001)*1.25],{label:'companion pickup'});
   stop();check(game.interact()&&game.heldCube,'Could not collect the original tower companion');
   report.interactions++;report.inputEvents.push({type:'interact-pickup',...snapshot()});
  }
  mark('Tower ascent begins at the ordinary bottom spawn');
  for(const stage of stages){
   check(stage.number===completed+1,`Unexpected tower route order at stage ${stage.number}`);
   const waypoints=continuousWaypoints(stage.waypoints);
   for(const [pointIndex,waypoint]of waypoints.entries()){
    await walk(position(waypoint.position),{...waypoint,tolerance:pointIndex===waypoints.length-1?.06:.2});
    // The authored jump point is the take-off location, not a place to stop
    // and finish the jump. Carry the queued Space into the next segment.
    if(waypoint.action==='jump'){
     check(game.playerGrounded,'Tower jump point must be approached on its physical deck');
     game.input.jumpQueued=true;report.jumps++;
     report.inputEvents.push({type:'jump',...snapshot(),takeoff:position(waypoint.position)});
    }
    check(game.heldCube,'The original companion must remain carried through the tower');
   }
   check(completed===stage.number,`Stage ${stage.number} route did not cross its live exit: ${JSON.stringify(level.getTowerMetrics?.())}`);
   if(completed===1||completed%25===0)mark(`Tower stage ${completed} completed through its physical route`);
   await globalThis.__NESI_TOWER_FLUSH_FRAMES__?.(snapshot());
  }
  check(game.state==='won','Stage 500 must reach the physical finish with the companion');
  report.simulatedSeconds=report.physicsSteps*DT;report.durationSeconds=report.simulatedSeconds;
  report.distance=report.distanceTravelled;report.teleports=game.teleportCount-initialTeleports;
  report.gameElapsedSeconds=(game.elapsed-initialElapsed)/1000;
  report.tower=level.getTowerMetrics?.();
  check(report.stageEvents.length===500&&report.stageEvents.every((event,i)=>event.stage===i+1),'Missing or unordered physical stage events');
  check(report.activeMovementSeconds>=900,'Full tower speedrun must contain at least 900 seconds of active movement');
  check(Math.abs(report.gameElapsedSeconds-report.simulatedSeconds)<.02,'Tower simulation clock differs from actual physics steps');
  check(report.maxNoInputSeconds<=5,'Tower route contains an artificial idle segment');
  report.pass=true;mark('All 500 stages completed in one uninterrupted ascent');
  await globalThis.__NESI_TOWER_FLUSH_FRAMES__?.(snapshot());
  return report;
 }catch(error){
  report.simulatedSeconds=report.physicsSteps*DT;report.durationSeconds=report.simulatedSeconds;
  report.distance=report.distanceTravelled;report.gameElapsedSeconds=(game.elapsed-initialElapsed)/1000;
  report.failure={message:String(error),...snapshot(),tower:level.getTowerMetrics?.()};
  error.towerReport=report;throw error;
 }finally{
  stop();game.input.jumpQueued=false;game.input.getMove=original.move;
  game.respawn=original.respawn;game.resetRun=original.resetRun;game.physics.resetCargo=original.resetCargo;
 }
}
