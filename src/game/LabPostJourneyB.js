import * as THREE from 'three';
import {installRoom21Aim} from './LabRoom21Journey.js';
import {CAMERA_PITCH_MIN,CAMERA_PITCH_MAX} from './LabCamera.js';
import {runThermalMemory} from './LabLateCampaignThermalJourney.js';
import {runCreativeFinal} from './LabCreativeFinalJourney.js';

const check=(ok,message)=>{if(!ok)throw Error(message);};
function prepare(d){
 installRoom21Aim(d);
 d.look=point=>{
  d.stop();for(let n=0;n<600;n++){
   const g=d.game;g.scene.updateMatrixWorld(true);
   if(point.clone().sub(g.camera.position).dot(g.camera.getWorldDirection(new THREE.Vector3()))<0){g.yaw+=.16;d.frame();continue;}
   const p=point.clone().project(g.camera);
   if(n>30&&Math.abs(p.x)<.00015&&Math.abs(p.y)<.00015)return;
   g.yaw-=THREE.MathUtils.clamp(p.x,-1,1)*.18;
   g.pitch=THREE.MathUtils.clamp(g.pitch+THREE.MathUtils.clamp(p.y,-1,1)*.17,CAMERA_PITCH_MIN,CAMERA_PITCH_MAX);
   d.frame();
  }
 };
}
function collect(d){
 for(let n=0;n<12;n++){
  const p=d.game.cargo.position;d.walk(p.x+1.35,p.z);
  if(d.game.playerPosition.distanceTo(d.game.cargo.position)<2.2){d.pickup();return;}
 }
 throw Error('Original moving companion is unreachable by ordinary walking');
}
function release(d){d.stop();d.wait(.3);check(d.game.interact()&&!d.game.heldCube,'Cannot put down the original companion');d.wait(.9);}

function room38(d,{route='carry-freight-then-launch',recover=false}={}){
 const {game:g,level:l,walk,wait,until,mark,frame,worldMove,stop}=d,p=l.panels;
 check(['carry-freight-then-launch','send-freight-early'].includes(route),'Unknown room38 route');
 collect(d);walk(11,2);release(d);
 const f=l.freight.floor,c=g.cargo.position;
 check(!g.heldCube&&c.x>f.minX+.2&&c.x<f.maxX-.2&&c.z>f.minZ+.2&&c.z<f.maxZ-.2&&Math.abs(c.y-f.y)<1.5,
  'Original loose companion is not on the actual freight floor');
 mark('The original companion waits on its own cargo elevator');
 if(route==='send-freight-early'){
  walk(17,13);check(g.interact()&&l.freight.target===1,'Lower console did not start loaded freight');
  until(()=>l.freight.at(1),12,'Freight missed upper docking station');
  check(g.cargo.position.y>14,'Original companion failed early freight trip');
  mark('Original companion reaches upper dock before player launches');
 }
 walk(11,12);walk(2,12);walk(-15,8.2);d.aim(0,p['well-entry'].getFrame().center);
 if(recover){
  walk(-11,4);until(()=>g.playerGrounded&&g.playerPosition.y< -3.5,5,'Service recovery floor missed');
  walk(-8,-12);walk(25,-12);walk(25,16);walk(19,16);walk(-18,14);
  check(g.playerPosition.y>-.01,'Dry recovery ramp failed');
  mark('A missed drop returns through the service floor without resetting the freight');
 }
 walk(-23,9);mark('west entrance to ascent');walk(-23,-16);mark('west balcony end');walk(-15,-13.4);
 check(g.playerPosition.y>13.9,`West acceleration balcony was not reached: ${g.playerPosition.toArray()}`);
 d.aim(1,p['angle-outlet'].getFrame().center);
 walk(-17,-12.1);wait(.4);
 const before=g.teleportCount;
 for(let n=0;n<180&&g.playerGrounded;n++){worldMove(0,1);frame();}stop();
 until(()=>g.teleportCount>before,5,'Physical fall failed to enter the portal');
 until(()=>g.playerGrounded,6,'Ballistic receiving gallery missed');
 check(g.playerPosition.y>14.9,'Real gravity did not supply sufficient flight height');
 mark('The player reaches the remote upper freight switch with earned speed');
 if(route!=='send-freight-early'){
  walk(15.8,-19);check(g.interact()&&l.freight.target===1,'Upper console failed to dispatch the original companion');
  until(()=>l.freight.at(1),12,'Freight missed receiving dock');
  check(g.cargo.position.y>14,'Original cargo failed to rise with its platform');
  mark('High-gallery console raises original loose companion after independent flight');
 }
 collect(d);walk(15,-18);until(()=>g.state==='won',3,'Separated travellers failed to reunite at goal');
}

const room39=runThermalMemory;

export function runPostB(d,options={}){
 prepare(d);
 if([35,36,39].includes(d.level.index))return runCreativeFinal(d,options);
 const runner={37:room38,38:room39}[d.level.index];
 check(runner,`Unknown post-campaign room ${d.level.index+1}`);
 return runner(d,options);
}
