import {runExpansionBJourney} from './LabExpansionJourneyB.js';
import {installRoom21Aim} from './LabRoom21Journey.js';

const check=(condition,message)=>{if(!condition)throw new Error(message);};
function collect(d){
 check(!d.game.heldCube,'Collect requires free hands');
 for(let n=0;n<12;n++){
  const p=d.game.cargo.position;d.walk(p.x+1.25,p.z);
  if(d.game.playerPosition.distanceTo(p)<2.2){d.pickup();d.mark('Collected the original cargo through E');return;}
 }
 throw new Error('Original cargo not physically reachable');
}
function release(d){d.stop();d.wait(.2);check(d.game.interact()&&!d.game.heldCube,'Ordinary cargo release failed');d.mark('Released the original cargo through E');}
function enterJump(d,panel){
 const f=panel.getFrame(),before=d.game.teleportCount;
 d.walk(f.center.x+f.normal.x*1.35,f.center.z+f.normal.z*1.35);
 for(let n=0;n<240&&d.game.teleportCount===before;n++){
  if(n%45===0)d.game.input.jumpQueued=true;
  d.worldMove(-f.normal.x,-f.normal.z);d.frame();
 }
 d.stop();check(d.game.teleportCount>before,'Jump entry missed');d.until(()=>d.game.playerGrounded,4,'Cabin landing missed');
}
async function prepareToppling(d){
 const signal=Symbol('causal-cut');let reached=false;
 try{await runExpansionBJourney({...d,mark:name=>{
  d.mark(name);
  if(name==='Rigid wall rotates under gravity into the only bridge'){reached=true;throw signal;}
 }},{});}catch(error){if(error!==signal)throw error;}
 check(reached,'Causal preparation marker missing');
}
function firstImpactPickup(d){
 d.walk(-23,17);d.walk(-23,-17);d.walk(-15,-17);d.walk(-15,-2);d.walk(0,-2);
 if(d.game.cargo.position.y>=-2){d.walk(0,15.3);d.walk(-8,15.3);d.walk(-8,-1);d.walk(0,-1);}
 collect(d);
}
function launchFromBalcony(d){
 d.walk(-16,14);d.walk(-16,11);d.walk(-16,10.50);d.wait(.4);
 const before=d.game.physics.portalTransports;release(d);
 d.until(()=>d.game.physics.portalTransports>before,6,'Gravity launch missed');
}
function southBridgeApproach(d){d.walk(0,15.3);d.walk(-8,15.3);d.walk(-8,-1);d.walk(0,-1);d.walk(0,-14);}

async function freeCargoBridge(d){
 const {game:g}=d;await prepareToppling(d);
 const pair=g.portals.portals.slice();
 const frames=pair.map(p=>({position:p.position.toArray(),quaternion:p.quaternion.toArray()}));
 firstImpactPickup(d);d.mark('Recovered first impact cargo through the real dry incline');
 d.walk(-15,-2);d.walk(-15,-17);d.walk(-23,-17);d.walk(-23,11);d.walk(-20,17);
 check(g.playerPosition.y>11.8,'Recovered cargo did not ascend the western incline');
 const transports=g.physics.portalTransports;launchFromBalcony(d);d.wait(2.5);
 check(g.physics.portalTransports>transports,'Same gravity pair was not reused');
 check(g.portals.portals.every((p,n)=>p===pair[n]),'Delivery must reuse both original portal instances');
 check(JSON.stringify(g.portals.portals.map(p=>({position:p.position.toArray(),quaternion:p.quaternion.toArray()})))===JSON.stringify(frames),'Static pair moved during cargo delivery');
 check(g.cargo.position.z< -17,'Second independent delivery did not reach the northern side of the fallen bridge');
 check(!g.heldCube&&g.playerPosition.x< -10,'Observer must stay in western wing while cargo travels independently');
 d.mark('Unchanged gravity pair sends free original cargo north before the observer crosses');
 d.walk(-23,17);d.walk(-23,-17);d.walk(-15,-17);d.walk(-15,-2);d.walk(0,-2);southBridgeApproach(d);
 if(!g.heldCube&&g.state==='playing')collect(d);d.walk(0,-24);
}
/** Reusable debug/recording driver: ordinary controls only, from normal Play.
 * It never assigns actor/body transforms, velocities, portal frames or puzzle
 * state. The common runV8Journey checks every frame for identity and resets. */
export async function runExpansionAlternateJourneyB(d,routeName){
 const expected={'free-cargo-bridge':49};
 check(Object.hasOwn(expected,routeName),'Unknown expansion B alternative');
 check(d.level.index===expected[routeName],'Alternative selected for the wrong room');
 installRoom21Aim(d);
 const cargo=d.game.cargo,body=d.game.physics.cargoBody;
 await freeCargoBridge(d);
 check(d.game.cargo===cargo&&d.game.physics.cargoBody===body,'Original companion body changed');
}
