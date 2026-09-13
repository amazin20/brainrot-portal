import * as THREE from 'three';
import {runRoom21} from './LabRoom21Journey.js';
const V=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z);
const assert=(condition,message)=>{if(!condition)throw new Error(message);};
/** Async variant of the established V8 driver for sequential native recording.
 * It uses the SAME room21 commands and 120Hz simulation; yielding changes only
 * wall-clock execution. No actor, portal or victory transform is assigned. */
export async function runRoom21Recorded(game,{onFrame=async()=>{},onMilestone=async()=>{},...options}={}){
  assert(game.levelIndex===20,'This recorder belongs to room21');
  const oldMove=game.input.getMove,move=new THREE.Vector2();game.input.getMove=()=>move.clone();
  game.resetRun(true);const level=game.firstLevel,index=game.levelIndex;
  const identity=game.cargo.group.uuid,body=game.physics.cargoBody.id,report={level:index+1,id:level.id,pass:false,milestones:[],respawns:0,resets:0,frames:0};
  const respawn=game.respawn,resetCargo=game.physics.resetCargo;
  game.respawn=function(...args){report.respawns++;return respawn.apply(this,args);};
  game.physics.resetCargo=function(...args){report.resets++;return resetCargo.apply(this,args);};
  async function frame(){
    if(game.state==='playing'){game.updatePlaying(1/120);if(game.state==='playing')game.updatePlaying(1/120);}
    game.updateVisuals(1/60,1);report.frames++;
    assert(report.respawns===0&&report.resets===0,`Level ${index+1}: unexpected reset at ${game.playerPosition.toArray()}`);
    assert(game.cargo.group.uuid===identity&&game.physics.cargoBody.id===body,'Companion identity changed');
    await onFrame(report.frames,game);
  }
  function stop(){move.set(0,0);game.input.keys.clear();}
  function worldMove(x,z){const v=V(x,0,z).applyAxisAngle(V(0,1,0),-game.yaw);move.set(v.x,v.z);}
  async function wait(seconds){stop();for(let n=0;n<Math.ceil(seconds*60);n++)await frame();}
  async function until(condition,seconds,label){stop();for(let n=0;n<seconds*60;n++){if(condition())return;await frame();}assert(condition(),`${label}: ${game.playerPosition.toArray()} / friend ${game.cargo.position.toArray()}`);}
  async function walk(x,z,seconds=20){
    const target=V(x,0,z);let best=Infinity,stuck=0;
    for(let n=0;n<seconds*60&&game.state==='playing';n++){
      const delta=target.clone().sub(game.playerPosition);delta.y=0;const d=delta.length();
      if(d<.11){stop();return;}
      if(d<best-.012){best=d;stuck=0;}else stuck++;
      const pace=Math.min(1,d*1.5);delta.normalize().multiplyScalar(pace);worldMove(delta.x,delta.z);await frame();
      if(stuck>420)throw new Error(`Blocked walking to ${x},${z} at ${game.playerPosition.toArray()}`);
    }
    stop();assert(game.state==='won'||Math.hypot(game.playerPosition.x-x,game.playerPosition.z-z)<.3,`Walk timed out at ${game.playerPosition.toArray()} target ${x},${z}`);
  }
  async function look(point){
    stop();
    for(let n=0;n<240;n++){
      game.scene.updateMatrixWorld(true);
      if(point.clone().sub(game.camera.position).dot(game.camera.getWorldDirection(V()))<0){game.yaw+=.18;await frame();continue;}
      const ndc=point.clone().project(game.camera);
      if(n>20&&Math.abs(ndc.x)<.01&&Math.abs(ndc.y)<.01)break;
      game.yaw-=THREE.MathUtils.clamp(ndc.x,-1,1)*.22;
      game.pitch=THREE.MathUtils.clamp(game.pitch+THREE.MathUtils.clamp(ndc.y,-1,1)*.19,-1.15,1.15);await frame();
    }
  }
  async function aim(index,point){
    await look(point);
    const okay=game.firePortal(index);
    assert(okay,'Shot input was not accepted');
    await until(()=>game.portalShots.queue.length===0&&game.portalShots.active.length===0,2,'Portal charge did not finish');
    const impact=game.portalShots.lastImpact;
    assert(impact?.valid,`Portal impact rejected at ${point.toArray()}: ${JSON.stringify(impact)}`);
    if(!okay) console.error('Aim blockers',game.raycaster.intersectObjects(game.aimBlockers,true).slice(0,6).map(h=>({name:h.object.name,point:h.point.toArray(),portal:h.object.userData.portalable,proxy:h.object.userData.collisionProxy})));
    assert(okay,`Could not shoot portal ${index} at ${point.toArray()} from ${game.playerPosition.toArray()}; camera ${game.camera.position.toArray()}`);
  }
  async function pickup(){game.interact();assert(game.heldCube,'Pickup failed');await wait(.55);}
  async function mark(name){const item={name,player:game.playerPosition.toArray(),cargo:game.cargo.position.toArray(),teleports:game.teleportCount};report.milestones.push(item);await onMilestone(item,game);}
  async function enter(patch,seconds=4){
    const f=patch.getFrame(),before=game.teleportCount;
    await walk(f.center.x+f.normal.x*1.35,f.center.z+f.normal.z*1.35);
    for(let n=0;n<seconds*60&&game.teleportCount===before;n++){worldMove(-f.normal.x,-f.normal.z);await frame();}
    stop();assert(game.teleportCount>before,`Entry traversal failed at ${game.playerPosition.toArray()} into ${patch.name}: ${game.portals.portals.map(p=>p?.position.toArray())}`);await wait(.6);
  }
  try {
    await wait(.5);
    await runRoom21({game,level,walk,wait,aim,look,until,pickup,enter,mark,frame,worldMove,stop},options);
    assert(game.state==='won','Joint arrival missing');
    report.pass=true;report.teleports=game.teleportCount;report.options=options;
    report.simulationSeconds=game.elapsed/1000;report.recordingSeconds=report.frames/60;
    return report;
  } finally {
    stop();game.input.getMove=oldMove;game.respawn=respawn;game.physics.resetCargo=resetCargo;
  }
}
