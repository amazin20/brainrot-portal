import fs from 'node:fs';
import * as THREE from 'three';
import {createHeadlessGame} from './lab-headless.mjs';
import {sampleRampSurface} from '../src/game/LabPhysics.js';
const g=await createHeadlessGame();g.chamberEdition='open';
await g.selectLevel(23,false);g.resetRun(true);
const pad=g.firstLevel.panels['ground-load'],car=g.firstLevel.car.panel;
for(const [i,s]of [[0,pad],[1,car]]){const p=g.portals.placeOnPanel(i,s.mesh,s.getFrame().center);if(!p.ok)throw Error(p.reason);g.portalSurfaceIds[i]=s.mesh.uuid;}
g.playerPosition.set(9,.2,35);g.previousPlayerPosition.copy(g.playerPosition);g.playerVelocity.set(0,0,0);g.yaw=0;g.input.getMove=()=>new THREE.Vector2(0,g.playerPosition.z>31?-.55:0);
let trace=[];for(let i=0;i<480;i++){g.updatePlaying(1/120);if(i%30===0)trace.push({t:i/120,p:g.playerPosition.toArray(),teleports:g.teleportCount});if(g.teleportCount)break;}
const floor={teleports:g.teleportCount,trace};
await g.selectLevel(29,false);g.resetRun(true);
const r=g.ramps[0],z=-8;g.playerPosition.set(-46,sampleRampSurface(r,z).height,z);g.previousPlayerPosition.copy(g.playerPosition);g.playerVelocity.set(0,0,-15);g.playerGrounded=true;g.yaw=0;g.input.keys.add('ShiftLeft');g.input.getMove=()=>new THREE.Vector2(0,-1);g.input.jumpQueued=true;
let minimum=0;trace=[];for(let i=0;i<260;i++){g.updatePlaying(1/120);const h=sampleRampSurface(r,g.playerPosition.z).height,d=g.playerPosition.y-h;if(g.playerPosition.z>=r.minZ&&g.playerPosition.z<=r.maxZ)minimum=Math.min(minimum,d);if(i%15===0)trace.push({t:i/120,p:g.playerPosition.toArray(),vy:g.playerVelocity.y,h,grounded:g.playerGrounded});}
const result={floor,ramp:{minimum,trace}};console.log(JSON.stringify(result,null,2));fs.writeFileSync(process.env.OUT||'/mnt/data/exploration-repro-before.json',JSON.stringify(result,null,2));
