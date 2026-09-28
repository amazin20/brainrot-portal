import * as THREE from 'three';
import {installRoom21Aim} from './LabRoom21Journey.js';
import {CAMERA_PITCH_MIN,CAMERA_PITCH_MAX} from './LabCamera.js';

const V=(...v)=>new THREE.Vector3(...v);
const check=(condition,message)=>{if(!condition)throw Error(message);};
function preciseAim(d){
 installRoom21Aim(d);
 d.look=point=>{d.stop();for(let i=0;i<600;i++){
  const g=d.game;g.scene.updateMatrixWorld(true);
  if(point.clone().sub(g.camera.position).dot(g.camera.getWorldDirection(V()))<0){g.yaw+=.16;d.frame();continue;}
  const p=point.clone().project(g.camera);
  if(i>30&&Math.abs(p.x)<.00015&&Math.abs(p.y)<.00015)return;
  g.yaw-=THREE.MathUtils.clamp(p.x,-1,1)*.18;
  g.pitch=THREE.MathUtils.clamp(g.pitch+THREE.MathUtils.clamp(p.y,-1,1)*.17,CAMERA_PITCH_MIN,CAMERA_PITCH_MAX);d.frame();
 }};
}
function collect(d){for(let i=0;i<10;i++){
 const p=d.game.cargo.position;d.walk(p.x+1.25,p.z);
 if(d.game.playerPosition.distanceTo(d.game.cargo.position)<2.2){d.pickup();return;}
}throw Error('Cannot approach the original loose companion');}
function release(d){d.stop();d.wait(.3);check(d.game.interact()&&!d.game.heldCube,'Original companion was not released');d.wait(.9);}
function load(d,pad){const {x,z}=pad.position;d.walk(x,z);d.wait(.4);release(d);d.until(()=>pad.loaded(),4,'Original companion did not load physical plate');}
function use(d,x,z,label){d.walk(x,z);d.wait(.15);check(d.game.interact(),`${label}: control did not respond`);}
function shot(d,color,surface){d.aim(color,surface.getFrame().center);}
function descendToService(d){
 d.walk(-8,8);d.game.input.jumpQueued=true;
 for(let i=0;i<95;i++){d.worldMove(1,0);d.frame();if(d.game.playerPosition.x>-3&&d.game.playerPosition.y<-.8)break;}
 d.stop();d.until(()=>d.game.playerGrounded&&d.game.playerPosition.y<-3.8,5,'Real lower service floor was not reached');
}

export function runPost31(d,{route='straight-transfer',recover=false}={}){
 preciseAim(d);check(['straight-transfer','empty-upper-first'].includes(route),'Unknown 31 route');
 const {game:g,level:l,walk,until,wait,mark}=d,p=l.panels;
 collect(d);load(d,l.call);mark('Original companion calls the first physical dock');
 walk(-12,1);use(d,-12,1,'Departure lever');until(()=>l.first.position.y>5.98,12,'First dock did not reach fixed exchange island');
 walk(0,-4);walk(4,1.2);use(d,4,1.2,'Island brake');check(l.first.braked,'First dock is not braked');
 mark('The first dock is locked on fixed island decking');
 if(route==='empty-upper-first'){
  walk(-2,-3.4);use(d,-2,-3.4,'Empty upper dispatch');
  until(()=>l.second.position.y>9.98,12,'Empty second dock did not reach upper berth');
  mark('Empty upper dock visits the destination before companion retrieval');
  walk(0,-9.5);use(d,0,-9.5,'Island recall');until(()=>l.second.position.y<6.02,12,'Empty upper dock did not return');
 }
 shot(d,1,p['relay-receiver']);
 if(recover){
  walk(0,6);
  until(()=>g.playerGrounded&&g.playerPosition.y<-3.8,5,'Loaded first-dock miss did not reach service floor');
  walk(-15,-16);walk(-22,-15);walk(-22,-2);walk(-22,5);
  check(g.playerPosition.y>-.1&&l.call.loaded()&&l.first.braked&&l.first.position.y>5.98,
   'West recovery ramp did not return to the still-loaded departure pad');
  mark('The loaded first dock stays high while its passenger returns by the west service ramp');
  shot(d,0,p['entry-weight']);
  until(()=>g.physics.grounded&&g.cargo.position.y>6,8,'Original companion did not cross from the loaded pad');
  walk(-23,5);walk(-23,18.5);walk(-18,18.5);wait(.4);
  const before=g.teleportCount;
  g.input.jumpQueued=true;
  for(let i=0;i<240&&g.teleportCount===before;i++){d.worldMove(0,-1);d.frame();}d.stop();
  until(()=>g.teleportCount>before&&g.playerGrounded&&g.playerPosition.y>5.9,6,
   'Passenger could not join the original companion on the fixed island');
  mark('Passenger uses the same real portal to rejoin the original companion');
 }else{walk(-4,-7);shot(d,0,p['entry-weight']);}
 until(()=>g.physics.grounded&&g.cargo.position.y>6,8,'Cargo did not land on the fixed island');
 check(!l.call.loaded()&&l.first.braked,'First dock did not hold its height after unloading');
 mark('The same physical companion returns through the lower address');
 if(recover){walk(0,-4);walk(3,-3);walk(g.cargo.position.x-1.25,g.cargo.position.z);d.pickup();}
 else collect(d);
 walk(0,-5);walk(9,-12);mark('Both travellers board the second independent dock');
 until(()=>l.second.position.y>9.98,12,'Second dock did not join destination');
 check(g.playerPosition.y>9.8&&g.heldCube,'Second dock did not physically carry player and companion');
 walk(18,-16);until(()=>g.state==='won',3,'Joint arrival failed');mark('Both passengers reach the raised destination');
}

