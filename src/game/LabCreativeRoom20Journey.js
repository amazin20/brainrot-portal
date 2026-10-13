import * as THREE from 'three';
import {installRoom21Aim} from './LabRoom21Journey.js';
const V=(...p)=>new THREE.Vector3(...p),check=(v,m)=>{if(!v)throw Error(m);};
export const CREATIVE20_MARKS=Object.freeze({pair:'current portal pair conducts two unobstructed cable branches',hanging:'original free companion tensions the cable and withdraws the horizontal bulkhead',finger:'visible retaining finger physically holds the actual door tooth'});
function aimPatch(d,index,p,point=p.getFrame().center){d.aim(index,point);check(d.game.portals.portals[index]?.surfaceId===p.mesh.uuid,'Charge hit a different surface: '+p.name);}
export function creative20Floor(d){const p=d.level.feed.surface.getFrame().center;d.walk(p.x,p.z+4);aimPatch(d,0,d.level.feed.surface);}
/** Find the ordinary standing viewpoint through both actual 64 cm slits.
 * Only walking/look input is used. No actor or portal pose is assigned. */
export function creative20Inspect(d){
 const {game:g,walk,look,level:l}=d,target=l.outlet.getFrame().center;
 walk(-15,28.5);walk(-21,28.5);walk(-21,27);walk(-21,19);walk(-21,8);walk(-16.4,6.5);
 look(target);aimPatch(d,1,l.outlet);

}
export function creative20Descend(d){d.walk(-21,8);d.walk(-21,19);d.walk(-21,27);d.walk(-21,28.5);d.walk(-15,28.5);}
/** Follow the companion's current ordinary motion, approaching from the
 * player's side instead of insisting on a stale point beside a wall. */
export function creative20Collect(d){
 const g=d.game;
 for(let n=0;n<1200;n++){
  const cargo=g.cargo.position,hand=g.playerPosition.clone().add(V(0,1.1,0));
  if(hand.distanceTo(cargo)<1.9&&g.interact()){
   check(g.heldCube,'A nearer control intercepted companion pickup');d.stop();d.wait(.55);return;
  }
  const delta=cargo.clone().sub(g.playerPosition);delta.y=0;
  if(delta.lengthSq()>.001){delta.normalize().multiplyScalar(.5);d.worldMove(delta.x,delta.z);}
  else d.stop();
  d.frame();
 }
 d.stop();throw Error('Could not approach the current companion through ordinary movement');
}
export function creative20Feed(d){
 const {game:g,walk,pickup,look,wait,until,mark}=d;
 walk(-3,25);creative20Collect(d);
 const entry=d.level.feed.surface.getFrame().center;
 walk(entry.x,entry.z+6);look(V(entry.x,2,entry.z-8));walk(entry.x,entry.z+1.25);wait(.45);
 const before=g.physics.portalTransports;
 check(g.interact()&&!g.heldCube,'Original freight release missed');wait(.65);
 // Aim the visible floor at the body's actual resting contact. The finite
 // elliptical aperture must admit every current oriented corner.
 walk(entry.x,entry.z+4);if(g.physics.portalTransports===before)aimPatch(d,0,d.level.feed.surface,g.cargo.position.clone().setY(entry.y));
 until(()=>g.physics.portalTransports>before&&g.cargo.position.z< -8,6,'Free original companion did not pass the guarded portal');
 mark('same dynamic companion enters the sealed high weight pocket');
 until(()=>d.level.rope.opening>.48&&d.level.nearHook.diagnostics().bearingForce<1,18,'Actual hanging cable did not unload the near-hook bearing');
 mark('true current cable tension unloads the physical near-hook bearing');
 walk(6,4.5);check(g.interact(),'Near-hook finite hand input missed');wait(1);
 until(()=>d.level.rope.opening>6.95,24,'The same finite E did not release the actual gate train');
 mark(CREATIVE20_MARKS.hanging);
}
function rerouteCableToFloor(d){
 // A separate manufactured floor patch withdraws the remote cable branch
 // without overlapping the smaller source feed or relocating the companion.
 d.walk(-9,22);
 aimPatch(d,1,d.level.recovery.surface);
 check(!d.level.rope.currentPath(),'Same-floor apertures still formed a far cable branch');
}
export function creative20Pin(d){
 d.walk(2,7);d.walk(2,-3);d.walk(7,-3);
 check(d.game.interact(),'Far retaining finger interaction missed');d.wait(.8);
 check(d.level.rope.pinTravel>.95,'Physical retaining finger did not extend');
 d.walk(2,-3);d.walk(2,7);rerouteCableToFloor(d);d.wait(2);
 d.walk(-3,24);d.walk(-3,8);d.walk(2,7);d.walk(2,-3);d.walk(7,-3);
 check(d.level.rope.opening>6.7,'Real tooth slipped past the physical finger');
 d.mark(CREATIVE20_MARKS.finger);
}
export async function runCreative20(d,{order='cargo-first',recovery=false,stopAt=null}={}){
 check(['cargo-first','scout-first'].includes(order),'Unknown tension preparation order');
 check([null,'pair-prepared','cargo-hanging','finger-held'].includes(stopAt),'Unknown tension cut');
 installRoom21Aim(d);
 if(order==='cargo-first'){creative20Floor(d);creative20Inspect(d);creative20Descend(d);}
 else{creative20Inspect(d);creative20Descend(d);creative20Floor(d);}
 d.mark(CREATIVE20_MARKS.pair);if(stopAt==='pair-prepared')return;
 creative20Feed(d);if(stopAt==='cargo-hanging')return;
 if(recovery){
  rerouteCableToFloor(d);d.wait(3);
  check(d.level.rope.opening<.05,'Rerouting the far aperture must release the return spring');
  check(d.game.cargo.position.z< -8,'Original cargo must remain on far recovery floor');
  d.mark('ordinary floor shot withdraws the far cable branch; same cargo remains in the recovery pocket');
  creative20Floor(d);creative20Inspect(d);creative20Descend(d);
  d.until(()=>d.level.rope.opening>.48&&d.level.nearHook.diagnostics().bearingForce<1,18,'Restored current cable geometry did not unload the same hook');
  d.walk(6,4.5);check(d.game.interact(),'Restored near-hook finite input missed');d.wait(1);
  d.until(()=>d.level.rope.opening>6.95,24,'Restored current cable geometry did not reopen the door');
  d.mark('current apertures restore continuous tension without respawn or a remembered portal step');
 }
 creative20Pin(d);if(stopAt==='finger-held')return;
 d.walk(9,-3);d.walk(9,-12);d.walk(-7,-12);d.walk(-12,-14);d.walk(Math.min(d.game.cargo.position.x+1.2,-12.2),Math.max(d.game.cargo.position.z,-20.15));d.pickup();
 d.mark('same original body recovered through the grounded side service opening');
 d.walk(-12,-14);d.walk(-7,-14);d.walk(16,-14);d.walk(16,-3);d.walk(16,6);d.walk(16,23);
 d.until(()=>d.game.state==='won',3,'Joint portal cable exit');d.mark('both travellers return through the mechanically retained door to the entry floor');
}
