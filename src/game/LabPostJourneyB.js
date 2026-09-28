import * as THREE from 'three';
import {installRoom21Aim} from './LabRoom21Journey.js';
import {CAMERA_PITCH_MIN,CAMERA_PITCH_MAX} from './LabCamera.js';

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

function raiseDrive(d,{prepareLight=false}={}){
 const {game:g,level:l,walk,wait,until,mark}=d,p=l.panels;
 d.aim(0,p['air-source'].getFrame().center);
 const west=l.index===39?-27:-28;
 walk(west,6);walk(west,-21);
 d.aim(1,p['air-receiver'].getFrame().center);
 until(()=>l.drive.flow,2,'A geometric flow did not reach the front grille');
 mark('The physical air path spins the real flywheel');
 if(prepareLight){
  wait(11);walk(-30,7);walk(-8,8);walk(-8,-24);walk(-28,-24);
  d.aim(0,p[l.index===35?'light-source':'projector-capture'].getFrame().center);
  d.aim(1,p[l.index===35?'island-beam':'first-light-destination'].getFrame().center);
  check(l.drive.wheel.omega>10,'Mechanism lost all its stored rotation');
  mark('The new light route is prepared using retained mechanical energy');
 }
 walk(-30,8);walk(-8,10);collect(d);
 walk(-20,6);walk(-20,-3);
 until(()=>l.cabin.position.y>5.98,25,'Occupied lift failed to reach actual upper gallery');
 walk(-20,-15);
 mark('The pair reaches permanent upper flooring and retains the original companion');
}

function room36(d,{route='raise-then-relay',recover=false,stopAfterFirstBridge=false}={}){
 const {game:g,level:l,walk,wait,until,mark}=d,p=l.panels;
 check(['raise-then-relay','prepare-light-first'].includes(route),'Unknown room36 route');
 raiseDrive(d,{prepareLight:route==='prepare-light-first'});
 if(recover){
  release(d);walk(-11,-13);until(()=>g.playerGrounded&&g.playerPosition.y<.1,5,'Service floor fall missed');
  walk(-9,6);walk(-9.6,7);check(g.interact(),'Real recall control missed');
  until(()=>l.cabin.position.y<.02,5,'Cabin did not return');
  walk(-20,6);walk(-20,-3);until(()=>l.cabin.position.y>5.98,25,'Cabin failed to recover companion');
  walk(-20,-15);collect(d);mark('Lift and same companion physically recovered after a fall');
 }
 if(route!=='prepare-light-first'){
  release(d);walk(-22,-13);
  d.aim(0,p['light-source'].getFrame().center);
  d.aim(1,p['island-beam'].getFrame().center);wait(.4);collect(d);
 }
 check(l.light.segments.length>1,'First light causeway is missing');
 walk(-20,-17);walk(5,-17);mark('Pair arrives on the permanent relay island');
 if(stopAfterFirstBridge)return;
 release(d);d.aim(1,p['last-turn'].getFrame().center);wait(.4);
 check(l.light.segments.length>1,'Light relay failed to redirect');
 collect(d);walk(5,-34);
 until(()=>g.state==='won',3,'Reconfigured optical exit did not accept both travellers');
 mark('Perpendicular light route completes the chamber');
}

function room37(d,{route='ride-all-berths'}={}){
 const {game:g,level:l,walk,until,mark,enter}=d,p=l.panels,c=l.car;
 check(['ride-all-berths','dispatch-cargo-first'].includes(route),'Unknown room37 route');
 d.aim(0,p['stationary-entry'].getFrame().center);
 d.aim(1,c.panel.getFrame().center);
 collect(d);enter(p['stationary-entry']);
 if(route==='dispatch-cargo-first'){
  walk(-18,-3);release(d);
  walk(-23,-3);walk(-22.7,-16.7);
  check(g.interact()&&c.target===1,'Side terminal failed to dispatch original loose cargo');
  until(()=>c.at(1),15,'Loaded cabin missed middle dock');
  check(g.cargo.position.y>7,'Original companion failed to travel on moving floor');
  walk(-15,-12);walk(-15,-8);
  until(()=>g.playerGrounded&&g.playerPosition.y<0,5,'Lower return floor or service ramp missed');
  walk(-19,-8);walk(-19,12);walk(-16,12);enter(p['stationary-entry']);
  mark('Freight and player take separate physical routes to the middle dock');
 }else{
  walk(-18,-3);release(d);
  walk(-14.4,0);check(g.interact()&&c.target===1,'Onboard dispatch to middle dock missed');
  until(()=>c.at(1),15,'Occupied car missed the second berth');
  mark('A portal, player, and companion all arrive at the middle berth aboard one car');
 }
 // The carriage portal is live on the middle dock. Walk around its visible
 // frame instead of accidentally stepping through to the lower entry.
 walk(1.5,-2.8);walk(7,-2.8);walk(7,-8);walk(4,-11);walk(0,-15.5);
 check(g.interact(),'The middle dock transmission selector missed');
 walk(4,-11);walk(7,-8);walk(7,-2.8);walk(1.5,-2.8);walk(1.5,0);
 check(g.interact()&&c.target===2,'Onboard dispatch failed to engage selected final gear');
 until(()=>c.at(2),15,'The third physical berth was not reached');
 collect(d);
 walk(22,-1.8);walk(22,-8);walk(20,-12);walk(16,-17);
 until(()=>g.state==='won',3,'Original companion failed to reach third berth');
 mark('Two real berth changes bring the pair to the shared finish');
}

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

