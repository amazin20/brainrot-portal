import * as THREE from 'three';
import {runSingularityJourney} from './LabSingularityJourney.js';
import {orientedBoxSupport} from './LabOrientedBoxContact.js';

const V=(...p)=>new THREE.Vector3(...p),UP=V(0,1,0);
const angle=x=>Math.atan2(Math.sin(x),Math.cos(x));
const check=(ok,message)=>{if(!ok)throw new Error(message);};
const vec=v=>[v.x,v.y,v.z];
const quat=q=>[q.x,q.y,q.z,q.w];
const dot=(a,b)=>a.reduce((s,x,i)=>s+x*b[i],0),sub=(a,b)=>a.map((x,i)=>x-b[i]);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
function rotate(p,q){const u=q.slice(0,3),t=cross(u,p).map(x=>2*x),c=cross(u,t);return p.map((x,i)=>x+q[3]*t[i]+c[i]);}
function multiply(a,b){return [a[3]*b[0]+a[0]*b[3]+a[1]*b[2]-a[2]*b[1],a[3]*b[1]-a[0]*b[2]+a[1]*b[3]+a[2]*b[0],a[3]*b[2]+a[0]*b[1]-a[1]*b[0]+a[2]*b[3],a[3]*b[3]-a[0]*b[0]-a[1]*b[1]-a[2]*b[2]];}
// Read the true compound Cannon shape transforms, including body and shape
// orientation. These observations never write a measured pose or velocity.
export function actualBox(body,index){
 const shape=body.shapes[index];if(!shape?.halfExtents)return null;
 const bq=quat(body.quaternion),q=multiply(bq,quat(body.shapeOrientations[index])),offset=rotate(vec(body.shapeOffsets[index]),bq);
 return {body:body.id,shape:shape.id,index,centre:vec(body.position).map((x,i)=>x+offset[i]),half:vec(shape.halfExtents),quaternion:q,axes:[[1,0,0],[0,1,0],[0,0,1]].map(a=>rotate(a,q))};
}
const extent=(box,n)=>box.half.reduce((s,h,i)=>s+h*Math.abs(dot(box.axes[i],n)),0);
export function boxSeparation(a,b){
 let gap=-Infinity,axis;const delta=sub(b.centre,a.centre),axes=[...a.axes,...b.axes];
 for(const x of a.axes)for(const y of b.axes){const c=cross(x,y),length=Math.hypot(...c);if(length>1e-8)axes.push(c.map(n=>n/length));}
 for(const n of axes){const d=Math.abs(dot(delta,n))-extent(a,n)-extent(b,n);if(d>gap){gap=d;axis=n;}}
 return {gap,penetration:Math.max(0,-gap),axis};
}
function carryTarget(physics){const t=physics.carryTarget;return t?{position:vec(t.position),velocity:vec(t.velocity),quaternion:quat(t.quaternion),age:t.age}:null;}
export function observeLoad(d,event){
 const {game:g,cell,originalBody:body,originalCargo:cargo}=d,cargoBox=actualBox(body,0),tray=actualBox(cell.rack,0);
 return {event,frame:d.report.frames,step:g.physics.world.stepnumber,player:g.playerPosition.toArray(),playerVelocity:g.playerVelocity.toArray(),held:g.heldCube===cargo,bodyPosition:vec(body.position),bodyVelocity:vec(body.velocity),bodySpeed:body.velocity.length(),bodyAngularVelocity:vec(body.angularVelocity),bodyAngularSpeed:body.angularVelocity.length(),bodyQuaternion:quat(body.quaternion),carryTarget:carryTarget(g.physics),cargoBox,cargoMinY:cargoBox.centre[1]-extent(cargoBox,[0,1,0]),trayMaxY:tray.centre[1]+extent(tray,[0,1,0]),traySAT:boxSeparation(cargoBox,tray),guards:cell.stops.shapes.map((shape,index)=>{const guard=actualBox(cell.stops,index);return guard?{body:cell.stops.id,shape:shape.id,index,name:cell.stopParts[index].mesh.name,...boxSeparation(cargoBox,guard)}:null;}).filter(Boolean)};
}

function loadingPositions(d){
 const tray=actualBox(d.cell.rack,0),spheres=d.game.physics.playerProxy?.body.shapes.filter(s=>Number.isFinite(s.radius))??[];
 const radius=spheres[0]?.radius??.43,front=tray.centre[2]+extent(tray,[0,0,1]);
 return {loader:[d.cell.centre.x,d.cell.centre.y,front+radius+.02],clear:[d.cell.centre.x,d.cell.centre.y,front+radius+1.02]};
}

/** A qualification route through the production controller and original cargo.
 * Mechanism and actor poses are observations only. Freight preparation uses its
 * existing ordinary-input route; the local scenario has its own 120 Hz driver
 * because the Singularity branch of runV8Journey does not dispatch scenarios. */
