import {installRoom21Aim} from './LabRoom21Journey.js';
const check=(condition,message)=>{if(!condition)throw Error(message);};
function collect(d){
 for(let n=0;n<12;n++){
  const p=d.game.cargo.position;d.walk(p.x+1.25,p.z);
  if(d.game.playerPosition.distanceTo(p)<2.2){d.pickup();return;}
 }
 throw Error('Original companion is not physically reachable');
}
function release(d){d.stop();d.wait(.2);check(d.game.interact()&&!d.game.heldCube,'Original free-cargo release rejected');d.wait(.65);}

/** Different causal order, using only ordinary input/controller steps:
 * cargo torque → unlit mechanical clamp → cargo removal → optical pair.
 * No actor poses, portal frames, load flags or mirror angles are assigned. */
export function runRoom49UnlitMirror(d){
 installRoom21Aim(d);const {game:g,level:l}=d;
 check(l.index===48,'The unlit mirror route belongs to room 49');
 collect(d);d.walk(-5.1,18);d.walk(-4.68,18);release(d);
 d.until(()=>Math.abs(l.head.angle-Math.PI/4)<.03,10,'Real cargo torque did not converge without light');
 check(!l.head.lit&&!g.portals.ready,'Load-first stage must precede the actual optical pair');
 d.mark('Free original cargo rotates live mirror before optical portals exist');
 d.walk(7,10.3);check(g.interact(),'Ordinary unlit clamp interaction missed');
 check(l.head.clamped&&!l.head.lit,'Clamp must freeze the actual mirror while its receiver remains unlit');
 d.mark('Mechanical clamp freezes actual mirror angle while lens remains unlit');
 collect(d);d.walk(10,18);release(d);check(!l.tray.loaded(),'Original cargo must leave the real load tray');
 const frozen=l.head.angle;d.wait(2);
 check(Math.abs(l.head.angle-frozen)<1e-10&&!l.head.lit,'Unloaded unlit mirror did not preserve its mechanical clamp angle');
 d.mark('Original cargo removed and parked; unloaded unlit mirror preserves mechanical angle');
 d.walk(-12,18);d.aim(0,l.input.getFrame().center);d.walk(-12,3);d.aim(1,l.outlet.getFrame().center);
 d.until(()=>l.head.lit,3,'Stored physical mirror angle did not reflect the later optical beam');
 check(!l.tray.loaded(),'Optical activation must occur with original cargo away from the load tray');
 d.mark('Later optical pair opens exit while original cargo is away from unloaded tray');
 d.walk(13,22);collect(d);d.walk(8,6);d.walk(8,-7);d.walk(0,-7);d.walk(0,-22);
 d.until(()=>g.state==='won',3,'Both original travellers did not reach the goal');
}
