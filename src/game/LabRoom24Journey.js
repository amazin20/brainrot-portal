const check=(p,m)=>{if(!p)throw Error(m);};
function feed(d){
 const p=d.level.panels['air-intake'],target=p.getFrame().center.clone();
 for(let n=0;n<4;n++){d.aim(0,target);d.wait(.15);if(d.level.state.pneumatic.feed)return;target.add(p.getFrame().center.clone().sub(d.game.portals.portals[0].position));}
 check(false,'Actual compressor stream missed the intake');
}
export async function runRoom24(d,{order='charge-first',interruptFeed=false,storageDelay=0}={}){
 const {game,level,walk,aim,wait,until,pickup,mark}=d,p=level.panels,s=level.state;
 walk(-7,15);walk(-7,-5);walk(-2,-2);aim(1,p['air-delivery'].getFrame().center);
 walk(-2,-1);walk(-7,-1);walk(-7,15);walk(-16,15);walk(-16,-10);walk(-14,-10);feed(d);
 if(interruptFeed){wait(2);aim(0,p['air-intake'].getFrame().center.clone().add({x:0,y:0,z:2}));wait(.4);check(!s.pneumatic.feed,'A missed aperture must interrupt the real supply');feed(d);}
 until(()=>game.playerPosition.y>7.97,20,'Pressure lift did not rise');mark('stored air raises the occupied cylinder');
 walk(-14,-14.5);walk(-12.6,-14.5);if(order==='charge-first')until(()=>s.pneumatic.pressure>9.8,18,'Charge before isolating the cylinder');game.interact();check(!s.pneumatic.liftValve,'Cylinder valve did not isolate');
 if(order==='isolate-first')mark('isolation precedes full charge');
 until(()=>s.pneumatic.pressure>9.8,18,'Accumulator failed to fill');mark('closed cylinder retains the first crossing');
 walk(-11,-12.9);walk(-7,-12.9);walk(-4,-13);aim(1,p['freight-receiver'].getFrame().center);
 walk(-7,-12.9);walk(-14,-12.9);walk(-14,-8);walk(0,-8);walk(0,-2.65);aim(0,p['sealed-cargo'].getFrame().center);until(()=>game.cargo.position.y>8,7,'Original friend did not reach upper freight pocket');wait(1.8);
 check(!s.pneumatic.feed,'Borrowed pair must stop pneumatic charging');check(s['pressure-lift'].position.y>7.9,'Isolated cylinder lost height');
 if(storageDelay)wait(storageDelay);mark('portal pair retrieves the original friend');
 walk(0,-8);walk(-14,-8);walk(-14,-12.9);walk(-7,-12.9);walk(game.cargo.position.x-1,game.cargo.position.z);pickup();
 walk(-3,-12);walk(8,-12);walk(8,-9.8);walk(8.2,-6.3);game.interact();wait(.4);walk(9.15,-6.6);game.interact();check(s.pneumatic.bridgeValve,'Crossing valve did not open');mark('boarded pressure car beside the free friend');mark('finite reserve carries both travellers');
 until(()=>s['pressure-ferry'].progress>.997,30,'Reservoir did not carry the loaded crossing');
 wait(1);walk(game.cargo.position.x-.8,game.cargo.position.z);mark('far pressure dock pickup');pickup();walk(8,14.4);walk(17,17);until(()=>game.state==='won',3,'Both travellers missed the pressure dock');
}
