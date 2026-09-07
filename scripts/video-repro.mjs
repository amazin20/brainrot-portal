import fs from 'node:fs';
import {createHeadlessGame} from './lab-headless.mjs';
const g=await createHeadlessGame();await g.selectLevel(10,false);
const out={note:'Reachable starting-position fixtures; full update including rendering, jump input and camera-relative movement.',scenarios:[]};
for (const fps of [30,60,144]) {
 g.resetRun(true);g.playerPosition.set(1.5,0,8.6);g.previousPlayerPosition.copy(g.playerPosition);g.facing=Math.PI;g.updateVisuals(0,1);
 let respawns=0,resets=0;const orig=g.resetRun;g.resetRun=function(...a){resets++;return orig.apply(this,a)};
 g.interact();let acc=0,maxErr=0,maxHand=0,losses=0,jumps=0,minUp=1;
 const samples=[];for(let frame=0;frame<fps*10;frame++){
  const time=frame/fps;
  if(time>1){g.input.keys.add('KeyW');g.input.keys.add('ShiftLeft');g.yaw=time<4?time*4:-time*6;}
  if(frame%(Math.round(fps*.7))===0&&time>1){g.input.jumpQueued=true;jumps++;}
  acc+=1/fps;while(acc>=1/120){g.updatePlaying(1/120);acc-=1/120;}
  g.updateVisuals(1/fps,acc*120);
  if(!g.heldCube)losses++;
  if(time>1&&g.physics.carryTarget){const t=g.physics.carryTarget.position,b=g.physics.cargoBody.position;maxErr=Math.max(maxErr,t.distanceTo(b));const d=g.animator.diagnostics.carryReach;maxHand=Math.max(maxHand,d.leftError||0,d.rightError||0);if(frame%Math.round(fps/5)===0)samples.push({time,error:t.distanceTo(b),hand:d,player:g.playerPosition.toArray(),cargo:g.cargo.position.toArray()});}
 }
 g.resetRun=orig;out.scenarios.push({fps,maxErr,maxHand,losses,jumps,resets,samples});console.log(fps,maxErr,maxHand,losses,resets);
}
fs.mkdirSync('qa',{recursive:true});fs.writeFileSync(process.env.REPRO_REPORT||'qa/video-after.json',JSON.stringify(out,null,2));g.physics.dispose();g.portals.dispose();
