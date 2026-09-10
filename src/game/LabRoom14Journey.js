export async function runRoom14(d,{order='cargo-first'}={}){
 if(!['cargo-first','scout-first'].includes(order))throw new RangeError('Unknown room14 action order');
 const {game,level,walk,wait,aim,until,pickup,enter,mark}=d,p=level.panels;
 aim(0,p.access.getFrame().center);aim(1,p['weave-west'].getFrame().center);
 if(order==='cargo-first'){walk(-14,12);pickup();}
 enter(p.access);walk(-16.5,0);mark('light landing reached');
 if(game.heldCube){walk(-16.5,1.6);game.interact();wait(.8);}aim(0,p['light-source'].getFrame().center);wait(.4);if(order==='cargo-first'){walk(game.cargo.position.x-1,2);pickup();}mark('first woven crossing');
 walk(-15.5,level.state.lightBridge.segments[1].a.z+1.55);wait(.2);game.input.jumpQueued=true;walk(-15.5,level.state.lightBridge.segments[1].a.z);wait(.4);walk(-1.5,0);mark('stable island reached');
 if(order==='scout-first'){
  walk(-2,2.5);aim(0,p['return-floor'].getFrame().center);aim(1,p['island-floor'].getFrame().center);
  walk(0,0);until(()=>game.playerPosition.y<3,5,'Scouting return did not descend');
  walk(game.cargo.position.x-1,game.cargo.position.z);aim(0,p.access.getFrame().center);aim(1,p['weave-west'].getFrame().center);pickup();enter(p.access);walk(-16.5,1.6);game.interact();wait(.8);aim(0,p['light-source'].getFrame().center);wait(.4);walk(game.cargo.position.x-1,2);pickup();walk(-15.5,level.state.lightBridge.segments[1].a.z+1.55);wait(.2);game.input.jumpQueued=true;walk(-15.5,level.state.lightBridge.segments[1].a.z);wait(.4);walk(-1.5,0);
 }
 // A narrow full-height fold admits the player, while the friend waits on
 // the stable island. The upper receiver must first be used for cargo.
 walk(-.8,0);game.interact();wait(.7);mark('friend waits on the island');
 walk(-1.5,0);walk(-1.5,-12.7);walk(1.5,-12.7);wait(.2);game.input.jumpQueued=true;walk(3,-12.7);wait(.2);game.input.jumpQueued=true;walk(3,-7);mark('folded upper return');
 aim(1,p['weave-north'].getFrame().center);
 wait(.2);game.input.jumpQueued=true;walk(4.7,-12.7);wait(.2);game.input.jumpQueued=true;walk(1.1,-12.7);walk(-1.5,-12.7);walk(-1.5,-8.5);
 const deliveryBefore=game.physics.portalTransports;
 aim(0,game.cargo.position.clone().setY(7.425));
 until(()=>game.physics.portalTransports>deliveryBefore&&game.cargo.position.y>11.8,5,'Friend did not travel independently');
 wait(1.2);mark('independent upper delivery');
 // Return down the fold for the low sight through the emitter housing. Its
 // aperture passes shots and light but excludes the complete player capsule.
 walk(-1.5,-2.3);walk(-2.85,-2.3);walk(-2.85,1.5);aim(0,p['light-source'].getFrame().center);wait(.4);
 walk(-1.5,0);walk(-1.5,-12.7);walk(1.5,-12.7);wait(.2);game.input.jumpQueued=true;walk(3,-12.7);wait(.2);game.input.jumpQueued=true;walk(3,-7);
 {const centre=level.state.lightBridge.segments[1].a.x;walk(centre+(game.cargo.position.x>=centre?1.51:-1.51),game.cargo.position.z);wait(.35);for(let n=0;n<5&&!game.heldCube;n++){walk(game.playerPosition.x,game.cargo.position.z);game.interact();if(!game.heldCube)wait(.2);}if(!game.heldCube)pickup();else wait(.55);}walk(game.playerPosition.x,-7);mark('perpendicular light crossing');
 wait(.2);game.input.jumpQueued=true;walk(level.state.lightBridge.segments[1].a.x,game.playerPosition.z);wait(.4);walk(3,-25.6);until(()=>game.state==='won',3,'Both travellers did not reach the far bay');
}