export async function runTower41RatchetCellJourney(game,{scenario=runTower41RatchetQualification,onFrame,onMilestone,onPhysicsTick,prepare=true}={}){
 const level=game.firstLevel,cell=level?.ratchetCell;
 check(level?.singularity&&cell&&game.state==='playing','Start the opt-in Tower41 ratchet qualification through Play');
 check(typeof scenario==='function','An explicit cell input scenario is required');
 const originalCargo=game.cargo,originalBody=game.physics.cargoBody,originalPlayer=game.playerPosition;
 const report={kind:'tower41-ratchet-production-inputs',frames:0,physicsTicks:0,seconds:0,jumps:0,interactions:0,resets:0,respawns:0,cargoResets:0,mechanismResets:0,cargoTransfers:[],actions:[],milestones:[],phases:[],maxPenetration:0,sameCargo:true};
 const identity=()=>check(game.cargo===originalCargo&&game.physics.cargoBody===originalBody&&game.playerPosition===originalPlayer,'An original actor reference changed');
 if(prepare){
  report.preparation=await runSingularityJourney(game,{order:['freight'],stopAfter:'freight'});
  identity();
  check(report.preparation.sameCompanion&&!report.preparation.resets&&!report.preparation.respawns&&!report.preparation.cargoResets,'Freight preparation changed or reset the original cargo');
 }
 cell.ensure();
 const world=game.physics.world,nativeMove=game.input.mobileMove instanceof THREE.Vector2,move=nativeMove?game.input.mobileMove:new THREE.Vector2(),teleportsBefore=game.teleportCount;
 report.inputSurface=nativeMove?'production InputController mobileMove and keys':'headless input-vector fixture';
 const original={move:game.input.getMove,reset:game.resetRun,respawn:game.respawn,cargoReset:game.physics.resetCargo,teleportCargo:game.physics.teleportCargo,cellReset:cell.reset};
 let currentPhase=null,pendingContacts=[],tickObserver=null;
 const snapshot=()=>({frame:report.frames,step:world.stepnumber,player:game.playerPosition.toArray(),playerVelocity:game.playerVelocity.toArray(),grounded:game.playerGrounded,yaw:game.yaw,facing:game.facing,cargo:vec(originalBody.position),cargoVelocity:vec(originalBody.velocity),cargoAngularVelocity:vec(originalBody.angularVelocity),cargoQuaternion:quat(originalBody.quaternion),carryTarget:carryTarget(game.physics),held:game.heldCube===originalCargo,cell:cell.diagnostics()});
 function phase(name){
  if(currentPhase)currentPhase.end=snapshot();
  currentPhase={name,ticks:0,start:snapshot(),contacts:[],maxPenetration:0,dynamicBodies:{},player:{minFootY:game.playerPosition.y,maxFootY:game.playerPosition.y,airborneTicks:0,fallingTicks:0,landings:0,wasGrounded:game.playerGrounded}};
  report.phases.push(currentPhase);
 }
 // Contact offsets belong to the preintegration poses. Capture their world
 // points after solve in preStep, then pair them with the completed postStep.
 function preStep(){
  pendingContacts=[];
  for(const c of world.contacts){
   if(!(c.bi.mass>0||c.bj.mass>0))continue;
   const a=c.bi.position.vadd(c.ri),b=c.bj.position.vadd(c.rj),normal=vec(c.ni);
   const gap=b.vsub(a).dot(c.ni),penetration=Math.max(0,-gap);
   check([...vec(a),...vec(b),...normal,gap,c.multiplier].every(Number.isFinite),'Nonfinite actual contact sample');
   check(Math.abs(c.ni.length()-1)<1e-6,'A contact normal is not unit length');
   const rackSign=c.bi===cell.rack?-1:c.bj===cell.rack?1:0;
   pendingContacts.push({step:world.stepnumber+1,bodyA:c.bi.id,bodyB:c.bj.id,shapeA:c.si?.id,shapeB:c.sj?.id,shapeTypeA:c.si?.constructor.name,shapeTypeB:c.sj?.constructor.name,pointA:vec(a),pointB:vec(b),normal,gap,penetration,multiplier:c.multiplier,normalImpulse:Math.max(0,c.multiplier)/120,verticalImpulseOnRack:rackSign*c.ni.y*c.multiplier/120,held:game.heldCube===originalCargo});
  }
 }
 function postStep(){
  report.physicsTicks++;
  if(!currentPhase)return;
  currentPhase.ticks++;
  const player=currentPhase.player;
  player.minFootY=Math.min(player.minFootY,game.playerPosition.y);player.maxFootY=Math.max(player.maxFootY,game.playerPosition.y);
  if(!game.playerGrounded){player.airborneTicks++;if(game.playerVelocity.y<-.2)player.fallingTicks++;}
  if(game.playerGrounded&&!player.wasGrounded)player.landings++;
  player.wasGrounded=game.playerGrounded;
  for(const b of world.bodies){
   if(!(b.mass>0))continue;
   const row=currentPhase.dynamicBodies[b.id]??={id:b.id,mass:b.mass,min:vec(b.position),max:vec(b.position),maxSpeed:0,maxAngularSpeed:0};
   const p=vec(b.position);for(let i=0;i<3;i++){row.min[i]=Math.min(row.min[i],p[i]);row.max[i]=Math.max(row.max[i],p[i]);}
   row.maxSpeed=Math.max(row.maxSpeed,b.velocity.length());row.maxAngularSpeed=Math.max(row.maxAngularSpeed,b.angularVelocity.length());
  }
  const seen=new Set();
  for(const c of pendingContacts){
   const key=[c.bodyA,c.bodyB,c.shapeA,c.shapeB].join(':');
   let row=currentPhase.contacts.find(a=>a.key===key);
   if(!row){row={key,bodyA:c.bodyA,bodyB:c.bodyB,shapeA:c.shapeA,shapeB:c.shapeB,shapeTypeA:c.shapeTypeA,shapeTypeB:c.shapeTypeB,contactTicks:0,freeCargoTicks:0,heldCargoTicks:0,heldPositiveContactTicks:0,equations:0,maxPenetration:0,maxAbsMultiplier:0,normalImpulse:0,verticalImpulseOnRack:0,samples:[]};currentPhase.contacts.push(row);}
   if(!seen.has(key)){row.contactTicks++;if(c.bodyA===originalBody.id||c.bodyB===originalBody.id){if(c.held)row.heldCargoTicks++;else row.freeCargoTicks++;}seen.add(key);}
   row.equations++;row.maxPenetration=Math.max(row.maxPenetration,c.penetration);row.maxAbsMultiplier=Math.max(row.maxAbsMultiplier,Math.abs(c.multiplier));
   row.normalImpulse+=c.normalImpulse;row.verticalImpulseOnRack+=c.verticalImpulseOnRack;
   const positiveKey=key+':positive';if(c.held&&c.multiplier>1e-7&&!seen.has(positiveKey)){row.heldPositiveContactTicks++;seen.add(positiveKey);}
   if(row.samples.length<8)row.samples.push(c);
   row.lastStep=c.step;row.lastSample=c;
   currentPhase.maxPenetration=Math.max(currentPhase.maxPenetration,c.penetration);report.maxPenetration=Math.max(report.maxPenetration,c.penetration);
  }
 }
 if(!nativeMove)game.input.getMove=()=>move.clone();
 game.resetRun=function(...args){report.resets++;return original.reset.apply(this,args);};
 game.respawn=function(...args){report.respawns++;return original.respawn.apply(this,args);};
 game.physics.resetCargo=function(...args){report.cargoResets++;return original.cargoReset.apply(this,args);};
 cell.reset=function(...args){report.mechanismResets++;return original.cellReset.apply(this,args);};
 game.physics.teleportCargo=function(...args){const from=vec(originalBody.position),held=game.heldCube===originalCargo,value=original.teleportCargo.apply(this,args);report.cargoTransfers.push({from,to:vec(originalBody.position),held,step:world.stepnumber});return value;};
 world.addEventListener('preStep',preStep);world.addEventListener('postStep',postStep);
 function stop(){move.set(0,0);game.input.keys.clear();}
 function worldMove(x,z){const p=V(x,0,z).applyAxisAngle(UP,-game.yaw);move.set(p.x,p.z);}
 function turn(dx,dz){const desired=Math.atan2(-dx,-dz);game.yaw+=THREE.MathUtils.clamp(angle(desired-game.yaw),-.065,.065);game.pitch+=THREE.MathUtils.clamp(-.14-game.pitch,-.025,.025);}
 async function frame(){
  for(let i=0;i<2;i++){check(game.state==='playing','The local cell attempt stopped playing');game.updatePlaying(1/120);identity();check(!report.resets&&!report.respawns&&!report.cargoResets&&!report.mechanismResets,'The measured local cell route reset');tickObserver?.(snapshot(),game);onPhysicsTick?.(snapshot(),game);}
  game.updateVisuals(1/60,1);report.frames++;
  if(onFrame)await onFrame(snapshot(),game);
  if(report.frames%120===0&&typeof window!=='undefined'&&typeof window.requestAnimationFrame==='function')await new Promise(resolve=>setTimeout(resolve,0));
 }
 async function wait(seconds){stop();for(let i=0;i<Math.ceil(seconds*60);i++)await frame();}
 async function until(predicate,seconds,label){stop();for(let i=0;i<Math.ceil(seconds*60);i++){if(predicate())return;await frame();}check(predicate(),label+': '+JSON.stringify(snapshot()));}
 async function walk(p,{sprint=true,tolerance=.16,timeout=50,followFloor=false}={}){
  p=p.toArray?.()??p;report.actions.push({kind:'walk',target:p,frame:report.frames});let best=Infinity,stuck=0;
  for(let i=0;i<timeout*60;i++){
   const dx=p[0]-game.playerPosition.x,dz=p[2]-game.playerPosition.z,d=Math.hypot(dx,dz);
   if(d<tolerance&&(followFloor||Math.abs(p[1]-game.playerPosition.y)<.65)){stop();return;}
   if(d<best-.003){best=d;stuck=0;}else stuck++;
   check(stuck<260,'Blocked walking to '+p+' at '+game.playerPosition.toArray());turn(dx,dz);
   if(sprint)game.input.keys.add('ShiftLeft');else game.input.keys.delete('ShiftLeft');
   const speed=d<.65?Math.max(.16,d/.65):1;worldMove(dx/Math.max(d,.001)*speed,dz/Math.max(d,.001)*speed);await frame();
  }throw new Error('Walk timed out '+p);
 }
 async function look(p){
  stop();p=V(...(p.toArray?.()??p));
  for(let i=0;i<300;i++){
   game.scene.updateMatrixWorld(true);
   if(p.clone().sub(game.camera.position).dot(game.camera.getWorldDirection(V()))<0){game.yaw+=.16;await frame();continue;}
   const q=p.clone().project(game.camera),tolerance=Math.min(.005,.035/Math.max(1,p.distanceTo(game.camera.position)));
   if(i>20&&Math.abs(q.x)<tolerance&&Math.abs(q.y)<tolerance)return;
   game.yaw-=THREE.MathUtils.clamp(q.x,-1,1)*.21;game.pitch=THREE.MathUtils.clamp(game.pitch+THREE.MathUtils.clamp(q.y,-1,1)*.19,-1.15,1.15);await frame();
  }throw new Error('Cannot aim at '+p.toArray());
 }
 async function interact(){const before=Boolean(game.heldCube);game.interactQueued=true;report.interactions++;report.actions.push({kind:'E',beforeHeld:before,frame:report.frames});await frame();return Boolean(game.heldCube)!==before;}
 async function pickup(){
  for(let i=0;i<4&&!game.heldCube;i++){
   const p=game.cargo.position;
   if(game.playerPosition.clone().add(V(0,1.1,0)).distanceTo(p)>1.9)await walk([p.x,game.playerPosition.y,p.z+1.1],{sprint:false});
   await interact();if(game.heldCube===originalCargo){await wait(.35);return;}await wait(.35);
  }check(false,'Could not pick up the original cargo: '+JSON.stringify(snapshot()));
 }
 async function jump(){check(game.playerGrounded,'Jump requires actual grounded feet');game.input.jumpQueued=true;report.jumps++;report.actions.push({kind:'jump',frame:report.frames});await frame();}
 function mark(name){const m={name,...snapshot()};report.milestones.push(m);onMilestone?.(m,game);}
 try{
  phase('ordinary approach');await pickup();
  // Hoist's supported west corridor starts on the east gallery (x14).
  // The direct x0→door chord at z-39 crosses the actual atrium void.
  for(const p of [[0,0,54],[0,0,39],[14,0,39],[14,0,-39],[27,0,-39],[27,0,-50]])await walk(p);
  mark('At lower hoist bay with original cargo');
  const driver={game,level,cell,report,originalCargo,originalBody,frame,wait,until,walk,look,jump,interact,pickup,worldMove,stop,phase,mark,snapshot,check,setTickObserver(observer){check(observer==null||typeof observer==='function','A tick observer must be a function');tickObserver=observer;}};
  await scenario(driver);
  if(currentPhase)currentPhase.end=snapshot();
  report.seconds=report.physicsTicks/120;report.teleports=game.teleportCount-teleportsBefore;report.sameCargo=game.cargo===originalCargo&&game.physics.cargoBody===originalBody;report.final=snapshot();report.pass=true;
  return report;
 }catch(error){report.seconds=report.physicsTicks/120;report.failure={message:String(error),...snapshot()};if(currentPhase)currentPhase.end=snapshot();error.ratchetInputReport=report;throw error;}
 finally{
  stop();world.removeEventListener('preStep',preStep);world.removeEventListener('postStep',postStep);
  game.input.getMove=original.move;game.resetRun=original.reset;game.respawn=original.respawn;game.physics.resetCargo=original.cargoReset;game.physics.teleportCargo=original.teleportCargo;
  cell.reset=original.cellReset;report.observersRestored=true;
 }
}

