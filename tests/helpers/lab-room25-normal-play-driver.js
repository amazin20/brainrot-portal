import * as THREE from 'three';
import {runRoom25} from '../../src/game/LabRoom25Journey.js';
const V=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z);
const assert=(condition,message)=>{if(!condition)throw new Error(message);};
/** Test driver uses the public movement vector, interaction button and camera
 * controls. Actor positions, portal positions, mechanism targets and win flags
 * are never assigned by the route. Run only in a debug build or Node test. */
export async function runRoom25NormalPlay(game,{onMilestone=()=>{},scenario=null,journeyOptions={}}={}) {
  const oldMove=game.input.getMove,move=new THREE.Vector2();game.input.getMove=()=>move.clone();
  assert(game.state==='playing'&&game.levelIndex===24,'Start at normal untouched Room25 Play spawn');const level=game.firstLevel,index=game.levelIndex;
  const identity=game.cargo.group.uuid,body=game.physics.cargoBody.id,report={level:index+1,id:level.id,pass:false,milestones:[],respawns:0,resets:0,frames:0};
  const respawn=game.respawn,resetCargo=game.physics.resetCargo,resetRun=game.resetRun;report.cargoResets=0;
  game.resetRun=function(...args){report.resets++;return resetRun.apply(this,args);};
  game.respawn=function(...args){report.respawns++;return respawn.apply(this,args);};
  game.physics.resetCargo=function(...args){report.cargoResets++;return resetCargo.apply(this,args);};
  function frame(){
    if(game.state==='playing'){game.updatePlaying(1/120);if(game.state==='playing')game.updatePlaying(1/120);}
    game.updateVisuals(1/60,1);report.frames++;
    assert(report.respawns===0&&report.resets===0&&report.cargoResets===0,`Level ${index+1}: unexpected reset at ${game.playerPosition.toArray()}`);
    assert(game.cargo.group.uuid===identity&&game.physics.cargoBody.id===body,'Companion identity changed');
  }
  function stop(){move.set(0,0);game.input.keys.clear();}
  function worldMove(x,z){const v=V(x,0,z).applyAxisAngle(V(0,1,0),-game.yaw);move.set(v.x,v.z);}
  function wait(seconds){stop();for(let n=0;n<Math.ceil(seconds*60);n++)frame();}
  function until(condition,seconds,label){stop();for(let n=0;n<seconds*60;n++){if(condition())return;frame();}assert(condition(),`${label}: ${game.playerPosition.toArray()} / friend ${game.cargo.position.toArray()}`);}
  function walk(x,z,seconds=20){
    const target=V(x,0,z);let best=Infinity,stuck=0;
    for(let n=0;n<seconds*60&&game.state==='playing';n++){
      const delta=target.clone().sub(game.playerPosition);delta.y=0;const d=delta.length();
      if(d<.11){stop();return;}
      if(d<best-.012){best=d;stuck=0;}else stuck++;
      const pace=Math.min(1,d*1.5);delta.normalize().multiplyScalar(pace);worldMove(delta.x,delta.z);frame();
      if(stuck>420)throw new Error(`Blocked walking to ${x},${z} at ${game.playerPosition.toArray()}`);
    }
    stop();assert(game.state==='won'||Math.hypot(game.playerPosition.x-x,game.playerPosition.z-z)<.3,`Walk timed out at ${game.playerPosition.toArray()} target ${x},${z}`);
  }
  function look(point){
    stop();
    for(let n=0;n<240;n++){
      game.scene.updateMatrixWorld(true);
      if(point.clone().sub(game.camera.position).dot(game.camera.getWorldDirection(V()))<0){game.yaw+=.18;frame();continue;}
      const ndc=point.clone().project(game.camera);
      if(n>20&&Math.abs(ndc.x)<.001&&Math.abs(ndc.y)<.001)break;
      game.yaw-=THREE.MathUtils.clamp(ndc.x,-1,1)*.22;
      game.pitch=THREE.MathUtils.clamp(game.pitch+THREE.MathUtils.clamp(ndc.y,-1,1)*.19,-1.15,1.15);frame();
    }
  }
  function aim(index,point){
    look(point);
    const okay=game.firePortal(index);
    assert(okay,'Shot input was not accepted');
    until(()=>game.portalShots.queue.length===0&&game.portalShots.active.length===0,2,'Portal charge did not finish');
    const impact=game.portalShots.lastImpact;
    assert(impact?.valid,`Portal impact rejected at ${point.toArray()}: ${JSON.stringify(impact)}`);
    if(!okay) console.error('Aim blockers',game.raycaster.intersectObjects(game.aimBlockers,true).slice(0,6).map(h=>({name:h.object.name,point:h.point.toArray(),portal:h.object.userData.portalable,proxy:h.object.userData.collisionProxy})));
    assert(okay,`Could not shoot portal ${index} at ${point.toArray()} from ${game.playerPosition.toArray()}; camera ${game.camera.position.toArray()}`);
  }
  function pickup(){game.interact();assert(game.heldCube,'Pickup failed');wait(.55);}
  function mark(name){const item={name,player:game.playerPosition.toArray(),cargo:game.cargo.position.toArray(),teleports:game.teleportCount};report.milestones.push(item);onMilestone(item,game);}
  function enter(patch,seconds=4){
    const f=patch.getFrame(),before=game.teleportCount;
    walk(f.center.x+f.normal.x*1.35,f.center.z+f.normal.z*1.35);
    for(let n=0;n<seconds*60&&game.teleportCount===before;n++){worldMove(-f.normal.x,-f.normal.z);frame();}
    stop();assert(game.teleportCount>before,`Entry traversal failed at ${game.playerPosition.toArray()} into ${patch.name}: ${game.portals.portals.map(p=>p?.position.toArray())}`);wait(.6);
  }
  try {
    wait(.5);
    if(scenario){
      await scenario({game,level,walk,wait,aim,look,until,pickup,enter,mark,frame,worldMove,stop});
      report.pass=true;report.kind='recovery';report.teleports=game.teleportCount;return report;
    }
    await runRoom25({game,level,walk,wait,aim,look,until,pickup,enter,mark,frame,worldMove,stop},journeyOptions);
    until(()=>game.state==='won',3,'Goal did not complete');
    assert(game.heldCube===game.cargo,'Original companion lost from hands');mark('both at exit');
    report.pass=true;report.teleports=game.teleportCount;if(journeyOptions.alternative)report.alternative=journeyOptions.alternative;return report;
  } catch(error) {error.ordinaryReport=structuredClone(report);throw error;} finally {
    stop();game.input.getMove=oldMove;game.respawn=respawn;game.physics.resetCargo=resetCargo;game.resetRun=resetRun;
  }
}

