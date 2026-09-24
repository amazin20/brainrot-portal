const check=(ok,msg)=>{if(!ok)throw Error(msg);};
function room13NorthCompanion(d){
 const {game,level,walk,aim,pickup,wait,until,mark}=d,p=level.panels,s=level.state;
 room13Access(d);walk(-16,-12);walk(-10,-11);d.look(game.playerPosition.clone().add({x:1,y:1,z:0}));
 check(game.interact()&&!game.heldCube,'Companion could not wait on north cage');wait(.8);
 mark('Companion waits on the unloaded northern cage');
 walk(-12,-6);aim(0,p['light-intake'].getFrame().center);walk(-14,-11);walk(-11.4,-11);aim(1,p['light-output'].getFrame().center);wait(1);
 check(s.optical.receivers[0]&&!s.optical.loaded,'North cage must rise with the mirror unloaded');
 until(()=>game.playerPosition.y>11.98&&game.cargo.position.y>12,12,'North cage did not lift both travellers');walk(-10,-14.5);
 mark('Both travellers reach north observation without loading the mirror');
 walk(game.cargo.position.x-1,game.cargo.position.z);pickup();walk(-10,-14.5);
 d.look(game.playerPosition.clone().add({x:0,y:1,z:-3}));check(game.interact()&&!game.heldCube,'Companion could not wait on north upper gallery');wait(.8);
 walk(7,-14.5);aim(0,p['mirror-cradle'].getFrame().center.clone().add({x:-1,y:0,z:.2}));walk(7,-15.5);
 aim(1,p['north-dispatch'].getFrame().center);
 walk(game.cargo.position.x+1,game.cargo.position.z);pickup();walk(-10.5,-14.5);
 d.look(p['north-dispatch'].getFrame().center);
 const transported=game.physics.portalTransports;
 for(let n=0;n<50&&game.playerPosition.x>-11.6;n++){d.worldMove(-1,0);d.frame();}
 check(game.interact()&&!game.heldCube,'Companion could not enter upper address');d.stop();
 until(()=>game.physics.portalTransports>transported,6,'Companion did not pass through upper address');
 until(()=>s.optical.loaded,6,'Companion failed to load lower mirror from the north gallery');
  mark('North address dispatches the original companion onto the live mirror');
}
export function room13Access(d,{carry=true}={}){
 const {game,level,walk,aim,pickup,enter,until,mark}=d,p=level.panels;
 walk(-15.5,16);aim(0,p['access-low'].getFrame().center);walk(-8.5,16);walk(-8.5,-18);walk(4,-18);aim(1,p['access-high'].getFrame().center.clone().add({x:0,y:1.7,z:0}));walk(-8.5,-18);walk(-8.5,16);
 if(carry){walk(game.cargo.position.x-1,game.cargo.position.z);pickup();walk(-15.5,16);}
 enter(p['access-low']);until(()=>game.playerGrounded,4,'Optical shelf landing');mark('optical shelf arrival');
}
export function room13Light(d,{branch='south'}={}){
 const {level,walk,aim,wait}=d;
 walk(-10,-6);aim(0,level.panels['light-intake'].getFrame().center);walk(-14,-6);walk(-14,branch==='south'?11:-11);walk(-11.4,branch==='south'?11:-11);aim(1,level.panels['light-output'].getFrame().center);wait(2);
}
export async function runRoom13(d,{order='cargo-first',interruptPower=false}={}){
 const {game,level,walk,aim,pickup,wait,until,mark}=d,p=level.panels,s=level.state;
 check(['cargo-first','scout-first','north-with-companion'].includes(order),'Unknown optical route');
 if(order==='north-with-companion'){
  room13NorthCompanion(d);
  // Reuse the lower mirror address to return; the loaded reflector then
  // provides the distinct southern optical route to the receiving gallery.
  walk(7,-14.25);aim(0,p['mirror-cradle'].getFrame().center.clone().add({x:-1.3,y:0,z:-1.4}));
  walk(-11.5,-14.5);const before=game.teleportCount;
  for(let n=0;n<240&&game.teleportCount===before;n++){d.worldMove(-1,0);d.frame();}
  d.stop();check(game.teleportCount>before,'Player could not cross northern dispatch');
  // Leave the live floor aperture before gravity can return the player to it.
  for(let n=0;n<70&&game.playerPosition.z>-5.5;n++){d.worldMove(0,-1);d.frame();}
  d.stop();
  mark('player follows the companion down to the mirror');
  room13Light(d);check(s.optical.receivers[1],'Loaded mirror did not feed southern cage');
  mark('mirror powers southern ascent after northern dispatch');
  until(()=>game.playerPosition.y>11.98,12,'Southern ascent after companion dispatch');
  walk(-10,14.5);walk(13.5,14.5);walk(13.5,6.4);walk(9,6.4);walk(9,5);
  walk(11,5.8);walk(11,2.5);walk(9,2.5);aim(1,p['receiving-return'].getFrame().center);walk(11,2.5);walk(11,5.8);walk(7.5,5.8);
  const cargoFloor=game.cargo.position.clone().setY(p['mirror-cradle'].getFrame().center.y);
  d.look(cargoFloor);game.input.jumpQueued=true;d.frame();aim(0,cargoFloor);
  until(()=>game.cargo.position.y>12,7,'Original friend did not leave the mirror');
  mark('companion reaches the upper receiving chamber');
  walk(11,5.8);walk(11,2.5);walk(9,2.5);
  for(let n=0;n<6&&!game.heldCube&&game.state==='playing';n++){
   const c=game.cargo.position,x=Math.max(8,Math.min(14,c.x+(game.playerPosition.x>c.x?.8:-.8))),z=Math.max(1.5,Math.min(6.5,c.z));
   walk(x,z,7);game.interact();if(!game.heldCube)wait(.2);
  }
  check(game.heldCube||game.state==='won','Companion moved away before reunion');mark('player recovers original companion');walk(9,2.5);
  until(()=>game.state==='won',5,'Reunion after northern dispatch');mark('north-first companion and player meet at the same receiving chamber');return;
 }
 if(order==='scout-first'){
  room13Access(d,{carry:false});walk(-16,-15.2);walk(-16,-12);walk(-12,-6);
  room13Light(d,{branch:'north'});check(s.optical.receivers[0],'Unloaded mirror must drive the northern cage');
  until(()=>game.playerPosition.y>11.98,12,'Northern observation ascent');walk(-10,-14.5);walk(7,-14.5);mark('scout reads both optical paths');
  check(game.cargo.position.y<1&&!game.heldCube,'Scout leaves the original friend below');
  walk(7,-18);until(()=>game.playerGrounded&&game.playerPosition.y<.1,5,'Northern return drop');walk(-8.5,-18);walk(-8.5,16);mark('scout returns below the mirror');
 }
 room13Access(d);
 walk(-16,-15.2);walk(-16,-12);walk(-12,-6);walk(-12,-2);walk(-14,3);walk(-10,3);
 // Use ordinary mouse orbit to inspect the mirror before placing its load;
 // retaining the earlier steep access shot would keep looking at the ceiling.
 d.look(p['mirror-cradle'].getFrame().center.clone().add({x:0,y:2,z:0}));
 mark('live weight turns the mirror');walk(-10,.85);wait(.7);game.interact();wait(1.8);check(s.optical.loaded,'Friend did not load the real mirror cradle');
 room13Light(d);check(s.optical.receivers[1],'Portal ray did not reach southern optical receiver: '+JSON.stringify(s.optical.segments.map(x=>({a:x.a.toArray(),b:x.b.toArray(),kind:x.kind}))));
 if(interruptPower){
  const high=game.playerPosition.y;
  aim(1,p['light-output'].getFrame().center.clone().add({x:0,y:0,z:-2}));wait(3);
  check(!s.optical.receivers[1]&&s['south-cage'].position.y<high-.5,'Loss of the physical ray must lower the occupied cage');
  mark('lost light returns the occupied cage');
  until(()=>s['south-cage'].position.y<6.05,10,'Released cage returns');
  aim(1,p['light-output'].getFrame().center);wait(2);check(s.optical.receivers[1],'Restored ray powers the same cage');
 }
 mark('weighted ray lifts the crossing');until(()=>game.playerPosition.y>11.98,12,'Optical cage ascent');
 walk(-10,14.5);walk(13.5,14.5);walk(13.5,6.4);walk(9,6.4);walk(9,5);mark('the return side of the light');
 walk(11,5.8);walk(11,2.5);walk(9,2.5);aim(1,p['receiving-return'].getFrame().center);walk(11,2.5);walk(11,5.8);walk(7.5,5.8);aim(0,p['mirror-cradle'].getFrame().center);
 until(()=>game.cargo.position.y>12,7,'Original friend returns through the cradle portal');
 walk(11,5.8);walk(11,2.5);walk(9,2.5);if(game.state==='playing'){walk(game.cargo.position.x-.9,game.cargo.position.z);pickup();}walk(9,2.5);until(()=>game.state==='won',5,'Optical reunion');mark('reunion after the ray is released');
}