/** The causal cycle uses two bounded loads so the second load can reach a
 * later retaining shoulder. E and normal walking remove the physical cargo;
 * no completion state or stored notch is used as the retention witness. */
export async function runTower41RatchetCellCycle(d){
 const {game:g,cell,originalCargo:cargo,originalBody:body}=d;
 const centre=cell.centre,{loader,clear}=loadingPositions(d);
 const travel=()=>cell.diagnostics().rack.travel;
 await d.walk([centre.x-3,centre.y,clear[2]],{sprint:false});
 await d.walk(clear,{sprint:false});
 d.phase('held clearance');await d.wait(.7);d.mark('Held original cargo clears the mechanism');
 async function load(name,target){
  d.phase(name);await d.walk(loader,{sprint:false,tolerance:.04});await d.wait(.35);
  const loading={name,trace:[],neutralFrames:2,maxWaitSeconds:.75,maxReleaseSpeed:.15,maxReleaseAngularSpeed:.15,minTrayClearance:.015};
  (d.report.loads??=[]).push(loading);
  const world=g.physics.world,nativeRelease=g.physics.release,postStep=()=>loading.trace.push(observeLoad(d,'postStep'));
  // E preserves the production body's momentum. Wait for the real held
  // endpoint to settle after it clears the tray, before queueing that E.
  g.physics.release=function(...args){loading.release={before:observeLoad(d,'before native release')};const result=nativeRelease.apply(this,args);loading.release.after=observeLoad(d,'after native release');return result;};
  world.addEventListener('postStep',postStep);
  try{
   await d.jump();let stable=0;
   await d.until(()=>{
    const s=observeLoad(d,'neutral release predicate');
    const neutral=s.bodySpeed<.15&&s.bodyAngularSpeed<.15&&s.cargoMinY>s.trayMaxY+.015&&body.position.z<loader[2]-.5&&Math.abs(body.position.x-centre.x)<.3&&s.guards.every(a=>a.gap>=0);
    stable=neutral?stable+1:0;loading.neutralWindow=neutral?[...(loading.neutralWindow??[]),s].slice(-2):[];return stable>=2;
   },.75,'The ordinary held jump did not reach a physically neutral release window');
   d.check(g.heldCube===cargo,'The original cargo must remain held before E loading');
   loading.beforeQueuedE=observeLoad(d,'before queued E');d.mark(name+' neutral before queued E');
   d.check(await d.interact()&&!g.heldCube,'Ordinary E did not release the original cargo');d.mark(name+' released');
   loading.afterTwoFreeTicks=observeLoad(d,'after two free ticks');
  }finally{world.removeEventListener('postStep',postStep);g.physics.release=nativeRelease;}
  await d.until(()=>travel()>target,5,'The original free cargo did not drive the rack to '+target);d.mark(name+' reached bounded travel');
  const p=d.report.phases.at(-1),guardShapes=new Set(cell.stops.shapes.map(s=>s.id));
  const guards=p.contacts.filter(c=>c.freeCargoTicks>0&&((c.bodyA===body.id&&c.bodyB===cell.stops.id&&guardShapes.has(c.shapeB))||(c.bodyB===body.id&&c.bodyA===cell.stops.id&&guardShapes.has(c.shapeA))));
  const roofShape=cell.stops.shapes.find((s,i)=>cell.stopParts[i].half.y===.125&&cell.stopParts[i].offset.y===2.925)?.id;
  loading.actualFreeContacts={fixedGuardMaxPenetration:Math.max(0,...guards.map(c=>c.maxPenetration)),roofMaxPenetration:Math.max(0,...guards.filter(c=>c.shapeA===roofShape||c.shapeB===roofShape).map(c=>c.maxPenetration)),fixedGuardContactTicksSummedAcrossShapes:guards.reduce((n,c)=>n+c.freeCargoTicks,0),roofShape};
  loading.historicalFirstLoad={fixedGuardMaxPenetration:.06580568874243653,roofMaxPenetration:.03537794054309452,sourceJourney:'98ea91ae7742ec22127b2609536e367fae9f4ccce154efa9a00d41d81670b27f',limitation:'Historical released milestone followed two free ticks and omitted quaternion and carry target; exact historical pre-E overlap is unknown.'};
 }
 async function unload(name){
  d.phase(name);d.check(await d.interact()&&g.heldCube===cargo,'Ordinary external E could not unload the original cargo');
  await d.walk(clear,{sprint:false,tolerance:.06});await d.wait(3);d.mark(name+' settled');
 }
 await load('first free load',.4);await unload('first E unload and retention');
 const firstRetention=travel();d.check(firstRetention>.12&&Math.abs(cell.rack.velocity.y)<.02,'The first unload did not retain a real nonzero stroke');
 await load('same body reload',.65);await unload('second E unload and retention');
 const secondRetention=travel();d.check(secondRetention>firstRetention+.15&&Math.abs(cell.rack.velocity.y)<.02,'Reload did not retain a later physical shoulder');
 d.report.retention={first:firstRetention,second:secondRetention};
 d.phase('local fall and floor E recovery');
 await d.walk([centre.x,centre.y,clear[2]+.85],{sprint:false});await d.wait(.3);
 d.check(await d.interact()&&!g.heldCube,'Ordinary E did not release cargo above the nearby real floor');
 d.mark('Original cargo released above real floor');await d.jump();
 await d.until(()=>g.playerGrounded&&body.position.y<centre.y+.65&&Math.abs(body.velocity.y)<.15,3,'The real local fall did not land on the existing floor');
 await d.pickup();d.mark('Recovered the same cargo through floor E');
}

