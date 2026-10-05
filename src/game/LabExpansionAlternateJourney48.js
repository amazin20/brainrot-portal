import * as THREE from 'three';
import {installRoom21Aim} from './LabRoom21Journey.js';
const V=(...p)=>new THREE.Vector3(...p),check=(condition,message)=>{if(!condition)throw Error(message);};
function collect(d){
 if(d.game.heldCube)return;
 for(const [x,z]of [[1.25,0],[-1.25,0],[0,1.25],[0,-1.25]]){
  const p=d.game.cargo.position.clone();
  try{d.walk(p.x+x,p.z+z,6);}catch{continue;}
  if(d.game.playerPosition.distanceTo(d.game.cargo.position)<2.2&&d.game.interact()&&d.game.heldCube){d.wait(.5);return;}
 }
 throw Error('Original cargo is not physically reachable from the attempted side');
}
function release(d){d.stop();d.wait(.2);check(d.game.interact()&&!d.game.heldCube,'Original free-cargo release rejected');d.wait(.65);}

/** Cargo staging precedes gravity delivery. A free original body settles on
 * the real closed floor; the later ordinary projectile opens its aperture.
 * All state changes come from the same live controller/physics as Play. */
export function runRoom48StagedCargo(d){
 installRoom21Aim(d);const {game:g,level:l}=d;
 check(l.index===47,'The staged cargo route belongs to room 48');
 d.walk(-11,13);d.aim(1,l.mouth.getFrame().center);
 collect(d);d.walk(-17,18.3);release(d);
 d.until(()=>g.physics.grounded,3,'Original staged cargo did not rest on the unpaired solid floor');
 check(!g.portals.ready&&g.physics.portalTransports===0,'Cargo must rest freely before the entry pair exists');
 d.mark('Original free cargo settles on closed solid feed floor before entry aperture exists');
 d.walk(-11,13);d.aim(0,l.feed.surface.getFrame().center.clone().add(V(-.6,0,-.05)));
 d.until(()=>g.physics.portalTransports>0,5,'Opening the ordinary entry pair did not deliver the staged original cargo');
 check(g.clearPortals(),'Ordinary pair clear input rejected');
 d.until(()=>g.physics.grounded,3,'Staged original cargo did not settle in the real jaw bed');
 d.mark('Opening the actual paired aperture delivers pre-staged free cargo by gravity');
 d.walk(-18,9.5);check(g.interact(),'Ordinary press control interaction missed');
 d.until(()=>l.press.running&&l.press.gap>.68&&l.press.gap<3&&l.door.progress>.95,5,'Original free cargo did not arrest the running jaw');
 d.mark('The pre-staged original body physically arrests the actual running jaw');
 d.walk(0,7);d.walk(0,-1);d.walk(8,-10.5);check(g.interact(),'Ordinary far pawl interaction missed');
 check(l.press.pinned,'Far pawl did not preserve the measured physical stroke');
 d.until(()=>l.roof.progress>.95,3,'Physical inspection hood stayed shut');
 d.mark('Far pawl preserves the measured gap and opens the real inspection hood');
 d.walk(8,-1);d.walk(0,-1);collect(d);d.walk(8,-1);d.walk(6,-12);d.walk(0,-21);
 d.until(()=>g.state==='won',3,'Both original travellers did not reach the goal');
}
