import fs from 'node:fs';import assert from 'node:assert/strict';import * as THREE from 'three';
import {createHeadlessGame} from './lab-headless.mjs';
const g=await createHeadlessGame(),V=(...p)=>new THREE.Vector3(...p);
const report={scope:'Bounded negative tests with deliberately assigned edge fixtures, not solution paths or exhaustive proof.',jumps:[],directGrabs:[],weakImpacts:[]};
for(const c of [
 {index:5,source:[[-1.5,0,-10],[0,0,-10],[1.5,0,-10]],targets:[[-1.5,0,-15],[0,0,-15],[1.5,0,-15]],reached:p=>p.z< -13.7},
 {index:7,source:[[-2,0,-1],[0,0,-1],[2,0,-1]],targets:[[-2,7,-4],[0,7,-4],[2,7,-4]],reached:p=>p.y>6.9&&p.z< -3.1},
 {index:8,source:[[-1.5,0,-10.5],[0,0,-10.5],[1.5,0,-10.5]],targets:[[-1.5,0,-14],[0,0,-14],[1.5,0,-14]],reached:p=>p.z< -12.9}
]){
 await g.selectLevel(c.index,false);
 for(const s of c.source)for(const t of c.targets)for(const carry of [false,true])for(const extraHeight of [0,.9]){
  g.resetRun(true);g.playerPosition.fromArray(s);g.playerPosition.y+=extraHeight;g.previousPlayerPosition.copy(g.playerPosition);g.playerGrounded=true;g.coyoteTime=.1;
  const d=V(t[0]-s[0],0,t[2]-s[2]).normalize();g.yaw=0;g.input.getMove=()=>new THREE.Vector2(d.x,d.z);g.input.keys.add('ShiftLeft');g.input.jumpQueued=true;g.heldCube=carry?g.cargo:null;g.playerVelocity.copy(d).multiplyScalar(carry?4.5:5);
  let bypass=false;for(let n=0;n<360;n++){g.firstLevel.update(1/120);g.updatePlayer(1/120);if(c.reached(g.playerPosition)&&g.playerGrounded){bypass=true;break;}}
  report.jumps.push({level:c.index+1,source:s,target:t,carry,extraHeight,bypass});
 }
}
await g.selectLevel(9,false);
// An actual eye-to-load obstruction check on the low cover, rather than distance alone.
for(const x of [-6,-3,0,3,6])for(const z of [-3,0,5])for(const dx of [-.5,0,.5]){
 g.resetRun(true);const p=V(x,.4,z);g.physics.resetCargo({position:p});g.cargo.position.copy(p);g.cargo.velocity.set(0,0,0);
 g.playerPosition.set(x+dx,1.57,z+.7);g.previousPlayerPosition.copy(g.playerPosition);g.interact();report.directGrabs.push({x,z,dx,bypass:!!g.heldCube});
}
await g.selectLevel(8,false);
for(const speed of [0,1,2,3])for(const x of [-.3,0,.3]){
 g.resetRun(true);const p=V(x,.42,-7);g.physics.resetCargo({position:p});g.cargo.position.copy(p);g.physics.cargoBody.velocity.z=-speed;
 let peak=0;for(let n=0;n<300;n++){g.updatePlaying(1/120);peak=Math.max(peak,g.firstLevel.state.piston.compression);}
 report.weakImpacts.push({speed,x,peak,latched:g.firstLevel.state.piston.latched});
}
// Without the friend at the long lever arm, a settled loaded bridge cannot support the far exit.
await g.selectLevel(6,false);report.balance=[];
for(const counterIndex of [0,1,2])for(const z of [-7,-9,-10]){
 g.resetRun(true);g.firstLevel.state.counterIndex=counterIndex;g.heldCube=g.cargo;
 g.playerPosition.set(0,2.2,z);g.playerGrounded=true;g.cargo.position.set(6,2.75,1);
 // Loading follows the real support instead of pinning an imaginary high platform.
 for(let n=0;n<900;n++)g.firstLevel.update(1/120);
 report.balance.push({counterIndex,z,endHeight:2.2+Math.tan(g.firstLevel.state.angle)*10.5,angle:g.firstLevel.state.angle});
}
fs.mkdirSync('qa',{recursive:true});fs.writeFileSync('qa/v13-audit.json',JSON.stringify(report,null,2));
assert.ok(report.jumps.every(r=>!r.bypass),'Closed obstacle jumped');assert.ok(report.directGrabs.every(r=>!r.bypass),'Friend grabbed through sealed glass');assert.ok(report.weakImpacts.every(r=>!r.latched),'Slow contact opened spring');assert.ok(report.balance.every(r=>r.endHeight<4),'Wrong load arrangement raises high exit');
console.log('PASS',report.jumps.length,'no-power jumps;',report.directGrabs.length,'sealed-grab probes;',report.weakImpacts.length,'weak impacts;',report.balance.length,'balance arrangements');g.physics.dispose();g.portals.dispose();