export function runPost32(d,{route='load-then-return'}={}){
 preciseAim(d);check(['load-then-return','prepare-return-first'].includes(route),'Unknown 32 route');
 const {game:g,level:l,walk,until,wait,mark}=d,p=l.panels;
 collect(d);
 load(d,l.pad);until(()=>l.entry.progress>.9,5,'First physical sluice failed to open');
 check(l.exit.progress<.1,'Exit sluice did not counterbalance the first');mark('Weight opens only the entry sluice');
 walk(0,9);
 if(route==='prepare-return-first'){shot(d,1,p['return-mouth']);mark('Receiver prepared through the open entry before stepping across');}
 walk(0,0);if(route!=='prepare-return-first')shot(d,1,p['return-mouth']);
 walk(0,4);check(g.playerPosition.z<5&&g.playerGrounded,'Player did not pass the first sluice');
 shot(d,0,p['reverse-weight']);
 until(()=>!l.pad.loaded()&&l.exit.progress>.9,6,'Second physical sluice failed to open after unloading');
 until(()=>g.physics.grounded&&g.cargo.position.z<6,5,'Same cargo did not return to central court');
 mark('Cargo changes both gate states without an artificial completion step');
 collect(d);walk(6,0);walk(6,-4);walk(0,-4);walk(0,-18);
 until(()=>g.state==='won',3,'Cross-lock joint finish missed');mark('Both travellers pass the released exit sluice');
}

export function runPost33(d,{route='ride-then-send'}={}){
 preciseAim(d);check(['ride-then-send','friend-before-passenger'].includes(route),'Unknown 33 route');
 const {game:g,level:l,walk,until,wait,mark}=d,p=l.panels;
 collect(d);load(d,l.near);check(l.car.braked,'First berth must wait for its passenger');
 walk(-13,-3);use(d,-13,-3,'First shunt departure');
 until(()=>l.car.at(1),12,'Carriage missed the stationary island');mark('Carriage docks alongside the stationary gallery');
 g.input.jumpQueued=true;for(let i=0;i<60&&g.playerPosition.x<-.8;i++){d.worldMove(1,0);d.frame();}d.stop();
 until(()=>g.playerGrounded&&g.playerPosition.y>5.9,4,'Carriage passenger did not land on fixed gallery');
 walk(0,-5);walk(5,1.3);check(g.playerPosition.y>5.9,'Gallery did not support the passenger at the island brake');
 use(d,5,1.3,'Island shunt brake');
 check(l.car.braked,'Carriage was not secured at the island');mark('Loaded car docks at the real fixed island');
 if(route==='friend-before-passenger'){
  // The fixed island's service floor and west return ramp make it possible
  // to revisit the original loaded pad. The player returns on foot while the
  // original loose companion takes the floor portal to the island first.
  shot(d,1,p['island-return']);walk(0,6);
  until(()=>g.playerGrounded&&g.playerPosition.y<-3.8,5,'Island drop did not reach the real service floor');
  walk(-15,-16);walk(-22,-15);walk(-22,-2);walk(-18,17);
  check(g.playerPosition.y>-.1&&l.near.loaded(),'Dry return did not reach the original loaded pad');
  const sent=g.physics.portalTransports;shot(d,0,p['branch-a']);
  until(()=>g.physics.portalTransports>sent&&g.cargo.position.y>6,7,'Friend did not reach the island ahead of player');
  check(g.playerPosition.x<-8&&g.playerPosition.y<1,'Player must remain at start during freight dispatch');
  mark('Original companion crosses first while player remains on the start bank');
  const before=g.teleportCount;
  walk(-18,16);
  for(let i=0;i<240&&g.teleportCount===before;i++){d.worldMove(0,-1);d.frame();}d.stop();
  until(()=>g.teleportCount>before&&g.playerGrounded&&g.playerPosition.y>5.9,6,'Player did not follow through the same floor aperture');
  mark('Player follows the already delivered companion through the same address');
 }else{shot(d,1,p['island-return']);walk(-4,2);shot(d,0,p['branch-a']);}
 until(()=>g.physics.grounded&&g.cargo.position.y>6,7,'Original freight did not reach island');
 collect(d);load(d,l.far);mark('Original cargo selects the second physical switch');
 walk(0,-6.5);use(d,0,-6.5,'Second shunt departure');
 until(()=>l.car.at(2),12,'Carriage did not travel toward exit');walk(18,-10);
 shot(d,1,p['destination-return']);shot(d,0,p['branch-b']);
 until(()=>g.physics.grounded&&g.cargo.position.y>6,8,'Companion did not reach destination');
 collect(d);walk(18,-18);until(()=>g.state==='won',3,'Switchyard joint finish missed');
 mark('The original companion took two real addresses and reached the exit');
}

