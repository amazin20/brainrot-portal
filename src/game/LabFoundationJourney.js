import {runSecondChapter} from './LabSecondChapterJourney.js';
import * as THREE from 'three';
import {installRoom21Aim} from './LabRoom21Journey.js';
const check=(ok,message)=>{if(!ok)throw new Error(message);};
function collect(d){for(let n=0;n<12;n++){const p=d.game.cargo.position;d.walk(p.x+1.35,p.z);if(d.game.playerPosition.distanceTo(d.game.cargo.position)<2.2){d.pickup();return;}}throw Error('Could not reach the moving companion by ordinary walking');}
function release(d){d.stop();d.wait(.25);check(d.game.interact()&&!d.game.heldCube,'Cannot put down the original companion');d.wait(.8);}
const V=(...p)=>new THREE.Vector3(...p);
function first(d,{alternate=false,recover=false}={}){
 const {game:g,level:l,walk,wait,mark,enter}=d,p=l.panels;
 const entry=p[alternate?'near-right':'near-left'];
 d.aim(0,entry.getFrame().center);d.aim(1,p['upper-view'].getFrame().center);
 if(recover){enter(entry);walk(6,-9);mark('Scout above, then return for the same companion');enter(p['upper-view']);walk(0,11);}
 collect(d);enter(entry);walk(7,-11);mark('A pair changes floor, and carries the companion');
}
function second(d,{alternate=false,recover=false}={}){
 const {game:g,level:l,walk,wait,until,mark}=d,p=l.panels;
 const connect=()=>{d.aim(0,p['light-source'].getFrame().center);d.aim(1,p['light-exit'].getFrame().center);wait(.35);};
 connect();mark('Light has become a floor across the gap');
 if(alternate||recover){walk(-17,8);walk(-2,8);g.clearPortals();until(()=>g.playerGrounded&&g.playerPosition.y< -2.9,5,'Expected real fall after extinguishing bridge');walk(-10,-15);walk(-18,-15);walk(-18,4);walk(-16,15);connect();mark('Bridge loss has a dry recovery, without reset');}
 collect(d);walk(-17,8);walk(16,8);
}
function third(d,{alternate=false,recover=false}={}){
 const {game:g,level:l,walk,wait,until,mark,enter}=d,c=l.car;
 // Target near walking height within the large ceramic sheet, not its top.
 const target=c.panel.getFrame().center.clone().addScaledVector(c.panel.getFrame().up,0);
 d.aim(0,l.panels['dispatch-entry'].getFrame().center);d.aim(1,target);
 if(alternate){
  enter(l.panels['dispatch-entry']);walk(-10,-2);walk(-10,-16);walk(-19,-16);walk(-19.6,-17);check(g.interact(),'Remote carriage control missed');until(()=>c.at(1),15,'Empty cabin failed to change berth');
  walk(-3,-15);until(()=>g.playerGrounded&&g.playerPosition.y<-2.9,5,'Observation fall missed');walk(-10,-8);walk(-19,-8);walk(-19,12);walk(-16,12);collect(d);
  mark('The original entry now points at the unoccupied destination cabin');enter(l.panels['dispatch-entry']);
 }else{
  collect(d);enter(l.panels['dispatch-entry']);walk(-18,-3);release(d);walk(-14.5,0);check(g.interact(),'Moving cabin console missed');
  until(()=>c.at(1),15,'Occupied cabin failed to reach berth');collect(d);mark('Both travellers and the attached portal rode the physical cabin');
 }
 walk(22,-2);walk(22,-17);walk(16,-17);
}
function fourth(d,{alternate=false,recover=false}={}){
 const {game:g,level:l,walk,wait,until,mark,frame,worldMove,stop}=d,p=l.panels;
 walk(-17,12);d.aim(0,p['fall-entry'].getFrame().center);
 collect(d);walk(-25,9);walk(-25,-16);walk(-20,-16);release(d);walk(-15,-13.4);d.aim(1,p['inclined-exit'].getFrame().center);
 // Optional exploration is a real fall from the permanent balcony to the
 // service floor away from the aperture, then an ordinary return up the ramp.
 if(recover||alternate){g.clearPortals();walk(-11,2);until(()=>g.playerGrounded,6,'Side fall did not reach solid support');walk(12,-6);walk(20,-6);walk(20,19);walk(-23,19);walk(-17,12);d.aim(0,p['fall-entry'].getFrame().center);walk(-25,9);walk(-25,-16);walk(-15,-13.4);d.aim(1,p['inclined-exit'].getFrame().center);mark('A missed drop returns through the service floor and actual incline');}
 collect(d);walk(-17,-12.1);wait(.4);const before=g.teleportCount;
 for(let i=0;i<180&&g.playerGrounded;i++){worldMove(0,1);frame();}stop();
 until(()=>g.teleportCount>before,5,'Falling aperture missed');until(()=>g.playerGrounded,6,'Receiving apron missed');
 check(g.playerPosition.y>14.9,'Insufficient genuine falling impulse');mark('Earned falling speed becomes height at the opposite gallery');walk(16,-17);
}
function fifth(d,{alternate=false,recover=false}={}){
 const {game:g,level:l,walk,wait,until,mark}=d,p=l.panels;
 d.aim(0,p['air-source'].getFrame().center);walk(-28,6);walk(-28,-21);d.aim(1,p['air-receiver'].getFrame().center);
 until(()=>l.drive.flow,2,'Air is not entering the real rotor grille');mark('One pair drives the motor, without hidden energy');
 const light=()=>{d.aim(0,p['light-source'].getFrame().center);d.aim(1,p['light-exit'].getFrame().center);wait(.4);};
 if(alternate){wait(11);walk(-30,7);walk(-8,8);walk(-8,-24);walk(-28,-24);light();check(l.drive.wheel.omega>10,'No stored motion remained');mark('Projection prepared first; the disconnected rotor retains useful energy');}
 if(alternate){walk(-8,-24);walk(-8,10);}else{walk(-30,8);walk(-8,10);}collect(d);walk(-20,6);walk(-20,-3);until(()=>l.cabin.position.y>5.98,25,'Loaded cabin did not rise');walk(-20,-15);mark('Permanent gallery holds the travellers independently of the motor');
 if(recover){release(d);walk(-11,-13);until(()=>g.playerGrounded&&g.playerPosition.y<.1,5,'Middle floor fall missed');walk(-9,6);walk(-9.6,7);check(g.interact(),'Recall control missed');until(()=>l.cabin.position.y<.02,5,'Cabin did not return');walk(-20,6);walk(-20,-3);until(()=>l.cabin.position.y>5.98,25,'Cannot recover after recall');walk(-20,-15);collect(d);mark('Cabin recall retrieves the stranded original companion');}
 if(!alternate){release(d);walk(-22,-13);light();collect(d);}
 walk(-20,-17);walk(18,-17);mark('The same pair now carries a solid path, not air');
}
export function runFoundationJourney(d,options={}){
 if(d.level.index>=5)return runSecondChapter(d,options);
 installRoom21Aim(d);const fn=[first,second,third,fourth,fifth][d.level.index];check(fn,'Unknown foundation room');return fn(d,options);
}
