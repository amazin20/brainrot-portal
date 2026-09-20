import {installRoom21Aim} from './LabRoom21Journey.js';
const check=(v,m)=>{if(!v)throw Error(m);};
export async function runRoom22(d,{order='weight-first',recovery=false}={}){
 installRoom21Aim(d);const {game,level,walk,wait,pickup,mark,until,enter}=d,p=level.panels;
 check(['weight-first','portal-first'].includes(order),'Unknown shutter preparation order');
 if(order==='portal-first'){walk(-12,5);d.aim(0,p['freight-weight'].getFrame().center);walk(-17,17);}
 walk(-16,17);pickup();walk(-12,6);d.look(p['freight-weight'].getFrame().center.clone().setY(2));walk(-12,1);wait(.5);game.interact();wait(1.5);
 check(level.shutters.loaded,'Original load did not hold the freight shutter');mark('original cargo opens ground passage and closes upper inspection');
 walk(-8,12);walk(7,12);walk(18,22.6);walk(18,7.5);check(game.playerPosition.y>6.9,'Inspection stair not reached');
 walk(8,3);d.aim(1,p['upper-return'].getFrame().center);walk(3.55,0);d.aim(0,p['freight-weight'].getFrame().center);
 until(()=>game.cargo.position.y>7.3,6,'Original cargo was not recovered through its loaded floor');wait(2);
 check(!level.shutters.loaded,'Removing the physical load must reverse the shutters');mark('permanent gallery retains height while the same cargo reverses both shutters');
 if(recovery){game.clearPortals();wait(.4);d.aim(1,p['upper-return'].getFrame().center);mark('erased portal pair restored on the permanent observation gallery');}
 walk(12,-5);walk(12,-18);d.aim(0,p['reverse-receiver'].getFrame().center);mark('reverse high slot reveals the receiving chamber');
 walk(10,-5);walk(15,3);walk(game.cargo.position.x-1,game.cargo.position.z);pickup();
 enter(p['upper-return']);check(game.playerPosition.y>13.9,'Upper receiver missed');
 walk(-14,-18);until(()=>game.state==='won',4,'Shutter chamber joint arrival');mark('original companion and traveller exit through the reverse side');
}
