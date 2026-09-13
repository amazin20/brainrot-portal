import * as THREE from 'three';
const V=(x,y,z)=>new THREE.Vector3(x,y,z);
const check=(ok,message)=>{if(!ok)throw Error(message);};

// All commands are awaited so the identical route supports synchronous Node
// checks and paced native browser recording. Only normal player actions occur.
export async function room21Delivery(d){
 const {game,level,walk,aim,wait,pickup,until,mark}=d,p=level.panels;
 await walk(-8,10);await walk(-11,8.6);await walk(-11,17);await walk(-7,6);
 await aim(0,V(-2,.025,8));
 await walk(-15,6);await walk(-15,17);await walk(-11,17);await walk(-11,8.6);
 await aim(1,p.freight.getFrame().center);await walk(-8,8.6);await walk(-8,11);
 await walk(game.cargo.position.x-1,game.cargo.position.z);await pickup();
 await walk(-2,11);await walk(-2,9.13);await wait(.3);
 const transports=game.physics.portalTransports;game.interact();
 await until(()=>game.physics.portalTransports>transports,5,'Low cargo fall missed its entry');
 await until(()=>level.pads[0].loaded(),8,'Cargo did not settle on the freight rest');
 await wait(2);check(level.pads[0].loaded(),'Freight resting state must remain loaded');
 await mark('same companion holds the flight aperture');
}

export async function room21Prepare(d){
 const {level,walk,aim,enter,mark}=d,p=level.panels;
 await walk(-8,10);await walk(-11,8.6);await walk(-11,17);await walk(-17,17);
 await aim(0,p.return.getFrame().center);await walk(-2,17.4);
 await aim(1,p.scout.getFrame().center);await walk(-17,17);await enter(p.return);
 await walk(-12,16);await walk(-12,12.1);await walk(-16,12.1);
 await walk(-16,0);await walk(-14.1,0);await aim(0,V(-2,.025,8));
 await walk(-16,0);await walk(-16,-12);await walk(-14.1,-12);
 await aim(1,p.rise.getFrame().center);await mark('independent upper route reveals the inclined surface');
 await walk(-16,12.1);await walk(-12,12.1);await walk(-12,13.5);await walk(-8,13.5);
 await walk(-.5,13.5);await walk(-.5,10.5);await walk(-2,10.5);
 check(Math.abs(d.game.playerPosition.y-14)<.15,'High source must be reached through its actual stairs');
 await mark('same well from a different height');
}

export async function room21Flight(d,{approach=.15,offsetX=0,interrupt=false,eraseInFlight=false}={}){
 const {game,walk,frame,worldMove,stop,until,mark}=d;
 await walk(-2+offsetX,10.5);await walk(-2+offsetX,9.15);
 const before=game.teleportCount;
 for(let n=0;n<240&&game.teleportCount===before;n++){worldMove(0,-approach);await frame();}
 stop();check(game.teleportCount>before,'Upper fall missed the shared entry');
 await mark('fall momentum becomes an ascending arc');
 if(eraseInFlight){await until(()=>game.playerPosition.z>-6.5,2,'Clear of the portal frame');game.clearPortals();await mark('erasing the pair after clearing its frame preserves the airborne route');}
 if(interrupt){
  const position=game.playerPosition.clone(),velocity=game.playerVelocity.clone();
  game.togglePause(true);for(let n=0;n<30;n++)await frame();
  check(game.playerPosition.equals(position)&&game.playerVelocity.equals(velocity),'Pause altered the flying body');
  game.togglePause(false);await mark('flight resumes with its physical momentum');
 }
 await until(()=>game.playerVelocity.y<0,3,'Apex not reached');await mark('gravity returns the traveller above the lintel');
 await until(()=>game.playerGrounded,4,'Receiving landing not reached');
 check(Math.abs(game.playerPosition.y-9)<.15,'Wrong landing '+game.playerPosition.toArray());
 await mark('permanent landing frees the portal pair');
}

export async function room21Reunite(d){
 const {game,level,walk,aim,until,pickup,wait,mark}=d,p=level.panels;
 await walk(6.3,6);await walk(10.7,6);await aim(1,p.rescue.getFrame().center);
 await walk(6,6);await walk(4.8,1.2);await walk(4.8,-4.5);
 await aim(0,game.cargo.position.clone().setY(p['freight-rest'].getFrame().center.y));
 await until(()=>game.cargo.position.x>4&&game.cargo.position.y>8,6,'Freight retrieval did not reach the receiver');
 await wait(1);await mark('released load closes the aperture behind the safe traveller');
 await walk(4.8,1.2);await walk(6,1.2);await walk(6,6);await walk(game.cargo.position.x-1,game.cargo.position.z);
 await pickup();await walk(6.7,6.5);await until(()=>game.state==='won',4,'The same two travellers must arrive together');
 await mark('gravity pocket reunited');
}

export async function runRoom21(d,{order='cargo-first',interrupt=false,eraseInFlight=false,recovery=false,approach=.15,offsetX=0}={}){
 check(['cargo-first','scout-first'].includes(order),'Unknown room21 preparation order');
 if(order==='scout-first'){
  await room21Prepare(d);await d.walk(-6,10.5);
  await d.until(()=>d.game.playerGrounded&&Math.abs(d.game.playerPosition.y-4)<.2,4,'Scouting return to the loading balcony');
  await d.mark('upper scouting returns without disturbing the companion');
 }
 await room21Delivery(d);await room21Prepare(d);
 if(recovery)await room21MissAndReturn(d);
 await room21Flight(d,{interrupt,eraseInFlight,approach,offsetX});await room21Reunite(d);
}

/** Erase the entry before falling: the real foundation catches the player.
 * Walk back up the actual return stairs, leaving the freight preparation intact. */
export async function room21MissAndReturn(d){
 const {game,level,walk,until,mark}=d;
 game.clearPortals();await walk(-2,8.0);
 await until(()=>game.playerGrounded&&Math.abs(game.playerPosition.y)<.15,4,'Missing portal must return to the foundation');
 check(level.pads[0].loaded(),'Failed flight must not erase freight preparation');
 await mark('miss returns to the same foundation with freight still prepared');
 await walk(-15,7);await walk(-15,17);await walk(-11,17);await walk(-11,8.6);await walk(-8,8.6);await walk(-8,11);
 await room21Prepare(d);await mark('local return restores the high approach without resetting');
}
