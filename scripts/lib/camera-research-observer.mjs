// Self-contained so Puppeteer can evaluate the same observer in production.
// Delegates existing functions unchanged; observes references and real frames.
export function installCameraResearchObserver({game=globalThis.__NESI_DEMO_GAME__,expose=true,pauseAnimationLoop=false}={}){
 const check=(value,message)=>{if(!value)throw Error(message);};
 check(game,'Production game is required');
 // Play reinstalls the normal animation loop. Pause in this SAME browser
 // invocation, before the observation boundary, so no CDP gap is counted.
 if(pauseAnimationLoop){check(typeof game.renderer?.setAnimationLoop==='function','A production renderer must pause atomically');game.renderer.setAnimationLoop(null);}
 const cargo=game.cargo,body=game.physics.cargoBody,mesh=game.animator.rig.mesh;
 const playerAsset=game.assets.get(1),cargoAsset=game.assets.get(2);
 const originals={visual:game.updateVisuals,resetRun:game.resetRun,resetCargo:game.physics.resetCargo,respawn:game.respawn};
 const identity=()=>({cargoUUID:game.cargo.group.uuid,cargoBodyId:game.physics.cargoBody.id,playerMeshUUID:game.animator.rig.mesh.uuid,playerSkinVertices:game.animator.rig.mesh.geometry.getAttribute('skinIndex').count,playerBones:game.animator.rig.mesh.skeleton.bones.length});
 const row={scope:'Two targeted research recordings; not full campaign, human, device, live or art acceptance',animationLoopPausedAtInstall:pauseAnimationLoop,start:identity(),observedVisualFrames:0,resetRunCalls:0,resetCargoCalls:0,respawnCalls:0,initializationRespawnFalseCalls:0,routeRespawnCalls:0,initializationBeforeFirstFrame:true,originalReferencesEveryFrame:true};
 let resetDepth=0;
 function references(){
  const same=game.cargo===cargo&&game.physics.cargoBody===body&&game.animator.rig.mesh===mesh&&game.assets.get(1)===playerAsset&&game.assets.get(2)===cargoAsset;
  row.originalReferencesEveryFrame&&=same;check(same,'Original cargo/body/player mesh/asset references changed');
  const current=identity();check(current.cargoUUID===row.start.cargoUUID&&current.cargoBodyId===row.start.cargoBodyId&&current.playerMeshUUID===row.start.playerMeshUUID,'Original actor identity changed');
 }
 game.resetRun=function(...args){row.resetRunCalls++;row.initializationBeforeFirstFrame&&=row.observedVisualFrames===0;resetDepth++;try{return originals.resetRun.apply(this,args);}finally{resetDepth--;}};
 game.physics.resetCargo=function(...args){row.resetCargoCalls++;row.initializationBeforeFirstFrame&&=row.observedVisualFrames===0;return originals.resetCargo.apply(this,args);};
 game.respawn=function(...args){row.respawnCalls++;if(resetDepth>0&&row.observedVisualFrames===0&&args[0]===false)row.initializationRespawnFalseCalls++;else row.routeRespawnCalls++;return originals.respawn.apply(this,args);};
 game.updateVisuals=function(...args){const result=originals.visual.apply(this,args);if(args[0]>0){row.observedVisualFrames++;references();}return result;};
 const observer={
  snapshot(){references();return {...row,finish:identity(),state:game.state,sameCargo:game.cargo===cargo,sameBody:game.physics.cargoBody===body,samePlayerMesh:game.animator.rig.mesh===mesh,cargoTransports:game.physics.portalTransports,playerTransports:game.teleportCount};},
  finish(route){
   const result=this.snapshot();check(route.pass&&game.state==='won'&&game.firstLevel.isWon(),'Ordinary route must reach actual joint victory');
   check(route.resets===0&&route.respawns===0&&row.routeRespawnCalls===0,'Zero in-route resets/respawns required');
   check(row.resetRunCalls===1&&row.resetCargoCalls===1&&row.respawnCalls===1&&row.initializationRespawnFalseCalls===1&&row.initializationBeforeFirstFrame,'Exactly one disclosed legacy route initialization before its first frame');
   return {...result,initialization:{resetRunCalls:1,resetCargoCalls:1,respawnFalseCalls:1,beforeFirstPositiveVisualFrame:true,excludedFromRouteCounters:true},routeResets:route.resets,routeRespawns:route.respawns,routeFrames:route.frames};
  },
  dispose(){game.updateVisuals=originals.visual;game.resetRun=originals.resetRun;game.physics.resetCargo=originals.resetCargo;game.respawn=originals.respawn;if(expose)delete globalThis.__NESI_CAMERA_RESEARCH_OBSERVER__;},
 };
 if(expose)globalThis.__NESI_CAMERA_RESEARCH_OBSERVER__=observer;
 return observer;
}
