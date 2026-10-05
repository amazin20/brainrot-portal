import * as THREE from 'three';
import {installPreciseLateAim,aimLateSurface} from './LabLateCampaignAim.js';
const V=(...p)=>new THREE.Vector3(...p);
const check=(ok,m)=>{if(!ok)throw Error(m);};
function collect(d){for(let i=0;i<12;i++){const p=d.game.cargo.position;d.walk(p.x+1.3,p.z);if(d.game.playerPosition.distanceTo(d.game.cargo.position)<2.2){d.pickup();return;}}throw Error('The original companion could not be recovered by ordinary input');}
function release(d){d.stop();d.wait(.3);check(d.game.interact()&&!d.game.heldCube,'Could not put down the original companion');d.wait(.85);}
function deposit(d,x,z){d.walk(x,z+3);d.walk(x,z+.72);release(d);}
function shot(d,color,surface){aimLateSurface(d,color,surface);}
function use(d,x,z,m){d.walk(x-1.3,z);d.wait(.15);check(d.game.interact(),m);}

function walkOnShuttle(d,l,x,z){
 for(let i=0;i<1200;i++){const p=d.game.playerPosition,dx=l.shuttle.position.x+x-p.x,dz=z-p.z,dist=Math.hypot(dx,dz);if(dist<.11){d.stop();return;}const pace=Math.min(1,dist*1.5);d.worldMove(dx/dist*pace,dz/dist*pace);d.frame();}throw Error('Could not reach moving shuttle valve');
}
export function runExpansion42(d,{route='positive-then-negative',stopAfter=null}={}){
 const {game:g,level:l,walk,until,mark}=d;
 if(route==='observe-open-branches'){
  walk(15,16);shot(d,0,l.input);walk(4,8);shot(d,1,l.mouthA);d.wait(5);check(l.pressure.left<15&&l.shuttle.position.x<4,'An unsealed live branch cannot reach an outer berth');mark('An empty valve leaks and gives only a short differential stroke');
 }
 if(stopAfter==='open-branches')return;
 collect(d);walk(-2,3);walkOnShuttle(d,l,-2,.72);release(d);until(()=>l.pressure.coverA>.92,3,'Original cargo did not close branch A check-valve');if(stopAfter==='valveA')return;
 if(!l.pressure.flowA){walk(15,16);shot(d,0,l.input);walk(4,8);shot(d,1,l.mouthA);}walkOnShuttle(d,l,0,0);
 until(()=>l.shuttle.position.x>19.95,25,'Positive differential did not move the real address to court B');mark('The original A check-valve and routed air move the actual positive berth');
 if(stopAfter==='positive')return;
 walkOnShuttle(d,l,-.7,0);d.pickup();walk(24,3);walk(30,3);walk(30,8);walk(30,32);deposit(d,26.5,35);
 walk(31,31);shot(d,1,l.mouthB);until(()=>l.pressure.coverB>.92&&l.pressure.difference<-75&&l.shuttle.position.x<-19.95,30,'Same original body in branch B did not reverse the real differential stroke');mark('Moving the same check-valve into the upper B court reverses the pressure sign');
 if(stopAfter==='negative')return;
 g.clearPortals();shot(d,0,l.mouthB);shot(d,1,l.passenger);collect(d);
 const before=g.teleportCount;for(let f=0;f<300&&g.teleportCount===before;f++){const p=g.playerPosition,v=V(33-p.x,0,34-p.z).normalize();d.worldMove(v.x,v.z);d.frame();}d.stop();check(g.teleportCount>before,'The same pair did not transfer both travellers to the negative moving address');d.wait(.6);
 walk(-32,0);until(()=>g.state==='won',4,'Original travellers did not leave the negative berth together');mark('The shared pair reunites both at the pressure-selected moving passenger address');
}

export function runExpansion43(d,{route='circulate-then-recover',stopAfter=null}={}){
 const {game:g,level:l,walk,until,mark}=d;
 if(route==='inspect-empty-field'){
  walk(-2,13);shot(d,1,l.ceiling);d.wait(2);check(l.induction.energy<.01&&l.induction.current<.01&&l.door.progress<.01,'An empty induction field cannot produce contactless current');mark('An empty magnetic field and one incomplete portal pair produce no electrical work');
 }
 if(stopAfter==='stationary')return;
 collect(d);deposit(d,-15,13);walk(-2,13);shot(d,1,l.ceiling);if(stopAfter==='prepared')return;walk(-6,18);shot(d,0,l.floor);
 until(()=>l.induction.energy>4900&&l.door.progress>.94,60,'Recurring original free cargo falls did not generate electrical work');check(l.induction.passes>2,'The live generator must require recurring motion');mark('Repeated physical falls through the coil supply measured induced electrical energy');
 if(stopAfter==='generated')return;
 g.clearPortals();d.wait(1.5);collect(d);check(l.induction.current<.01,'Recovering the real core must stop induction');mark('The original generator core is physically recovered after breaking its portal loop');if(stopAfter==='recovered')return;
 walk(0,5);walk(0,-8);release(d);
 aimLateSurface(d,1,l.upper,l.upper.getFrame().center.clone().add(V(0,1.4,0)));walk(-15,-10);shot(d,0,l.entry);collect(d);d.enter(l.entry);walk(10,-22);
 until(()=>g.state==='won',3,'Both original travellers did not reach the sealed bay using the repurposed pair');mark('The same pair changes from gravity generator to sealed-bay transport');
}