export function runPost34(d,{route='load-then-clamp'}={}){
 preciseAim(d);check(['load-then-clamp','explore-service-first'].includes(route),'Unknown 34 route');
 const {game:g,level:l,walk,until,wait,mark}=d,p=l.panels;
 if(route==='explore-service-first'){
  descendToService(d);
  walk(11,-12);walk(-23,-12);walk(-23,-9.6);walk(-23,0);mark('The lower service circuit really returns to the preparation dock');
 }
 collect(d);descendToService(d);
 walk(11,-12);walk(19,-12);walk(19,-9);walk(19,0);walk(14,18);load(d,l.mass);
 check(l.getClamped(),'Counterweight must remain secured while passenger returns');
 walk(19,0);walk(19,-9);walk(19,-12);walk(-23,-12);walk(-23,-9);walk(-23,0);
 walk(-15,1);use(d,-15.2,1.7,'Counterweight release');
 until(()=>l.left.position.y>7.98,12,'West cabin did not rise under its opposite load');
 check(l.right.position.y<.02,'Opposite cabin did not descend');mark('Mass raises one real cabin and lowers the other');
 walk(-18,-17);use(d,-18.2,-19,'Counterweight clamp');check(l.getClamped(),'Stopper did not lock counterweight');
 shot(d,1,p['west-receiver']);walk(-8,-6);shot(d,0,p['right-weight']);
 until(()=>g.physics.grounded&&g.cargo.position.y>8,8,'Original load did not land on west gallery');
 check(l.left.position.y>7.98&&l.getClamped(),'West cabin fell after locked load removal');
 collect(d);walk(-18,-17);until(()=>g.state==='won',3,'Counterweight joint finish missed');
 mark('Fixed mechanical elevation and original companion share the exit');
}

export function runPost35(d,{route='dispatch-after-rewire'}={}){
 preciseAim(d);check(['dispatch-after-rewire','carry-after-first-latch'].includes(route),'Unknown 35 route');
 const {game:g,level:l,walk,until,mark}=d,p=l.panels;
 collect(d);load(d,l.dispatch);walk(0,21);
 shot(d,0,p['air-origin']);shot(d,1,p['first-receiver']);
 until(()=>l.powered()[0]&&l.first.progress>.9,5,'Flow did not open first physical sluice');
 check(!l.powered()[1]&&l.second.progress<.1,'Wrong receiver energized');
 mark('A real portal ray drives only the first sluice');
 walk(0,11);walk(0,0);use(d,-6,1.3,'First door latch');check(l.isFirstLatched(),'First real latch was not engaged');
 if(route==='carry-after-first-latch'){
  walk(0,0);walk(0,11);walk(0,17);collect(d);walk(0,11);walk(0,1);release(d);
  check(!l.dispatch.loaded()&&g.cargo.position.z<9,'Companion was not moved to the safe middle court');
  mark('Original companion crosses the held first doorway on foot before airflow is redirected');
 }
 shot(d,1,p['second-receiver']);
 until(()=>l.powered()[1]&&l.second.progress>.9,5,'Flow did not open second sluice');
 use(d,6,-5.1,'Second door latch');check(l.isLatched(),'Second mechanical latch was not engaged');
 mark('Stable middle court allows rerouting before cargo retrieval');
 if(route==='dispatch-after-rewire'){
  walk(0,-5);walk(0,3);walk(0,0);shot(d,0,p['companion-address']);
  until(()=>g.physics.grounded&&g.cargo.position.z<9,8,'Original companion did not enter the floor address');
  check(l.second.progress>.9&&l.isLatched(),'Exit shut after genuine flow was disconnected');
  mark('Cargo travels through the same pair after the flow is disconnected');
 }
 collect(d);walk(0,-4);walk(0,-20);until(()=>g.state==='won',3,'Air-switch joint finish missed');
 mark('Mechanically retained door brings both travellers to exit');
}

export const POST_A_ROUTES=Object.freeze([runPost31,runPost32,runPost33,runPost34,runPost35]);
export function runPostA(d,options={}){
 const fn=POST_A_ROUTES[d.level.index-30];check(fn,'Unknown post-campaign room');return fn(d,options);
}
