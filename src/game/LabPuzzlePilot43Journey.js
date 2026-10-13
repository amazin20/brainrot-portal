import {installPreciseLateAim,aimLateSurface} from './LabLateCampaignAim.js';
const check=(condition,message)=>{if(!condition)throw Error(message);};
function collect(d){
 for(let i=0;i<10;i++){
  const p=d.game.cargo.position;d.walk(p.x+1.3,p.z);
  if(d.game.playerPosition.distanceTo(d.game.cargo.position)<2.2){d.pickup();return;}
 }
 throw Error('Original companion cannot be recovered by ordinary input');
}
function release(d){d.stop();d.wait(.3);check(d.game.interact()&&!d.game.heldCube,'Original companion could not be released');d.wait(.85);}

/** Ordinary production input. Stages stop only the proof driver, never alter
 * the level's geometry, cargo, portals, shutter targets or completion rule. */
export function runPuzzlePilot43(d,{stopAfter=null,recover=false}={}){
 installPreciseLateAim(d);
 const {game:g,level:l}=d,p=l.panels;
 check(l.pilot43,'This route requires the opt-in puzzle pilot');
 if(recover){
  d.walk(-9,25);d.walk(-5,25);d.until(()=>g.playerGrounded&&g.playerPosition.y<-3.8,5,'Lower service floor missed');
  d.walk(-5,-1);d.walk(-25,-1);d.walk(-25,14);d.walk(-14,20);d.mark('A physical fall and the service ramp return to the entry court');
 }
 collect(d);d.walk(-20,17);d.walk(-20,14.72);release(d);
 d.until(()=>l.button.loaded()&&l.shutter.progress>.98,3,'The original companion did not hold the observation shutter');
 d.mark('The original companion holds open a real observation aperture');
 if(stopAfter==='weighted')return;
 d.walk(-14,22);aimLateSurface(d,0,p.entry);aimLateSurface(d,1,p.gallery);
 if(stopAfter==='connected')return;
 d.enter(p.entry);d.until(()=>g.playerGrounded&&g.playerPosition.y>14.9,4,'The raised apron did not receive the player');
 check(l.button.loaded()&&g.cargo.position.y<1,'The original weight must remain on the lower button during first traversal');
 d.mark('The player reaches a raised receiving apron while the companion remains below');
 d.walk(-27,-14);d.walk(-27,-22);d.walk(2.8,-22);d.walk(2.8,-18.6);
 if(stopAfter==='gallery')return;
 const cargoTransports=g.physics.portalTransports;
 aimLateSurface(d,1,p.return);
 aimLateSurface(d,0,p['floor-button']);
 d.until(()=>g.physics.portalTransports>cargoTransports,5,'The lower button aperture did not return the original free cargo');
 d.until(()=>g.physics.grounded&&g.cargo.position.y>15.1,5,'The returned companion did not settle on the real gallery');
 d.until(()=>l.shutter.progress<.02,3,'Removing live weight must close the shutter');
 check(g.playerPosition.y>14.9&&!g.heldCube,'The cargo must be recovered independently from the new view');
 d.mark('A shot around the partition returns the original weight and closes the observation shutter');
 if(stopAfter==='recovered')return;
 d.walk(2.8,-22);d.walk(3.6,-22);aimLateSurface(d,0,p.fall);aimLateSurface(d,1,p.launch);
 collect(d);d.walk(3.3,-22);
 const teleports=g.teleportCount;
 for(let n=0;n<180&&g.playerGrounded;n++){d.worldMove(1,0);d.frame();}d.stop();
 check(!g.playerGrounded&&g.heldCube,'Both travellers must leave the real gallery edge together');
 d.until(()=>g.teleportCount>teleports,5,'The gravitational falling aperture was missed');
 d.until(()=>g.playerGrounded,6,'The high receiving terrace did not catch the flight');
 check(g.playerPosition.y>21.9,'A direct teleport without falling cannot reach this high terrace');
 d.mark('The same pair carries the original travellers through a real fall and upward flight');
 d.walk(15,15);d.until(()=>g.state==='won',3,'The original travellers did not reach the physical exit together');
 d.mark('Both original travellers reach the visible exit without reset or checkpoint');
}
