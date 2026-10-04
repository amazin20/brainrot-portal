import assert from 'node:assert/strict';
import * as THREE from 'three';
import {runCreative18} from '../../src/game/LabCreativeRoom18Journey.js';
import {installPreciseLateAim,aimLateSurface} from '../../src/game/LabLateCampaignAim.js';
const V=(...p)=>new THREE.Vector3(...p);
function rush(d,x,z,seconds=4){d.game.input.keys.add('ShiftLeft');for(let n=0;n<seconds*60&&d.game.state==='playing';n++){const v=V(x,0,z).sub(d.game.playerPosition);v.y=0;v.normalize();d.worldMove(v.x,v.z);d.game.input.jumpQueued=n%13===0;d.frame();}d.stop();}
function collect(d){if(d.game.heldCube)return;const c=d.game.cargo.position;d.walk(c.x+1.15,c.z);d.pickup();}
function switchKnife(d){d.walk(-4,7.65);assert.ok(d.game.interact());d.wait(.2);}
function blocked(d){assert.notEqual(d.game.state,'won');assert.ok(d.game.playerPosition.z> -7,'The actual partition stops the observer');d.mark('Observed physical partition and incomplete series circuit');}
export const creative18Attacks=[
 {name:'electrical-empty-cell-forward-current-rush',run(d){switchKnife(d);d.wait(3);assert.equal(d.level.circuit.current,0);assert.equal(d.level.circuit.stroke,0);rush(d,0,-20);blocked(d);}},
 {name:'electrical-hand-feed-through-subdiameter-sight-slit',run(d){
  const g=d.game,update=g.updatePlaying;let entered=false;
  // Sprint-jumps can reach the outside roof. Continuously observe the actual
  // protected interior, rather than mistaking an exterior roof position for
  // a body passing through the low sight throat.
  g.updatePlaying=function(dt){update.call(this,dt);const c=this.cargo.position;if(c.x>-16.075&&c.x< -11.925&&c.z>3.35&&c.z<9.625&&c.y<1.8)entered=true;};
  try{collect(d);d.walk(-8,0);d.walk(-14,.4);rush(d,-14,5,2);if(g.heldCube)assert.ok(g.interact());d.wait(2);
   assert.equal(g.physics.portalTransports,0);assert.equal(entered,false,'The original body must not enter the protected contact cell through the deep subdiameter throat');assert.ok(!d.level.circuit.contacts.every(Boolean));assert.equal(d.level.circuit.current,0);assert.equal(d.level.circuit.stroke,0);blocked(d);
  }finally{g.updatePlaying=update;}
 }},
 {name:'electrical-source-only-release-no-contact-circuit',run(d){installPreciseLateAim(d);d.walk(-7,19);aimLateSurface(d,0,d.level.feed.surface);collect(d);d.walk(-7,17.7);d.stop();d.wait(.4);assert.ok(d.game.interact());d.wait(2);switchKnife(d);assert.equal(d.level.circuit.current,0);rush(d,0,-20);blocked(d);}},
 {name:'electrical-loaded-cell-reverse-polarity-rush',run(d){runCreative18(d,{stopBeforePower:true});switchKnife(d);switchKnife(d);d.until(()=>d.level.circuit.stroke===0,4,'Reverse current must reach its actual closed stop');assert.equal(d.level.circuit.mode,2);rush(d,0,-20);blocked(d);}},
 {name:'electrical-delivered-conductor-with-released-jaws-rush',run(d){runCreative18(d,{stopBeforePower:true});assert.deepEqual(d.level.circuit.contacts,[true,true]);assert.ok(d.game.interact()&&!d.level.circuit.clamped);d.until(()=>!d.level.circuit.contacts.some(Boolean),3,'The real electrode springs must retract from the delivered conductor');switchKnife(d);d.wait(2);assert.equal(d.level.circuit.current,0);assert.equal(d.level.circuit.stroke,0);assert.equal(d.game.physics.portalTransports,1);rush(d,0,-20);blocked(d);}},
 {name:'electrical-sealed-partition-destination-spam',run(d){installPreciseLateAim(d);d.walk(-7,19);aimLateSurface(d,0,d.level.feed.surface);d.walk(8,-3);d.look(V(8,2,-6.66));for(let n=0;n<3;n++){assert.ok(d.game.firePortal(1));d.until(()=>!d.game.portalShots.queue.length&&!d.game.portalShots.active.length,3,'Partition charge unresolved');assert.equal(d.game.portalShots.lastImpact.valid,false);assert.equal(d.game.portals.portals[1],null);d.wait(.2);}rush(d,8,-20);blocked(d);}},
 {name:'electrical-carried-cargo-perimeter-and-jump-boost',run(d){collect(d);for(const p of [[24,20],[24,-5],[-24,-5],[-24,20],[0,-20]])rush(d,...p,3);assert.equal(d.level.circuit.stroke,0);blocked(d);}},
];
export const creative18EarlyAttacks=[
 {name:'electrical-staged-two-contacts-without-power',run(d){runCreative18(d,{stopBeforePower:true});d.wait(3);assert.equal(d.level.circuit.current,0);assert.equal(d.level.circuit.stroke,0);rush(d,0,-20);blocked(d);}},
 {name:'electrical-staged-reverse-before-human-clearance',run(d){runCreative18(d,{stopBeforePower:true});switchKnife(d);d.until(()=>d.level.circuit.stroke>.32,2,'Physical partial stroke absent');switchKnife(d);d.until(()=>d.level.circuit.stroke===0,3,'Reverse motor did not close partial stroke');rush(d,0,-20);blocked(d);}},
 {name:'electrical-staged-repeated-knife-reversals',run(d){runCreative18(d,{stopBeforePower:true});d.walk(-4,7.65);for(let cycle=0;cycle<16;cycle++)for(let n=0;n<3;n++){assert.ok(d.game.interact());d.frame();}assert.equal(d.level.circuit.mode,0);assert.ok(d.level.circuit.stroke<.1);rush(d,0,-20);blocked(d);}},
];
