import * as THREE from 'three';
import {capsuleBoxContact} from './LabOrientedBoxContact.js';
import {runPuzzleProgression50} from './LabPuzzleProgression50Journey.js';

const V=(...p)=>new THREE.Vector3(...p),R=.43,H=2.4;
const check=(ok,message)=>{if(!ok)throw Error(message);};

// Independent observation oracle: minimize the convex point-to-solid-box
// distance along the capsule's central segment in the *actual Cannon shape*
// frame. This deliberately does not call the controller's closest-pair code.
function realShapeDistance(foot,body,index){
 const inverse=new THREE.Quaternion().copy(body.quaternion).invert(),center=V().copy(body.shapeOffsets[index]).applyQuaternion(new THREE.Quaternion().copy(body.quaternion)).add(body.position);
 const a=foot.clone().add(V(0,R,0)).sub(center).applyQuaternion(inverse),b=foot.clone().add(V(0,H-R,0)).sub(center).applyQuaternion(inverse),half=body.shapes[index].halfExtents;
 const at=t=>{const p=a.clone().lerp(b,t);return Math.hypot(Math.max(0,Math.abs(p.x)-half.x),Math.max(0,Math.abs(p.y)-half.y),Math.max(0,Math.abs(p.z)-half.z));};
 let lo=0,hi=1;for(let n=0;n<60;n++){const left=(2*lo+hi)/3,right=(lo+2*hi)/3;if(at(left)<at(right))hi=right;else lo=left;}
 return Math.min(at(0),at(1),at((lo+hi)/2));
}

/** Observe the real controller immediately after it resolves the player and
 * before Cannon advances. Only public walk/run/jump/E inputs drive this route.
 * Some projected centre/tip approaches cannot reach the beam; report those
 * limits rather than turning an obstructed approach into contact coverage. */
