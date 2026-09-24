import * as THREE from 'three';
import {installRoom21Aim} from './LabRoom21Journey.js';
const check=(ok,message)=>{if(!ok)throw new Error(message);};
function collect(d){for(let n=0;n<12;n++){const p=d.game.cargo.position;d.walk(p.x+1.35,p.z);if(d.game.playerPosition.distanceTo(d.game.cargo.position)<2.2){d.pickup();return;}}throw Error('Could not reach the moving companion by ordinary walking');}
function release(d){d.stop();d.wait(.25);check(d.game.interact()&&!d.game.heldCube,'Cannot put down the original companion');d.wait(.8);}
const V=(...p)=>new THREE.Vector3(...p);
function first(d,{alternate=false,recover=false}={}){
 const {game:g,level:l,walk,until,mark,enter}=d,p=l.panels;
 const entry=p['near-left'];
 if(alternate){
  collect(d);walk(7,6);release(d);
  check(!g.heldCube&&g.cargo.position.x>1&&g.cargo.position.x<13&&g.cargo.position.z>2&&g.cargo.position.z<14,'Friend was not staged on the real freight platform');
  mark('Companion staged below while player remains beside the freight platform');
  walk(0,12);
 }
 d.aim(0,entry.getFrame().center);d.aim(1,p['upper-view'].getFrame().center);
 if(alternate){
  enter(entry);walk(9,-12);check(g.interact(),'Upper freight dispatch cannot be reached');
  until(()=>l.cargoHoist.at(1),5,'Freight platform did not reach the upper gallery');
  check(g.cargo.position.y>3,'Original companion did not ride the platform');
  mark('Scout dispatches the original companion after reaching the upper gallery by portal');
  walk(7,2);walk(7,6);collect(d);walk(7,-11);return;
 }
 if(recover){enter(entry);walk(6,-9);mark('Scout above, then return for the same companion');enter(p['upper-view']);walk(0,11);}
 collect(d);enter(entry);walk(7,-11);mark('A pair changes floor, and carries the companion');
}
function second(d,{alternate=false,recover=false}={}){
 const {game:g,level:l,walk,wait,until,mark}=d,p=l.panels;
 const connect=(destination='light-exit')=>{d.aim(0,p['light-source'].getFrame().center);d.aim(1,p[destination].getFrame().center);wait(.35);};
 if(alternate){
  connect('service-exit');mark('Projection first makes a physical path to the service island');
  collect(d);walk(-11,3);walk(-9,3);walk(-9,-3);walk(-9,-9);walk(8,-9);release(d);
  check(g.playerGrounded&&g.playerPosition.y>2.9&&g.cargo.position.y>3.1&&g.cargo.position.x>4&&g.cargo.position.x<12&&g.cargo.position.z>-13&&g.cargo.position.z< -5,'Both travellers need a solid island before the bridge changes');
  d.aim(1,p['island-turn'].getFrame().center);wait(.35);
  mark('The same projected light now points north, after the companion reaches permanent footing');
  collect(d);walk(8,8);walk(16,8);return;
 }
 connect();mark('Light has become a floor across the gap');
 if(recover){walk(-17,8);walk(-2,8);g.clearPortals();until(()=>g.playerGrounded&&g.playerPosition.y< -2.9,5,'Expected real fall after extinguishing bridge');walk(-10,-15);walk(-18,-15);walk(-18,4);walk(-16,15);connect();mark('Bridge loss has a dry recovery, without reset');}
 collect(d);walk(-17,8);walk(16,8);
}
function third(d,{alternate=false,recover=false}={}){
 const {game:g,level:l,walk,wait,until,mark,enter}=d,c=l.car;
 // Target near walking height within the large ceramic sheet, not its top.
 const target=c.panel.getFrame().center.clone().addScaledVector(c.panel.getFrame().up,0);
 d.aim(0,l.panels['dispatch-entry'].getFrame().center);d.aim(1,target);
 if(recover){
  walk(-5,8);until(()=>g.playerGrounded&&g.playerPosition.y<-2.9,5,'Lower service floor missed');
  walk(-10,-8);walk(-19,-8);walk(-19,12);walk(-16,12);
  check(g.playerPosition.y>-.1&&g.cargo.position.y>.3,'The return incline did not reunite both travellers');
  mark('The dry service incline returns from a missed departure without resetting either traveller');
 }
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
function fourthCompanionFirst(d){
 const {game:g,level:l,walk,until,mark,frame,worldMove,stop}=d,p=l.panels;
 walk(-17,12);d.aim(0,p['fall-entry'].getFrame().center);
 // Prepare the outlet while the companion is safe on the starting floor.
 walk(-25,9);walk(-25,-16);walk(-15,-13.4);
 d.aim(1,p['inclined-exit'].getFrame().center);
 walk(-25,-16);walk(-25,9);walk(-24,17);collect(d);
 walk(-25,9);walk(-25,-16);walk(-17,-15);
 for(let n=0;n<120&&g.playerPosition.z< -12.8;n++){worldMove(0,1);frame();}
 stop();check(g.playerPosition.y>13.9&&g.heldCube,'Companion launch must begin on the high deck');
 const cargoTransports=g.physics.portalTransports;
 check(g.interact()&&!g.heldCube,'Could not release the original companion into the fall');
 until(()=>g.physics.portalTransports>cargoTransports,5,'Companion missed the floor portal');
 until(()=>g.physics.grounded&&g.cargo.position.y>15.2&&g.cargo.position.x> -3&&g.cargo.position.x<9,6,
  'Companion did not land on the connected receiving shelf');
 mark('The original companion reaches the receiving shelf before the player');
 walk(-17,-15);d.wait(.4);
 const before=g.teleportCount;
 for(let n=0;n<180&&g.playerGrounded;n++){worldMove(0,.7);frame();}stop();
 until(()=>g.teleportCount>before,5,'Player missed the falling aperture');
 until(()=>g.playerGrounded,6,'Player missed the receiving apron');
 check(g.playerPosition.y>14.9,'Player did not carry real falling speed into the gallery');
 collect(d);mark('Player recovers the companion after a separate momentum flight');
 walk(16,-17);
}
function fourth(d,{alternate=false,recover=false}={}){
 if(alternate)return fourthCompanionFirst(d);
 const {game:g,level:l,walk,wait,until,mark,frame,worldMove,stop}=d,p=l.panels;
 walk(-17,12);d.aim(0,p['fall-entry'].getFrame().center);
 collect(d);walk(-25,9);walk(-25,-16);walk(-20,-16);release(d);walk(-15,-13.4);d.aim(1,p['inclined-exit'].getFrame().center);
 // Optional exploration is a real fall from the permanent balcony to the
 // service floor away from the aperture, then an ordinary return up the ramp.
 if(recover){g.clearPortals();walk(-11,2);until(()=>g.playerGrounded,6,'Side fall did not reach solid support');walk(12,-6);walk(20,-6);walk(20,19);walk(-23,19);walk(-17,12);d.aim(0,p['fall-entry'].getFrame().center);walk(-25,9);walk(-25,-16);walk(-15,-13.4);d.aim(1,p['inclined-exit'].getFrame().center);mark('A missed drop returns through the service floor and actual incline');}
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
 installRoom21Aim(d);const fn=[first,second,third,fourth,fifth][d.level.index];check(fn,'Unknown foundation room');return fn(d,options);
}
