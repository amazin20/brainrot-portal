/** Authored positive solutions. Only ordinary walking, aiming, interaction and
 * elapsed simulation are used: no actor teleports, assigned actuator targets,
 * forced success, disabled collision or test-only forces. */
export async function runExtendedStages(d){
 const {game,level,walk,wait,aim,until,pickup,enter,mark,frame,worldMove,stop}=d;
 const check=(v,m)=>{if(!v)throw Error(m);};
 const drop=()=>{wait(.25);game.interact();check(!game.heldCube,'Could not put friend down');wait(1);};
 const collect=()=>{const c=game.cargo.position;walk(c.x,c.z+1.05);if(game.state!=='won')pickup();};
 if(level.index===5){
  aim(0,level.panels['cab-entry'].getFrame().center);
  walk(-3,0);walk(-3,-4.5);aim(1,level.panels['cab-inner'].getFrame().center);
  walk(-3,4);enter(level.panels['cab-entry']);mark('entered calibration cabin through its service sightline');
  walk(-7.8,-4.6);game.interact();until(()=>level.state.mirror>.995,4,'Mirror did not turn');
  enter(level.panels['cab-inner']);walk(-7,9);aim(0,level.panels['light-intake'].getFrame().center);
  walk(4,-5.5);aim(1,level.panels['light-outlet'].getFrame().center);
  until(()=>level.state.lit,4,'Light did not reach receiver');mark('beam physically traversed pair and reflected to receiver');
  collect();walk(4,-10);walk(0,-10);walk(0,-16.3);
 }else if(level.index===6){
  walk(8,1.2);game.interact();wait(.3);game.interact();wait(4);
  walk(0,1);aim(0,level.panels['lever-load'].getFrame().center);
  collect();walk(0,1);walk(0,5.5);walk(0,7.75);drop();
  wait(2);mark('same load creates a larger torque at the end of the lever');
  walk(0,0);walk(0,-9.5);walk(0,-12.8);mark('crossed a load-balanced physical deck');
  walk(-7.8,-14);aim(1,level.panels['lever-receiver'].getFrame().center);wait(2);mark('retrieval after releasing lever load');
  walk(-7.8,-14);aim(0,level.panels['balance-upper-transfer'].getFrame().center);enter(level.panels['balance-upper-transfer']);
  if(game.state!=='won'){collect();walk(4.6,-14.5);}
 }else if(level.index===7){
  aim(0,level.panels['air-intake'].getFrame().center);
  walk(0,3);aim(1,level.panels['air-up'].getFrame().center);
  walk(6,10);game.interact();wait(.5);check(level.state.enabled,'Fan not enabled');
  collect();walk(0,4);walk(0,1.3);
  until(()=>game.playerPosition.y>8.3,6,'Updraft did not lift player');mark('sustained portal-routed air supports both travellers');
  for(let n=0;n<300&&!(game.playerGrounded&&game.playerPosition.y>6.9);n++){worldMove(0,-1);frame();}stop();
  check(game.playerGrounded&&game.playerPosition.y>6.9,'Could not leave the stream onto gallery');walk(0,-9);
 }else if(level.index===8){
  walk(-7,6);aim(0,level.panels['belt-end'].getFrame().center);
  walk(-5,1);walk(-4,-5);aim(1,level.panels['impact-entry'].getFrame().center);
  // The loading platform has a low stair on its outside edge.
  walk(-7,-2);walk(-11,-2);walk(-11,2.8);
  game.interact();wait(.3);check(level.state.direction===1,'Belt direction did not reverse');
  walk(-8,2.8);collect();walk(-8,9);walk(-8,6.9);drop();
  until(()=>level.state.piston.latched,12,'The projectile did not compress and latch the spring');mark('cargo momentum physically compressed the spring and latched the pawl');
  walk(-5,1);walk(-4,-3.9);walk(0,-3.9);wait(2);collect();walk(0,-3.9);walk(-4,-3.9);walk(-4,-11.6);walk(0,-11.6);walk(0,-16);
 }else{
  walk(-12,13);walk(14,13);walk(14,-12);walk(6,-10.05);aim(0,level.panels.well.getFrame().center.clone().add({x:.5,y:0,z:0}));walk(14,-12);walk(14,-8);walk(12,-8);aim(1,level.panels.collection.getFrame().center);
  walk(14,-8);walk(14,11);walk(-1,12.5);game.interact();check(level.state.enabled,'Vector field not on');
  const direction=i=>{for(let n=0;level.state.direction!==i&&n<4;n++){game.interact();wait(.12);}};
  const c=()=>game.cargo.position;
  until(()=>c().x>6.4,12,'East route blocked');direction(1);
  until(()=>c().z<-.35,10,'First north route blocked');direction(2);
  until(()=>c().x< -6.9,12,'West route blocked');direction(1);
  until(()=>c().z< -4.35,10,'Second north route blocked');direction(0);
  until(()=>c().x>6.4,12,'Final east route blocked');direction(1);
  until(()=>c().y>3&&c().x>9,12,'Friend did not travel from the well to the collection gallery');mark('field navigated the sealed maze; friend extracted through bottom portal');
  walk(14,11);walk(14,-8);walk(11.8,-6.8);if(game.state!=='won'){const p=game.cargo.position;walk(p.x+.9,p.z-.9);pickup();walk(11.8,-8);}
 }
}

/** Regression route from the 2026-09-08 room-7 recording. Uses the same
 * controls as a player: move the counterweight, carry the friend, then try
 * repeated jumps to the intermediate gallery. Reaching that gallery matters:
 * the final dock can subsequently be entered through an ordinary portal pair.
 * No actor poses, mechanism targets, collision flags or win flags are assigned. */
export function runBalanceJumpAttempt(d,{carry=true,counter=2,sprint=true,jumpEvery=8,maxFrames=420}={}){
 const {game,level,walk,wait,pickup,worldMove,frame,stop}=d;
 if(level.index!==6)throw Error('Balance regression requires room 7');
 walk(8,1.2);for(let n=0;n<counter;n++){game.interact();wait(.3);}wait(4);
 if(carry){const c=game.cargo.position;walk(c.x,c.z+1.05);pickup();}
 walk(0,1);if(sprint)game.input.keys.add('ShiftLeft');
 let reached=false,maxY=game.playerPosition.y,frames=0;
 for(;frames<maxFrames;frames++){
  if(jumpEvery&&frames%jumpEvery===0)game.input.jumpQueued=true;
  worldMove(0,-1);frame();maxY=Math.max(maxY,game.playerPosition.y);
  if(game.playerPosition.z<-11.3&&game.playerPosition.y>5.49&&game.playerGrounded){reached=true;break;}
  if(game.playerPosition.y<-3)break;
 }
 stop();return {reached,maxY,frames,player:game.playerPosition.toArray(),angle:level.state.angle,
  cargoHeld:game.heldCube===game.cargo,teleports:game.teleportCount};
}
