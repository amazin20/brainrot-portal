import * as THREE from 'three';
import {aimLateSurface} from './LabLateCampaignAim.js';
import {runCreative34} from './LabCreativeCounterweightJourney.js';
import {runInverseSpring} from './LabLateCampaignSpringJourney.js';
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
function shot(d,color,surface){aimLateSurface(d,color,surface);}
function descendToService(d){
 d.walk(-8,8);d.game.input.jumpQueued=true;
 for(let i=0;i<95;i++){d.worldMove(1,0);d.frame();if(d.game.playerPosition.x>-3&&d.game.playerPosition.y<-.8)break;}
 d.stop();d.until(()=>d.game.playerGrounded&&d.game.playerPosition.y<-3.8,5,'Real lower service floor was not reached');
}

export function runPost31(d,{route='cargo-then-air',stopBeforeCargoRecovery=false,stopBeforeCargoDelivery=false,recover=false}={}){
 preciseAim(d);check(['cargo-then-air','inspect-rack-first','straight-transfer','empty-upper-first'].includes(route),'Unknown31 route');
 const {game:g,level:l,walk,until,mark}=d,p=l.panels;
 if(route==='inspect-rack-first'||route==='empty-upper-first'){
  walk(-15,21);walk(-15,16);walk(0,16);walk(-3,8);
  shot(d,1,p['rake-mouth']);walk(0,16);walk(10,19);walk(13,19);walk(13,23);walk(24,23);shot(d,0,p['rake-air-intake']);d.wait(2);walk(13,23);walk(13,19);walk(10,19);walk(0,16);walk(-3,8);
  check(l.rack.stroke<.02,'Air must not move an empty rack without physical cargo contact');
  mark('Air alone cannot move the guided rack mass');
 }
 if(stopBeforeCargoDelivery)return;
 if(route==='inspect-rack-first'||route==='empty-upper-first'){walk(0,16);walk(-15,16);walk(-15,21);}
 collect(d);load(d,l.dispatch);walk(-15,21);walk(-15,16);walk(0,16);walk(-3,8);
 shot(d,1,p['rake-mouth']);const sent=g.physics.portalTransports;walk(0,16);const dispatchAim=g.cargo.position.clone();dispatchAim.y=p['rake-dispatch'].getFrame().center.y;aimLateSurface(d,0,p['rake-dispatch'],dispatchAim);
 until(()=>g.physics.portalTransports>sent,6,'Original cargo missed the isolated rack guide');
 walk(10,19);walk(13,19);walk(13,23);walk(24,23);shot(d,0,p['rake-air-intake']);until(()=>l.rack.latched,16,'Real air-driven cargo contact did not extend the rack');
 check(l.rack.stroke>12.95,'The bridge must come from the full physical rack stroke');check(g.clearPortals(),'Clearing the powered pair after full stroke failed');
 mark('Free cargo contact extends the visible rack and transverse bridge');
 if(stopBeforeCargoRecovery)return;
 walk(13,23);walk(13,19);walk(10,19);walk(0,16);walk(-3,8);until(()=>l.inspection.progress>.94,4,'Full rack stroke did not lift its real inspection cover');
 walk(-6.3,8);g.input.jumpQueued=true;for(let i=0;i<100;i++){d.worldMove(-.65,0);d.frame();if(i>20&&g.playerGrounded&&g.playerPosition.x<-7.8)break;}d.stop();until(()=>g.playerGrounded,3,'Observer did not cross the visible lowered inspection stop');collect(d);
 walk(-8.5,8);g.input.jumpQueued=true;for(let i=0;i<100;i++){d.worldMove(.65,0);d.frame();if(i>20&&g.playerGrounded&&g.playerPosition.x>-6.1)break;}d.stop();until(()=>g.playerGrounded,3,'Original pair did not leave the opened inspection guide');
 walk(-3,8);walk(0,16);walk(-15,16);walk(-28.1,16);walk(-28.1,6);walk(-28.1,-16);walk(-24,-20);
 if(recover){walk(-15,-18);walk(-15,-11);until(()=>g.playerGrounded&&g.playerPosition.y<-3.8,5,'Crossing miss did not reach physical lower recovery floor');walk(24,-6);walk(24,18);walk(24,23);walk(13,23);walk(13,19);walk(10,19);walk(0,16);walk(-15,16);walk(-28.1,16);walk(-28.1,6);walk(-28.1,-16);mark('A real dry return recovers the independent inspection gallery');}
 walk(-14,-20);walk(-12,-20);walk(-2,-20);walk(2,-20);walk(18,-20);
 until(()=>g.state==='won',4,'Rack bridge failed the joint upper finish');
 mark('Both original travellers use the mechanically completed crossing');
}

export function runPost32(d,{route='freight-before-light',stopBeforeRatchet=false,stopBeforeCargoDelivery=false}={}){
 preciseAim(d);check(['freight-before-light','inspect-optics-first','load-then-return','prepare-return-first'].includes(route),'Unknown 32 route');
 const {game:g,level:l,walk,until,mark}=d,p=l.panels;
 if(route==='inspect-optics-first'||route==='prepare-return-first'){
  walk(18,12);shot(d,0,p['double-ray-intake']);walk(-7,-1);shot(d,1,p['shadow-mouth']);
  until(()=>l.optics.raw.every(Boolean),3,'Both unoccluded height rays should reach their real sensors');
  check(!l.optics.valid&&l.diaphragm.progress<.1,'Light without a small opaque body cannot release the differential diaphragm');
  mark('Both lit receivers keep the physical diaphragm shut');
 }
 if(stopBeforeCargoDelivery)return;
 collect(d);load(d,l.dispatch);walk(7,16);walk(-7,-1);
 shot(d,1,p['shadow-mouth']);const sent=g.physics.portalTransports;const cargoAim=g.cargo.position.clone();cargoAim.y=p['shadow-dispatch'].getFrame().center.y;aimLateSurface(d,0,p['shadow-dispatch'],cargoAim);
 until(()=>g.physics.portalTransports>sent&&g.physics.grounded&&g.cargo.position.x<-13,8,'Original small body did not reach the low cargo-only hood');
 mark('The original companion takes a freight aperture too low for its observer');
 walk(18,12);shot(d,0,p['double-ray-intake']);
 until(()=>l.optics.valid&&l.diaphragm.progress>.92,5,'The original cargo must shade the low ray while leaving the upper ray lit');
 check(l.optics.shadow[0]&&!l.optics.shadow[1],'The difference must come from the same actual opaque box');
 mark('A real cargo shadow separates the two height circuits');
 if(stopBeforeRatchet)return;
 walk(0,4);walk(0,-12);walk(5.5,-13);check(g.interact()&&l.optics.latched,'The diaphragm ratchet must be reached on its far side');
 mark('A downstream physical ratchet retains the diaphragm before cargo retrieval');
 until(()=>l.access.progress>.94,5,'The physical inspection cover did not lift');
 walk(0,-12);walk(0,-4);walk(-13,4);walk(g.cargo.position.x,.85);check(g.interact()&&g.heldCube,'Original cargo cannot be collected across the low hood edge');
 d.wait(.5);check(l.diaphragm.progress>.9,'Retrieving the occluder must not clear the mechanical ratchet');
 walk(-13,4);walk(0,4);walk(0,-19);until(()=>g.state==='won',3,'The original pair did not cross the retained diaphragm');
 mark('The light circuit is borrowed again after the original cargo returns');
}

export const runPost33=runInverseSpring;
export const runPost34=runCreative34;

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
