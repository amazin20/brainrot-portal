import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createHeadlessGame} from './lab-headless.mjs';
const g=await createHeadlessGame();await g.selectLevel(20,false);
const results=[];let n=0;const output=process.env.R2_AIR_REPORT||'qa/room21-r2-air-shortcuts.json';let pass=false;
try{
for(const exit of ['source-carriage','rising-out','freight-out'])for(const offset of [-1.2,0,1.2])for(const vz of [-4,0,4])for(const goal of [[10,8],[14,-5],[14,-23]]){
 g.resetRun(true);const l=g.firstLevel,s=l.state.sourceDrive;
 // Explicit maximum-source reachability fixture: prepare height, not cargo.
 s.car.target=1;s.car.update(1/s.car.rate);s.brake=true;s.car.locked=true;l.update(0);l.renderUpdate(1);g.scene.updateMatrixWorld(true);
 if(Math.abs(s.car.floor.y-18)>1e-6)throw Error('Fixture did not raise source carriage');
 const end=l.panels[exit].getFrame().center.clone();end.z+=offset;
 const inOk=g.placeOnPanel(0,l.panels['shared-drop'].mesh,new THREE.Vector3(-10,.025,10));
 const outOk=g.placeOnPanel(1,l.panels[exit].mesh,end);
 if(!inOk||!outOk){results.push({exit,offset,vz,goal,placed:false});continue;}
 g.playerPosition.set(-10,3,10);g.previousPlayerPosition.copy(g.playerPosition);g.playerVelocity.set(0,-24,vz);g.playerGrounded=false;
 g.heldCube=g.cargo;g.physics.resetCargo({position:new THREE.Vector3(-10,4.06,10.72)});g.cargo.position.set(-10,4.06,10.72);
 const old=g.input.getMove;let transit=false,highEast=false,maxX=-100,point=null;
 g.input.getMove=()=>{if(!transit)return new THREE.Vector2();const d=new THREE.Vector3(goal[0]-g.playerPosition.x,0,goal[1]-g.playerPosition.z).normalize().applyAxisAngle(new THREE.Vector3(0,1,0),-g.yaw);return new THREE.Vector2(d.x,d.z);};
 try{for(let i=0;i<840&&g.state==='playing';i++){g.updatePlaying(1/120);transit ||= g.teleportCount>0;maxX=Math.max(maxX,g.playerPosition.x);if(g.playerGrounded&&g.playerPosition.x>5.5&&g.playerPosition.y>=11.9){highEast=true;point=g.playerPosition.toArray();break;}}}
 finally{g.input.getMove=old;}
 const r={exit,offset,vz,goal,placed:true,transit,highEast,point,maxX,won:l.isWon(),final:g.playerPosition.toArray(),load:l.state.freightGuard.loaded};results.push(r);
 if(highEast)console.log('BYPASS',r);if(++n%20===0)console.log('cases',n);
}
assert.equal(results.length,81);assert(results.every(r=>r.placed&&r.transit),'Every case must reach an actual legal portal transfer');
assert(results.every(r=>!r.highEast&&!r.won),'A trajectory bypassed the unprepared freight branch');pass=true;
}finally{g.physics.dispose();g.portals.dispose();fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify({commit:process.env.BUILD_COMMIT||null,scope:'Narrow reachability fixtures, not ordinary routes or all possible trajectories.',pass,results},null,2));}