/** One bounded servo-pressure probe after the ordinary two-load cycle.
 * Holding the original cargo throughout is part of the observed attack.
 * Real contact or retained advancement is a finding, not a presumed failure. */
export async function runTower41RatchetHeldPressure(d){
 const {game:g,cell,originalCargo:cargo,originalBody:body}=d,centre=cell.centre;
 const startTravel=cell.diagnostics().rack.travel,actionsStart=d.report.actions.length;
 d.phase('bounded held pressure attack');
 const keepHeld=()=>d.check(g.heldCube===cargo,'The held-pressure probe unexpectedly released the original cargo');
 keepHeld();await d.walk(loadingPositions(d).loader,{sprint:false,tolerance:.04});await d.wait(.35);
 await d.jump();
 await d.until(()=>g.playerPosition.y>centre.y+.9,.75,'The ordinary held-pressure jump was not reached');keepHeld();
 async function press(label,x,z,frames){
  d.report.actions.push({kind:'held-pressure-input',label,worldMove:[x,z],frames,frame:d.report.frames});
  g.input.keys.delete('ShiftLeft');
  for(let i=0;i<frames;i++){d.worldMove(x,z);await d.frame();keepHeld();}
  d.stop();
 }
 await press('slow north pressure during jump and descent',0,-.35,24);
 await d.until(()=>g.playerGrounded,2,'The held-pressure jump did not return to the real floor');keepHeld();
 await press('held left turn at the real mouth',-.35,0,6);
 await press('held right turn at the real mouth',.35,0,6);
 await d.walk(loadingPositions(d).clear,{sprint:false,tolerance:.06});await d.wait(3);keepHeld();
 const endTravel=cell.diagnostics().rack.travel,p=d.report.phases.at(-1);
 const contacts=p.contacts.filter(c=>(c.bodyA===body.id&&c.bodyB===cell.rack.id)||(c.bodyB===body.id&&c.bodyA===cell.rack.id));
 const heldTicks=contacts.reduce((n,c)=>n+c.heldCargoTicks,0),freeTicks=contacts.reduce((n,c)=>n+c.freeCargoTicks,0),motion=p.dynamicBodies[cell.rack.id];
 d.report.heldPressure={status:heldTicks?'CONTACT_OBSERVED':'NOTREACHED/OPEN',startRetainedTravel:startTravel,endRetainedTravel:endTravel,retainedAdvance:endTravel-startTravel,minRackTravel:cell.rackOrigin.y-motion.max[1],maxRackTravel:cell.rackOrigin.y-motion.min[1],heldContactTicksSummedAcrossShapes:heldTicks,freeContactTicksSummedAcrossShapes:freeTicks,maxRawPenetration:p.maxPenetration,maxCargoRackPenetration:Math.max(0,...contacts.map(c=>c.maxPenetration)),heldThroughout:true,EReleases:0,attemptedInputs:d.report.actions.slice(actionsStart),limitation:'This one ordinary held approach/jump/descent/turn probe does not close general servo or boarding bypasses.'};
 d.mark('Bounded held pressure probe finished with original cargo held');
}

