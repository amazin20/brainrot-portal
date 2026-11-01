import test from 'node:test';
import assert from 'node:assert/strict';
import {createHeadlessGame} from '../scripts/lab-headless.mjs';
import {disposeLabLevel} from '../src/game/LabLevelLifecycle.js';
import {runV8Journey} from '../src/game/LabV8Journey.js';
import {ACTIVE_FOUNDATION_RUNTIME_FLAGS} from '../src/game/ReleaseIdentity.js';

test('current14 freight view, passenger transition and glass-side reunion retain a visible collision-safe camera',async()=>{
 const game=await createHeadlessGame();Object.assign(game,{chamberEdition:'foundation',...ACTIVE_FOUNDATION_RUNTIME_FLAGS});await game.selectLevel(13,true);
 game.camera.aspect=1.6;game.camera.updateProjectionMatrix();
 const update=game.updateVisuals;let active=false,crossing=false,frames=0,crossingFrames=0,ordinaryCrossingFrames=0,unseen=0,longestUnseen=0,minimum=Infinity,settling=false;
 game.updateVisuals=function(...args){
  update.apply(this,args);if(!active||crossingFrames>=120)return;
  crossing ||= this.teleportCount>0;frames++;if(crossing){crossingFrames++;if(!settling)ordinaryCrossingFrames++;}
  const pivot=this.cameraRig.playerPivot;minimum=Math.min(minimum,this.camera.position.distanceTo(pivot));
  const screen=pivot.clone().project(this.camera),visible=Math.abs(screen.x)<1&&Math.abs(screen.y)<1&&screen.z> -1&&screen.z<1;
  unseen=visible?0:unseen+1;longestUnseen=Math.max(longestUnseen,unseen);
  const swept=this.camera.position.clone();this.cameraRig.constrain(pivot,swept);
  assert.ok(swept.distanceTo(this.camera.position)<1e-7,'The final camera crossed a real current14roof, wall or observation pane');
 };
 try{
  const report=await runV8Journey(game,{journeyOptions:{nativeStart:true},onMilestone:item=>{if(item.name==='light contact carries the original companion across the unsupported turn')active=true;}});
  assert.equal(report.pass,true);assert.equal(report.respawns+report.resets,0);assert.equal(game.state,'won');
  assert.ok(ordinaryCrossingFrames>=30,'Observe the actual passenger transfer and final approach, not only a frozen goal pose');
  // This new route has no old upper boarding jump. Explicit render-only
  // settling supplements the actual crossing to120postarrival observations;
  // it changes neither actor pose nor the physics world.
  settling=true;const step=game.physics.world.stepnumber;while(crossingFrames<120)game.updateVisuals(1/60,1);assert.equal(game.physics.world.stepnumber,step);
  assert.equal(crossingFrames,120);assert.ok(frames>crossingFrames);assert.ok(minimum>=2.2,`The camera entered the character: ${minimum}m`);assert.ok(longestUnseen<=8,`The real passenger path hid the traveller for${longestUnseen/60}s`);
 }finally{game.updateVisuals=update;disposeLabLevel(game);}
});
