import {runV8Journey} from './LabV8Journey.js';
/** Recovery route starts at the authored spawn, lets the empty ferry leave,
 * deliberately falls WITHOUT a pair, then walks upstairs and recalls the ferry
 * through the same E control the player uses. It never assigns actor/state data. */
export async function runRecoveryJourney(game,options={}){
 if(game.levelIndex!==16)throw new RangeError('The ferry recovery belongs to level 17');
 return runV8Journey(game,{...options,scenario:async d=>{
  const {level,walk,wait,aim,until,mark,pickup}=d,s=level.state,p=level.panels;
  const check=(v,m)=>{if(!v)throw new Error(m);};
  aim(0,p.supply.getFrame().center);aim(1,p['rail-air'].getFrame().center);
  walk(-11.3,4.5);wait(.2);game.interact();wait(.2);check(s.blower.enabled,'Could not start blower with E');
  until(()=>s.sail.progress>.99,60,'Empty ferry did not leave dock');mark('empty ferry stranded on the far shore');
  game.interact();wait(.3);check(!s.blower.enabled,'Could not stop blower');game.clearPortals();
  walk(-5,8);wait(.8);check(game.playerGrounded&&game.playerPosition.y<.1,'Did not fall into basin');
  check(!game.portals.ready,'Unexpected prepared portal pair');mark('fell without any portal preparation');
  walk(-6,-13);walk(-9.5,-13);walk(-9.5,-5.2);wait(.4);
  check(game.playerPosition.y>2.8,'Staircase did not restore the starting dock');
  walk(-8.6,.1);wait(.2);game.interact();wait(.2);check(s.sailPhysics.recalling,'Winch control not reachable');
  until(()=>s.sail.progress<.01&&!s.sailPhysics.recalling,60,'Winch did not bring the same ferry back');
  mark('winch returned ferry through continuous physical motion');
  let c=game.cargo.position.clone();walk(c.x,c.z+1.2);until(()=>game.playerGrounded,4,'Could not approach fallen companion');
  c=game.cargo.position.clone();walk(c.x,c.z+1.1);pickup();
  if(game.playerPosition.y<2.8){walk(-6,-13);walk(-9.5,-13);walk(-9.5,-5.2);wait(.4);}
  check(game.playerPosition.y>2.8,'Recovery must end back at the starting dock');
  check(game.heldCube===game.cargo&&game.teleportCount===0,'Recovery changed companion or teleported the player');
  mark('same friend recovered on the restored loading dock');
 }});
}