function room39(d,{route='companion-first',recover=false}={}){
 const {game:g,level:l,walk,until,wait,mark}=d,p=l.panels;
 check(['companion-first','scout-first'].includes(route),'Unknown room39 route');
 if(recover){
  walk(-13,16);until(()=>g.playerGrounded&&g.playerPosition.y< -3.5,5,'Dry fall missed');
  walk(-16,-20);walk(-23,-20);walk(-23,4);walk(-21,15);
  mark('Lower floor returns to the same high start with no reset');
 }
 d.aim(0,p['source-one'].getFrame().center);
 d.aim(1,p['island-arrival'].getFrame().center);wait(.3);
 check(l.first.segments.length>1,'First projector lacks its portal path');
 if(route==='companion-first')collect(d);
 walk(-19,7);walk(5,7);walk(5,5);
 if(route==='scout-first'){
  walk(-20,7);collect(d);walk(-19,7);walk(5,7);walk(5,5);
  mark('The first bridge is explored before accompanying the original companion');
 }
 release(d);
 // The second projector housing is a genuine opaque obstacle. View its
 // ceramic receiver obliquely from the island's rear inspection strip.
 walk(5,11);d.aim(0,p['source-two'].getFrame().center);
 walk(5,5);d.aim(1,p['exit-turn'].getFrame().center);wait(.3);
 check(l.second.segments.length>1,`Second projector did not feed final bridge: ${JSON.stringify({segments:l.second.segments.map(s=>[s.a.toArray(),s.b.toArray(),s.kind]),portals:g.portals.portals.map(q=>q?.position.toArray()),impact:g.portalShots.lastImpact})}`);
 check(g.playerGrounded&&g.playerPosition.y>5.9,'Player left the permanent switching island');
 collect(d);walk(5,0);walk(5,-20);
 until(()=>g.state==='won',3,'Second projector failed joint exit');
 mark('Changed projector reaches exit without preserving a temporary light bridge');
}

function room40(d,{route='motor-then-plate',stopBeforePlate=false}={}){
 const {game:g,level:l,walk,wait,until,mark}=d,p=l.panels;
 check(['motor-then-plate','bridge-prepared-first'].includes(route),'Unknown room40 route');
 raiseDrive(d,{prepareLight:route==='bridge-prepared-first'});
 if(route!=='bridge-prepared-first'){
  release(d);walk(-22,-13);
  d.aim(0,p['projector-capture'].getFrame().center);
  d.aim(1,p['first-light-destination'].getFrame().center);wait(.4);collect(d);
 }
 check(l.light.segments.length>1,'Station heart did not make its light crossing');
 walk(-20,-17);walk(5,-17);
 if(stopBeforePlate)return;
 release(d);
 until(()=>l.shutter.position.y>15,3,'Original companion did not release the visible mechanical shutter');
 check(l.plate.loaded(),'The real pressure plate is not carrying the companion');
 mark('Original companion loads centre plate and ratchet opens the actual shutter');
 collect(d);walk(19,-17);
 until(()=>g.state==='won',3,'The pair did not reach the last gallery after opening its gate');
 mark('Ratcheted shutter stays clear while the companion is recovered');
}

export function runPostB(d,options={}){
 prepare(d);
 const runner=[room36,room37,room38,room39,room40][d.level.index-35];
 check(runner,`Unknown post-campaign room ${d.level.index+1}`);
 return runner(d,options);
}
