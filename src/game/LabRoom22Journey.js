import {installRoom21Aim} from './LabRoom21Journey.js';
const check=(v,m)=>{if(!v)throw Error(m);};
export async function runRoom22(d,{order='weight-first',recovery=false}={}){
 installRoom21Aim(d);const {game,level,walk,wait,pickup,mark,until,enter}=d,p=level.panels;
 check(['weight-first','portal-first','send-freight-first'].includes(order),'Unknown shutter preparation order');
 if(order==='portal-first'){walk(-12,5);d.aim(0,p['freight-weight'].getFrame().center);walk(-17,17);}
 walk(-16,17);pickup();walk(-12,6);d.look(p['freight-weight'].getFrame().center.clone().setY(2));walk(-12,1);wait(.5);game.interact();wait(1.5);
 check(level.shutters.loaded,'Original load did not hold the freight shutter');mark('original cargo opens ground passage and closes upper inspection');
 walk(-8,12);walk(7,12);walk(18,22.6);walk(18,7.5);check(game.playerPosition.y>6.9,'Inspection stair not reached');mark('inspection stair joins the permanent gallery');
 walk(8,3);d.aim(1,p['upper-return'].getFrame().center);walk(3.55,0);d.aim(0,p['freight-weight'].getFrame().center);
 until(()=>game.cargo.position.y>7.3,6,'Original cargo was not recovered through its loaded floor');wait(2);
 check(!level.shutters.loaded,'Removing the physical load must reverse the shutters');mark('permanent gallery retains height while the same cargo reverses both shutters');
 if(recovery){game.clearPortals();wait(.4);d.aim(1,p['upper-return'].getFrame().center);mark('erased portal pair restored on the permanent observation gallery');}
 walk(12,-5);walk(12,-18);d.aim(0,p['reverse-receiver'].getFrame().center);mark('reverse high slot reveals the receiving chamber');
 walk(10,-5);walk(15,3);walk(game.cargo.position.x-1,game.cargo.position.z);pickup();
 if(order==='send-freight-first'){
  // The returned upper-floor companion can use the final paired aperture as
  // its own freight path. The observer follows after a separate crossing.
  walk(18,3);const sent=game.physics.portalTransports;
  for(let n=0;n<160&&game.playerPosition.x<20.15;n++){d.worldMove(1,0);d.frame();}d.stop();
  check(game.playerPosition.y>6.9&&game.heldCube,'The freight launch must begin on the permanent east gallery');
  check(game.interact()&&!game.heldCube,'Cannot release the original companion toward the high receiver');
  until(()=>game.physics.portalTransports>sent,5,'Free companion missed the high receiver');
  until(()=>game.physics.grounded&&game.cargo.position.y>14,6,'Companion missed the permanent final receiving room');
  mark('the original companion enters the high receiver while the player remains on the east gallery');
 }
 enter(p['upper-return']);check(game.playerPosition.y>13.9,'Upper receiver missed');
 if(order==='send-freight-first'){
  wait(1.5);check(game.physics.grounded&&game.cargo.position.y>13.5,'The companion did not settle on the joined receiving shelf');
  walk(game.cargo.position.x-1,game.cargo.position.z);pickup();
 }
 walk(-14,-18);until(()=>game.state==='won',4,'Shutter chamber joint arrival');mark('original companion and traveller exit through the reverse side');
}
