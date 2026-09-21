const check=(ok,message)=>{if(!ok)throw Error(message);};
export async function runRoom30(d,{east=false,recovery=false,inspectFirst=false}={}){
 const {game,level,walk,wait,aim,until,look,mark,frame,worldMove,stop}=d,p=level.panels;
 // Commands below are normal camera, movement, E and actual charge requests.
 // No mechanism values, bodies, portal frames or progression flags are set.
 walk(-21.5,16);game.interact();wait(.3);check(game.velocityCompanion?.connected,'The original friend did not connect');
 if(inspectFirst){walk(-26,-13);look(p['north-arc'].getFrame().center);walk(-26,22);walk(25,22);look(p['east-arc'].getFrame().center);mark('both launch wings reveal physically different trajectories');}
 const approach=(x,z)=>{for(let n=0;n<1200;n++){const dx=x-game.playerPosition.x,dz=z-game.playerPosition.z,d=Math.hypot(dx,dz);if(d<.07&&Math.hypot(game.playerVelocity.x,game.playerVelocity.z)<.35){stop();wait(.2);return;}const pace=Math.min(.5,d*.35);worldMove(dx/Math.max(d,.001)*pace,dz/Math.max(d,.001)*pace);frame();}throw Error('Viewing rim approach failed');};
 const prepare=()=>{walk(-25,16);walk(-25,-32);approach(-22.6,-32);aim(0,p['first-well'].getFrame().center);aim(1,p[east?'east-arc':'north-arc'].getFrame().center);};
 const firstDive=()=>{
  walk(-25,-32);walk(-25,-17);walk(0,-17);
  const before=game.teleportCount;
  for(let n=0;n<240&&game.playerGrounded;n++){worldMove(0,-1);game.input.keys.add('ShiftLeft');frame();}
  stop();until(()=>game.teleportCount>before,7,'First gravity reservoir missed');
  until(()=>game.playerGrounded,9,'First arc landing');
  check(game.playerPosition.y>39.8&&game.playerPosition.x>43,'First route missed the shared observation garden');
  mark(east?'east-west physical arc reaches the shared island':'north-south physical arc reaches the shared island');
 };
 if(recovery){
  // Deliberately walk off a real balcony; the real foundation catches both.
  walk(-30,23);walk(-35,23);until(()=>game.playerGrounded&&game.playerPosition.y<.2,9,'Lower recovery garden');
  check(game.velocityCompanion.isNear(),'The actual friend must land nearby');mark('a missed balcony reaches the physical recovery garden');
  walk(-28,24);aim(0,p['lower-return'].getFrame().center);aim(1,p['hub-return'].getFrame().center);
  const before=game.teleportCount;
  walk(-29,16);for(let n=0;n<240&&game.teleportCount===before;n++){worldMove(-1,0);frame();}stop();
  until(()=>game.playerGrounded&&game.playerPosition.y>51.9,5,'Physical recovery portal back to hub');
  mark('ordinary portals recover the original travellers without a reset');
 }
 prepare();firstDive();
 walk(49,24);look(level.state['outlet-angleControl'].position);game.interact();wait(2);
 check(level.state.tilt.angle>.7,'The final outlet did not physically tilt');mark('turning the real outlet changes the last ballistic arc');
 walk(42,30);walk(40,45);approach(43.4,45);aim(0,p['second-well'].getFrame().center);aim(1,p['sunward-outlet'].getFrame().center);
 walk(42,30);walk(60,30);const before=game.teleportCount;
 for(let n=0;n<240&&game.playerGrounded;n++){worldMove(0,1);game.input.keys.add('ShiftLeft');frame();}
 stop();until(()=>game.teleportCount>before,7,'Second gravity reservoir missed');until(()=>game.playerGrounded,9,'Sunward landing');
 check(game.playerPosition.y>27.8&&game.playerPosition.x>122,'Final fling missed the sunward island');
 mark('the original travellers cross the final gap with conserved momentum');
 walk(140,31);until(()=>game.state==='won',4,'Joint sunward finish');
 check(game.velocityCompanion.isNear(),'Original friend absent at finish');
}
