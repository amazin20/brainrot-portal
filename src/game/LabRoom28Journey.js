const check=(ok,message)=>{if(!ok)throw Error(message);};
export async function runRoom28(d,{route='equal-tide-garden',recoverFall=false,interrupt=false}={}){
 const {game,level,walk,aim,look,wait,until,pickup,mark}=d,p=level.panels,s=level.state;
 const release=()=>{look(game.playerPosition.clone().add({x:-2,y:1.3,z:0}));game.interact();wait(1.4);};
 const collect=()=>{walk(game.cargo.position.x+1,game.cargo.position.z);pickup();};
 walk(-14,13);aim(0,p['coral-low'].getFrame().center);walk(3,17);pickup();
 walk(20,13);walk(20,0);walk(14,0);release();aim(1,p[route==='full-tide-observatory'?'lagoon-fall':'lagoon-low'].getFrame().center);
 until(()=>s['lagoon-float'].position.y>(route==='full-tide-observatory'?5.25:2.90),40,'Eastern tide did not reach the chosen landing');wait(3);
 mark(route==='full-tide-observatory'?'a full tide reveals the observatory':'equal tides reveal the middle garden');
 collect();
 if(route==='full-tide-observatory'){
  walk(18,-4.6);walk(18,-12);walk(-3,-12);walk(-3,-2);walk(-3,5);
  walk(5,5);release();aim(1,p['lagoon-low'].getFrame().center);until(()=>Math.abs(s.tides.flow)<.001,30,'Lower collectors did not equalize');collect();
 }else{walk(14,6);walk(5,6);}
 if(recoverFall){walk(5,10);until(()=>game.playerGrounded&&game.playerPosition.y<.1,5,'Lagoon foundation did not recover a missed step');walk(20,10);walk(20,0);walk(14,0);until(()=>game.playerGrounded,3,'Refloat landing');game.input.jumpQueued=true;wait(.7);walk(14,6);walk(5,6);}
 walk(-8.1,6);walk(-8.1,0);walk(-13,0);until(()=>game.playerGrounded,3,'Coral middle hatch');
 check(game.playerPosition.y>2.8,'Middle arch did not meet the coral float');mark('the tide changes which coral doorway is usable');
 release();aim(0,p['coral-fall'].getFrame().center);
 until(()=>s['coral-float'].position.y>5.26,40,'Return tide did not lift the occupied coral island');
 mark('the same water returns beneath both travellers');collect();walk(-17,0);walk(-22,0);until(()=>game.state==='won',4,'Joint arrival at the coral observatory');
}
