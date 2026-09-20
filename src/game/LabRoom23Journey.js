import {installRoom21Aim} from './LabRoom21Journey.js';
const check=(v,m)=>{if(!v)throw Error(m);};
export async function runRoom23(d,{order='receiver-first',recovery=false}={}){
 installRoom21Aim(d);const {game,level,walk,wait,mark,until,pickup}=d,p=level.panels,b=level.balance;
 check(['receiver-first','floor-first'].includes(order),'Unknown counterweight preparation order');
 walk(-16,3);if(order==='floor-first')d.aim(0,p['west-load-car'].getFrame().center);
 d.aim(1,p['freight-throat'].getFrame().center);if(order!=='floor-first')d.aim(0,p['west-load-car'].getFrame().center);
 walk(-12.8,3);until(()=>b.loaded,8,'Freight did not reach the distant counterweight car');mark('original freight loads the opposite coupled carriage');
 until(()=>game.playerPosition.y>9.9,20,'Near counterweight ascent');walk(-11,-2);walk(-11,-8);walk(6,-8);walk(6,5.5);walk(8.4,5.5);check(game.interact(),'Middle transmission brake missed');check(b.braked,'Counterweight brake not engaged');mark('permanent gallery preserves first ascent and brake clamps both cars');
 walk(game.cargo.position.x-1,game.cargo.position.z);pickup();walk(8.4,5.5);walk(6,5.5);walk(6,-8);walk(0,-8);d.look(game.playerPosition.clone().setZ(-20));wait(.4);game.interact();wait(1.5);check(!game.heldCube,'Cargo was not placed in permanent storage');
 mark('original load rests outside either moving car');
 if(recovery){game.clearPortals();wait(.4);mark('portal pair erased while both fixed cargo pocket and braked car remain recoverable');}
 walk(6,-8);walk(6,5.5);walk(8.4,5.5);check(game.interact(),'Return brake release missed');check(!b.braked,'Counterweight brake remained engaged');
 until(()=>game.playerPosition.y>19.9,20,'Empty far carriage failed to return upward');walk(11,8);mark('upper apron joins the returning gallery');walk(19,8);walk(19,-20);walk(4,-20);
 d.aim(1,p['high-return'].getFrame().center);walk(10,-20);walk(10,-17.1);d.aim(0,p['middle-pocket'].getFrame().center);
 until(()=>game.cargo.position.y>20.3,8,'Original load was not retrieved on upper gallery');wait(2);mark('same cargo retrieved from permanent middle pocket');
 walk(10,-20);walk(game.cargo.position.x+1,game.cargo.position.z);if(game.state==='playing'){pickup();walk(0,-20);}until(()=>game.state==='won',3,'Counterweight joint arrival');mark('both travellers reach the high reverse gallery');
}
