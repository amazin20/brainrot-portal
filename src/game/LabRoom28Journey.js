const check=(ok,message)=>{if(!ok)throw Error(message);};
export async function runRoom28(d,{route='equal-tide-garden',recoverFall=false,interrupt=false}={}){
 const {game,level,walk,aim,look,wait,until,pickup,mark}=d,p=level.panels,s=level.state;
 const release=()=>{look(game.playerPosition.clone().add({x:-2,y:1.3,z:0}));game.interact();wait(1.4);};
 const collect=()=>{walk(game.cargo.position.x+1,game.cargo.position.z);pickup();};
 walk(-14,13);aim(0,p['coral-low'].getFrame().center);walk(3,17);pickup();
 walk(21,13);walk(21,0);walk(14,0);release();mark('the collector opens and the lagoon begins to rise');aim(1,p[route==='full-tide-observatory'?'lagoon-fall':'lagoon-low'].getFrame().center);
 if(!interrupt){
  // Glance at the actual near-mouth gauge after a real shot while the water
  // still moves. This is ordinary player camera movement, not a staged view.
  wait(.3);look(p['lagoon-fall'].getFrame().center.clone().set(18.5,5.5,-5.2));
  check(Math.abs(s.tides.flow)>.006,'The receiving tide stopped before its visible flow check');
  mark('the east gauge and receiving current show the moving tide');
 }
 if(interrupt){wait(.25);game.clearPortals();const stopped=s.tides.levels[1];wait(3);check(Math.abs(s.tides.levels[1]-stopped)<1e-8,'Disconnected collectors created water');mark('a broken connection holds both tides');walk(14,2.5);walk(21,2.5);walk(21,13);walk(-14,13);aim(0,p['coral-low'].getFrame().center);walk(21,13);walk(21,0);walk(14,0);aim(1,p['lagoon-low'].getFrame().center);}
 until(()=>s['lagoon-float'].position.y>(route==='full-tide-observatory'?5.25:2.90),40,'Eastern tide did not reach the chosen landing');wait(3);
 mark(route==='full-tide-observatory'?'a full tide reveals the observatory':'equal tides reveal the middle garden');
 collect();
 if(route==='full-tide-observatory'){
  walk(18,-4.6);walk(18,-12);walk(-3,-12);walk(-3,-2);walk(-3,5);
  walk(5,5);release();aim(1,p['lagoon-low'].getFrame().center);until(()=>Math.abs(s.tides.flow)<.001,30,'Lower collectors did not equalize');collect();
 }else{walk(14,6);walk(5,6);}
 if(recoverFall){
  walk(5,11);until(()=>game.playerGrounded&&game.playerPosition.y<.1,5,'Lagoon foundation did not recover a missed step');release();
  walk(-4,13);aim(0,p['coral-overflow'].getFrame().center);wait(.3);until(()=>Math.abs(s.tides.flow)<.001,40,'Visible overflow did not return the displaced tide');game.clearPortals();
  walk(-14,13);aim(0,p['coral-low'].getFrame().center);collect();walk(21,13);walk(21,0);walk(14,0);release();aim(1,p['lagoon-low'].getFrame().center);
  wait(.3);until(()=>Math.abs(s.tides.flow)<.001,40,'Reopened tide did not recover the middle garden');collect();walk(14,6);walk(5,6);mark('the overflow recovers a missed garden without a reset');
 }
 walk(-8.1,6);walk(-8.1,0);walk(-13,0);until(()=>game.playerGrounded,3,'Coral middle hatch');
 check(game.playerPosition.y>2.8,'Middle arch did not meet the coral float');mark('the tide changes which coral doorway is usable');
 release();mark('the occupied coral island begins its return tide');aim(0,p['coral-fall'].getFrame().center);
 until(()=>s['coral-float'].position.y>5.2,40,'Return tide did not lift the occupied coral island');
 mark('the same water returns beneath both travellers');collect();walk(-17,0);walk(-22,0);until(()=>game.state==='won',4,'Joint arrival at the coral observatory');
}
