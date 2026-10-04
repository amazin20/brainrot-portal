import * as THREE from 'three';
import {installRoom21Aim} from './LabRoom21Journey.js';
const V=(...p)=>new THREE.Vector3(...p),check=(ok,msg)=>{if(!ok)throw Error(msg);};
function collect(d){
 for(let i=0;i<12;i++){const c=d.game.cargo.position;d.walk(c.x+1.2,c.z);if(d.game.playerPosition.distanceTo(c)<2.2){d.pickup();return;}}
 throw Error('Original companion cannot be reached by production walking');
}
function release(d){d.stop();d.wait(.4);check(d.game.interact()&&!d.game.heldCube,'Original companion release failed');d.wait(.7);}
function use(d,p,label){d.walk(p[0],p[1]+1.2);check(d.game.interact(),label);d.wait(.25);}
function aimPatch(d,color,patch,point=patch.getFrame().center){
 d.aim(color,point);
 check(d.game.portals.portals[color]?.surfaceId===patch.mesh.uuid,'Shot reached another surface instead of '+patch.name);
}

function room36(d,options){
 const {game:g,level:l,walk,aim,until,wait,mark}=d;
 // Every setup action happens through walking and real projectiles. The
 // gravity address is configured from the dry floor, then the player climbs.
 walk(-24,-2);walk(-24,27);
 if(options.route==='scout-impact-first'||options.alternate){
  walk(-10,-10);aimPatch(d,1,l.outlet);
  walk(-18,10);aimPatch(d,0,l.fallPad.surface);
 }else{
  walk(-18,10);aimPatch(d,0,l.fallPad.surface);
  walk(-10,-10);aimPatch(d,1,l.outlet);
 }
 mark('Floor-to-wall pair is aimed at the long arm of the real dynamic rotor');
 walk(-17,27);walk(-24,27);walk(-24,-13);collect(d);
 walk(-18,-12);walk(-18,-6.35);wait(.4);
 const transports=g.physics.portalTransports;
 check(g.interact()&&!g.heldCube,'Cargo fall release missed');
 until(()=>g.physics.portalTransports>transports,6,'Original cargo missed its falling portal');
 mark('The original loose companion retains its falling momentum through the portal');
 until(()=>l.rotor.angle>1.54,12,'Off-axis cargo impact did not turn and ratchet the real rotor');
 until(()=>l.bridge.position.z< -17.9,8,'Angular transmission did not align the high bridge cassette');
 d.look(V(-8,2,-5));
 mark('Actual angular momentum turns the spindle and translates the bridge into its dock');
 if(options.stopAfterImpact)return;
 walk(-24,-10);walk(-24,-2);walk(-24,27);
 collect(d);mark('The same companion is recovered on the lower service floor');
 walk(-17,27);walk(-24,27);walk(-24,-13);d.look(V(19,11,-13));walk(-12,-13);walk(4,-13);walk(19,-13);
 until(()=>g.state==='won',3,'Angular bridge did not support the joint exit');
 mark('Both travellers walk across the physically docked high cassette');
}