/** Reach the genuine top face with the ordinary jump/hand endpoint. Forces
 * come exclusively from Cannon equations, never from an overlap counter. */
export async function runTower41RatchetHeldContact(d){
 const {game:g,cell,originalBody:body,originalCargo:cargo}=d,c=cell.centre;
 d.check(g.heldCube===cargo,'Held-contact approach requires the original cargo');
 await d.walk(loadingPositions(d).clear,{sprint:false,tolerance:.06});
 d.phase('actual held top-face pressure');
 const start=cell.diagnostics().rack.travel,actionStart=d.report.actions.length;
 await d.walk(loadingPositions(d).loader,{sprint:false,tolerance:.04});await d.wait(.35);
 d.stop();await d.jump();
 for(let i=0;i<64;i++){d.stop();await d.frame();d.check(g.heldCube===cargo,'Pressure silently released the original cargo');}
 d.stop();await d.wait(.5);
 const p=d.report.phases.at(-1),tray=cell.rack.shapes[0].id;
 const contacts=p.contacts.filter(x=>((x.bodyA===body.id&&x.bodyB===cell.rack.id&&x.shapeB===tray)||(x.bodyB===body.id&&x.bodyA===cell.rack.id&&x.shapeA===tray))&&x.heldPositiveContactTicks>0);
 const actualHeldPositiveContactTicks=contacts.reduce((n,x)=>n+x.heldPositiveContactTicks,0),normalImpulse=contacts.reduce((n,x)=>n+x.normalImpulse,0),verticalImpulseOnRack=contacts.reduce((n,x)=>n+x.verticalImpulseOnRack,0);
 d.check(actualHeldPositiveContactTicks>0&&normalImpulse>1e-6&&verticalImpulseOnRack< -1e-6,'The real held top face was not physically loaded');
 d.mark('Actual held top-face contact and downward impulse');
 await d.walk(loadingPositions(d).clear,{sprint:false,tolerance:.06});await d.wait(3);
 const end=cell.diagnostics().rack.travel;
 d.report.heldContact={status:'CONTACT_OBSERVED',passedBoundedContact:true,actualHeldPositiveContactTicks,normalImpulse,verticalImpulseOnRack,startRetainedTravel:start,endRetainedTravel:end,retainedAdvance:end-start,maxCargoRackPenetration:Math.max(0,...contacts.map(x=>x.maxPenetration)),heldThroughout:g.heldCube===cargo,ECommands:d.report.actions.slice(actionStart).filter(x=>x.kind==='E').length,actualCargoBodyId:body.id,actualRackBodyId:cell.rack.id,actualTrayShapeId:tray,fullServoResistanceAccepted:false,limitation:'One real top-face approach, jump, pressure and withdrawal; retained advancement is measured, not assumed absent.'};
 d.check(d.report.heldContact.heldThroughout&&d.report.heldContact.ECommands===0,'The held-contact window changed grip through E');
 d.mark('Held top-face pressure withdrawn and physical retention observed');
}

