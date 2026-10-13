/** Browser/Node shared controller. Only ordinary movement, view, jump, portal
 * charge and E APIs supply input. The frozen production runRoom25 is injected;
 * this controller never calls a fixture reset or assigns an actor/mechanism pose.
 * Scheduling/rendering are controlled by the outer diagnostic recorder. */
export async function runRoom25NativeDriver(game,{runProductionJourney,onFrame=()=>{},onMilestone=()=>{},maxPhysicsSteps=36000}={}){
 const check=(ok,message)=>{if(!ok)throw Error('Room25 native driver: '+message);};
 check(typeof runProductionJourney==='function','exact production journey export required');
 check(Number.isSafeInteger(maxPhysicsSteps)&&maxPhysicsSteps>=24000&&maxPhysicsSteps<=36000,'bounded actual physics budget required');
 check(game.state==='playing'&&game.levelIndex===24&&game.chamberEdition==='foundation'&&game.firstLevel.id==='opposed-shadows','normal Foundation25 Play required');
 const level=game.firstLevel,m=level.state.optical.machine,o=level.state.optical,world=game.physics.world;
 const refs={cargo:game.cargo,body:game.physics.cargoBody,shape:game.physics.cargoBody.shapes[0],player:game.playerGroup,visual:game.playerVisual,weapon:game.weapon,physics:game.physics};
 const start=world.stepnumber,forceStart=m.diagnostics().forceCount,spawn=level.spawn.toArray?.()??level.spawn;
 check(Math.hypot(...game.playerPosition.toArray().map((n,i)=>n-spawn[i]))<1e-8,'normal untouched Play spawn required');
 check(!game.portals.ready,'normal Play must start without placed portals');
 const Vector=game.playerPosition.constructor,Move=game.input.getMove().constructor,V=(x=0,y=0,z=0)=>new Vector(x,y,z),move=new Move();
 const old={move:game.input.getMove,reset:game.resetRun,respawn:game.respawn,cargoReset:game.physics.resetCargo,levelReset:level.reset,machineReset:m.reset,interact:game.interact};
 const route={kind:'room25-required-ordinary-input-diagnostic-route',edition:'foundation',level:25,index:24,id:level.id,pass:false,complete:false,frames:0,physicsSteps:0,seconds:0,
  bodyId:refs.body.id,shapeId:refs.shape.id,cargoUuid:refs.cargo.group.uuid,cargoMass:3.2,resets:0,respawns:0,cargoResets:0,levelResets:0,machineResets:0,shots:0,interactions:0,jumpInputs:0,milestones:[],actions:[],
  suppliedInputs:'ordinary production movement vector, yaw/pitch view, jump queue, firePortal and interact E; real production runRoom25 imported',
  productionAccepted:false,sourceCiAccepted:false,nativeAccepted:false,publicationAccepted:false,fullRoomAccepted:false,humanAccepted:false,allBypassesAccepted:false};
 const stats={postSteps:0,forceSamples:0,identityChecks:0,lastWorldStep:start,forceCountStart:forceStart,forceCountFinish:forceStart,
  minHeight:0,maxHeight:0,maxCargoY:refs.body.position.y,loadedContactSteps:0,positiveMotorForceSteps:0,motorOffDescendingSteps:0,
  firstReceiverSteps:0,secondReceiverSteps:0,movingMirrorReflectionSteps:0,maxForceBalanceY:0,maxForceBalanceZ:0,maxMotorPower:0,maxMotorForce:0,maxDampingPower:0,
  externalMotorWorkStart:m.diagnostics().motorWork,externalMotorWorkFinish:m.diagnostics().motorWork,activeShutterRackWorkFinish:m.diagnostics().rackWork,
  twoLegacyPassengerLiftsKinematic:true,passiveShutterTransmissionClaimed:false};
 let visual=0,lastState=null;
 const identity=()=>{
  check(game.cargo===refs.cargo&&game.physics===refs.physics&&game.physics.cargoBody===refs.body&&game.playerGroup===refs.player&&game.playerVisual===refs.visual&&game.weapon===refs.weapon,'original actor/controller references changed');
  const b=refs.body;check(b.world===world&&world.bodies.includes(b)&&b.mass===3.2&&b.type===1&&b.shapes.length===1&&b.shapes[0]===refs.shape&&['x','y','z'].every(k=>refs.shape.halfExtents[k]===.39),'original dynamic .78m cargo shape/mass/ownership changed');
  check(route.resets+route.respawns+route.cargoResets+route.levelResets+route.machineResets===0,'route reset detected');stats.identityChecks++;
 };
 const snapshot=()=>{
  identity();const d=m.diagnostics(),f=d.lastForce;return {visualFrame:visual,physicsSteps:world.stepnumber-start,worldStep:world.stepnumber,seconds:(world.stepnumber-start)/120,state:game.state,
   edition:game.chamberEdition,level:game.levelIndex+1,id:level.id,player:game.playerPosition.toArray(),cargo:refs.body.position.toArray(),cargoQuaternion:refs.body.quaternion.toArray(),cargoBodyId:refs.body.id,cargoShapeId:refs.shape.id,cargoMass:refs.body.mass,cargoDynamic:refs.body.type===1,held:Boolean(game.heldCube),
   freight:{height:m.height,velocity:m.velocity,deckY:m.deckBody.position.y,loaded:m.loaded,normalLoad:m.normalLoad,pressureFraction:m.pressureFraction,motorEnabled:m.motorEnabled,motorLit:o.motorLit,motorWork:d.motorWork,rackWork:d.rackWork,forceCount:d.forceCount,lastForce:f},
   optics:{receivers:[...o.receivers],mirror:{position:o.movingMirror.position.toArray(),normal:o.movingMirror.normal.toArray()},motorReceiver:o.motorReceiver.toArray(),segments:o.segments.map(s=>({a:s.a.toArray(),b:s.b.toArray(),kind:s.kind}))},
   passengerLifts:{firstY:level.state['shadow-lift'].position.y,secondY:level.state['relay-lift'].position.y,implementation:'retained legacy kinematic opticalLift'},resetCounts:{resets:route.resets,respawns:route.respawns,cargoResets:route.cargoResets,levelResets:route.levelResets,machineResets:route.machineResets}};
 };
 const observed=()=>{
  identity();check(world.stepnumber===stats.lastWorldStep+1,'actual postStep clock skipped');stats.lastWorldStep=world.stepnumber;stats.postSteps++;
  check(stats.postSteps<=maxPhysicsSteps,'actual physics budget exhausted; no silent truncation');const d=m.diagnostics(),f=d.lastForce;
  check(f&&f.worldStep===world.stepnumber-1&&f.dt===1/120,'current force record must belong to this actual120Hz step');
  check(d.forceCount-forceStart===stats.postSteps,'exactly one force application per actual physics step required');stats.forceSamples++;stats.forceCountFinish=d.forceCount;
  check(Number.isFinite(f.motorForce)&&f.motorForce>=0&&f.motorForce<=m.budget.motorForce+1e-8,'finite actual external motor force required');
  check(Number.isFinite(f.motorPower)&&f.motorPower<=m.budget.motorPower+1e-8,'finite actual external motor power required');
  check(Number.isFinite(f.forceBalanceY)&&Number.isFinite(f.forceBalanceZ)&&Math.abs(f.forceBalanceY)<1e-8&&Math.abs(f.forceBalanceZ)<1e-8,'actual founded force balance failed');
  check(f.foundedVelocity.every(v=>v===0),'founded reaction must not claim external movement');
  check([f.deckDampingPower,f.carriageDampingPower,f.rackDampingPower].every(p=>Number.isFinite(p)&&p<=1e-8),'passive dampers supplied positive work');
  if(!f.motorLit)check(f.motorForce===0,'unlit actual mirror supplied motor force');
  check(Math.abs(f.mirror.position[1]-(f.carriageY+3.96))<1e-9,'actual moving mirror lost its carriage transform');
  stats.minHeight=Math.min(stats.minHeight,m.height);stats.maxHeight=Math.max(stats.maxHeight,m.height);stats.maxCargoY=Math.max(stats.maxCargoY,refs.body.position.y);
  if(m.loaded){check(m.loadStep===world.stepnumber&&m.normalLoad>0,'positive current original-load contact required');stats.loadedContactSteps++;}
  if(f.motorForce>0)stats.positiveMotorForceSteps++;if(!f.motorLit&&m.velocity<-.2)stats.motorOffDescendingSteps++;
  if(o.receivers[0])stats.firstReceiverSteps++;if(o.receivers[1])stats.secondReceiverSteps++;
  if(f.raySegments.some(s=>s.kind==='mirror'&&Math.hypot(...s.b.map((v,i)=>v-f.mirror.position[i]))<.46))stats.movingMirrorReflectionSteps++;
  stats.maxForceBalanceY=Math.max(stats.maxForceBalanceY,Math.abs(f.forceBalanceY));stats.maxForceBalanceZ=Math.max(stats.maxForceBalanceZ,Math.abs(f.forceBalanceZ));
  stats.maxMotorPower=Math.max(stats.maxMotorPower,f.motorPower);stats.maxMotorForce=Math.max(stats.maxMotorForce,f.motorForce);stats.maxDampingPower=Math.max(stats.maxDampingPower,f.deckDampingPower,f.carriageDampingPower,f.rackDampingPower);
 };
 game.interact=function(...a){route.interactions++;const wasHeld=Boolean(game.heldCube),motorBefore=m.motorEnabled,result=old.interact.apply(this,a);route.actions.push({kind:'ordinary-E',worldStep:world.stepnumber,wasHeld,held:Boolean(game.heldCube),motorBefore,motorAfter:m.motorEnabled,accepted:result,player:game.playerPosition.toArray()});return result;};
 game.input.getMove=()=>move.clone();game.resetRun=function(...a){route.resets++;return old.reset.apply(this,a);};game.respawn=function(...a){route.respawns++;return old.respawn.apply(this,a);};game.physics.resetCargo=function(...a){route.cargoResets++;return old.cargoReset.apply(this,a);};level.reset=function(...a){route.levelResets++;return old.levelReset.apply(this,a);};m.reset=function(...a){route.machineResets++;return old.machineReset.apply(this,a);};world.addEventListener('postStep',observed);
 function emit(){lastState=snapshot();const result=onFrame(lastState);check(!result?.then,'frame observer must be synchronous; recorder drains its explicit FIFO separately');route.frames++;}
 function frame(){if(game.input.jumpQueued)route.jumpInputs++;const before=world.stepnumber;if(game.state==='playing'){game.updatePlaying(1/120);if(game.state==='playing')game.updatePlaying(1/120);}game.updateVisuals(1/60,1);visual++;check(world.stepnumber-before>=1&&world.stepnumber-before<=2,'ordinary visual frame requires one or two actual120Hz steps');emit();}
 function stop(){move.set(0,0);game.input.keys.clear();}
 function worldMove(x,z){const v=V(x,0,z).applyAxisAngle(V(0,1,0),-game.yaw);move.set(v.x,v.z);}
 function wait(seconds){stop();for(let n=0;n<Math.ceil(seconds*60)&&game.state==='playing';n++)frame();}
 function until(condition,seconds,label){stop();for(let n=0;n<seconds*60&&!condition();n++){check(game.state==='playing',label+' before actual won');frame();}check(condition(),label+': '+game.playerPosition.toArray()+' / friend '+game.cargo.position.toArray());}
 function walk(x,z,seconds=20){const target=V(x,0,z);let best=Infinity,stuck=0;for(let n=0;n<seconds*60&&game.state==='playing';n++){const delta=target.clone().sub(game.playerPosition);delta.y=0;const distance=delta.length();if(distance<.11){stop();return;}if(distance<best-.012){best=distance;stuck=0;}else stuck++;delta.normalize().multiplyScalar(Math.min(1,distance*1.5));worldMove(delta.x,delta.z);frame();check(stuck<=420,'blocked ordinary walk to '+x+','+z);}stop();check(game.state==='won'||Math.hypot(game.playerPosition.x-x,game.playerPosition.z-z)<.3,'ordinary walk timed out');}
 function look(point){stop();for(let n=0;n<240;n++){game.scene.updateMatrixWorld(true);if(point.clone().sub(game.camera.position).dot(game.camera.getWorldDirection(V()))<0){game.yaw+=.18;frame();continue;}const ndc=point.clone().project(game.camera);if(n>20&&Math.abs(ndc.x)<.001&&Math.abs(ndc.y)<.001)break;game.yaw-=Math.max(-1,Math.min(1,ndc.x))*.22;game.pitch=Math.max(-1.15,Math.min(1.15,game.pitch+Math.max(-1,Math.min(1,ndc.y))*.19));frame();}}
 function aim(index,point){look(point);check(game.firePortal(index),'ordinary portal input rejected');route.shots++;until(()=>!game.portalShots.queue.length&&!game.portalShots.active.length,2,'actual portal charge did not resolve');check(game.portalShots.lastImpact?.valid,'actual portal impact rejected '+JSON.stringify(game.portalShots.lastImpact));route.actions.push({kind:'portal-charge',index,point:point.toArray(),worldStep:world.stepnumber,impact:{...game.portalShots.lastImpact}});}
 function pickup(){check(game.interact()&&game.heldCube===refs.cargo,'ordinary pickup failed');wait(.55);}
 function mark(name){const record={name,...snapshot()};route.milestones.push(record);onMilestone(record);}
 function enter(patch,seconds=4){const f=patch.getFrame(),before=game.teleportCount;walk(f.center.x+f.normal.x*1.35,f.center.z+f.normal.z*1.35);for(let n=0;n<seconds*60&&game.teleportCount===before;n++){worldMove(-f.normal.x,-f.normal.z);frame();}stop();check(game.teleportCount>before,'actual ordinary portal traversal failed');wait(.6);}
 try{
  emit();wait(.5);await runProductionJourney({game,level,walk,wait,aim,look,until,pickup,enter,mark,frame,worldMove,stop},{order:'weight-first',interruptFreightLight:true,interruptLight:false});
  check(game.state==='won'&&game.heldCube===refs.cargo,'full original-companion route must actually win');
  check(stats.maxHeight>8.95&&stats.loadedContactSteps>100&&stats.positiveMotorForceSteps>100&&stats.movingMirrorReflectionSteps>100,'real original-loaded mirror ascent missing');
  check(stats.motorOffDescendingSteps>20,'real optical cut and gravity return missing');
  check(stats.firstReceiverSteps>100&&stats.secondReceiverSteps>100,'both actual legacy passenger circuits required');
  const names=route.milestones.map(r=>r.name);for(const name of ['retargeted portal removes current freight mirror supply and gravity returns the original support','ordinary lower-floor portal restores light and raises the same original load','first optical receiver raised the loaded counterweight onto a physical balcony','balcony retrieval reverses both linked shadows without a cargo portal','reverse overlook reveals the starting room'])check(names.filter(n=>n===name).length===1,'complete actual milestone missing: '+name);
  route.physicsSteps=world.stepnumber-start;route.seconds=route.physicsSteps/120;route.teleports=game.teleportCount;route.postStepStart=start;route.postStepFinish=world.stepnumber;route.lastVisualFrame=visual;route.firstStatePhysicsSteps=0;route.lastState=lastState;
  const d=m.diagnostics();stats.externalMotorWorkFinish=d.motorWork;stats.activeShutterRackWorkFinish=d.rackWork;
  check(stats.postSteps===route.physicsSteps&&stats.forceSamples===route.physicsSteps,'full actual clock and force counts required');
  check(route.physicsSteps===visual*2||route.physicsSteps===visual*2-1,'actual visual/physics clock relation required');
  route.observed=stats;route.pass=route.complete=true;return route;
 }catch(error){route.physicsSteps=world.stepnumber-start;route.seconds=route.physicsSteps/120;route.lastVisualFrame=visual;route.lastState=lastState;route.observed=stats;error.room25DiagnosticRoute=route;throw error;}
 finally{world.removeEventListener('postStep',observed);stop();game.input.getMove=old.move;game.resetRun=old.reset;game.respawn=old.respawn;game.physics.resetCargo=old.cargoReset;level.reset=old.levelReset;m.reset=old.machineReset;game.interact=old.interact;}
}
