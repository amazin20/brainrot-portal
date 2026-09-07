import {runV8Journey} from './LabV8Journey.js';
/** Recovery starts with a real fall before any portal is placed. After the
 * stairs, let the empty ferry leave and recall it with E. No deleted X action,
 * private portal clear, actor transform or mechanism state assignment is used. */
export async function runRecoveryJourney(game,options={}){
 if(game.levelIndex!==16)throw new RangeError('The ferry recovery belongs to level 17');
 return runV8Journey(game,{...options,scenario:async d=>{
  const {level,walk,wait,aim,until,mark,pickup}=d,s=level.state,p=level.panels;
  const check=(v,m)=>{if(!v)throw new Error(m);};
  // F and X were removed from player controls. Demonstrate an unprepared
  // fall BEFORE ever placing a portal, rather than privately deleting a pair.
  walk(-5,8);wait(.8);check(game.playerGrounded&&game.playerPosition.y<.1,'Did not fall into basin');
  check(!game.portals.ready,'Unexpected prepared portal pair');mark('fell without any portal preparation');
  walk(-6,-13);walk(-9.5,-13);walk(-9.5,-5.2);wait(.4);
  check(game.playerPosition.y>2.8,'Staircase did not restore the starting dock');
  walk(-7,-4.5);walk(-7,7);walk(-9,7);
  aim(0,p.supply.getFrame().center);aim(1,p['rail-air'].getFrame().center);
  walk(-11.3,4.5);wait(.2);game.interact();wait(.2);
  // The wandering friend can reach the console first. Honour the same pickup
  // priority as a player: carry it to a quiet part of the dock before using E.
  if(game.heldCube){walk(-7,9);wait(.3);game.interact();wait(.6);walk(-11.3,4.5);wait(.2);game.interact();wait(.2);}
  check(s.blower.enabled,'Could not start blower with E');
  until(()=>s.sail.progress>.99,60,'Empty ferry did not leave dock');mark('empty ferry stranded on the far shore');
  game.interact();wait(.3);check(!s.blower.enabled,'Could not stop blower');
  walk(-8.6,.1);wait(.2);game.interact();wait(.2);check(s.sailPhysics.recalling,'Winch control not reachable');
  until(()=>s.sail.progress<.01&&!s.sailPhysics.recalling,60,'Winch did not bring the same ferry back');
  mark('winch returned ferry through continuous physical motion');
  // A projected X/Z waypoint is not a route between different storeys.
  // The friend can settle below the returned ferry. Walk into the open basin
  // before approaching it; never attempt pickup through the deck above it.
  if(game.cargo.position.y<2.5&&game.playerPosition.y>2.8){
   walk(-5,8);until(()=>game.playerGrounded&&game.playerPosition.y<.1,5,'Could not descend to the fallen friend');
  }
  let c=game.cargo.position.clone();
  if(c.y>2.5){
   if(game.playerPosition.y<2.8){walk(-6,-13);walk(-9.5,-13);walk(-9.5,-5.2);wait(.4);}
   walk(-7.2,7);c=game.cargo.position.clone();
   const dx=-9-c.x,dz=3-c.z,length=Math.hypot(dx,dz)||1;
   walk(c.x+dx/length*1.05,c.z+dz/length*1.05);
  }else{
   walk(c.x,c.z+1.2);until(()=>game.playerGrounded,4,'Could not approach fallen companion');
   c=game.cargo.position.clone();walk(c.x,c.z+1.1);
  }
  mark('approached the friend on its actual floor');
  try{pickup();}catch(error){throw new Error(`${error.message}; recovery player ${game.playerPosition.toArray()}; friend ${game.cargo.position.toArray()}`);}
  if(game.playerPosition.y<2.8){walk(-6,-13);walk(-9.5,-13);walk(-9.5,-5.2);wait(.4);}
  check(game.playerPosition.y>2.8,'Recovery must end back at the starting dock');
  check(game.heldCube===game.cargo&&game.teleportCount===0,'Recovery changed companion or teleported the player');
  mark('same friend recovered on the restored loading dock');
 }});
}
