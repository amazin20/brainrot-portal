import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createHeadlessGame} from '../scripts/lab-headless.mjs';
import {scanEarlyPortalSightlines} from '../scripts/lib/puzzle-sightline-scan.mjs';
import {runV8Journey} from '../src/game/LabV8Journey.js';
import {installRoom21Aim} from '../src/game/LabRoom21Journey.js';

const game=await createHeadlessGame();
after(()=>{game.physics.dispose();game.portals.dispose();});

const restricted=[
 {level:22,panel:'reverse-receiver',maxFloorY:.5},
 {level:23,panel:'high-return',maxFloorY:10.5},
 {level:24,panel:'freight-receiver',maxFloorY:.5},
 {level:25,panel:'home',maxFloorY:9.5,excludeSurfaces:['Home receiving chamber']},
 {level:25,panel:'freight-receiver',maxFloorY:.5},
 {level:25,panel:'return-entry',maxFloorY:9.5,excludeSurfaces:['Home receiving chamber']},
 {level:26,panel:'freight-receiver',maxFloorY:8.5},
];
for(const config of restricted)test(`room ${config.level}: early floor/jump viewpoints cannot place a shortcut portal on ${config.panel}`,async()=>{
 await game.selectLevel(config.level-1,false);game.resetRun(true);
 const scan=scanEarlyPortalSightlines(game,config);
 assert.ok(scan.positions>=25&&scan.rays>=450,`A meaningful finite grid must remain: ${JSON.stringify({...scan,hits:undefined})}`);
 assert.equal(scan.hits.length,0,`A suspected early shortcut needs an input-only attempt: ${JSON.stringify(scan.hits.slice(0,4))}`);
});

for(let number=22;number<=26;number++)test(`room ${number}: victory requires the original friend physically present on the same exit, with grounded player`,async()=>{
 await game.selectLevel(number-1,false);game.resetRun(true);
 const level=game.firstLevel,body=game.physics.cargoBody,identity=game.cargo.group.uuid;
 // Isolated completion fixture, deliberately not passage evidence. No room
 // progress flags, mechanism state or companion identity are changed.
 assert.equal(level.isWon(),false);
 game.playerPosition.copy(level.goal.position);game.playerGrounded=true;
 assert.equal(level.isWon(),false,'A traveller alone cannot complete the new room');
 game.cargo.position.copy(level.goal.position).add(new THREE.Vector3(0,.39,0));
 assert.equal(level.isWon(),true,'Joint physical arrival must be sufficient without a hidden checklist');
 game.playerGrounded=false;assert.equal(level.isWon(),false,'Flying past the exit is not a grounded finish');
 game.playerGrounded=true;game.cargo.position.y-=4;assert.equal(level.isWon(),false,'The friend below the exit is not present on its floor');
 game.resetRun(true);assert.equal(level.isWon(),false);assert.equal(game.physics.cargoBody,body);assert.equal(game.cargo.group.uuid,identity);
});

for(const offset of [-.65,0,.65])for(const steer of ['forward','right'])
test(`room 23: ordinary early throat jump at vertical offset ${offset}, steering ${steer}, cannot reach the upper gallery`,async()=>{
 await game.selectLevel(22,false);
 const result=await runV8Journey(game,{scenario:d=>{
  installRoom21Aim(d);d.walk(-16,3);
  const target=d.level.panels['freight-throat'].getFrame().center.clone();target.y+=offset;
  d.aim(1,target);d.aim(0,d.level.panels['west-load-car'].getFrame().center);
  d.walk(-15,3);game.input.jumpQueued=true;
  for(let n=0;n<480;n++){
   if(game.teleportCount)d.worldMove(steer==='right'?1:0,steer==='forward'?1:0);
   else if(game.playerPosition.x< -11)d.worldMove(1,0);else d.stop();
   d.frame();const p=game.playerPosition;
   const upperGallery=(p.z>6.6&&p.z<10.4&&p.x>6.8)||(p.x>15&&p.z>-19&&p.z<10.4)||(p.z< -17&&p.x> -5&&p.x<22);
   assert.equal(game.playerGrounded&&p.y>19.8&&upperGallery,false,'The initial freight route bypassed both counterweight rides');
   assert.equal(game.state,'playing');
  }
  d.stop();assert.equal(d.level.isWon(),false);
 }});
 assert.ok(result.pass);assert.equal(result.resets,0);assert.equal(result.respawns,0);
});
