import * as THREE from 'three';
import {installRoom21Aim} from './LabRoom21Journey.js';
import {CAMERA_PITCH_MIN,CAMERA_PITCH_MAX} from './LabCamera.js';
function preciseAim(d){
 installRoom21Aim(d);d.look=point=>{d.stop();for(let n=0;n<600;n++){const g=d.game;g.scene.updateMatrixWorld(true);if(point.clone().sub(g.camera.position).dot(g.camera.getWorldDirection(new THREE.Vector3()))<0){g.yaw+=.16;d.frame();continue;}const p=point.clone().project(g.camera);if(n>30&&Math.abs(p.x)<.00015&&Math.abs(p.y)<.00015)return;g.yaw-=THREE.MathUtils.clamp(p.x,-1,1)*.18;g.pitch=THREE.MathUtils.clamp(g.pitch+THREE.MathUtils.clamp(p.y,-1,1)*.17,CAMERA_PITCH_MIN,CAMERA_PITCH_MAX);d.frame();}};
}
function release(d){d.stop();d.wait(.3);check(d.game.interact()&&!d.game.heldCube,'Release failed');d.wait(1.0);}

const V=(...p)=>new THREE.Vector3(...p),check=(c,m)=>{if(!c)throw Error(m);};
function collect(d){const p=d.game.cargo.position;d.walk(p.x+1.35,p.z);d.pickup();}
export function runResearch31(d,{route='carry-first',recover=false}={}){
 preciseAim(d);const {game:g,level:l,walk,wait,mark,until}=d,p=l.panels;
 if(recover){walk(-14,17);until(()=>g.playerGrounded,5,'Service floor missed');check(g.playerPosition.y<-3.9,'Did not exercise a real fall');walk(-16,-20);walk(-23,-20);walk(-23,5);walk(-21,15);mark('Service ramp returns to the actual start without a reset');}
 d.aim(0,p['light-source'].getFrame().center);d.aim(1,p['west-bridge'].getFrame().center);wait(.4);
 check(l.light.segments.length>1,'No routed light sheet');
 if(recover){walk(-19,8);walk(-9,8);g.clearPortals();until(()=>g.playerGrounded&&g.playerPosition.y<-3.5,5,'Extinguished bridge did not lead to the service floor');walk(-16,-20);walk(-23,-20);walk(-23,5);walk(-21,15);d.aim(0,p['light-source'].getFrame().center);d.aim(1,p['west-bridge'].getFrame().center);mark('Extinguished bridge, real fall and reconstruction without resetting');}
 mark('Light becomes a walkable crossing, not a progress flag');
 if(route==='scout-first'){walk(-19,8);walk(4,8);walk(4,4);walk(4,8);walk(-21,8);mark('The central island can be explored before transporting the companion');}
 collect(d);walk(-19,8);walk(4,8);walk(4,5);mark('Both travellers stand on independent permanent architecture');
 release(d);d.aim(1,p['north-bridge'].getFrame().center);wait(.3);collect(d);walk(4,1);walk(4,-20);
 until(()=>g.state==='won',3,'Light relay joint exit missed');mark('The same source now leads in a perpendicular direction');
}
export function runResearch32(d,{route='powered-ascent'}={}){
 preciseAim(d);const {game:g,level:l,walk,wait,mark,until}=d,p=l.panels,[a,b]=l.cabins;
 d.aim(0,p['air-source'].getFrame().center);walk(-26,6);walk(-26,-20);d.aim(1,p['turbine-feed'].getFrame().center);
 until(()=>l.drive.flow,2,'Air did not reach the receiver');mark('A geometric air path spins the receiver');
 // Wait on the ordinary floor, then recall the real cabin with its terminal.
 if(route==='stored-energy'){wait(12);d.aim(0,p['service-return'].getFrame().center);walk(-26,-21.5);walk(-19,-21.5);const before=g.teleportCount;g.input.jumpQueued=true;for(let i=0;i<180&&g.teleportCount===before;i++){d.worldMove(0,-1);d.frame();}d.stop();check(g.teleportCount>before,'Service return jump missed');wait(.7);g.clearPortals();check(l.drive.wheel.omega>15,'Insufficient stored mechanical energy');mark('The same portals become a service shortcut while stored motion remains');}
 walk(-26,9);walk(-18,10);collect(d);walk(-8,9);walk(-8,2);
 until(()=>a.position.y>5.98,25,'First drive did not reach gallery');walk(3,1);mark('Worm drive holds the first landing without an artificial checkpoint');
 walk(3,0);release(d);walk(6.3,2.5);check(g.interact()&&l.drive.gear===1,'Transmission selector missed');collect(d);
 walk(4,-6);walk(4,-12);until(()=>b.position.y>11.98,35,'Second drive did not reach upper gallery');
 walk(4,-23);until(()=>g.state==='won',3,'Stored-motion joint finish missed');mark('Stored rotation powers the second mechanism; both travellers arrive');
}
export function runResearch33(d,{route='carry-first',recover=false}={}){
 preciseAim(d);const {game:g,level:l,walk,wait,mark,until,worldMove,frame,stop}=d,p=l.panels;
 if(recover){walk(-10,12);until(()=>g.playerGrounded&&g.playerPosition.y<-3.5,4,'Recovery floor missed');walk(2,-8);walk(25,-8);walk(25,21);walk(-22,20);check(g.playerPosition.y>-.01,'Return ramp failed');mark('Service floor and dry return explored before the first flight');}
 walk(-17,12);d.aim(0,p['first-fall'].getFrame().center);
 collect(d);walk(-25,9);walk(-25,-16);walk(-20,-16);release(d);walk(-15,-13.4);d.aim(1,p['first-outlet'].getFrame().center);collect(d);walk(-17,-12.1);wait(.4);const before=g.teleportCount;
 for(let i=0;i<180&&g.playerGrounded;i++){worldMove(0,1);frame();}stop();
 until(()=>g.teleportCount>before,5,'First fall aperture missed');until(()=>g.playerGrounded,6,'First receiving gallery missed');
 check(g.playerPosition.y>14.9,'First flight did not reach the actual raised gallery');mark('First impulse reaches a new view of the return outlet');
 walk(14,-11);release(d);walk(14,-6.5);d.aim(0,p['second-fall'].getFrame().center);d.aim(1,p['second-outlet'].getFrame().center);collect(d);walk(14,-6.1);wait(.3);
 const second=g.teleportCount;for(let i=0;i<180&&g.playerGrounded;i++){worldMove(0,1);frame();}stop();
 until(()=>g.teleportCount>second,5,'Second falling aperture missed');until(()=>g.playerGrounded,6,'Return receiving gallery missed');
 check(g.playerPosition.y>21.9,'Return impulse did not reach the upper gallery');walk(-4,17);until(()=>g.state==='won',3,'Return-vector joint finish missed');mark('Two real falls, original companion, no staging or checkpoint');
}
export function runResearchJourney(d,options={}){
 const fn=[runResearch31,runResearch32,runResearch33][d.level.index-30];if(!fn)throw Error('Unknown research room');return fn(d,options);
}
