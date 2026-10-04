import * as THREE from 'three';
import {runRoom14} from '../../src/game/LabRoom14Journey.js';
const V=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z);

export function foldSprint(d,target,seconds,{jumpEvery=5,interactEvery=0}={}){
 d.game.input.keys.add('ShiftLeft');
 for(let n=0;n<seconds*60&&d.game.state==='playing';n++){
  const delta=target.clone().sub(d.game.playerPosition);delta.y=0;
  if(delta.length()<.17&&!interactEvery)break;
  delta.normalize();d.worldMove(delta.x,delta.z);
  if(jumpEvery&&n%jumpEvery===0)d.game.input.jumpQueued=true;
  if(interactEvery&&n%interactEvery===0)d.game.interactQueued=true;
  d.frame();
 }
 d.stop();
}
function collect(d){
 if(d.game.heldCube)return;
 for(const [x,z]of [[1.25,0],[-1.25,0],[0,1.25],[0,-1.25]]){
  const c=d.game.cargo.position;foldSprint(d,V(c.x+x,0,c.z+z),4,{jumpEvery:0});d.game.interact();d.wait(.4);if(d.game.heldCube)return;
 }
 throw Error('Could not collect cargo after actual fold attack');
}

/** Replays the reproduced input-only full win on the original static stair.
 * Actor/portal/mechanism state is never assigned. `finish:false` observes the
 * physical folded passage only, for targeted timing/free-push regressions. */
export async function runRoom14FoldAttack(d,{finish=true,jumpEvery=5,interactEvery=11,freePush=false,precharge=false}={}){
 const stopped=Symbol('island-prefix');let reached=false;
 try{await runRoom14({...d,mark:name=>{d.mark(name);if(name==='stable island reached'){reached=true;throw stopped;}}});}catch(e){if(e!==stopped)throw e;}
 if(!reached)throw Error('Setup did not physically reach the stable island');
 const evidence=d.evidence??(d.evidence={});evidence.reachedStableIsland=true;evidence.cargoTransportsBefore=d.game.physics.portalTransports;
 if(precharge){
  d.walk(-2.65,0);d.walk(-2,0);d.wait(.4);d.game.interact();d.wait(.7);
  d.until(()=>d.level.state.counterweightStair.offset>-.01,5,'Actual island weight did not raise the span before the rush');
  evidence.prechargedOffset=d.level.state.counterweightStair.offset;collect(d);
 }
 if(freePush){d.look(V(-1.5,8.5,-10));d.game.interact();d.wait(.7);}
 foldSprint(d,V(-1.5,12,-12.7),15,{jumpEvery,interactEvery});
 evidence.northFoldReached=d.game.playerPosition.z<-11&&d.game.playerPosition.y>10;
 evidence.cargoAtFold=d.game.cargo.position.toArray();evidence.heldAtFold=Boolean(d.game.heldCube);
 evidence.cargoTransportsAfterFold=d.game.physics.portalTransports;evidence.spanOffset=d.level.state.counterweightStair?.offset??null;
 if(!finish)return evidence;
 if(!d.game.heldCube)collect(d);
 d.wait(.4);d.walk(1.5,-12.7);d.wait(.2);d.game.input.jumpQueued=true;d.walk(3,-12.7);d.wait(.2);d.game.input.jumpQueued=true;d.walk(3,-7);d.wait(.4);
 evidence.cargoAtReceiver=d.game.cargo.position.toArray();evidence.playerAtReceiver=d.game.playerPosition.toArray();evidence.heldAtReceiver=Boolean(d.game.heldCube);
 if(d.game.playerPosition.y<11.8||d.game.cargo.position.y<11.8)return evidence;
 d.look(V(4,13.2,-6));d.game.interact();d.wait(.8);d.aim(1,d.level.panels['weave-north'].getFrame().center);
 d.wait(.2);d.game.input.jumpQueued=true;d.walk(4.7,-12.7);d.wait(.4);foldSprint(d,V(1.1,12,-12.7),6);d.walk(-1.5,-12.7);
 for(const [x,z]of [[-1.5,-2.3],[-2.85,-2.3],[-2.85,1.5]])d.walk(x,z);
 d.aim(0,d.level.panels['light-source'].getFrame().center);d.wait(.4);
 d.walk(-1.5,0);d.walk(-1.5,-12.7);d.walk(1.5,-12.7);d.wait(.2);d.game.input.jumpQueued=true;d.walk(3,-12.7);d.wait(.2);d.game.input.jumpQueued=true;d.walk(3,-7);
 collect(d);const centre=d.level.state.lightBridge.segments[1].a.x;d.walk(d.game.playerPosition.x,-7);d.wait(.2);d.game.input.jumpQueued=true;d.walk(centre,d.game.playerPosition.z);d.wait(.4);d.walk(3,-25.6);d.until(()=>d.game.state==='won',3,'Fold attack final arrival');
 evidence.cargoTransportsAtFinish=d.game.physics.portalTransports;return evidence;
}
