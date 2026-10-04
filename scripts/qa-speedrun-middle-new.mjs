/** New finite adversarial coverage of rooms 15–28. Controls only: movement,
 * sprint/jump, camera, E, portal fire/clear. All transforms and mechanism values
 * are read-only observations; genuine production collision/physics decide play.
 * A blocked attack is not evidence that every imaginable exploit is absent. */
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import * as THREE from 'three';
import {createHeadlessGame} from './lab-headless.mjs';
import {runV8Journey} from '../src/game/LabV8Journey.js';
import {installRoom21Aim,room21Freight,room21Fall} from '../src/game/LabRoom21Journey.js';
import {room18Climb} from '../src/game/LabRoom18Journey.js';
import {room19Ascent,room19Cargo} from '../src/game/LabRoom19Journey.js';

const V=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z);
const levels=(process.env.ROOMS||'15,16,17,18,19,20,21,22,23,24,25,26,27,28').split(',').map(Number);
const output=process.env.OUT||'qa/speedrun-middle-new.json';
if(!levels.every(n=>n>=15&&n<=28&&Number.isInteger(n)))throw Error('ROOMS must be 15–28');
const g=await createHeadlessGame();g.chamberEdition='foundation';
function sourceFingerprint(){const files=fs.readdirSync('src/game',{recursive:true}).filter(f=>f.endsWith('.js')).sort(),hash=createHash('sha256');for(const file of files){hash.update(file);hash.update(fs.readFileSync(path.join('src/game',file)));}return hash.digest('hex');}
const report={scope:'Finite new input-only speedrun attacks in production simulation. No actor transforms, mechanism targets, progress flags or win flags assigned. Headless physics evidence, not a renderer or human playtest.',source:{commit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),gameSourcesSha256:sourceFingerprint(),gameCoreSha256:createHash('sha256').update(fs.readFileSync('src/game/LabGame.js')).digest('hex'),started:new Date().toISOString()},rooms:[]};
let observed,driver;
function state(d){
 const l=d.level,s=l.state||{},r={player:g.playerPosition.toArray(),cargo:g.cargo.position.toArray(),held:!!g.heldCube,teleports:g.teleportCount,cargoTransports:g.physics.portalTransports,won:g.state==='won'};
 if(l.shutters)r.shutters={loaded:l.shutters.loaded,progress:l.shutters.progress};
 if(l.cassette)r.cassette={height:l.cassette.height,braked:l.cassette.braked};
 if(l.balance)r.balance={loaded:l.balance.loaded,braked:l.balance.braked,coupling:l.balance.coupling};
 if(l.gardenDoor)r.door={angle:l.gardenDoor.angle,braked:l.gardenDoor.braked,loaded:l.gardenDoor.loaded};
 if(s.address)r.car={progress:s.address.progress,locked:s.address.locked};
 if(s.inertia)r.inertia={omega:s.inertia.wheel.omega,work:s.inertia.travelWork,power:s.inertia.power,gear:s.inertia.gear};
 if(s['inertial-ferry'])r.ferry=s['inertial-ferry'].progress;
 if(s.optical)r.optical={loaded:s.optical.loaded,lit:s.optical.lit,receivers:s.optical.receivers};
 if(s.sightShutter)r.sightShutter={loaded:s.sightShutter.loaded,progress:s.sightShutter.progress};
 if(l.circuit)r.circuit={mode:l.circuit.mode,current:l.circuit.current,contacts:[...l.circuit.contacts],stroke:l.circuit.stroke};
 if(s.tides)r.tides={levels:[...s.tides.levels],flow:s.tides.flow,total:s.tides.levels.reduce((a,b)=>a+b,0)};
 if(s.conveyors)r.conveyors={reversed:s.conveyors.reversed,braked:s.conveyors.braked};
 return r;
}
function step(d){
 d.frame();observed.frames++;
}
function force(d,target,seconds,{jump=true,angle=0,land=false}={}){
 g.input.keys.add('ShiftLeft');
 for(let i=0;i<seconds*60&&g.state==='playing';i++){
  const delta=target.clone().sub(g.playerPosition);delta.y=0;
  if(delta.length()<.18&&Math.abs(g.playerPosition.y-target.y)<.3&&(!land||g.playerGrounded))break;
  delta.normalize().applyAxisAngle(V(0,1,0),angle);d.worldMove(delta.x,delta.z);
  if(jump&&i%37===0)g.input.jumpQueued=true;d.frame();
 }
 d.stop();
}
function bounded(d,x,z,seconds=10){try{d.walk(x,z,seconds);return true;}catch(e){if(!/Blocked walking|Walk timed out/.test(e.message))throw e;observed.obstacles.push(e.message);return false;}}
function collect(d){
 if(g.heldCube)return true;
 for(const [x,z]of [[1,0],[-1,0],[0,1],[0,-1]]){
  const p=g.cargo.position.clone();if(!bounded(d,p.x+x,p.z+z,8))continue;
  if(g.interact()&&g.heldCube){d.wait(.25);return true;}
 }
 observed.obstacles.push('Original cargo inaccessible from this physically reached stage');return false;
}
async function cut(d,mark,opts={}){
 const stopped=Symbol('cut');let reached=false;
 const route={...d,mark:name=>{d.mark(name);if(name===mark){reached=true;throw stopped;}}};
 try{const m=await import(`../src/game/LabRoom${d.level.index+1}Journey.js`);await m[`runRoom${d.level.index+1}`](route,opts);}catch(e){if(e!==stopped)throw e;}
 if(!reached)throw Error('Setup route did not reach cut '+mark);
 observed.cut=mark;observed.stage=state(d);
}
function peekShot(d,index,p,label){
 d.look(p);const accepted=g.firePortal(index);
 if(accepted)d.until(()=>!g.portalShots.queue.length&&!g.portalShots.active.length,3,'Probe charge resolution');
 const receipt={label,accepted,valid:accepted&&!!g.portalShots.lastImpact?.valid,impact:accepted?g.portalShots.lastImpact:null,from:g.playerPosition.toArray(),aim:p.toArray()};observed.shots.push(receipt);return receipt.valid;
}
function corners(panel){
 const f=panel.getFrame(),right=f.right||V(1,0,0).applyQuaternion(f.quaternion||panel.mesh.quaternion),up=f.up||V(0,1,0).applyQuaternion(f.quaternion||panel.mesh.quaternion);
 return [[-.65,-.65],[-.65,.65],[.65,-.65],[.65,.65]].map(([x,y])=>f.center.clone().addScaledVector(right,x).addScaledVector(up,y));
}
function supportChain(d){
 // Plan a speculative staircase from *existing* enabled floor/solid roofs.
 // The graph only chooses input targets; it never moves either actor.
 const supports=[...g.floors.filter(f=>f.enabled!==false).map(f=>({name:f.mesh?.name||'floor',x0:f.minX,x1:f.maxX,z0:f.minZ,z1:f.maxZ,y:f.y})),
  ...g.colliders.filter(c=>c.enabled!==false&&!c.walkablePlane).map(c=>({name:c.mesh?.name||'solid roof',x0:c.box.min.x,x1:c.box.max.x,z0:c.box.min.z,z1:c.box.max.z,y:c.box.max.y}))]
  .filter(s=>s.x1-s.x0>.1&&s.z1-s.z0>.1&&Number.isFinite(s.y)&&s.y>=0&&s.y<35);
 const p=g.playerPosition,goal=d.level.goal.position,inside=(s,q)=>q.x>=s.x0-.05&&q.x<=s.x1+.05&&q.z>=s.z0-.05&&q.z<=s.z1+.05;
 const queue=[],parent=new Map();for(let i=0;i<supports.length;i++)if(inside(supports[i],p)&&Math.abs(supports[i].y-p.y)<.3){queue.push(i);parent.set(i,-1);}
 let chosen=queue[0],found=false;
 for(let n=0;n<queue.length;n++){
  const i=queue[n],a=supports[i];if(chosen===undefined||a.y>supports[chosen].y)chosen=i;
  if(inside(a,goal)&&Math.abs(a.y-goal.y)<.4){chosen=i;found=true;break;}
  for(let j=0;j<supports.length;j++){
   if(parent.has(j))continue;const b=supports[j],dy=b.y-a.y;
   if(dy>1.65||dy<-.8)continue;
   const dx=Math.max(0,a.x0-b.x1,b.x0-a.x1),dz=Math.max(0,a.z0-b.z1,b.z0-a.z1);
   if(Math.hypot(dx,dz)>2.4)continue;parent.set(j,i);queue.push(j);
  }
 }
 const route=[];while(chosen!==undefined&&chosen!==-1){route.push(supports[chosen]);chosen=parent.get(chosen);}route.reverse();
 observed.supportGraph={speculativeGoalPath:found,reachable:parent.size,route};
 for(const s of route.slice(1,90)){
  const insetX=Math.min(.23,(s.x1-s.x0)/2),insetZ=Math.min(.23,(s.z1-s.z0)/2);
  const target=V(THREE.MathUtils.clamp(g.playerPosition.x,s.x0+insetX,s.x1-insetX),s.y,THREE.MathUtils.clamp(g.playerPosition.z,s.z0+insetZ,s.z1-insetZ));
  const distance=Math.hypot(target.x-g.playerPosition.x,target.z-g.playerPosition.z);
  force(d,target,Math.min(12,3+distance/3),{jump:true,land:true});
  if(g.state==='won')break;
  if(Math.abs(g.playerPosition.y-s.y)>.45){observed.obstacles.push('Speculative roof chain blocked at '+s.name+' height '+s.y+' / actual '+g.playerPosition.toArray());break;}
 }
 force(d,d.level.goal.position,10,{angle:.15});
}
async function run(number,name,attack){
 if(process.env.KIND&&!process.env.KIND.split(',').some(kind=>name.includes(kind)))return null;
 await g.selectLevel(number-1,false);const originalCargo=g.cargo,originalBody=g.physics.cargoBody;observed={frames:0,physicsSteps:0,maxY:g.playerPosition.y,forceSteps:0,loadedSteps:0,shots:[],obstacles:[]};let error=null,result=null;
 const ordinaryUpdate=g.updatePlaying;
 g.updatePlaying=function(dt){const value=ordinaryUpdate.call(this,dt);observed.physicsSteps++;observed.maxY=Math.max(observed.maxY,g.playerPosition.y);if(g.firstLevel.playerAcceleration?.(g.playerPosition,g.playerVelocity)?.lengthSq()>.001)observed.forceSteps++;if(g.firstLevel.pads?.some(p=>p.loaded?.()))observed.loadedSteps++;return value;};
 try{result=await runV8Journey(g,{scenario:async base=>{const d={...base,frame:()=>step(base)};driver=d;if(number>=21)installRoom21Aim(d);await attack(d);}});}catch(e){error=e.message;}finally{g.updatePlaying=ordinaryUpdate;}
 const row={name,completed:g.state==='won',simulationFinishedWithoutDriverError:!error,frames:result?.frames||observed.frames,error,observed,state:state(driver||{level:g.firstLevel}),resets:result?.resets,respawns:result?.respawns,sameCompanion:g.cargo===originalCargo,sameCargoBody:g.physics.cargoBody===originalBody};
 row.outcome=error?'driver-or-setup-error':row.completed?'completed-requires-causal-review':name==='drop-cargo-at-ledge-corner-jump-boost'&&!observed.dropAt?'cargo-unavailable-before-boost':'blocked-in-finite-attempt';
 console.log('MIDDLE ATTACK',number,name,row.completed?'COMPLETED':error?'ERROR/BLOCKED':'BLOCKED');return row;
}
const stages={
 15:{name:'clear-current-during-transverse-flight-and-corner-steer',run:async d=>{await cut(d,'airborne lane exchange');g.clearPortals();observed.clearAt=state(d);force(d,V(14,14,-12),14,{angle:-.22});collect(d);force(d,d.level.goal.position,8);}},
 16:{name:'collapse-support-while-carrying-and-rush-upper-gallery',run:async d=>{await cut(d,'borrowed floor crossing');g.clearPortals();observed.clearAt=state(d);force(d,V(12,13.4,0),10,{angle:.18});force(d,d.level.goal.position,14,{angle:-.25});}},
 17:{name:'release-parked-brake-before-pickup-and-chase-car-edge',run:async d=>{await cut(d,'the brake holds an empty carriage');if(!g.interact())throw Error('Brake release input missed');observed.releaseAt=state(d);bounded(d,14,15);g.input.jumpQueued=true;bounded(d,14,11);try{d.enter(d.level.panels.address);}catch(e){observed.obstacles.push(e.message);}collect(d);force(d,V(-21,0,21),10);try{d.enter(d.level.panels.arrival);}catch(e){observed.obstacles.push(e.message);}force(d,d.level.goal.position,18,{angle:.3});}},
 18:{name:'preaddress-turn-corner-without-original-freight-weight',run:async d=>{const p=d.level.panels;d.walk(6,14);d.walk(6,8);d.aim(0,V(1.6,.025,8.2));for(const [x,z]of [[1,21],[1,28],[-19.5,28],[-19.5,16.5],[0,16.5]])d.walk(x,z);room18Climb(d);d.walk(-1.5,11);d.walk(-1.5,5);observed.unweightedUpperSight=state(d);if(g.playerPosition.y<19.8)throw Error('Preparation did not reach the real upper sight corridor');let valid=false;for(const pt of corners(p.turn))valid=peekShot(d,1,pt,'unweighted sight corner')||valid;if(!valid){observed.obstacles.push('All four turn-face corner shots arrested before freight opens sight shutter');return;}d.walk(-1.5,11);d.walk(1.5,11);force(d,V(1.5,0,7),6,{jump:false});force(d,d.level.goal.position,18);}},
 19:{name:'empty-flywheel-clutch-cargo-wedge-and-diagonal-ferry-leap',run:async d=>{room19Ascent(d);room19Cargo(d);for(const [x,z]of [[0,-6.5],[4,-6.5],[10.1,-6.5],[10.1,-4.8]])d.walk(x,z);g.interact();observed.clutchAt=state(d);collect(d);g.interact();d.wait(.3);force(d,V(16,8,13),18,{angle:.35});collect(d);force(d,d.level.goal.position,8);}},
 20:{name:'clear-pair-at-final-field-mouth-and-jump-diagonally-outside-tube',run:async d=>{await cut(d,'final field transfer over the shared hub');g.clearPortals();force(d,V(-2,20,-9),10,{angle:.38});force(d,d.level.goal.position,16,{angle:-.25});}},
 21:{name:'freight-loaded-high-cassette-without-brake-release',run:async d=>{room21Freight(d);observed.cassetteBefore=state(d);d.walk(0,7.85);d.aim(0,d.level.panels['shared-well'].getFrame().center.clone().setZ(7.1));const face=d.level.panels['moving-cassette'];let valid=peekShot(d,1,face.getFrame().center,'braked high cassette centre');for(const pt of corners(face))valid=peekShot(d,1,pt,'braked high cassette corner')||valid;if(!valid){observed.obstacles.push('High braked cassette blocked by its actual enclosure');return;}room21Fall(d);force(d,d.level.goal.position,12);collect(d);force(d,d.level.goal.position,8);}},
 22:{name:'pick-load-before-ground-crossing-and-race-closing-throat',run:async d=>{await cut(d,'original cargo opens ground passage and closes upper inspection');collect(d);g.input.keys.add('ShiftLeft');for(const [x,z]of [[-8,12],[-.9,14.25],[.9,14.25],[7,12],[18,22.6],[18,7.5]]){if(!bounded(d,x,z,6))force(d,V(x,0,z),3,{angle:.2});}observed.postThroat=state(d);force(d,d.level.goal.position,16,{angle:-.35});}},
 23:{name:'remove-original-load-before-brake-and-jump-to-upper-return',run:async d=>{await cut(d,'original freight loads the opposite coupled carriage');bounded(d,6,5.5,8);collect(d);force(d,V(11,20,8),14,{angle:.28});force(d,d.level.goal.position,14,{angle:-.28});}},
 24:{name:'corner-squeeze-between-gardens-before-any-rotation',run:async d=>{await cut(d,'the same aperture starts its courtyard orbit');collect(d);force(d,V(-5,6,3),10,{angle:-.4});force(d,V(-8,6,-8),10,{angle:.35});force(d,V(-20,11,-18),12);observed.noRotationStage=state(d);if(g.heldCube){g.interact();d.wait(.3);}for(const pt of corners(d.level.panels['pavilion-receiver']))peekShot(d,0,pt,'unrotated final face corner');collect(d);force(d,d.level.goal.position,12);}},
 25:{name:'carry-shadow-load-away-while-first-lift-rises-and-climb-housing',run:async d=>{await cut(d,'one weight moves two opposite shadows');collect(d);for(const [x,z]of [[-7,6],[-20,6],[-20,-10],[-14,-10],[-14,-13],[-7,-13]])force(d,V(x,9,z),4,{angle:.15});observed.omittedLight=state(d);force(d,d.level.goal.position,14,{angle:-.25});}},
 26:{name:'retrieve-air-valve-before-upper-dock-and-carry-rush-unpowered-shaft',run:async d=>{await cut(d,'the first permanent gallery preserves height');force(d,V(-17,0,22),9,{angle:.15});collect(d);force(d,V(12,16,-8),14,{angle:-.3});force(d,d.level.goal.position,14,{angle:.3});}},
 27:{name:'brake-upper-belts-and-sprint-through-final-launch-instead-of-motor',run:async d=>{await cut(d,'ready for the upper conveyor crossing');if(g.heldCube){g.interact();d.wait(.5);}for(const [x,z]of [[21,11],[21,13],[10,13],[8.8,13]])bounded(d,x,z);g.interact();observed.brakeInputAt=state(d);bounded(d,10,11);bounded(d,10,7);collect(d);bounded(d,10,11);bounded(d,15.3,11);force(d,V(15.3,8,-21),12,{jump:true});force(d,d.level.goal.position,12,{angle:-.15});}},
 28:{name:'freeze-mid-tide-before-garden-height-and-cargo-jump-lower-door',run:async d=>{await cut(d,'the east gauge and receiving current show the moving tide');d.wait(3);g.clearPortals();const before=state(d);collect(d);force(d,V(5,3,6),10,{angle:-.28});force(d,V(-13,3,0),10,{angle:.25});force(d,d.level.goal.position,12);observed.frozenTide=before;}},
};
async function room16ReverseServiceStair(d){
 const p=d.level.panels;
 if(!collect(d))throw Error('Original cargo pickup failed before service-stair attack');
 bounded(d,13,16);force(d,V(13,2,13),8,{land:true});
 if(g.playerPosition.y<1.8){observed.obstacles.push('Reverse lower service staircase blocked below its raised landing');return;}
 d.walk(7,13);force(d,V(7,7.4,2.7),8,{land:true});
 observed.stairArrival=state(d);
 if(g.playerPosition.y<7.3){observed.obstacles.push('Reverse island staircase blocked before the first projected crossing could be omitted');return;}
 if(g.teleportCount||g.portals.ready)throw Error('Unexpected portal used before island arrival');
 // Try a genuine moving release over the well's roof rim, then leap onto
 // the rising car from the island rather than extinguish a projected floor.
 d.walk(7.2,-1.5);d.walk(4.5,-1.5);force(d,V(2.6,6.875,0),4,{land:true});
 observed.roofArrival=state(d);
 if(!g.playerGrounded||Math.abs(g.playerPosition.y-6.875)>.3){observed.obstacles.push('Roof-rim jump physically blocked');return;}
 g.input.keys.add('ShiftLeft');for(let n=0;n<10;n++){d.worldMove(-1,0);d.frame();}g.interact();observed.roofRelease=state(d);
 force(d,V(6,7.4,0),4,{land:true});d.walk(8.5,0);force(d,V(12,13.4,0),6,{land:true});
 d.until(()=>d.level.pads[0].loaded(),7,'Roof throw did not physically load the counterweight');
 d.until(()=>g.playerGrounded&&g.playerPosition.y>13.3,10,'Roof throw did not let the player board the rising car');observed.unprojectedAscent=state(d);
 d.walk(12,3.2);d.walk(6,5.8);d.walk(0,4.25);d.aim(0,p['upper-rest'].getFrame().center);d.aim(1,g.cargo.position.clone().setY(p.counterweight.getFrame().center.y));
 d.until(()=>g.cargo.position.y>13,6,'Upper original cargo retrieval');observed.upperCargoExit=state(d);g.clearPortals();d.wait(.5);if(!collect(d))throw Error('Could not retrieve original cargo after closing the upper receiving floor');d.walk(-3,5.8);g.interact();d.wait(.8);
 d.walk(-3,4.6);d.walk(-15,4.6);d.walk(-15,5.8);d.aim(1,p['last-address'].getFrame().center.clone().add(V(0,.6,0)));d.aim(0,p.source.getFrame().center.clone().add(V(0,0,.4)));
 d.walk(g.cargo.position.x-1,g.cargo.position.z);d.pickup();d.walk(20.4,5.8);d.walk(20.4,-7.4);d.walk(17.5,-7.4);
 const crossing=d.level.state.lightBridge.pieces.find(piece=>piece.floor.enabled&&piece.floor.y>13&&piece.floor.minX<17.5&&piece.floor.maxX>17.5)?.floor;
 if(!crossing)throw Error('Final projected receiving edge missing');d.walk(17.5,crossing.maxZ+.65);d.wait(.2);g.input.jumpQueued=true;d.walk(17.5,(crossing.minZ+crossing.maxZ)/2);d.wait(.4);
 d.walk(-16,-10);d.walk(-16,-6.4);d.until(()=>g.playerGrounded&&Math.abs(g.playerPosition.y-13.4)<.15,5,'Final permanent receiving apron');if(g.state==='playing')d.walk(-17,-6.4);d.until(()=>g.state==='won',4,'Reverse service-stair joint exit');
}
try{
 for(const number of levels){
  const item={number,attacks:[]};
  if(number===18||number===20){
   const m=await import(`./lib/creative-room${number}-attacks.mjs`);
   const attacks=m[`creative${number}Attacks`];
   if(!Array.isArray(attacks)||attacks.length<7)throw Error('Missing complete replacement-room attacks: '+number);
   for(const a of attacks){const row=await run(number,a.name,a.run);if(row)item.attacks.push(row);}
   item.suspectedShortcuts=item.attacks.filter(a=>a.completed).map(a=>a.name);report.rooms.push(item);
   fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');
   continue;
  }
  // Both long exterior directions are tested. This tries diagonal joins,
  // stair undersides, outer-wall collision seams and goal-support undersides.
  for(const sign of [-1,1])item.attacks.push(await run(number,'outer-perimeter-diagonal-seam-rush-'+sign,d=>{
   collect(d);const b=d.level.workshop?.bounds||{minX:-20,maxX:20,minZ:-20,maxZ:20};
   const pts=sign===1?[[b.minX+1,b.maxZ-1],[b.minX+1,b.minZ+1],[b.maxX-1,b.minZ+1]]:[[b.maxX-1,b.maxZ-1],[b.maxX-1,b.minZ+1],[b.minX+1,b.minZ+1]];
   for(const [x,z]of pts)force(d,V(x,g.playerPosition.y,z),5,{angle:sign*.12});
   force(d,d.level.goal.position,12,{angle:sign*.18});
  }));
  item.attacks.push(await run(number,'drop-cargo-at-ledge-corner-jump-boost',d=>{
   if(!collect(d))return;
   const q=g.playerPosition.clone(),floors=g.floors.filter(f=>f.enabled!==false&&f.y>q.y+.5&&f.y<=q.y+4);
   const nearest=floors.map(f=>({f,x:THREE.MathUtils.clamp(q.x,f.minX+.5,f.maxX-.5),z:THREE.MathUtils.clamp(q.z,f.minZ+.5,f.maxZ-.5)})).sort((a,b)=>Math.hypot(a.x-q.x,a.z-q.z)-Math.hypot(b.x-q.x,b.z-q.z))[0];
   if(nearest)force(d,V(nearest.x,q.y,nearest.z),4,{jump:false});
   g.interact();d.wait(.7);observed.dropAt=state(d);const c=g.cargo.position.clone(),floor=g.playerPosition.y;observed.preBoostFloor=floor;
   for(let i=0;i<240&&g.state==='playing';i++){const delta=c.clone().sub(g.playerPosition);delta.y=0;delta.normalize();d.worldMove(delta.x,delta.z);if(i%33===0)g.input.jumpQueued=true;d.frame();if(g.playerGrounded&&g.playerPosition.y>floor+.5)observed.groundedAboveOriginalFloor=true;}
   d.stop();collect(d);if(nearest)force(d,V(nearest.x,nearest.f.y,nearest.z),6,{angle:.22});force(d,d.level.goal.position,10,{angle:-.18});
  }));
  item.attacks.push(await run(number,'high-face-four-corners-through-low-sightline',d=>{
   const goal=d.level.goal.position,targets=Object.entries(d.level.panels).filter(([,p])=>p.getFrame().center.y>g.playerPosition.y+3).sort((a,b)=>a[1].getFrame().center.distanceToSquared(goal)-b[1].getFrame().center.distanceToSquared(goal));
   let acceptedTarget;
   for(const [name,p]of targets.slice(0,2))for(const point of corners(p))if(peekShot(d,1,point,name+' corner'))acceptedTarget=p;
   if(!acceptedTarget){observed.obstacles.push('No high-face corner shot accepted from initial physical viewpoint');return;}
   const src=Object.values(d.level.panels).filter(p=>p!==acceptedTarget&&p.getFrame().center.y<g.playerPosition.y+3).sort((a,b)=>a.getFrame().center.distanceToSquared(g.playerPosition)-b.getFrame().center.distanceToSquared(g.playerPosition));let source;
   for(const p of src.slice(0,3))if(peekShot(d,0,p.getFrame().center,'near source')){source=p;break;}
   collect(d);if(source)try{d.enter(source);}catch(e){observed.obstacles.push(e.message);}force(d,d.level.goal.position,14,{angle:.18});
  }));
  item.attacks.push(await run(number,'prop-roof-bunnyhop-chain-without-mechanisms',d=>{collect(d);supportChain(d);}));
  const stage=stages[number];item.attacks.push(await run(number,stage.name,stage.run));item.attacks=item.attacks.filter(Boolean);
  if(number===16){const extra=await run(number,'reverse-service-stair-roof-drop-skips-projected-delivery',room16ReverseServiceStair);if(extra)item.attacks.push(extra);}
  item.suspectedShortcuts=item.attacks.filter(a=>a.completed).map(a=>a.name);report.rooms.push(item);
  fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');
 }
}finally{
 report.source.finishedGameSourcesSha256=sourceFingerprint();report.source.unchangedDuringRun=report.source.finishedGameSourcesSha256===report.source.gameSourcesSha256;report.source.finished=new Date().toISOString();
 report.counts={levels:report.rooms.length,attempts:report.rooms.reduce((n,r)=>n+r.attacks.length,0),completed:report.rooms.reduce((n,r)=>n+r.attacks.filter(a=>a.completed).length,0),blockedWithCompletedDriver:report.rooms.reduce((n,r)=>n+r.attacks.filter(a=>!a.completed&&!a.error).length,0),driverOrSetupErrors:report.rooms.reduce((n,r)=>n+r.attacks.filter(a=>a.error).length,0)};
 fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');g.physics.dispose();g.portals.dispose();
 console.log('MIDDLE COUNTS',JSON.stringify(report.counts));
 if(report.counts.completed||report.counts.driverOrSetupErrors||!report.source.unchangedDuringRun)process.exitCode=1;
}
