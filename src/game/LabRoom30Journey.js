const check=(ok,message)=>{if(!ok)throw Error(message);};
export async function runRoom30(d,{east=false,recovery=false,inspectFirst=false}={}){
 const {game,level,walk,wait,aim,until,look,mark,frame,worldMove,stop}=d,p=level.panels;
 // Commands below are normal camera, movement, E and actual charge requests.
 // No mechanism values, bodies, portal frames or progression flags are set.
 // Find the actual companion instead of depending on the exact start point.
 walk(game.cargo.position.x-1.5,game.cargo.position.z);game.interact();wait(.3);check(game.velocityCompanion?.connected,'The original friend did not connect');
 if(inspectFirst){walk(-26,-13);look(p['north-arc'].getFrame().center);walk(-22,13);walk(-22,22);walk(25,22);look(p['east-arc'].getFrame().center);mark('both launch wings reveal physically different trajectories');}
 const approach=(x,z)=>{for(let n=0;n<1200;n++){const dx=x-game.playerPosition.x,dz=z-game.playerPosition.z,d=Math.hypot(dx,dz);if(d<.07&&Math.hypot(game.playerVelocity.x,game.playerVelocity.z)<.35){stop();wait(.2);return;}const pace=Math.min(.5,d*.35);worldMove(dx/Math.max(d,.001)*pace,dz/Math.max(d,.001)*pace);frame();}throw Error('Viewing rim approach failed at '+game.playerPosition.toArray());};
 const prepare=()=>{
  walk(-21,13);walk(-25,13);walk(-25,-32);approach(-22.6,-32);aim(0,p['first-well'].getFrame().center);
  if(east){walk(-22,22);walk(25,22);aim(1,p['east-arc'].getFrame().center);walk(-22,22);}
  else aim(1,p['north-arc'].getFrame().center);
 };
 const firstDive=()=>{
  walk(-25,-32);walk(-25,-17);walk(0,-17);
  const before=game.teleportCount;
  for(let n=0;n<240&&game.playerGrounded;n++){worldMove(0,-1);game.input.keys.add('ShiftLeft');frame();}
  stop();until(()=>game.teleportCount>before,7,'First gravity reservoir missed');
  until(()=>game.playerGrounded,9,'First arc landing');
  check(game.playerPosition.y>39.8&&(east?game.playerPosition.x>94&&game.playerPosition.x<138:game.playerPosition.x>43&&game.playerPosition.x<81),
   'First route missed its observation island');
  mark(east?'east-west physical arc reaches the separate eastern island':'north-south physical arc reaches the central island');
 };
 if(recovery){
  // Deliberately walk off a real balcony; the real foundation catches both.
  walk(-30,23);walk(-35,23);until(()=>game.playerGrounded&&game.playerPosition.y<.2,9,'Lower recovery garden');
  check(game.velocityCompanion.isNear(),'The actual friend must land nearby');mark('a missed balcony reaches the physical recovery garden');
  walk(-28,24);aim(0,p['lower-return'].getFrame().center);walk(-10,45);aim(1,p['hub-return'].getFrame().center);
  const before=game.teleportCount;
  walk(-29,16);for(let n=0;n<240&&game.teleportCount===before;n++){worldMove(-1,0);frame();}stop();
  until(()=>game.playerGrounded&&game.playerPosition.y>51.9,5,'Physical recovery portal back to hub');
  mark('ordinary portals recover the original travellers without a reset');
  // The high recovery receiver leaves the mouse looking steeply upward.
  // Return the view to the walking horizon before choosing the next panel.
  for(let n=0;n<40;n++){game.pitch+=Math.max(-.05,Math.min(.05,-.16-game.pitch));frame();}
 }
 prepare();mark('room30 first flight prepared');firstDive();
 if(east){
  approach(103.1,24);look(level.state['east-outlet-angleControl'].position);game.interact();wait(2);
  check(level.state.eastTilt.angle>.7,'The eastern final outlet did not physically tilt');
  mark('eastern perch turns its own outlet toward the sunward island');
  walk(130,30);aim(1,p['east-sunward-outlet'].getFrame().center);
  walk(103,30);walk(103,45);approach(105.65,45);
  aim(0,p['east-second-well'].getFrame().center);
 }else{
  approach(49.1,24);look(level.state['outlet-angleControl'].position);game.interact();wait(2);
  check(level.state.tilt.angle>.7,'The final outlet did not physically tilt');
  mark('turning the real outlet changes the last ballistic arc');
  walk(42,30);walk(40,45);approach(43.7,45);
  aim(0,p['second-well'].getFrame().center);aim(1,p['sunward-outlet'].getFrame().center);
 }
 mark(east?'eastern well and east-facing outlet prepare a different final flight':'central well and north-facing outlet prepare the final flight');
 if(east){walk(103,30);walk(120,30);}else{walk(42,30);walk(60,30);}
 const before=game.teleportCount;
 for(let n=0;n<240&&game.playerGrounded;n++){worldMove(0,1);game.input.keys.add('ShiftLeft');frame();}
 stop();until(()=>game.teleportCount>before,7,'Second gravity reservoir missed');until(()=>game.playerGrounded,9,'Sunward landing');
 check(game.playerPosition.y>27.8&&game.playerPosition.x>182,'Final fling missed the sunward island');
 mark(east?'eastern final arc crosses the gap from a perpendicular portal':'the original travellers cross the final gap with conserved momentum');
 walk(200,31);until(()=>game.state==='won',4,'Joint sunward finish');
 check(game.velocityCompanion.isNear(),'Original friend absent at finish');
}