export function runExpansion44(d,{route='brake-before-air',stopAfter=null}={}){
 const {game:g,level:l,walk,until,mark}=d;
 if(route==='observe-unladen-overspeed'){
  walk(18,14);shot(d,0,l.input);walk(-5,13);shot(d,1,l.mouth);d.wait(6);check(l.governor.omega>10&&l.door.progress<.2,'An unbraked governor must overshoot the sleeve alignment');mark('Unladen airflow overspeeds the actual centrifugal regulator');
 }
 if(stopAfter==='overspeed')return;
 collect(d);deposit(d,-15,14);walk(18,14);shot(d,0,l.input);walk(-5,13);shot(d,1,l.mouth);
 until(()=>l.governor.omega>3.9&&l.governor.omega<5.1&&l.door.progress>.94,8,'Real cargo friction did not stabilize the governor sleeve');mark('Cargo friction balances live wind torque in the actual working speed band');
 if(stopAfter==='stabilized')return;
 walk(0,5);walk(0,-7);use(d,7,-7,'Downstream governor pawl unreachable');check(l.governor.pawl!==null,'The real sleeve was not held by the pawl');
 g.clearPortals();walk(0,-7);walk(0,5);collect(d);walk(0,-20);until(()=>g.state==='won',3,'Both original travellers did not cross the mechanically retained sleeve');
}

export function runExpansion45(d,{route='counterweight-then-wind',stopAfter=null}={}){
 const {game:g,level:l,walk,until,mark}=d;
 // The two charges are prepared while hands remain free. The cargo-height
 // outlet is aimed from its exposed eastern face on the original boat.
 walk(-25,10);shot(d,0,l.input);walk(-20,7);walk(-10,3);shot(d,1,l.mouth);
 if(route==='observe-unbalanced-thrust'){
  d.wait(2);check(l.trim.powered&&!l.trim.cargoAboard&&l.boat.position.x<-11.99,'A single observer cannot trim and propel the freight ferry');mark('Live wind cannot make an untrimmed one-body ferry leave its quay');
 }
 if(stopAfter==='unbalanced')return;
 walk(-20,7);collect(d);walk(-20,7);deposit(d,-14,0);
 // Equal masses occupy opposite ±2 m shoulders; only positions and real
 // grounding contribute to the ferry moment equation.
 walk(-10,0);until(()=>l.trim.cargoAboard&&l.trim.playerAboard&&l.trim.traction>.75,4,'Two actual ferry loads did not balance opposite shoulders');mark('Separated original loads trim the wind-driven ferry');
 if(stopAfter==='trimmed')return;
 until(()=>l.boat.at(1),20,'The actually powered trimmed ferry did not reach its far quay');mark('The moving air address and both original loads reach the receiving quay');
 check(g.playerPosition.y>2.9&&g.cargo.position.y>3.1,'Ferry riders lost their real deck');collect(d);walk(14,3);walk(21,3);walk(25,-7);until(()=>g.state==='won',3,'Both original travellers did not leave the ferry together');
}

export function runExpansion46(d,{route='damp-before-light',stopAfter=null}={}){
 const {game:g,level:l,walk,until,mark}=d;
 if(route==='light-before-damp'){
  walk(-24,9);shot(d,0,l.input);walk(-14,-6);shot(d,1,l.mouth);d.wait(2);check(l.optical.powered&&l.bridge.position.y<-3.9,'Optical power without real cargo damping must leave the crossing below its docks');mark('A powered unstable inspection bed cannot engage its crossing');
 }
 if(stopAfter==='undamped')return;
 collect(d);deposit(d,-18,4);if(stopAfter==='loaded-before-tuning')return;walk(-11.3,7);check(g.interact(),'Frequency adjustment unreachable');
 check(l.oscillator.frequency<3,'Excitation dial did not change real frequency');walk(-24,9);shot(d,0,l.input);walk(-14,-6);shot(d,1,l.mouth);
 until(()=>l.oscillator.loaded&&l.oscillator.rms<.82&&l.bridge.position.y>3.98,8,'Original free body did not damp the actual sprung bed');mark('Original grounded cargo dissipates oscillator motion until the optical bridge engages');
 if(stopAfter==='damped')return;
 walk(-15,-15);walk(14,-15);use(d,18,-17,'Far-side bridge clamp unreachable');check(l.oscillator.clamped,'Physical crossing clamp did not hold');
 walk(14,-15);walk(-15,-15);collect(d);g.clearPortals();walk(-15,-12);walk(14,-12);walk(22,-12);walk(22,-15);until(()=>g.state==='won',3,'Both original travellers did not cross the retained damped bridge');
}

export function runExpansionAJourney(d,options={}){
 installPreciseLateAim(d);const fn=[runExpansion42,runExpansion43,runExpansion44,runExpansion45,runExpansion46][d.level.index-41];check(fn,'Unknown expansion A room');return fn(d,options);
}
