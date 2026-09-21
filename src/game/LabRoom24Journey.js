import {installRoom21Aim} from './LabRoom21Journey.js';
const check=(p,m)=>{if(!p)throw Error(m);};
export async function runRoom24(d,{route='carry-through',recovery=false}={}){
 installRoom21Aim(d);const {game,level,walk,wait,until,pickup,enter,mark}=d,p=level.panels,door=level.gardenDoor;
 check(['carry-through','counterweight'].includes(route),'Unknown garden route');
 walk(0,22);d.aim(1,p['revolving-door'].getFrame().center);walk(18,19);d.aim(0,p['garden-entry'].getFrame().center);walk(11,18);pickup();
 if(route==='carry-through'){
  walk(18,20);enter(p['garden-entry']);until(()=>game.playerGrounded,4,'South garden landing missed');walk(1,3);d.look(game.playerPosition.clone().setZ(5));wait(.3);game.interact();wait(.7);walk(2,3.5);d.aim(0,p['balcony-entry'].getFrame().center);walk(3.7,5);d.look(p['revolving-door'].getFrame().center);mark('the same aperture starts its courtyard orbit');check(game.interact(),'Manual worm drive missed');check(door.manualTurn,'Manual drive did not engage');until(()=>door.angle<-1.56,6,'Manual drive did not turn door');mark('carried friend explores south balcony and the manual turning drive');walk(game.cargo.position.x-.9,game.cargo.position.z);pickup();enter(p['balcony-entry']);
 }else{
  walk(8,20);walk(-12,20);walk(-12,15);d.look(p['garden-counterweight'].getFrame().center.clone().setY(2));walk(-12,12.7);wait(.5);game.interact();wait(1.2);check(level.workshop.pads[0].loaded(),'Original friend missed the turning planter');until(()=>door.angle<-1.56,6,'Weighted door did not turn');mark('original weight turns the portal into a different courtyard');walk(-12,20);walk(18,20);enter(p['garden-entry']);
 }
 until(()=>game.playerGrounded,4,'West garden arrival did not land');check(game.playerPosition.y>5.9,'Wrong garden height');walk(-8,-8);
 if(route==='counterweight'){
  walk(-10,-7.2);check(game.interact(),'Garden brake missed');check(door.braked,'Garden brake did not engage');mark('west garden brake holds the real rotating door');walk(-12,-6.5);walk(-20,-6.5);walk(-20,1.5);walk(-12,2.65);d.aim(0,p['garden-counterweight'].getFrame().center);until(()=>game.cargo.position.y>6.1,6,'Garden cargo return missed');wait(1.5);check(!door.loaded&&door.angle<-1.56,'The brake failed to retain its angle after unloading');mark('the same portal pair lifts its original counterweight');walk(-12,1.5);walk(-20,1.5);walk(-20,-8);
 }
 if(game.heldCube){walk(-8,-10);walk(-12,-10);d.look(game.playerPosition.clone().setX(-16));wait(.3);game.interact();wait(.6);walk(-12,-7);walk(-20,-7);walk(-20,-8);}
 if(recovery==='ground-return'){
  walk(-12,-7);walk(-12,-2);until(()=>game.playerGrounded&&game.playerPosition.y<.2,4,'Garden recovery floor missed');game.clearPortals();walk(-12,8);walk(9,8);walk(8.3,15);check(game.interact(),'Low garden release missed');until(()=>door.angle>-.01,6,'Low release failed to return the unloaded door');mark('fall and erased pair recovered through the low mechanical release');
  walk(0,22);d.aim(1,p['revolving-door'].getFrame().center);walk(18,19);d.aim(0,p['garden-entry'].getFrame().center);enter(p['garden-entry']);walk(2,3.5);d.aim(0,p['balcony-entry'].getFrame().center);walk(3.7,5);check(game.interact(),'Recovery crank missed');until(()=>door.angle<-1.56,6,'Recovery orbit failed');enter(p['balcony-entry']);walk(-8,-8);
 }else if(recovery){game.clearPortals();wait(.2);walk(-7,-8);d.aim(1,p['revolving-door'].getFrame().center);mark('erased pair restored from the permanent garden');}
 walk(-20,-8);walk(-20,-18);check(game.playerPosition.y>10.9,'Garden reverse perch missed');d.aim(0,p['pavilion-receiver'].getFrame().center);mark('folded garden stair reveals the yellow pavilion');walk(-20,-7);walk(-7,-8);walk(game.cargo.position.x-.9,game.cargo.position.z);pickup();enter(p['revolving-door']);walk(16,-18);until(()=>game.state==='won',4,'Garden joint arrival missed');mark('original companion joins the final garden');
}