function room37(d,options){
 const {game:g,level:l,walk,aim,until,mark,wait}=d;
 const prepared=options.route==='prepare-fields-first'||options.alternate;
 if(prepared){use(d,[-9,4],'Early first magnetic winding switch missed');mark('First field is prepared before original cargo is loaded');}
 walk(-16,7);aimPatch(d,1,l.mouth);
 if(options.stopBeforeFeed)return;
 walk(-11,16);collect(d);
 // Face into the loading plate through ordinary movement; hands release the
 // body above its centre. The source floor, not a route assignment, transports it.
 walk(-16,17);walk(-16,15.5);release(d);
 walk(-10,18);aimPatch(d,0,l.entry.surface);
 until(()=>g.physics.portalTransports>0&&g.cargo.position.z<6,6,'Original free companion did not enter guarded channel');
 mark('Original free companion enters the low hood through the same real pair');
 if(!prepared)use(d,[-9,4],'First magnetic winding switch missed');
 until(()=>g.cargo.position.z< -5&&Math.abs(g.cargo.position.x+16)<1.2,12,'First magnetic leg failed');
 mark('The first field pulls cargo along a real low-walled leg');
 use(d,[0,-1],'Second winding switch missed');
 until(()=>g.cargo.position.x>15&&Math.abs(g.cargo.position.z+6)<1.2,15,'Magnetic cargo failed to turn across channel');
 mark('The second field transfers the original body across the transverse tunnel');
 use(d,[8,-1],'Third magnetic winding switch missed');
 until(()=>l.receiver.loaded(),12,'Original cargo missed open receiving socket');
 until(()=>l.door.progress>.9,3,'Receiving mass did not open the physical door');
 mark('Original mass rests on the remote contact socket and opens the collision door');
 if(options.stopBeforeRetrieval)return;
 walk(8,2);walk(-23,6);walk(-23,-10);walk(0,-10);walk(0,-16);
 use(d,[4,-17],'Visible open-door pawl missed');
 use(d,[10,-18],'Receiving field disconnect missed');
 mark('Open receiving door is held by its visible pawl and the field is disconnected');
 // Approach from the dry back gallery. A diagonal across the socket would
 // physically shove the loose original before the pickup button is in reach.
 walk(8,-16.8);walk(8,-23);walk(20,-23);walk(20,-20);
 collect(d);mark('Field is disconnected; same companion leaves its socket after the door is clamped');
 walk(8,-23);walk(0,-22);until(()=>g.state==='won',3,'Magnetic bypass did not permit the shared finish');
 mark('The human takes the grounded outer gallery and reunites with original cargo');
}

function room40(d,options){
 const {game:g,level:l,walk,aim,until,mark,wait}=d;
 walk(18,23);aimPatch(d,0,l.input);
 walk(18,24.5);walk(8,24.5);walk(-6,18);walk(-6,10);aimPatch(d,1,l.outlet);
 mark('One optical source is routed through two independently calibrated real slits');
 if(options.stopBeforeWeight)return;
 const trimFirst=options.route==='trim-then-balance'||options.alternate;
 if(trimFirst){
  walk(6,9.2);for(let i=0;i<3;i++){check(g.interact(),'Early common rack selector missed');wait(.35);}
  check(!l.getCalibration().lit,'Common trim by itself must leave differentially opposed windows dark');
  mark('Common rack is centred first; both real slits still block illumination');
  walk(-10,10);walk(-10,18);
 }
 collect(d);
 walk(-19,20);walk(-19,17.7);release(d);
 until(()=>l.lever.loaded(),3,'Original mass missed differential lever bed');
 check(l.getCalibration().arm< -1,'The cargo lever arm is not on the left of the spindle');
 mark('Original mass and its measured lever arm move the two shutters oppositely');
 walk(-10,18);walk(-10,10);walk(6,9.2);
 if(!trimFirst)for(let i=0;i<3;i++){check(g.interact(),'Common rack selector missed');wait(.35);}
 until(()=>l.getCalibration().lit,3,'Portal ray did not actually traverse both calibrated openings');
 mark('Common adjustment brings both physical windows onto the same portal ray');
 if(options.stopBeforeClamp)return;
 use(d,[-5,8],'Calibrated slit clamp missed');
 check(l.getCalibration().clamped,'Slit clamp did not hold lit geometry');
 walk(-10,10);walk(-10,18);collect(d);
 check(l.getCalibration().lit,'Removing companion disturbed physically clamped windows');
 mark('The visible clamps retain slit positions while the original companion is recovered');
 walk(-15,10);walk(-15,-15);walk(0,-15);walk(0,-23);
 until(()=>g.state==='won',3,'Calibrated optical door did not admit both travellers');
 mark('Actual receiver illumination opens the final collision door');
}

export function runCreativeFinal(d,options={}){
 installRoom21Aim(d);
 const runner={35:room36,36:room37,39:room40}[d.level.index];
 check(runner,'Unsupported creative-final chamber');return runner(d,options);
}
