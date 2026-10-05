import * as THREE from 'three';
import {installRoom21Aim} from './LabRoom21Journey.js';
const V=(...p)=>new THREE.Vector3(...p),check=(v,m)=>{if(!v)throw Error(m);};
function collect(d){for(let n=0;n<12;n++){const p=d.game.cargo.position;d.walk(p.x+1.25,p.z);if(d.game.playerPosition.distanceTo(p)<2.2){d.pickup();return;}}throw Error('Original companion is not reachable');}
function release(d){d.stop();d.wait(.2);check(d.game.interact()&&!d.game.heldCube,'Cannot release original cargo');d.wait(.65);}
function fallCargo(d,{x,z,direction=-1}){d.walk(x,z);d.wait(.4);const before=d.game.physics.portalTransports;check(d.game.interact()&&!d.game.heldCube,'Cargo drop rejected');d.until(()=>d.game.physics.portalTransports>before,6,'Original cargo missed gravity portal');}
function enterJump(d,p){const f=p.getFrame(),before=d.game.teleportCount;d.walk(f.center.x+f.normal.x*1.35,f.center.z+f.normal.z*1.35);for(let n=0;n<240&&d.game.teleportCount===before;n++){if(n%45===0)d.game.input.jumpQueued=true;d.worldMove(-f.normal.x,-f.normal.z);d.frame();}d.stop();check(d.game.teleportCount>before,'Jump entrance traversal failed');d.until(()=>d.game.playerGrounded,4,'Moving cabin landing failed');}
function fracture(d,o){const {game:g,level:l}=d;
 d.walk(-8,9);d.walk(-8,25.5);d.walk(0,25.5);d.walk(0,12);d.walk(-8,7);d.aim(0,l.well.surface.getFrame().center);d.walk(-8,0);d.walk(0,0);d.aim(1,l.outlet.getFrame().center);d.walk(8,0);d.walk(8,25.5);d.walk(-8,25.5);d.walk(-8,8.0);d.walk(-12,8.1);d.walk(-23,14);
 if(o.stopBeforeDelivery)return;
 collect(d);d.walk(-16,9.1);d.walk(-16,8.55);fallCargo(d,{x:-16,z:8.50});
 d.until(()=>l.fuse.broken,5,'Falling cargo did not fracture the real safety sheet');d.mark('Real contact energy breaks glass ceramic into physical fragments');
 d.walk(-8,9);d.walk(-8,25.5);d.walk(6,18);d.walk(6,0);d.walk(0,0);collect(d);d.walk(0,-21);
}
function wedge(d,o){const {game:g,level:l}=d;
 d.walk(-11,13);d.aim(1,l.mouth.getFrame().center);d.aim(0,l.feed.surface.getFrame().center.clone().add(V(-.6,0,-.05)));
 if(o.stopBeforeDelivery){d.walk(-18,9.5);check(g.interact(),'Press control missed');d.wait(3);return;}
 collect(d);d.walk(-17,18.3);release(d);d.until(()=>g.physics.portalTransports>0,5,'Cargo feed did not cross');g.clearPortals();d.until(()=>g.physics.grounded,3,'Cargo did not settle in the physical jaw bed');
 d.walk(-18,9.5);check(g.interact(),'Press control missed');d.until(()=>l.press.running&&l.press.gap>.68&&l.press.gap<3.0&&l.door.progress>.95,5,'Cargo does not physically arrest the jaw');d.mark('The original body physically jams the motor stroke');
 d.walk(0,7);d.walk(0,-1);d.walk(8,-10.5);check(g.interact(),'Far press stop cannot be operated');check(l.press.pinned,'Visible pawl missed the jaw');d.until(()=>l.roof.progress>.95,3,'Inspection hood stayed shut');
 d.walk(8,-1);d.walk(0,-1);collect(d);d.walk(8,-1);d.walk(6,-12);d.walk(0,-21);
}
function reflection(d,o){const {game:g,level:l}=d;
 d.walk(-12,18);d.aim(0,l.input.getFrame().center);d.walk(-12,3);d.aim(1,l.outlet.getFrame().center);
 if(o.stopBeforeDelivery){d.wait(3);return;}
 collect(d);d.walk(-5.10,18);d.walk(-4.68,18);release(d);
 d.until(()=>l.head.lit,10,'Real load moment failed to aim reflection at the lens');d.mark('Portal ray reflects from the cargo torqued live mirror normal');
 d.walk(7,10.3);check(g.interact(),'Mirror clamp missed');check(l.head.clamped&&l.head.lit,'Clamp did not preserve lit mirror angle');
 collect(d);d.walk(8,6);d.walk(8,-7);d.walk(0,-7);d.walk(0,-22);
}
function topple(d,o){const {game:g,level:l}=d;
 d.walk(-23,15);d.walk(-23,-17);d.walk(-15,-17);d.walk(-15,7);d.aim(0,l.well.surface.getFrame().center);
 d.walk(-15,-17);d.walk(-23,-17);d.walk(-23,11);d.walk(-8,17);d.until(()=>g.playerGrounded&&g.playerPosition.y<.5,5,'Initial south dock landing failed');
 d.walk(8,17);d.walk(8,1);d.walk(0,1);d.aim(1,l.outlet.getFrame().center);
 d.walk(8,1);d.walk(8,17);d.walk(-15,17);d.until(()=>g.playerGrounded&&g.playerPosition.y< -3.8,5,'West service landing failed');d.walk(-15,-17);d.walk(-23,-17);d.walk(-23,11);d.walk(-20,17);
 if(o.stopBeforeDelivery)return;
 collect(d);d.walk(-16,14);d.walk(-16,11.0);d.walk(-16,10.50);fallCargo(d,{x:-16,z:10.50});
 d.until(()=>l.top.angle< -1.45,8,'Original cargo did not topple the constrained structural wall');d.mark('Rigid wall rotates under gravity into the only bridge');
 d.walk(-23,17);d.walk(-23,-17);d.walk(-15,-17);d.walk(-15,-2);d.walk(0,-2);
 if(g.cargo.position.y< -2){d.walk(g.cargo.position.x+1.3,g.cargo.position.z);collect(d);}
 d.walk(0,15.3);d.walk(-8,15.3);d.walk(-8,-1);d.walk(0,-1);d.walk(0,-14);
 if(!g.heldCube)collect(d);d.walk(0,-24);
}
function relay(d,o){const {game:g,level:l}=d;
 d.walk(-21,15);d.aim(0,l.entry.getFrame().center);d.walk(-14,24);d.aim(1,l.shuttle.panel.getFrame().center);
 if(o.stopBeforeDelivery){d.walk(-16,20.4);check(g.interact(),'Relay south control missed');d.wait(5);return;}
 collect(d);enterJump(d,l.entry);d.walk(-17.7,-5.5);release(d);check(l.clutch.loaded(),'Cargo not on the real carrier floor');
 enterJump(d,l.shuttle.panel);d.walk(-16,20.4);check(g.interact(),'Relay dispatch missed');d.until(()=>l.shuttle.at(1),8,'Loaded cabin did not travel transversely');d.mark('Original loose cargo and its portal address travel to the east berth');
 enterJump(d,l.entry);d.walk(22.5,-13.3);d.walk(18,-13.3);d.walk(18,-17);d.walk(26,-18.7);check(g.interact(),'East vertical dispatch missed');d.until(()=>l.shuttle.at(2),5,'Loaded cabin did not climb to the final berth');
 // The same entry is now on the moved cabin. Walk off the east dock and
 // return by the genuine dry floor and service incline, then repurpose it.
 d.walk(19,-4);d.until(()=>g.playerGrounded&&g.playerPosition.y< -3.8,5,'Dry relay service floor missed');d.walk(-28,-16);d.walk(-28,15);d.walk(-21,15);enterJump(d,l.entry);collect(d);d.walk(8,-16.3);d.walk(3,-16.3);d.walk(3,-23);
}
export function runExpansionBJourney(d,options={}){
 installRoom21Aim(d);
 if(options.alternative==='staged-cargo'){
  check(d.level.index===47,'Staged cargo alternative requires room 48');
  return import('./LabExpansionAlternateJourney48.js').then(m=>m.runRoom48StagedCargo(d));
 }
 if(options.alternative==='unlit-mirror'){
  check(d.level.index===48,'Unlit mirror alternative requires room 49');
  return import('./LabExpansionAlternateJourney49.js').then(m=>m.runRoom49UnlitMirror(d));
 }
 if(options.alternative==='free-cargo-bridge'||options.alternative==='prearmed-relay'){
  check(d.level.index===(options.alternative==='free-cargo-bridge'?49:50),'Expansion alternative selected for the wrong room');
  return import('./LabExpansionAlternateJourneyB.js').then(m=>m.runExpansionAlternateJourneyB(d,options.alternative));
 }
 check(!options.alternative,'Unknown expansion B alternative');
 const f=[fracture,wedge,reflection,topple,relay][d.level.index-46];check(f,'Unknown expansion B room');return f(d,options);
}
