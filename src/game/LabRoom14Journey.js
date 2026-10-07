import {installRoom21Aim} from './LabRoom21Journey.js';

export async function runRoom14(d,{order='cargo-first'}={}){
 if(!['cargo-first','scout-first','remote-companion'].includes(order))throw new RangeError('Unknown room14 action order');
 if(order==='remote-companion')installRoom21Aim(d);
 const {game,level,walk,wait,aim,look,until,pickup,enter,mark}=d,p=level.panels;
 if(order==='remote-companion'){
  // Set the original friend down inside the visible dispatch area before
  // leaving it below for the first light crossing. Use a settled northward
  // grip rather than releasing it at the distant edge of the floor aperture.
  walk(game.cargo.position.x-1,game.cargo.position.z);pickup();
  walk(-12.1,12);walk(-12.1,11.5);wait(.55);game.interact();wait(.8);
 }
 aim(0,p.access.getFrame().center);aim(1,p['weave-west'].getFrame().center);
 if(order==='cargo-first'){walk(-14,12);pickup();}
 enter(p.access);walk(-16.5,0);mark('light landing reached');
 if(game.heldCube){walk(-16.5,1.6);game.interact();wait(.8);}aim(0,p['light-source'].getFrame().center);wait(.4);if(order==='cargo-first'){walk(game.cargo.position.x-1,2);pickup();}mark('first woven crossing');
 walk(-15.5,level.state.lightBridge.segments[1].a.z+1.55);wait(.2);game.input.jumpQueued=true;walk(-15.5,level.state.lightBridge.segments[1].a.z);wait(.4);walk(-1.5,0);mark('stable island reached');
 if(order==='remote-companion'){
  if(game.heldCube||game.cargo.position.y>1)throw Error('The first crossing must leave the original companion at the entry');
  // Retarget the source aperture to a visible spare part of its ceramic.
  // The beam then misses the aperture and the old projected curtain vanishes.
  // The unweighted stair remains down until the same cargo reaches the island.
  walk(-2.85,1.5);
  const source=p['light-source'].getFrame();
  aim(0,source.center.clone().addScaledVector(source.right,1.4));wait(.2);
  if(game.portals.portals[0].surfaceId!==p['light-source'].mesh.uuid||level.state.lightBridge.segments.length!==1)throw Error('Retargeted source did not disconnect the woven light');
  walk(-2.2,-2.2);
  aim(1,p['island-receiver'].getFrame().center);
  // A free friend can wander while the player scouts the crossing. Leave the
  // receiving address prepared, then use the actual lower recovery court to
  // place the same body back on its ceramic before sending it independently.
  walk(-2.85,1.5);walk(-3.8,1.5);
  until(()=>game.playerGrounded&&game.playerPosition.y<.1,5,'Island recovery fall missed the real lower court');
  walk(game.cargo.position.x-1,game.cargo.position.z);pickup();
  walk(-13,13.6);walk(-13,13.1);wait(1.5);
  const dispatchPoint=game.cargo.position.clone().setY(p['entry-dispatch'].getFrame().center.y);
  // Set the normal camera while the friend is still held, so its free walk
  // cannot make the floor target stale during the approach of the charge.
  look(dispatchPoint);
  if(!game.interact()||game.heldCube)throw Error('Could not set the original friend on the dispatch ceramic');
  wait(.4);
  const before=game.physics.portalTransports;
  aim(0,dispatchPoint);
  until(()=>game.physics.portalTransports>before&&game.cargo.position.y>7.8,6,'Entry floor did not route the original friend to the island');
  until(()=>game.physics.grounded&&game.cargo.position.y>7.4,5,'Original friend did not settle on the permanent island');
  mark('companion follows through the remote island address');
  aim(0,p.access.getFrame().center);aim(1,p['weave-west'].getFrame().center);
  enter(p.access);walk(-16.5,1.6);aim(0,p['light-source'].getFrame().center);wait(.4);
  walk(-15.5,level.state.lightBridge.segments[1].a.z+1.55);wait(.2);game.input.jumpQueued=true;walk(-15.5,level.state.lightBridge.segments[1].a.z);wait(.4);walk(-1.5,0);
  mark('light crossing restored after physical entry-floor recovery');
  walk(-1.5,0);walk(game.cargo.position.x-1,game.cargo.position.z);pickup();walk(-1.5,0);
 }
 if(order==='scout-first'){
  walk(-2,2.5);aim(0,p['return-floor'].getFrame().center);aim(1,p['island-floor'].getFrame().center);
  walk(0,0);until(()=>game.playerPosition.y<3,5,'Scouting return did not descend');
  walk(game.cargo.position.x-1,game.cargo.position.z);aim(0,p.access.getFrame().center);aim(1,p['weave-west'].getFrame().center);walk(game.cargo.position.x-1,game.cargo.position.z);pickup();enter(p.access);walk(-16.5,1.6);game.interact();wait(.8);aim(0,p['light-source'].getFrame().center);wait(.4);walk(game.cargo.position.x-1,2);pickup();walk(-15.5,level.state.lightBridge.segments[1].a.z+1.55);wait(.2);game.input.jumpQueued=true;walk(-15.5,level.state.lightBridge.segments[1].a.z);wait(.4);walk(-1.5,0);
 }
 // A narrow full-height fold admits the player, while the friend waits on
 // the stable island. The upper receiver must first be used for cargo.
 walk(-2.65,0);walk(-2,0);wait(.4);
 game.interact();wait(.7);mark('friend waits on the island');
 until(()=>level.state.counterweightStair.offset>-.01,5,'The island load did not raise the physical folded stair');
 walk(-1.5,0);walk(-1.5,-12.7);walk(1.5,-12.7);wait(.2);game.input.jumpQueued=true;walk(3,-12.7);wait(.2);game.input.jumpQueued=true;walk(3,-7);mark('folded upper return');
 const receiving=p['weave-north'].getFrame();
 // The remote route's precise camera can choose a slightly lower aperture:
 // its light top stays within the real jump and exit-bay step clearance.
 aim(1,receiving.center.clone().addScaledVector(receiving.up,order==='remote-companion'?-.3:0));
 wait(.2);game.input.jumpQueued=true;walk(4.7,-12.7);wait(.2);game.input.jumpQueued=true;walk(1.1,-12.7);walk(-1.5,-12.7);walk(-1.7,-8.5);
 const deliveryBefore=game.physics.portalTransports;
 aim(0,game.cargo.position.clone().setY(7.425));
 until(()=>game.physics.portalTransports>deliveryBefore&&game.cargo.position.y>11.8,5,'Friend did not travel independently');
 wait(1.2);mark('independent upper delivery');
 until(()=>level.state.counterweightStair.offset>-.01,5,'The upper receiving load did not hold the physical folded stair');
 // Return down the fold for the low sight through the emitter housing. Its
 // aperture passes shots and light but excludes the complete player capsule.
 walk(-1.5,-2.3);walk(-2.85,-2.3);walk(-2.85,1.5);aim(0,p['light-source'].getFrame().center);wait(.4);
 walk(-1.5,0);walk(-1.5,-12.7);walk(1.5,-12.7);wait(.2);game.input.jumpQueued=true;walk(3,-12.7);wait(.2);game.input.jumpQueued=true;walk(3,-7);
 {const centre=level.state.lightBridge.segments[1].a.x;walk(centre+(game.cargo.position.x>=centre?1.51:-1.51),game.cargo.position.z);wait(.35);for(let n=0;n<5&&!game.heldCube;n++){walk(game.playerPosition.x,game.cargo.position.z);game.interact();if(!game.heldCube)wait(.2);}if(!game.heldCube)pickup();else wait(.55);}walk(game.playerPosition.x,-7);mark('perpendicular light crossing');
 wait(.2);game.input.jumpQueued=true;walk(level.state.lightBridge.segments[1].a.x,game.playerPosition.z);wait(.4);walk(3,-25.6);until(()=>game.state==='won',3,'Both travellers did not reach the far bay');
}
