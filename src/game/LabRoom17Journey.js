const check=(ok,msg)=>{if(!ok)throw Error(msg);};
export function room17Depart(d,{order='cargo-first'}={}){
 const {game,level,walk,wait,aim,look,until,pickup,enter,mark}=d,p=level.panels,s=level.state,m=s.address;
 check(['cargo-first','scout-first'].includes(order),'Unknown moving-address order');
 walk(-19,20);aim(0,p.arrival.getFrame().center);walk(-22,19);walk(-22,10);aim(1,p.address.getFrame().center.clone().add({x:0,y:1.5,z:0}));
 if(order==='scout-first'){
  enter(p.arrival);walk(-14,11);mark('the first berth has no upper return');walk(-19,15);until(()=>game.playerGrounded&&game.playerPosition.y<.1,5,'Initial berth recovery');
 }
 walk(game.cargo.position.x-1,game.cargo.position.z);pickup();walk(-17,23);look(p.dispatch.getFrame().center.clone().add({x:0,y:2,z:0}));walk(-17,20.85);game.interact();wait(1.2);check(level.pads[0].loaded(),'Friend did not load the dispatch plate');
 mark('the address leaves its first berth');walk(-21,21);until(()=>m.progress>.999,9,'Address departure');enter(p.arrival);walk(14,12);wait(.2);game.input.jumpQueued=true;walk(14,15);walk(19,18);game.interact();wait(.3);check(m.locked,'Berth brake did not engage');
 mark('the brake holds an empty carriage');
}
export async function runRoom17(d,{order='cargo-first',interruptBrake=false}={}){
 const {game,level,walk,wait,aim,look,until,pickup,enter,mark}=d,p=level.panels,m=level.state.address;
 room17Depart(d,{order});
 walk(14,15);wait(.2);game.input.jumpQueued=true;walk(14,11);enter(p.address);
 walk(game.cargo.position.x-1,game.cargo.position.z);pickup();wait(.5);check(m.progress>.999,'Unloaded address did not stay parked');walk(-21,21);enter(p.arrival);
 walk(14,10.8);look(p.address.getFrame().center.clone().setZ(12.5));game.interact();wait(1.5);check(m.loaded(),'Friend did not settle on the carriage');
 walk(14,12);wait(.2);game.input.jumpQueued=true;walk(14,15);walk(19,18);game.interact();wait(.3);check(!m.locked,'Brake did not release');
 if(interruptBrake){game.interact();wait(.7);check(m.locked&&m.progress<1&&m.progress>.05,'Midstroke brake must physically hold the carriage');mark('the return stroke can be stopped and resumed');game.interact();wait(.3);}
 mark('the same portal reveals another shore');walk(21,15);walk(21,12);walk(21,-15);walk(-22.5,-15);walk(-22.5,-30.5);walk(-16,-30.5);
 aim(0,p['upper-receiver'].getFrame().center.clone().add({x:0,y:1.1,z:0}));mark('a new sight replaces the arrival portal');walk(-22.5,-30.5);walk(-22.5,-15);walk(-14,-15);walk(-14,-11);walk(-14,5.4);walk(-14,8.6);until(()=>game.playerGrounded&&Math.abs(game.playerPosition.y-7)<.1,6,'Return drop to original berth');
 until(()=>m.progress<.001,6,'Return stroke completion');walk(game.cargo.position.x-1.05,game.cargo.position.z);pickup();enter(p.address);walk(-16,-20.4);until(()=>game.state==='won',4,'Moving address reunion');
}