/** Release during the ordinary jump, without a neutral-momentum wait. E must
 * preserve the actual body; post-production CCD observations are separate
 * from the earlier Cannon preintegration contact-force samples. */
export async function runTower41RatchetFastRelease(d){
 const {game:g,cell,originalCargo:cargo,originalBody:body}=d,c=cell.centre;
 if(g.heldCube!==cargo)await d.pickup();
 await d.walk(loadingPositions(d).loader,{sprint:false,tolerance:.04});await d.wait(.35);
 d.phase('ordinary early E and fixed compound guard sweep');
 g.input.keys.add('ShiftLeft');d.worldMove(0,-1);await d.jump();
 await d.until(()=>g.playerPosition.y>c.y+.9,.75,'Early-E ordinary jump was not reached');
 const release={before:null,after:null},native=g.physics.release,beforeCorrections=g.physics.compoundCargoSweepCorrections??0;
 const postPhysicsTrace=[],sweepEvents=[];let lastStep=g.physics.world.stepnumber,maxGuardPenetration=0,budgetFallbackTicks=0,velocityConstraintFallbackTicks=0,speedCapAdmissibilityCorrections=0;
 d.setTickObserver(()=>{
  const sample=observeLoad(d,'after production physics tick and compound CCD');d.check(sample.step===lastStep+1,'The early-E trace skipped a real fixed step');lastStep=sample.step;
  maxGuardPenetration=Math.max(maxGuardPenetration,0,...sample.guards.map(x=>x.penetration));postPhysicsTrace.push(sample);
  const swept=g.physics.lastCompoundCargoSweep;
  if(swept){
   d.check(swept.worldStep===sample.step,'Compound CCD observations must belong to this actual production step');
   sample.compoundSweep={worldStep:swept.worldStep,correctionCount:swept.corrections.length,maxResidualPenetration:swept.maxResidualPenetration,budgetFallback:Boolean(swept.budgetFallback),velocityConstraintFallback:Boolean(swept.velocityConstraintFallback),speedCapAdmissibilityCorrections:swept.speedCapAdmissibilityCorrections??0,cannonContactEquationsAdded:swept.cannonContactEquationsAdded};
   budgetFallbackTicks+=Number(Boolean(swept.budgetFallback));velocityConstraintFallbackTicks+=Number(Boolean(swept.velocityConstraintFallback));speedCapAdmissibilityCorrections+=swept.speedCapAdmissibilityCorrections??0;
   for(const event of swept.corrections)sweepEvents.push(event);
  }
 });
 g.physics.release=function(...args){release.before=observeLoad(d,'before actual early E');const value=native.apply(this,args);release.after=observeLoad(d,'after actual early E');return value;};
 try{d.check(await d.interact()&&g.heldCube!==cargo,'Early E did not release the original cargo');}finally{g.physics.release=native;}
 for(const key of ['bodyPosition','bodyQuaternion','bodyVelocity','bodyAngularVelocity'])d.check(JSON.stringify(release.before[key])===JSON.stringify(release.after[key]),'E changed native '+key);
 d.check(release.after.carryTarget===null,'E did not remove the held endpoint');
 try{for(let i=0;i<61;i++){d.stop();await d.frame();}}finally{d.setTickObserver(null);}
 const p=d.report.phases.at(-1),guards=p.contacts.filter(x=>x.freeCargoTicks>0&&((x.bodyA===body.id&&x.bodyB===cell.stops.id)||(x.bodyB===body.id&&x.bodyA===cell.stops.id)));
 d.check(maxGuardPenetration<.002,'Early E left the actual full cargo box inside a registered fixed guard');
 d.report.fastRelease={pass:true,release,releaseSpeed:release.before.bodySpeed,ccdCorrections:(g.physics.compoundCargoSweepCorrections??0)-beforeCorrections,sweepEvents,postPhysicsTrace,maxGuardPenetration,budgetFallbackTicks,velocityConstraintFallbackTicks,speedCapAdmissibilityCorrections,all124PostProductionTicksObserved:postPhysicsTrace.length===124,actualCannonGuardContactTicks:guards.reduce((n,x)=>n+x.freeCargoTicks,0),maxCannonPreintegrationGuardPenetration:Math.max(0,...guards.map(x=>x.maxPenetration)),cannonAndCCDObservationsDistinct:true,fullHighSpeedEnvelopeAccepted:false};
 d.mark('Early E preserves momentum and the full box remains outside fixed guards');
 await d.pickup();await d.walk(loadingPositions(d).clear,{sprint:false,tolerance:.06});await d.wait(.5);
}

