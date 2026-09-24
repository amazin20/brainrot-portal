import {runBalanceJourney} from './LabBalanceJourney.js';
export {runBalanceJumpAttempt} from './LabBalanceJourney.js';
/** Authored positive solutions. Only ordinary walking, aiming, interaction and
 * elapsed simulation are used: no actor teleports, assigned actuator targets,
 * forced success, disabled collision or test-only forces. */
export async function runExtendedStages(d,{order}={}){
 const {game,level,walk,wait,aim,until,pickup,enter,mark,frame,worldMove,stop}=d;
 const check=(v,m)=>{if(!v)throw Error(m);};
 const drop=()=>{wait(.25);game.interact();check(!game.heldCube,'Could not put friend down');wait(1);};
 const collect=()=>{const c=game.cargo.position;walk(c.x,c.z+1.05);if(game.state!=='won')pickup();};
 if(level.index===5){
  if(order==='light-first'){
   // The pilot receiver supplies a physical reason for the outside servo to
   // turn the same mirror. Both apertures remain in place through the turn.
   walk(-7,9);aim(0,level.panels['light-intake'].getFrame().center);
   walk(4,-5.5);aim(1,level.panels['light-outlet'].getFrame().center);
   until(()=>level.state.pilotLit,3,'Unturned beam did not reach the pilot receiver');
   check(!level.state.lit&&level.state.target===0,'Pilot must precede the real exit receiver');
   mark('unturned optical path lights the pilot receiver before the mirror turns');
   walk(3,-7);check(game.interact(),'Outside mirror servo cannot be used');
  }else{
   aim(0,level.panels['cab-entry'].getFrame().center);
   walk(-3,0);walk(-3,-4.5);aim(1,level.panels['cab-inner'].getFrame().center);
   walk(-3,4);enter(level.panels['cab-entry']);mark('entered calibration cabin through its service sightline');
   walk(-7.8,-4.6);game.interact();until(()=>level.state.mirror>.995,4,'Mirror did not turn');
   enter(level.panels['cab-inner']);walk(-7,9);aim(0,level.panels['light-intake'].getFrame().center);
   walk(4,-5.5);aim(1,level.panels['light-outlet'].getFrame().center);
  }
  until(()=>level.state.lit,4,'Light did not reach receiver');mark('beam physically traversed pair and reflected to receiver');
  collect();walk(4,-10);walk(0,-10);walk(0,-16.3);
 }else if(level.index===6){
  await runBalanceJourney(d,{order});
 }else if(level.index===7){
  if(order==='wind-through'){
   // The fan can also carry the travellers into the wall aperture. They
   // emerge inside the upward plume instead of approaching it on foot.
   aim(0,level.panels['air-intake'].getFrame().center);
   walk(0,3);aim(1,level.panels['air-up'].getFrame().center);
   walk(6,10);game.interact();wait(.5);check(level.state.enabled,'Fan not enabled');
   collect();check(game.heldCube,'The original friend must travel through the wind portal');
   const before=game.teleportCount;
   for(let n=0;n<100&&game.playerPosition.z<6.95&&game.teleportCount===before;n++){worldMove(0,1);frame();}stop();
   check(game.playerPosition.z>6.5&&game.playerPosition.z<7.5&&game.playerPosition.x<8.5,
    'Travellers did not enter the horizontal wind centerline');
   mark('both travellers enter the horizontal fan stream before the wall portal');
   let peakX=game.playerPosition.x;
   until(()=>{peakX=Math.max(peakX,game.playerPosition.x);return game.teleportCount>before;},3,
    'Horizontal air did not send the travellers through its portal');
   check(peakX>8.5&&game.playerPosition.y<5&&game.playerVelocity.y>0,
    'The stopped player did not ride the fan into the portal and emerge upward');
   mark('fan alone pushes both travellers through the wall portal into the vertical plume');
   for(let n=0;n<360&&!(game.playerGrounded&&game.playerPosition.y>6.9);n++){worldMove(0,-1);frame();}stop();
   check(game.playerGrounded&&game.playerPosition.y>6.9,'Ballistic wind launch missed the upper gallery');
   walk(0,-9);return;
  }
  // Both orders use the same fan and portal pair: the live plume can be
  // routed through an existing pair or the pair can be built around a live fan.
  if(order==='air-first'){
   walk(6,10);game.interact();wait(.5);check(level.state.enabled,'Fan not enabled');
   check(!game.portals.ready,'The fan-first route must begin without a portal pair');
   mark('fan running before portals route its air');
   walk(6,11.5);walk(1,11.5);walk(1,5.8);
  }
  aim(0,level.panels['air-intake'].getFrame().center);
  walk(0,3);aim(1,level.panels['air-up'].getFrame().center);
  if(order!=='air-first'){walk(6,10);game.interact();wait(.5);check(level.state.enabled,'Fan not enabled');}
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