export function runPuzzleProgression50BeamJourney(d){
 const {game:g,level:l}=d,r=l.rotor;
 check(l.puzzleProgression50,'Beam probes require the actual folded rift');
 const cargo=g.cargo,body=g.physics.cargoBody,player=g.playerGroup;
 const report={pass:false,phases:[],contacts:[],emptyWedges:[],cargoTransfers:[],identity:{cargo:cargo.group.uuid,cargoBody:body.id,player:player.uuid},
  minAngle:Infinity,maxAngle:-Infinity,samples:0,deepestBeamOverlap:0,fakeBeamGrounding:0,dividerOverlaps:0,independentShapeChecks:0,
  loadedA:false,loadedB:false,actualFalls:0,recoveries:0,heldReleaseAndRegrab:false,
  caveats:['Service floor and projected centre approaches are below the beams; they prove clear movement/recovery, not contact with an unreachable face.',
   'The west front casing and A freight lintel obstruct the west centre approach.',
   'Finite ordinary-input attempts do not establish that every beam boarding route or puzzle bypass is closed.']};
 let phase=null,stationary=false,previousFoot=g.playerPosition.clone();
 const begin=(name,details={})=>{phase={name,...details,samples:0,heldSamples:0,freeSamples:0,minAngle:Infinity,maxAngle:-Infinity,
  beams:r.parts.map(c=>({name:c.mesh.name,minDistance:Infinity,nearFrames:0,touchingFrames:0,emptyAabbFrames:0,stationaryMovingEmptyAabbFrames:0,stoppedInputMovingNearFrames:0,stationaryStartMovingNearFrames:0,stationaryMovingNearFrames:0})),start:g.playerPosition.toArray()};report.phases.push(phase);};
 const sample=(beforeFoot,beforeSpeed)=>{
  check(g.cargo===cargo&&g.physics.cargoBody===body&&g.playerGroup===player,'An input-only beam probe replaced an original actor');
  if(!phase)return;report.samples++;phase.samples++;phase[g.heldCube?'heldSamples':'freeSamples']++;
  const q=r.body.quaternion,angle=Math.atan2(2*(q.w*q.z+q.x*q.y),1-2*(q.y*q.y+q.z*q.z));
  phase.minAngle=Math.min(phase.minAngle,angle);phase.maxAngle=Math.max(phase.maxAngle,angle);report.minAngle=Math.min(report.minAngle,angle);report.maxAngle=Math.max(report.maxAngle,angle);
  const foot=g.playerPosition,displacement=foot.distanceTo(previousFoot),capsuleBounds=new THREE.Box3(V(foot.x-R,foot.y,foot.z-R),V(foot.x+R,foot.y+H,foot.z+R));previousFoot.copy(foot);
  if(foot.y+H<13&&foot.z>-24.55&&foot.z<9.55&&Math.abs(foot.x)<.4+R-.025)report.dividerOverlaps++;
  r.parts.forEach((c,index)=>{
   const box=c.orientedBox;check(box?.body===r.body,'The production beam must opt in to its existing real Cannon shape');
   check(box.step===g.physics.world.stepnumber,'Beam contact history did not correspond to the current physics step');
   check(box.half.distanceTo(V().copy(r.body.shapes[index].halfExtents))<1e-8&&box.offset.distanceTo(V().copy(r.body.shapeOffsets[index]))<1e-8,'Beam observation changed the actual original shape');
   const hit=capsuleBoxContact(foot,R,H,box),row=phase.beams[index];
   check(Number.isFinite(hit.distance)&&hit.normal.toArray().every(Number.isFinite),'Beam observation produced invalid contact geometry');
   check(Math.abs(hit.normal.length()-1)<1e-6,'An actual beam contact normal was not a world unit vector');
   row.minDistance=Math.min(row.minDistance,hit.distance);report.deepestBeamOverlap=Math.max(report.deepestBeamOverlap,hit.depth);
   const emptyWedge=capsuleBounds.intersectsBox(c.box)&&hit.distance>R+.08;
   if(emptyWedge){
    row.emptyAabbFrames++;if(stationary&&beforeSpeed<.01&&Math.abs(r.body.angularVelocity.z)>.02)row.stationaryMovingEmptyAabbFrames++;
    if(report.emptyWedges.length<40&&!report.emptyWedges.some(x=>x.phase===phase.name&&x.beam===index&&Math.abs(x.angle-angle)<.02)){
     const independent=realShapeDistance(foot,r.body,index);report.independentShapeChecks++;
     check(Math.abs(independent-hit.distance)<1e-6,'The actual empty AABB witness disagreed with the independent real-shape observation');
     report.emptyWedges.push({phase:phase.name,beam:index,angle,omega:r.body.angularVelocity.z,foot:foot.toArray(),held:g.heldCube===cargo,distance:hit.distance,independentDistance:independent,aabbMin:c.box.min.toArray(),aabbMax:c.box.max.toArray(),stoppedInput:stationary,prePlayerSpeed:beforeSpeed,physicsStep:box.step});
    }
   }
   if((emptyWedge&&phase.samples%30===0)||hit.distance<R+.025&&phase.samples%12===0){
    const independent=realShapeDistance(foot,r.body,index);report.independentShapeChecks++;
    check(Math.abs(independent-hit.distance)<1e-6,'Production beam distance disagreed with the independent actual-Cannon-shape observation');
   }
   if(g.playerGrounded&&Math.abs(foot.y-c.box.max.y)<.015&&hit.distance>R+.08)report.fakeBeamGrounding++;
   if(hit.distance<R+.025){
    row.nearFrames++;
    if(hit.distance<=R+.0005)row.touchingFrames++;
    if(stationary&&Math.abs(r.body.angularVelocity.z)>.02){row.stoppedInputMovingNearFrames++;if(beforeSpeed<.01)row.stationaryStartMovingNearFrames++;if(displacement<1e-5&&g.playerVelocity.length()<.01)row.stationaryMovingNearFrames++;}
    if(report.contacts.length<100&&!report.contacts.some(x=>x.phase===phase.name&&x.beam===index&&Math.abs(x.angle-angle)<.04))
     report.contacts.push({phase:phase.name,beam:index,angle,omega:r.body.angularVelocity.z,foot:foot.toArray(),cargo:g.cargo.position.toArray(),
      held:g.heldCube===cargo,grounded:g.playerGrounded,distance:hit.distance,independentDistance:realShapeDistance(foot,r.body,index),depth:hit.depth,point:hit.point.toArray(),normal:hit.normal.toArray(),physicsStep:box.step,stoppedInput:stationary,playerDisplacement:displacement,playerSpeed:g.playerVelocity.length(),prePlayerSpeed:beforeSpeed,prePlayerFoot:beforeFoot.toArray(),previousBeamDistance:capsuleBoxContact(beforeFoot,R,H,box,box.previous).distance});
   }
  });
 };
 const updatePlayer=g.updatePlayer;
 g.updatePlayer=function(dt){const before=this.playerPosition.clone(),speed=this.playerVelocity.length(),value=updatePlayer.call(this,dt);sample(before,speed);return value;};
 const teleportCargo=g.physics.teleportCargo;
 g.physics.teleportCargo=function(...args){
  const from=body.position.toArray(),held=g.heldCube===cargo,value=teleportCargo.apply(this,args);
  report.cargoTransfers.push({held,body:body.id,from,to:body.position.toArray(),physicsStep:this.world.stepnumber});return value;
 };
 const move=(x,z,{frames=120,jump=false,jumpWhen=null,sprint=true}={})=>{
  let jumped=false;
  for(let n=0;n<frames;n++){
   const delta=V(x-g.playerPosition.x,0,z-g.playerPosition.z),distance=delta.length();
   if(distance<.14){d.stop();return true;}
   if(!jumped&&(jump&&n===0||jumpWhen?.())){g.input.jumpQueued=true;jumped=true;}
   if(sprint)g.input.keys.add('ShiftLeft');
   const pace=Math.min(1,distance*2);delta.normalize().multiplyScalar(pace);d.worldMove(delta.x,delta.z);d.frame();
  }d.stop();return Math.hypot(g.playerPosition.x-x,g.playerPosition.z-z)<.3;
 };
 const hold=frames=>{d.stop();stationary=true;try{for(let n=0;n<frames;n++)d.frame();}finally{stationary=false;}};
 const land=()=>d.until(()=>g.playerGrounded,6,'Ordinary beam attempt did not land on a real surface');
 const recoverLoaded=(side)=>{
  land();if(g.playerPosition.y>-3.8)return;
  report.actualFalls++;begin(`${side.toUpperCase()} loaded real fall and dry ramp recovery`);
  d.walk(side==='a'?-12:4.85,-28);d.walk(-39.2,-28);d.walk(-39.2,20);d.walk(-30,25);
  d.enter(l.departureEntry);d.until(()=>g.playerGrounded&&g.playerPosition.y>6.08&&g.playerPosition.y<6.5,6,'Real loaded pane failed to recover its gallery after the fall');
  report.recoveries++;d.walk(side==='a'?-12:12,-7);
 };
 const galleryB=()=>{
  begin('B loaded east stop-arm tip ordinary empty-handed sprint and jump');
  // The real rebound freight hood blocks x12 near z-3.4 in the loaded
  // pose. Walk around its outer side on the existing gallery.
  d.walk(17,-7);d.walk(17,8);d.walk(8,8);
  // A normal run-up keeps the jump causal and avoids asking a stationary
  // capsule to cover the entire unsupported gallery gap in one leap.
  move(.86,8,{frames:120,jumpWhen:()=>g.playerGrounded&&g.playerPosition.x<4.85});hold(12);recoverLoaded('b');
  if(g.playerPosition.y>6&&g.playerPosition.z>0){d.walk(17,8);d.walk(17,-7);d.walk(12,-7);}
  check(r.loaded('b')&&!g.heldCube,'The original B contact must remain the cause of the loaded pose');
 };
 const recoverFreeCargo=()=>{
  const snapshot=()=>({step:g.physics.world.stepnumber,player:g.playerPosition.toArray(),hand:g.playerPosition.clone().add(V(0,1.1,0)).toArray(),
   cargo:cargo.position.toArray(),bodyPosition:body.position.toArray(),velocity:body.velocity.toArray(),angularVelocity:body.angularVelocity.toArray(),
   body:body.id,mass:body.mass,held:g.heldCube===cargo});
  const recovery=report.freeCargoRecovery={status:'tracking',frameBudget:600,frames:0,standoff:1.35,attemptDistance:2.1,
   initial:snapshot(),current:null,minHandDistance:Infinity,minHorizontalDistance:Infinity,lineOfSightChecks:0,blockedChecks:0,nativeEAttempts:[],observations:[]};
  const ray=new THREE.Raycaster(),side=V();d.stop();
  for(let frame=0;frame<recovery.frameBudget;frame++){
   check(g.cargo===cargo&&g.physics.cargoBody===body,'Free cargo recovery replaced the original body');
   const hand=g.playerPosition.clone().add(V(0,1.1,0)),delta=cargo.position.clone().sub(hand),distance=delta.length();
   const horizontal=Math.hypot(g.playerPosition.x-cargo.position.x,g.playerPosition.z-cargo.position.z);
   recovery.current=snapshot();recovery.minHandDistance=Math.min(recovery.minHandDistance,distance);recovery.minHorizontalDistance=Math.min(recovery.minHorizontalDistance,horizontal);
   if(frame%12===0)recovery.observations.push({...recovery.current,frame,handDistance:distance});
   if(distance<=2.25){
    // Observe the same hand-to-body blocker rule as native E with a separate
    // raycaster. Camera framing never substitutes the interaction ray.
    g.scene.updateMatrixWorld(true);ray.set(hand,delta.clone().normalize());ray.far=Math.max(0,distance-.1);
    const blockers=ray.intersectObjects(g.cameraBlockers,true).filter(hit=>hit.distance<distance-.1&&g.isActiveBlocker(hit.object));
    recovery.lineOfSightChecks++;if(blockers.length)recovery.blockedChecks++;
    recovery.lastLineOfSight={frame,step:g.physics.world.stepnumber,distance,clear:blockers.length===0,
     blockers:blockers.slice(0,4).map(hit=>({name:hit.object.name,id:hit.object.uuid,distance:hit.distance}))};
    if(distance<=recovery.attemptDistance&&!blockers.length){
     const attempt={frame,...recovery.current,handDistance:distance,lineOfSight:recovery.lastLineOfSight};
     attempt.nativeReturned=g.interact();attempt.originalHeld=g.heldCube===cargo;recovery.nativeEAttempts.push(attempt);
     if(attempt.originalHeld){
      d.stop();d.wait(.55);recovery.status='recovered';recovery.current=snapshot();
      recovery.physicsSteps=recovery.current.step-recovery.initial.step;recovery.seconds=recovery.physicsSteps/120;
      recovery.settleFrames=Math.ceil(.55*60);return;
     }
    }
   }
   // Follow the LIVE body from the player's current side. A fixed south-side
   // target can walk through and push a free companion before the E attempt.
   side.set(g.playerPosition.x-cargo.position.x,0,g.playerPosition.z-cargo.position.z);
   if(side.lengthSq()<1e-8)side.set(0,0,1);else side.normalize();
   const target=cargo.position.clone().addScaledVector(side,recovery.standoff),moveDelta=target.sub(g.playerPosition);moveDelta.y=0;
   const remaining=moveDelta.length(),pace=Math.min(1,remaining*1.5);
   if(remaining>.01){moveDelta.multiplyScalar(pace/remaining);d.worldMove(moveDelta.x,moveDelta.z);}else d.stop();
   d.frame();recovery.frames++;
  }
  d.stop();recovery.status='not-recovered';recovery.current=snapshot();recovery.physicsSteps=recovery.current.step-recovery.initial.step;recovery.seconds=recovery.physicsSteps/120;
  check(false,'Bounded ordinary live-cargo approach did not recover the same original body: '+JSON.stringify(recovery.current));
 };
 const returnB=()=>{
  check(g.heldCube===cargo,'B beam return must start with genuine outside E extraction');
  begin('B return physical cup clearance to main-beam moving tip, held');
  const corridorX=4.85;move(corridorX,-5.7,{frames:60});
  d.until(()=>r.cups[1].colliders[1].box.min.x>corridorX+R+.04,4,'The actual returning B wall did not open the east approach corridor');
  move(corridorX,0,{frames:120});hold(36);
  begin('B return main-beam empty diagonal AABB witness with original held cargo');
  move(g.playerPosition.x,1.2,{frames:90});move(corridorX,1.2,{frames:90});
  d.until(()=>r.angle>-.95,4,'The real spring did not reach the observed main-beam diagonal clearance window');
  move(corridorX,0,{frames:90});hold(36);
  begin('B return main-beam held sprint and ordinary jump');move(6.7,0,{frames:45,jump:true});land();move(corridorX,0,{frames:90});
  // E releases the same body onto the actual gallery, clear of B and of the
  // final feed. The return continues under its real spring while we run free.
  begin('B return original cargo released inside the east gallery for empty-handed probe');move(6.1,0,{frames:60});hold(12);
  check(cargo.position.x>4.9&&cargo.position.y>6.3,'The original held body must actually be inside the gallery before ordinary E release');
  check(g.interact()&&!g.heldCube,'Ordinary E failed to release the original body');
  begin('B return late stop-arm walking approach without held cargo', {windowCoverage:'Measured from actual angles; this late approach may miss the diagonal wedge window.'});
  d.walk(corridorX,7);d.walk(corridorX,8);hold(24);land();
  phase.reachedStopArmZ=Math.abs(g.playerPosition.z-8)<.3;phase.finish=g.playerPosition.toArray();
  check(g.playerPosition.y>6,'The stop-arm empty wedge probe must retain its real east-gallery floor');
  begin('B return recover same free original cargo with ordinary E');
  recoverFreeCargo();report.heldReleaseAndRegrab=true;d.walk(12,-7);
 };
 const mark=d.mark,until=d.until;
 const driver={...d,mark(name){
  mark(name);
  if(name.startsWith('Original free weight'))report.loadedA=r.loaded('a')&&r.angle>1.48;
  else if(name.startsWith('The same cargo'))report.loadedB=r.loaded('b')&&r.angle< -1.48;
  else if(name.startsWith('Opposite service view'))galleryB();
  else if(name.startsWith('Both original'))begin('Ordinary final joint victory');
 },until(condition,seconds,label){
  if(label==='Removing opposite cargo did not return and settle the actual common frame and both suspended cups')returnB();
  return until(condition,seconds,label);
 }};
 try{
  begin('Ordinary original-cargo setup and A physical loading');runPuzzleProgression50(driver);
  check(g.state==='won'&&g.heldCube===cargo,'The causal beam attempts must still complete the ordinary original-actor joint route');
  check(report.cargoTransfers.filter(c=>!c.held).length===2,'Beam attempts must preserve exactly the two original free freight deliveries');
  check(report.cargoTransfers.every(c=>c.body===body.id),'A portal replaced the original cargo body');
  check(report.loadedA&&report.loadedB,'Both loaded poses must be caused by real original-cargo contacts');
  check(report.fakeBeamGrounding===0,'The controller grounded on a beam AABB instead of a true face');
  check(report.dividerOverlaps===0,'A beam response pushed the player through the real central divider');
  check(report.deepestBeamOverlap<.055,'A resolved production player remained inside a real beam');
  report.pass=true;return report;
 }catch(error){error.beamProbeReport={...report,lastPhase:phase?.name,player:g.playerPosition.toArray(),cargo:cargo.position.toArray(),angle:r.angle,currentLoadedA:r.loaded('a'),currentLoadedB:r.loaded('b'),held:g.heldCube===cargo};throw error;
 }finally{g.updatePlayer=updatePlayer;g.physics.teleportCargo=teleportCargo;d.stop();}
}