/** A physical jump onto/against the moving tray and ordinary withdrawal.
 * Capsule support and mechanism progress remain real observations. */
export async function runTower41RatchetBoarding(d){
 const {game:g,cell,originalCargo:cargo}=d,c=cell.centre;
 if(g.heldCube!==cargo)await d.pickup();
 await d.walk(loadingPositions(d).loader,{sprint:false,tolerance:.04});await d.wait(.35);
 d.phase('ordinary tray boarding and withdrawal');const before=d.level.getTowerMetrics().solvedIds.slice(),startTravel=cell.diagnostics().rack.travel,samples=[];
 g.input.keys.add('ShiftLeft');d.worldMove(0,-1);await d.jump();
 for(let i=0;i<80;i++){
  d.worldMove(0,-1);await d.frame();const sample=d.snapshot(),support=orientedBoxSupport(cell.rackParts[0].collider.orientedBox,g.playerPosition.x,g.playerPosition.z,g.playerPosition.y+.02);
  sample.actualTraySupport=support?{height:support.height,normal:support.normal.toArray(),bodyId:cell.rack.id,shapeId:cell.rack.shapes[0].id}:null;
  sample.boarded=Boolean(g.playerGrounded&&g.playerPosition.y>c.y+.1&&support&&Math.abs(g.playerPosition.y-support.height)<.015&&support.normal.y>.5);
  samples.push(sample);d.check(g.heldCube===cargo,'Boarding changed the original grip');
 }
 d.stop();await d.wait(.5);await d.walk(loadingPositions(d).clear,{sprint:false,tolerance:.06});await d.wait(2);
 const after=d.level.getTowerMetrics().solvedIds.slice();
 d.check(JSON.stringify(before)===JSON.stringify(after),'A local boarding attempt completed an unrelated castle mechanism');
 const actualBoardedSamples=samples.filter(x=>x.boarded).length;
 d.check(actualBoardedSamples>0,'The ordinary boarding route did not stand on the actual moving tray');
 d.report.boarding={pass:true,attemptOutcome:actualBoardedSamples?'ACTUAL_TRAY_BOARDING_OBSERVED':'NOTREACHED/OPEN',actualBoardedSamples,heldThroughout:g.heldCube===cargo,actualGroundedSamples:samples.filter(x=>x.grounded).length,maxFootY:Math.max(...samples.map(x=>x.player[1])),minFootY:Math.min(...samples.map(x=>x.player[1])),startRetainedTravel:startTravel,endRetainedTravel:cell.diagnostics().rack.travel,completedMechanismsBefore:before,completedMechanismsAfter:after,samples,fullBoardingResistanceAccepted:false};
 d.mark('Original actors withdraw from the local boarding attempt');
}

export async function runTower41RatchetQualification(d){
 await runTower41RatchetCellCycle(d);
 await runTower41RatchetHeldContact(d);
 await runTower41RatchetFastRelease(d);
 await runTower41RatchetBoarding(d);
}
