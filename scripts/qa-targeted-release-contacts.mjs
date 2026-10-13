import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import * as THREE from 'three';
import {createHeadlessGame} from './lab-headless.mjs';

// Authored, local geometry targets replace the unreachable enclosing-shell
// corners in the broad release audit. Only normal Play/reset and production
// move, sprint, jump, camera and E inputs are used. No actor, body, portal,
// machinery or completion state is assigned. This is finite physics evidence.
const V=(...p)=>new THREE.Vector3(...p),UP=V(0,1,0),OUT=process.env.QA_OUT||'qa/targeted-release-contacts.json';
const files=fs.readdirSync('src/game').filter(f=>f.endsWith('.js')&&!f.startsWith('LabExpansion')&&f!=='LabCampaignMenu.js').sort();
const hash=()=>createHash('sha256').update(files.map(f=>f+'\n'+fs.readFileSync('src/game/'+f)).join('\n')).digest('hex');
const harnessHash=()=>createHash('sha256').update(fs.readFileSync(new URL(import.meta.url))).digest('hex');
const g=await createHeadlessGame();g.chamberEdition='foundation';
const report={method:'Normal Play spawn, original cargo and body, 120 Hz production physics, 60 Hz visuals; ordinary world movement, sprint, jump, camera and E only. Local named-coordinate targets with continuous 3D contact measurement. A head or original-body underside contact must be observed; side contacts alone do not qualify. No render claim or exhaustive exploit-absence claim.',sourceFiles:files,commit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),sourceBefore:hash(),harnessBefore:harnessHash(),started:new Date().toISOString(),rows:[]};
const definitions=[
 {room:14,kind:'inward-corner-grip-reversal',name:'lowered-fold-west-corner',route:[[-10,12],[-5,12],[-5,-5.925],[-4,-5.925]],target:[-3,-5.925],outside:[-4.2,-5.1],match:b=>Math.abs(b.min.x+3)<.02&&Math.abs(b.max.x)<.02&&Math.abs((b.min.z+b.max.z)/2+5.925)<.03&&b.max.y-b.min.y>.3&&b.max.y-b.min.y<.5},
 {room:14,kind:'underside-jump-release-regrab',name:'lowered-fold-last-moving-tread-underside',route:[[-10,12],[-5,12],[-5,-9.075],[-4,-9.075]],target:[-1.5,-9.075],outside:[-4.1,-9.075],match:b=>Math.abs(b.min.x+3)<.02&&Math.abs(b.max.x)<.02&&Math.abs((b.min.z+b.max.z)/2+8.625)<.03&&b.max.y-b.min.y>.3&&b.max.y-b.min.y<.5},
 {room:16,kind:'inward-corner-grip-reversal',name:'service-dock-retaining-floor-southwest',route:[[0,16.8],[10,16.8]],target:[11,15.8],outside:[10,16.8],match:(b,c)=>c.mesh.name==='Raised service retaining dock / collision'},
 {room:16,kind:'underside-jump-release-regrab',name:'descending-island-return-under-low-tread',route:[[1,15],[1,10.095],[4,10.095]],target:[7,10.095],outside:[4,10.095],match:b=>Math.abs(b.min.x-5)<.02&&Math.abs(b.max.x-9)<.02&&Math.abs((b.min.z+b.max.z)/2-10.525)<.03&&b.max.y-b.min.y>.3&&b.max.y-b.min.y<.4},
 {room:18,kind:'inward-corner-grip-reversal',name:'contact-cell-eastern-casing-corner',route:[[-8,19],[-8,11]],target:[-11.575,9.975],outside:[-9.8,11],match:b=>Math.abs(b.min.x+16.425)<.02&&Math.abs(b.max.x+11.575)<.02&&Math.abs(b.max.z-9.975)<.02&&b.min.y<.1&&b.max.y>2.7},
 {room:18,kind:'underside-jump-release-regrab',name:'contact-cell-outside-overhanging-roof',route:[[-8,19],[-8,12],[-14,12]],target:[-14,10.5],outside:[-14,11.5],match:b=>Math.abs(b.min.x+16.625)<.02&&Math.abs(b.max.x+11.375)<.02&&Math.abs(b.min.y-2.8)<.02&&Math.abs(b.max.z-10.8)<.02},
 {room:41,kind:'inward-corner-grip-reversal',name:'freight-partition-sight-throat-lower-corner',route:[[0,39],[-6,39],[-26,39],[-31,39],[-31,26],[-40,26]],target:[-42.675,28.3],outside:[-41,27],match:b=>Math.abs(b.min.x+43.325)<.02&&Math.abs(b.max.x+42.675)<.02&&Math.abs(b.max.z-28.3)<.02&&b.min.y<.1&&b.max.y>9},
 {room:41,kind:'underside-jump-release-regrab',name:'atrium-folded-stair-over-main-gallery',route:[[0,39],[0,-41.344],[-1.5,-41.344]],target:[-2.85,-41.344],outside:[-1.5,-41.344],finishRoute:[[0,-41.344],[0,39],[-6,39],[-26,39],[-31,39]],match:b=>Math.abs(b.min.x+9)<.02&&Math.abs(b.max.x+3)<.02&&Math.abs(b.min.y-2.5620253164556956)<.02&&Math.abs(b.min.z+41.913924050632914)<.02},
];
function save(){fs.mkdirSync('qa',{recursive:true});fs.writeFileSync(OUT,JSON.stringify(report,null,2)+'\n');}
function snap(){return {player:g.playerPosition.toArray(),cargo:g.cargo.position.toArray(),body:[g.physics.cargoBody.position.x,g.physics.cargoBody.position.y,g.physics.cargoBody.position.z],velocity:g.playerVelocity.toArray(),held:!!g.heldCube,grounded:g.playerGrounded,state:g.state,playerTeleports:g.teleportCount,cargoTransports:g.physics.portalTransports};}
function mechanics(){const l=g.firstLevel;return {stairOffset:l.state?.counterweightStair?.offset,stairSupported:l.state?.counterweightStair?.supported,liftHeight:l.state?.['counterweight-lift']?.position?.y,circuitContacts:l.circuit?.contacts,circuitCurrent:l.circuit?.current,circuitStroke:l.circuit?.stroke,solved:l.getTowerMetrics?.().solvedIds};}
try{
 for(const def of definitions){if(process.env.ROOMS&&!process.env.ROOMS.split(',').map(Number).includes(def.room))continue;if(process.env.ATTACK&&!def.name.includes(process.env.ATTACK))continue;
  await g.selectLevel(def.room-1,false);g.resetRun(true);
  const row={...Object.fromEntries(Object.entries(def).filter(([k])=>k!=='match')),id:g.firstLevel.id,sourceBefore:hash(),start:snap(),events:[],trajectory:[],resets:0,respawns:0,cargoResets:0,frames:0,physicsSteps:0,reachedContact:false,reachedUnderside:false,cargoContactEquations:0,releases:0,regrabs:0,minPlayerSurfaceDistance:Infinity,minCargoCenterDistance:Infinity,minUndersideHeadGap:Infinity,maxY:g.playerPosition.y,maxSpeed:0,causalCandidates:[]};
  const cargo=g.cargo,body=g.physics.cargoBody,move=new THREE.Vector2(),old={move:g.input.getMove,reset:g.resetRun,respawn:g.respawn,cargoReset:g.physics.resetCargo};
  row.originalIdentity={cargoUuid:cargo.group.uuid,bodyId:body.id};g.input.getMove=()=>move.clone();
  g.resetRun=function(...a){row.resets++;return old.reset.apply(this,a);};g.respawn=function(...a){row.respawns++;return old.respawn.apply(this,a);};g.physics.resetCargo=function(...a){row.cargoResets++;return old.cargoReset.apply(this,a);};
  let targetCollider=null,attacking=false;
  function event(name,detail={}){row.events.push({name,frame:row.frames,...snap(),mechanics:mechanics(),...detail});}
  function observe(){
   row.maxY=Math.max(row.maxY,g.playerPosition.y);row.maxSpeed=Math.max(row.maxSpeed,g.playerVelocity.length());
   if(targetCollider&&attacking){const b=targetCollider.box,p=g.playerPosition;
    const xgap=Math.max(b.min.x-p.x,0,p.x-b.max.x),zgap=Math.max(b.min.z-p.z,0,p.z-b.max.z);
    // Production resolveBody expands a carried traveller beside tall walls.
    // Record that actual controller contact radius rather than mislabelling
    // its deliberate 62 cm clearance as an unreachable 43 cm capsule.
    const radius=g.heldCube&&b.min.y<p.y+.5&&b.max.y>p.y+2.4?.62:.43;
    const hgap=Math.max(0,Math.hypot(xgap,zgap)-radius),ygap=Math.max(b.min.y-p.y-2.4,0,p.y-b.max.y),surface=Math.hypot(hgap,ygap);
    row.minPlayerSurfaceDistance=Math.min(row.minPlayerSurfaceDistance,surface);row.minCargoCenterDistance=Math.min(row.minCargoCenterDistance,b.distanceToPoint(g.cargo.position));
    const near=surface<.035;if(near&&!row.reachedContact){row.reachedContact=true;event('actual-player-capsule-contact',{surfaceDistance:surface,controllerRadius:radius,box:b.min.toArray().concat(b.max.toArray())});}
    // The ordinary circular head can meet a tread edge before its centre is
    // underneath the tread. Neighbouring half-metre treads make this common.
    const under=Math.hypot(xgap,zgap)<.43&&p.y<b.min.y;
    if(under){const headGap=b.min.y-(p.y+2.4);row.minUndersideHeadGap=Math.min(row.minUndersideHeadGap,Math.abs(headGap));if(Math.abs(headGap)<.045&&!row.reachedUnderside){row.reachedUnderside=true;event('actual-underside-head-contact',{headGap,box:b.min.toArray().concat(b.max.toArray())});}}
    const staticBody=g.physics.solids.get(targetCollider.mesh.uuid)?.body;
    if(staticBody){const contacts=g.physics.world.contacts.filter(c=>c.enabled!==false&&((c.bi===body&&c.bj===staticBody)||(c.bj===body&&c.bi===staticBody)));row.cargoContactEquations+=contacts.length;if(contacts.length&&!row.firstCargoContact){row.firstCargoContact={frame:row.frames,...snap()};event('actual-original-body-Cannon-contact');}for(const c of contacts){const staticFirst=c.bi===staticBody,normal=[c.ni.x,c.ni.y,c.ni.z].map(v=>v*(staticFirst?1:-1)),gap=c.bi.position.vadd(c.ri).distanceTo(c.bj.position.vadd(c.rj));row.contactNormals??=[];if(!row.contactNormals.some(n=>n.every((v,i)=>Math.abs(v-normal[i])<.02)))row.contactNormals.push(normal);if(normal[1]<-.9&&gap<.05&&!row.reachedCargoUnderside){row.reachedCargoUnderside=true;event('actual-original-body-underside-Cannon-contact',{normal,contactPointGap:gap});}}}
   }
   if(attacking&&!row.resets&&!row.respawns){
    const l=g.firstLevel;if(def.room===16&&g.playerPosition.y>1.96&&g.heldCube===cargo&&g.teleportCount===0&&!row.causalCandidates.includes('same-pair-reaches-service-dock-without-portals')){row.causalCandidates.push('same-pair-reaches-service-dock-without-portals');event('causal-candidate-service-dock');}
    if(def.room===18&&l.circuit?.contacts.every(Boolean)&&g.physics.portalTransports===0&&!row.causalCandidates.includes('both-cell-contacts-without-cargo-portal')){row.causalCandidates.push('both-cell-contacts-without-cargo-portal');event('causal-candidate-contact-cell');}
    if(def.room===41&&l.getTowerMetrics().solvedIds.includes('freight')&&g.teleportCount===0&&!row.causalCandidates.includes('freight-solved-without-player-portal')){row.causalCandidates.push('freight-solved-without-player-portal');event('causal-candidate-freight');}
   }
  }
  function frame(){for(let sub=0;sub<2&&g.state==='playing';sub++){g.updatePlaying(1/120);row.physicsSteps++;observe();}g.updateVisuals(1/60,1);row.frames++;if(row.frames%30===0)row.trajectory.push({frame:row.frames,...snap(),mechanics:mechanics()});if(g.cargo!==cargo||g.physics.cargoBody!==body)throw Error('Original actor identity changed');if(row.resets||row.respawns||row.cargoResets)throw Error('Production death/reset interrupted this attack');}
  function stop(){move.set(0,0);g.input.keys.clear();}
  function worldMove(x,z){const p=V(x,0,z).applyAxisAngle(UP,-g.yaw);move.set(p.x,p.z);}
  function wait(sec){stop();for(let n=0;n<sec*60;n++)frame();}
  function toward(target,ticks,{jumpEvery=0,interactEvery=0,turn=0,stopNear=false}={}){
   let distance=Infinity;g.input.keys.add('ShiftLeft');
   for(let n=0;n<ticks&&g.state==='playing';n++){const p=g.playerPosition,v=V(target[0]-p.x,0,target[1]-p.z),d=v.length();distance=Math.min(distance,d);if(stopNear&&d<.12)break;if(d>.0001)v.normalize().multiplyScalar(Math.min(1,d*2));if(turn)v.applyAxisAngle(UP,turn);worldMove(v.x,v.z);if(jumpEvery&&n%jumpEvery===0)g.input.jumpQueued=true;if(interactEvery&&n%interactEvery===0){const held=!!g.heldCube,accepted=g.interact();if(accepted){if(held&&!g.heldCube)row.releases++;if(!held&&g.heldCube)row.regrabs++;}event('E-release-regrab',{accepted,wasHeld:held});}frame();}stop();return distance;
  }
  function walk(p){const distance=toward(p,1200,{stopNear:true});if(distance>.18)throw Error('Ordinary setup path missed '+p+' at '+g.playerPosition.toArray());event('ordinary-setup-waypoint',{target:p,minimumDistance:distance});}
  function collect(){if(g.heldCube)return;const offsets=[[1.15,0],[-1.15,0],[0,1.15],[0,-1.15]].sort((a,b)=>Math.hypot(g.cargo.position.x+a[0]-g.playerPosition.x,g.cargo.position.z+a[1]-g.playerPosition.z)-Math.hypot(g.cargo.position.x+b[0]-g.playerPosition.x,g.cargo.position.z+b[1]-g.playerPosition.z));for(const [dx,dz]of offsets){const c=g.cargo.position;const p=[c.x+dx,c.z+dz];toward(p,240,{stopNear:true});if(g.interact()&&g.heldCube){wait(.45);event('picked-up-original-cargo');return;}}throw Error('Original cargo was not reached by normal walking');}
  try{wait(.5);collect();for(const p of def.route)walk(p);targetCollider=g.colliders.find(c=>c.enabled!==false&&!c.frontPlane&&def.match(c.box,c));if(!targetCollider)throw Error('Authored target collider absent');row.targetCollider={name:targetCollider.mesh.name,uuid:targetCollider.mesh.uuid,box:targetCollider.box.min.toArray().concat(targetCollider.box.max.toArray())};event('attack-location-reached');attacking=true;
   row.minimumTargetDistance=toward(def.target,210,{jumpEvery:def.kind.startsWith('underside')?0:29});event('local-approach-ended');
   for(let phase=0;phase<8&&g.state==='playing';phase++){
    const target=phase%2?def.outside:def.target;row.minimumTargetDistance=Math.min(row.minimumTargetDistance,toward(target,55,{jumpEvery:def.kind.startsWith('underside')?11:23,interactEvery:def.kind.startsWith('underside')?13:0,turn:phase%2?-.11:.11}));
   }event('contact-sequence-ended');
   if(def.kind.startsWith('underside')&&g.heldCube){const accepted=g.interact();if(accepted&&!g.heldCube)row.releases++;event('E-final-release',{accepted});}wait(.5);
   if(def.room===41){if(def.finishRoute){collect();for(const p of def.finishRoute)walk(p);}toward([-53,47],240,{jumpEvery:17,interactEvery:41});event('finite-attempt-to-receiving-bay');}
   else if(g.firstLevel.goal?.position){toward([g.firstLevel.goal.position.x,g.firstLevel.goal.position.z],240,{jumpEvery:17,interactEvery:41});event('finite-attempt-to-goal');}
   row.outcome=g.state==='won'||row.causalCandidates.length?'causal-bypass-needs-review':!row.reachedContact?'contact-not-reached':def.kind.startsWith('underside')&&!(row.reachedUnderside||row.reachedCargoUnderside)?'side-contact-only-underside-not-reached':'finite-authored-contact-no-completion';
  }catch(error){row.error=String(error);row.outcome=row.resets||row.respawns||row.cargoResets?'production-death-during-attack':'setup-or-driver-incomplete';}
  finally{stop();g.input.getMove=old.move;g.resetRun=old.reset;g.respawn=old.respawn;g.physics.resetCargo=old.cargoReset;row.final=snap();row.finalMechanics=mechanics();row.sameCargo=g.cargo===cargo;row.sameBody=g.physics.cargoBody===body;row.sourceAfter=hash();row.sourceStable=row.sourceBefore===row.sourceAfter;row.contactCoverageQualified=row.reachedContact&&(def.kind==='inward-corner-grip-reversal'||row.reachedUnderside||row.reachedCargoUnderside)&&row.sameCargo&&row.sameBody&&!row.resets&&!row.respawns&&!row.cargoResets;report.rows.push(row);save();console.log(JSON.stringify({room:def.room,name:def.name,outcome:row.outcome,contact:row.reachedContact,underside:row.reachedUnderside,cargoUnderside:row.reachedCargoUnderside,qualified:row.contactCoverageQualified,cargoContacts:row.cargoContactEquations,normals:row.contactNormals,releases:row.releases,regrabs:row.regrabs,candidates:row.causalCandidates,p:row.final.player,error:row.error}));}
 }
}finally{report.finished=new Date().toISOString();report.sourceAfter=hash();report.sourceStable=report.sourceAfter===report.sourceBefore;report.harnessAfter=harnessHash();report.harnessStable=report.harnessAfter===report.harnessBefore;report.summary={cases:report.rows.length,qualified:report.rows.filter(r=>r.contactCoverageQualified).length,unqualified:report.rows.filter(r=>!r.contactCoverageQualified).length,causalCandidates:report.rows.filter(r=>r.causalCandidates.length||r.final.state==='won').length};report.pass=report.sourceStable&&report.harnessStable&&report.rows.length===definitions.length&&report.rows.every(r=>r.sourceStable&&r.contactCoverageQualified&&r.sameCargo&&r.sameBody&&!r.error&&!r.resets&&!r.respawns&&!r.cargoResets&&!r.causalCandidates.length&&r.final.state!=='won'&&r.outcome==='finite-authored-contact-no-completion'&&(r.kind!=='underside-jump-release-regrab'||r.releases>0&&r.regrabs>0));save();g.physics.dispose();g.portals.dispose();console.log('SUMMARY',JSON.stringify(report.summary),'PASS',report.pass);if(!report.pass)process.exitCode=1;}
