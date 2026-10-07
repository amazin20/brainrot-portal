import * as THREE from 'three';
import {installRoom21Aim} from './LabRoom21Journey.js';
const V=(...p)=>new THREE.Vector3(...p),check=(v,m)=>{if(!v)throw Error(m);};
export const CREATIVE20_MARKS=Object.freeze({pair:'current portal pair conducts two unobstructed cable branches',hanging:'original free companion tensions the cable and withdraws the horizontal bulkhead',finger:'visible retaining finger physically holds the actual door tooth'});
function aimPatch(d,index,p,point=p.getFrame().center){d.aim(index,point);check(d.game.portals.portals[index]?.surfaceId===p.mesh.uuid,'Charge hit a different surface: '+p.name);}
export function creative20Floor(d){d.walk(-9,24);aimPatch(d,0,d.level.feed.surface);}
/** Find the ordinary standing viewpoint through both actual 64 cm slits.
 * Only walking/look input is used. No actor or portal pose is assigned. */
export function creative20Inspect(d){
 const {game:g,walk,look,level:l}=d,target=l.outlet.getFrame().center;
 walk(-15,28.5);walk(-21,28.5);walk(-21,27);walk(-21,19);walk(-21,8);walk(-16.4,6.5);
 look(target);aimPatch(d,1,l.outlet);

}
export function creative20Descend(d){d.walk(-21,8);d.walk(-21,19);d.walk(-21,27);d.walk(-21,28.5);d.walk(-15,28.5);}
export function creative20Feed(d){
 const {game:g,walk,pickup,look,wait,until,mark}=d;
 walk(-3,25);walk(g.cargo.position.x+1.2,g.cargo.position.z);pickup();
 walk(-9,24);look(V(-9,2,10));walk(-9,19.25);wait(.45);
 const before=g.physics.portalTransports;
 check(g.interact()&&!g.heldCube,'Original freight release missed');wait(.65);
 // Aim the visible floor at the body's actual resting contact. The finite
 // elliptical aperture must admit every current oriented corner.
 walk(-9,22);aimPatch(d,0,d.level.feed.surface,g.cargo.position.clone().setY(d.level.feed.surface.getFrame().center.y));
 until(()=>g.physics.portalTransports>before&&g.cargo.position.z< -8,6,'Free original companion did not pass the guarded portal');
 mark('same dynamic companion enters the sealed high weight pocket');
 until(()=>d.level.rope.opening>6.95,14,'Actual hanging cable tension did not withdraw the door');
 mark(CREATIVE20_MARKS.hanging);
}
function rerouteCableToFloor(d){
 // Two distinct ordinary shots on the broad loading floor withdraw the far
 // cable branch. The second aperture must clear the original freight slot.
 d.walk(-9,22);
 aimPatch(d,1,d.level.feed.surface,d.level.feed.surface.getFrame().center.clone().add(V(1.8,0,2)));
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
  d.until(()=>d.level.rope.opening>6.95,14,'Restored current cable geometry did not reopen the door');
  d.mark('current apertures restore continuous tension without respawn or a remembered portal step');
 }
 creative20Pin(d);if(stopAt==='finger-held')return;
 d.walk(9,-3);d.walk(9,-12);d.walk(-7,-12);d.walk(-12,-14);d.walk(Math.min(d.game.cargo.position.x+1.2,-12.2),Math.max(d.game.cargo.position.z,-20.15));d.pickup();
 d.mark('same original body recovered through the grounded side service opening');
 d.walk(-12,-14);d.walk(-7,-14);d.walk(16,-14);d.walk(16,-3);d.walk(16,6);d.walk(16,23);
 d.until(()=>d.game.state==='won',3,'Joint portal cable exit');d.mark('both travellers return through the mechanically retained door to the entry floor');
}
