import {runV8Journey} from './LabV8Journey.js';
import {installRoom21Aim} from './LabRoom21Journey.js';

/** Regression for the reported opening in the room-24 loading plate.
 * All actor movement, shots and carrying use the ordinary game controls.
 * No positions, collisions, portal placements or mechanism states are assigned. */
export async function runPortalFloorJourney(game,{offset=0,carry=false,returnTrip=false,onMilestone=()=>{}}={}){
 if(!game.firstLevel?.openChamber||game.levelIndex!==23)throw new Error('Open room 24 required');
 if(!Number.isFinite(offset)||Math.abs(offset)>.6)throw new RangeError('Test offset must be within 0.6 metres');
 const report=await runV8Journey(game,{onMilestone,scenario:d=>{
  installRoom21Aim(d);
  const pad=game.firstLevel.loadPads[0].surface,wall=game.firstLevel.car.panel;
  const wallFrame=wall.getFrame();
  d.aim(1,wallFrame.center.clone().addScaledVector(wallFrame.up,-.85));
  d.walk(9,35.5);d.aim(0,pad.getFrame().center);d.mark('linked floor and carriage');
  if(carry){const c=game.cargo.position.clone();d.walk(c.x,c.z+1.4);d.pickup();d.walk(9+offset,35.5);}
  else if(offset)d.walk(9+offset,35.5);
  const before=game.teleportCount;
  for(let n=0;n<240&&game.teleportCount===before;n++){d.worldMove(0,-.30);d.frame();}
  d.stop();
  if(game.teleportCount!==before+1)throw new Error(`Player blocked by floor backing: ${game.playerPosition.toArray()}`);
  if(carry&&!game.heldCube)throw new Error('Original companion lost in floor portal');
  d.mark('floor to wall crossed');
  // Clear the exit naturally, so the reverse approach is a separate crossing.
  const f=wall.getFrame();for(let n=0;n<36;n++){d.worldMove(f.normal.x*.45,f.normal.z*.45);d.frame();}d.wait(.25);
  if(returnTrip){d.enter(wall,5);d.mark('wall to floor crossed');
   if(game.teleportCount<before+2)throw new Error('Reverse floor exit failed');
   for(let n=0;n<65;n++){d.worldMove(0,.65);d.frame();}d.wait(.3);
  }
 }});
 return {...report,kind:'floor-portal-regression',offset,carry,returnTrip};
}
