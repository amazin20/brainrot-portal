import * as THREE from 'three';

const DT=1/120,UP=new THREE.Vector3(0,1,0);
const check=(condition,message)=>{if(!condition)throw new Error(message);};
const array=value=>value?.toArray?.()??value;
const round=value=>Math.round(value*10000)/10000;
const angle=value=>Math.atan2(Math.sin(value),Math.cos(value));

/** One authored solution through the production game, starting at Play. The
 * route may choose a different order for the three independent wings on each
 * deck. It never assigns an actor pose, a portal, a mechanism state or victory.
 */
export async function runTowerJourney(game,{onMilestone=()=>{},branchOrder=[0,1,2],stopAfterDeck=null,stopAfterTransitionDeck=null}={}){
 const level=game.firstLevel,stages=level.towerStages;
 check(level?.towerChallenge&&Array.isArray(stages)&&stages.length===level.totalStages,'The Tower must expose its authored wings');
 check(game.state==='playing'&&!game.externalBlocked,'Start through the normal Play control');
 check(level.completedStages===0,'A recording must begin before the first wing');
 check(game.playerPosition.distanceTo(level.spawn)<2,'A recording must begin at the ordinary spawn');
 check(branchOrder.length===3&&new Set(branchOrder).size===3&&branchOrder.every(b=>Number.isInteger(b)&&b>=0&&b<3),'Each deck needs one visit to each of its three branches');
 const report={level:game.levelIndex+1,id:level.id,kind:'continuous-tower',pass:false,
  frames:0,physicsSteps:0,simulatedSeconds:0,durationSeconds:0,activeMovementSeconds:0,activeInputSeconds:0,
  distanceTravelled:0,distance:0,maxIdleSeconds:0,maxNoInputSeconds:0,stagesCompleted:0,
  respawns:0,resets:0,cargoResets:0,teleports:0,jumps:0,interactions:0,shots:0,cameraTurnRadians:0,
  stageEvents:[],keystoneEvents:[],telemetry:[],inputEvents:[],milestones:[],branchOrder:[...branchOrder],
  method:'Authored route with ordinary movement, jump, E and portal shots; 120 Hz production physics and 60 Hz visuals. No actor placement, puzzle-state assignment, checkpoint or initial reset.'};
 const original={move:game.input.getMove,respawn:game.respawn,resetRun:game.resetRun,resetCargo:game.physics.resetCargo};
 const move=new THREE.Vector2(),identity=game.cargo.group.uuid,body=game.physics.cargoBody.id;
 const initialTeleports=game.teleportCount,initialElapsed=game.elapsed;
 let idle=0,noInput=0,completed=0,lastTelemetry=-1,lastYaw=game.yaw,lastPitch=game.pitch,lastCameraYaw=game.yaw;
 game.input.getMove=()=>move.clone();
 game.respawn=function(...args){report.respawns++;return original.respawn.apply(this,args);};
 game.resetRun=function(...args){report.resets++;return original.resetRun.apply(this,args);};
 game.physics.resetCargo=function(...args){report.cargoResets++;return original.resetCargo.apply(this,args);};
 const snapshot=()=>({stage:completed,completedStages:level.completedStages,frame:report.frames,
  simulatedSeconds:round(report.physicsSteps*DT),player:game.playerPosition.toArray(),cargo:game.cargo.position.toArray(),
  distanceTravelled:round(report.distanceTravelled),activeMovementSeconds:round(report.activeMovementSeconds),
  teleports:game.teleportCount-initialTeleports});
 function stop(){move.set(0,0);game.input.keys.clear();}
 function worldMove(x,z){const direction=new THREE.Vector3(x,0,z).applyAxisAngle(UP,-game.yaw);move.set(direction.x,direction.z);}
 function viewToward(dx,dz){
  if(Math.hypot(dx,dz)<.001)return;
  const desired=Math.atan2(-dx,-dz);
  game.yaw+=THREE.MathUtils.clamp(angle(desired-game.yaw),-.07,.07);
  game.pitch+=THREE.MathUtils.clamp(-.14-game.pitch,-.025,.025);
 }
 function mark(name){const item={name,...snapshot()};report.milestones.push(item);onMilestone(item,game);}
 function samplePhysics(){
  const before=game.playerPosition.clone(),input=move.length();
  game.updatePlaying(DT);report.physicsSteps++;
  const delta=game.playerPosition.clone().sub(before),horizontal=Math.hypot(delta.x,delta.z);
  report.distanceTravelled+=delta.length();
  const moving=horizontal/DT>.2,turning=Math.abs(angle(game.yaw-lastYaw))+Math.abs(game.pitch-lastPitch)>.0001;
  if(moving&&input>.05)report.activeMovementSeconds+=DT;
  if((moving&&input>.05)||turning)report.activeInputSeconds+=DT;
  idle=moving||turning?0:idle+DT;noInput=input>.05||turning?0:noInput+DT;
  report.maxIdleSeconds=Math.max(report.maxIdleSeconds,idle);
  report.maxNoInputSeconds=Math.max(report.maxNoInputSeconds,noInput);
  lastYaw=game.yaw;lastPitch=game.pitch;
  check(report.respawns===0&&report.resets===0&&report.cargoResets===0,'Tower run reset before completion');
  check(game.cargo.group.uuid===identity&&game.physics.cargoBody.id===body,'The original companion changed');
  check(level.completedStages>=completed&&level.completedStages<=completed+1,'Wing chronology skipped or moved backwards');
  if(level.completedStages!==completed){
   completed=level.completedStages;report.stagesCompleted=completed;
   const last=level.getTowerMetrics().stageEvents.at(-1);
   report.stageEvents.push({stage:completed,id:last?.id,deck:last?.deck,branch:last?.branch,...snapshot()});
  }
 }
 async function frame(){
  check(game.state==='playing'||game.state==='won',`Tower stopped in state ${game.state}`);
  check(!game.externalBlocked,'The Tower is externally blocked');
  for(let step=0;step<2&&game.state==='playing';step++)samplePhysics();
  game.updateVisuals(1/60,1);report.frames++;
  report.cameraTurnRadians+=Math.abs(angle(game.yaw-lastCameraYaw));lastCameraYaw=game.yaw;
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
 async function walk(point,{label='waypoint',tolerance=.20,sprint=true,timeout=35}={}){
  const target=new THREE.Vector3(...array(point));let best=Infinity,stuck=0;
  for(let n=0;n<60*timeout&&game.state==='playing';n++){
   const dx=target.x-game.playerPosition.x,dz=target.z-game.playerPosition.z,d=Math.hypot(dx,dz);
   if(d<tolerance&&Math.abs(target.y-game.playerPosition.y)<.72){stop();return;}
   if(d<best-.006){best=d;stuck=0;}else stuck++;
   check(stuck<240,`Tower wing blocked at ${label}: player ${game.playerPosition.toArray()} target ${array(point)}`);
   viewToward(dx,dz);
   if(sprint)game.input.keys.add('ShiftLeft');else game.input.keys.delete('ShiftLeft');
   if(d<tolerance)worldMove(0,0);
   else worldMove(dx/Math.max(d,.0001),dz/Math.max(d,.0001));
   await frame();
  }
  check(game.state==='won',`Tower wing timed out at ${label}: player ${game.playerPosition.toArray()} target ${array(point)}`);
 }
 async function wait(seconds,label='mechanism'){
  check(seconds>=0&&seconds<4.9,`Route contains a prolonged wait at ${label}`);
  stop();for(let n=0;n<Math.ceil(seconds*60)&&game.state==='playing';n++)await frame();
 }
 async function until(condition,seconds,label){
  stop();for(let n=0;n<seconds*60&&game.state==='playing';n++){if(condition())return;await frame();}
  check(condition(),`${label}: player ${game.playerPosition.toArray()} cargo ${game.cargo.position.toArray()}`);
 }
 async function look(point){
  stop();const target=new THREE.Vector3(...array(point));
  for(let n=0;n<240;n++){
   game.scene.updateMatrixWorld(true);
   if(target.clone().sub(game.camera.position).dot(game.camera.getWorldDirection(new THREE.Vector3()))<0){game.yaw+=.18;await frame();continue;}
   const ndc=target.clone().project(game.camera);
   if(n>20&&Math.abs(ndc.x)<.015&&Math.abs(ndc.y)<.015)return;
   game.yaw-=THREE.MathUtils.clamp(ndc.x,-1,1)*.22;
   game.pitch=THREE.MathUtils.clamp(game.pitch+THREE.MathUtils.clamp(ndc.y,-1,1)*.19,-1.15,1.15);
   await frame();
  }
  check(false,`Could not aim at ${array(point)}`);
 }
 async function shoot(action){
  check(!game.heldCube,'The route must put the companion down before firing');
  await look(action.aim??action.target);
  check(game.firePortal(action.slot??0),'The portal shot input was rejected');
  report.shots++;report.inputEvents.push({type:'shoot',slot:action.slot??0,...snapshot()});
  await until(()=>!game.portalShots.queue.length&&!game.portalShots.active.length,3,'Portal charge unresolved');
  check(game.portalShots.lastImpact?.valid,`Portal shot missed: ${JSON.stringify(game.portalShots.lastImpact)}`);
 }
 async function interact(kind){
  stop();check(game.interact(),`Tower ${kind} interaction failed at ${game.playerPosition.toArray()}`);
  report.interactions++;report.inputEvents.push({type:kind,...snapshot()});
  if(kind==='drop')check(!game.heldCube,'The companion was not placed');
  if(kind==='pickup')check(game.heldCube,'The original companion was not recovered');
  await wait(.2,kind);
 }
 async function recoverCompanion(stage){
  // A released rigid body can roll or be carried by a field. Follow its live
  // position with ordinary controls; an authored pickup marker is only a cue.
  for(let attempt=0;attempt<4&&!game.heldCube;attempt++){
   const cargo=game.cargo.position,hand=game.playerPosition.clone().addScaledVector(UP,1.1);
   if(hand.distanceTo(cargo)>1.65){
    await walk([cargo.x,game.playerPosition.y,cargo.z],{label:`${stage.id}: recover companion`,tolerance:1.05,sprint:false,timeout:20});
   }
   if(game.playerPosition.clone().addScaledVector(UP,1.1).distanceTo(game.cargo.position)<2.2){
    await interact('pickup');return;
   }
   await wait(.65,'companion settling');
  }
  check(game.heldCube,`Could not reach the original companion in ${stage.id}`);
 }
 async function perform(action,stage){
  const label=`${stage.id}: ${action.kind}`;
  switch(action.kind){
   case 'walk':await walk(action.target,{label,tolerance:action.tolerance??.20,sprint:action.sprint!==false,timeout:action.timeout??35});break;
   case 'jump':
    if(action.target)await walk(action.target,{label,tolerance:.23});
    check(game.playerGrounded,`Jump takeoff was not grounded at ${label}`);
    game.input.jumpQueued=true;report.jumps++;report.inputEvents.push({type:'jump',...snapshot()});
    await frame();break;
   case 'shoot':await shoot(action);break;
   case 'pickup':await recoverCompanion(stage);break;
   case 'drop':case 'use':await interact(action.kind);break;
   case 'wait':await wait(action.seconds??.2,label);break;
   case 'until':await until(()=>{
    const state=stage.keystoneDeck==null?level.getTowerStageState(stage.index):level.getTowerKeystoneState(stage.keystoneDeck);
    return state?.[action.field]===action.value;
   },action.seconds??4,label);break;
   case 'enter':{
    const before=game.teleportCount,normal=new THREE.Vector3(...action.normal);
    const approach=new THREE.Vector3(...array(action.target)).addScaledVector(normal,action.standoff??1.35);
    await walk(approach,{label,tolerance:action.tolerance??.3});
    for(let n=0;n<(action.seconds??4)*60&&game.teleportCount===before;n++){
     worldMove(-normal.x,-normal.z);await frame();
    }
    stop();check(game.teleportCount>before,`Portal crossing failed at ${label}`);break;
   }
   default:throw new Error(`Unknown Tower route action ${action.kind} in ${stage.id}`);
  }
 }
 try{
  report.telemetry.push({...snapshot(),input:[0,0],sprint:false,grounded:game.playerGrounded,yaw:game.y,pitch:game.pitch,speed:0});
  const decks=[...new Set(stages.map(stage=>stage.deck))].sort((a,b)=>a-b);
  if(!game.heldCube)await interact('pickup');
  mark('The final Tower begins at its ordinary bottom spawn');
  for(const deck of decks){
   for(const branch of branchOrder){
    const stage=stages.find(stage=>stage.deck===deck&&stage.branch===branch);
    check(stage,`Missing Tower wing ${deck}/${branch}`);
    for(const action of stage.route)await perform(action,stage);
    check(level.getTowerStageState(stage.index)?.solved,`Wing ${stage.id} route did not solve its physical puzzle`);
    check(level.completedStages===report.stageEvents.length,`Wing ${stage.id} did not produce one completion event`);
    mark(`Solved ${stage.name} through live controls`);
    await globalThis.__NESI_TOWER_FLUSH_FRAMES__?.(snapshot());
   }
   check(Array.isArray(level.keystoneRoutes?.[deck])&&level.keystoneRoutes[deck].length>0,
    `Deck ${deck+1} needs a substantial central keystone route`);
   const keystone={id:`keystone-${deck+1}`,keystoneDeck:deck,index:stages.length+deck,name:`Deck ${deck+1} keystone`};
   for(const action of level.keystoneRoutes[deck])await perform(action,keystone);
   const state=level.getTowerKeystoneState?.(deck),event=level.getTowerMetrics?.().keystoneEvents?.at(-1);
   check(state?.solved&&event?.deck===deck,`Deck ${deck+1} keystone was not physically solved`);
   report.keystoneEvents.push({...event,...snapshot()});
   mark(`Deck ${deck+1} keystone solved`);
   if(stopAfterDeck===deck){report.partial=true;break;}
   mark(`Deck ${deck+1} relays connected`);
   for(const action of level.deckRoutes?.[deck]??[])await perform(action,{id:`deck-${deck+1}`,index:stages.length,name:'Deck transition'});
   if(stopAfterTransitionDeck===deck){report.partial=true;break;}
  }
  if(!report.partial){
   for(const action of level.finalRoute??[])await perform(action,{id:'crown',index:stages.length,name:'Crown'});
   check(game.state==='won','The physical crown did not admit both travellers');
  }
  report.simulatedSeconds=report.physicsSteps*DT;report.durationSeconds=report.simulatedSeconds;
  report.distance=report.distanceTravelled;report.teleports=game.teleportCount-initialTeleports;
  report.gameElapsedSeconds=(game.elapsed-initialElapsed)/1000;
  report.tower=level.getTowerMetrics?.();
  if(!report.partial){
   check(report.stageEvents.length===stages.length,'A wing was omitted from the uninterrupted route');
   check(report.keystoneEvents.length===decks.length,'A central keystone was omitted from the uninterrupted route');
   check(report.teleports>0&&report.shots>0,'The redesigned Tower route must use real portals');
   check(report.activeInputSeconds>=900,'The complete Tower speedrun must contain at least fifteen minutes of active play');
   check(report.maxNoInputSeconds<=5,'The Tower route contains an AFK segment');
   check(Math.abs(report.gameElapsedSeconds-report.simulatedSeconds)<.02,'The Tower simulation clock diverged');
   report.pass=true;mark('Every Tower wing and the crown completed in one attempt');
  }
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
