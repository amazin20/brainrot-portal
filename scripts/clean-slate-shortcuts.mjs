import fs from 'node:fs';
import * as THREE from 'three';
import {createHeadlessGame} from './lab-headless.mjs';
import {runV8Journey} from '../src/game/LabV8Journey.js';
import {installRoom21Aim} from '../src/game/LabRoom21Journey.js';
const g=await createHeadlessGame();await g.selectLevel(20,false);
const cases=[];
try{
 for(const exit of ['freight-mouth','departure-entry','brake-bay'])for(const steer of [-1,0,1]){
  let transfer,landing;
  const route=await runV8Journey(g,{scenario:d=>{
   installRoom21Aim(d);d.walk(0,7.85);
   d.aim(0,d.level.panels['shared-well'].getFrame().center.clone().setZ(7.1));
   if(exit==='brake-bay')d.walk(-13,9);else if(exit==='departure-entry')d.walk(-10,14);
   d.aim(1,d.level.panels[exit].getFrame().center);
   d.walk(g.cargo.position.x+1,g.cargo.position.z);d.pickup();d.walk(0,12);d.walk(0,8.05);
   const before=g.teleportCount;
   for(let i=0;i<360&&g.playerGrounded;i++){d.worldMove(0,-.15);d.frame();}
   d.stop();d.until(()=>g.teleportCount>before,5,'The attempt must really traverse the portal');
   transfer=g.playerPosition.toArray();
   for(let i=0;i<480&&!g.playerGrounded;i++){d.worldMove(0,steer);d.frame();}d.stop();
   if(!g.playerGrounded)throw Error('Attempt did not reach a stable landing');
   landing=g.playerPosition.toArray();
   if(g.state==='won'||d.level.isWon())throw Error('An initial pair bypassed the entire mechanism');
   if(d.level.cassette.height!==d.level.cassette.high||!g.heldCube)throw Error('Unexpected actuator/cargo change');
  }});
  cases.push({exit,steer,transfer,landing,route,pass:true});console.log(exit,steer,landing);
 }
}finally{
 const out=process.env.EVIDENCE_OUT||'smoke-artifacts/clean-slate';fs.mkdirSync(out,{recursive:true});
 fs.writeFileSync(out+'/ordinary-shortcuts.json',JSON.stringify({scope:'Nine finite ordinary-input carried launch attempts through the three initially visible wall faces. Not exhaustive search.',cases,complete:cases.length===9},null,2));
 g.physics.dispose();g.portals.dispose();
}
