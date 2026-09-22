import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createHeadlessGame} from '../scripts/lab-headless.mjs';
import {scanEarlyPortalSightlines} from '../scripts/lib/puzzle-sightline-scan.mjs';
import {runV8Journey} from '../src/game/LabV8Journey.js';
import {installRoom21Aim} from '../src/game/LabRoom21Journey.js';
import {nextCampaignLevel} from '../src/game/LabCampaignRoute.js';
import {CAMPAIGN} from '../src/game/LabCampaignLevels.js';

const game=await createHeadlessGame();
after(()=>{game.physics.dispose();game.portals.dispose();});

const restricted=[
 {level:22,panel:'reverse-receiver',maxFloorY:.5},
 {level:23,panel:'high-return',maxFloorY:10.5},
 {level:24,panel:'pavilion-receiver',maxFloorY:.5},
 {level:25,panel:'home',maxFloorY:9.5,excludeSurfaces:['Home receiving chamber']},
 {level:25,panel:'freight-receiver',maxFloorY:.5},
 {level:25,panel:'return-entry',maxFloorY:9.5,excludeSurfaces:['Home receiving chamber']},
 {level:26,panel:'freight-receiver',maxFloorY:8.5},
 {level:27,panel:'upper-intake',maxFloorY:.5},
 {level:27,panel:'reverse-outlet',maxFloorY:.5},
 {level:30,panel:'sunward-outlet',maxFloorY:52.5,excludeSurfaces:['Shared observation island','Island well viewing balcony','Second dive lip','Sunward arrival island']},
];
for(const config of restricted)test(`room ${config.level}: early floor/jump viewpoints cannot place a shortcut portal on ${config.panel}`,async()=>{
 await game.selectLevel(config.level-1,false);game.resetRun(true);
 const scan=scanEarlyPortalSightlines(game,config);
 assert.ok(scan.positions>=25&&scan.rays>=450,`A meaningful finite grid must remain: ${JSON.stringify({...scan,hits:undefined})}`);
 assert.equal(scan.hits.length,0,`A suspected early shortcut needs an input-only attempt: ${JSON.stringify(scan.hits.slice(0,4))}`);
});

for(let number=22;number<=30;number++)test(`room ${number}: victory requires the original friend physically present on the same exit, with grounded player`,async()=>{
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

test('former finale clears kinetic effects into room31; new finale returns to room1',async()=>{
 // Supply the production scene fog omitted by the headless rendering stub.
 game.scene.fog=new THREE.Fog(0xb3ced6,64,120);
 await game.selectLevel(0,false);
 const lights=()=>{const result=[];game.scene.traverse(n=>{if(n.isLight)result.push(n);});return result;};
 const ordinary={background:game.scene.background.getHex(),fog:game.scene.fog.color.getHex(),near:game.scene.fog.near,far:game.scene.fog.far,lights:lights().length};
 for(const number of [24,27,28,29,30])await game.selectLevel(number-1,false);
 assert.equal(game.kineticMode,true);assert.equal(Boolean(game.epicMode),false);
 assert.equal(game.camera.far,500);assert.ok(game.velocityCompanion);
 const finaleRoots=[...game.levelRoots],finaleLights=lights(),director=game.epicDirector;
 // Exercise the actual presentation effect before changing level, so this
 // catches retained flashes/FOV after a real kinetic presentation update.
 director.update({dt:.1,velocity:new THREE.Vector3(32,9,0),grounded:false,active:true,enabled:true});
 director.portal(34,2);assert.ok(director.amount>0&&director.portalPulse>0);
 const next=nextCampaignLevel(game.levelIndex,CAMPAIGN.length);assert.equal(next,30);
 await game.selectLevel(next,false);game.updateVisuals(1/60);
 assert.equal(game.levelIndex,30);assert.equal(game.kineticMode,false);assert.equal(game.velocityCompanion,null);
 assert.equal(director.amount,0);assert.equal(director.portalPulse,0);assert.equal(director.enabled,false);
 assert.ok(finaleRoots.every(n=>n.parent===null));
 assert.ok(finaleLights.every(n=>!lights().includes(n)));
 for(const number of [32,33])await game.selectLevel(number-1,false);
 assert.equal(nextCampaignLevel(game.levelIndex,CAMPAIGN.length),0);
 await game.selectLevel(0,false);game.updateVisuals(1/60);
 assert.equal(game.levelIndex,0);assert.equal(game.kineticMode,false);assert.equal(game.velocityCompanion,null);
 assert.equal(game.camera.far,130);assert.equal(game.cameraRig.epicMode,false);assert.equal(game.cameraRig.epicFraming,0);
 assert.equal(game.velocityFocus,false);assert.equal(game.kinetic,null);
 assert.equal(director.amount,0);assert.equal(director.portalPulse,0);assert.equal(director.enabled,false);
 assert.deepEqual({background:game.scene.background.getHex(),fog:game.scene.fog.color.getHex(),near:game.scene.fog.near,far:game.scene.fog.far,lights:lights().length},ordinary);
 assert.ok(finaleRoots.every(n=>n.parent===null),'Old chapter roots must leave the scene');
 assert.ok(finaleLights.every(n=>!lights().includes(n)),'Finale lights must not accumulate in ordinary rooms');
});

test('room 28: working low collectors transfer water while their ribs block ordinary running and jumping entry',async()=>{
 await game.selectLevel(27,false);
 const result=await runV8Journey(game,{scenario:d=>{
  const p=d.level.panels;
  d.walk(-14,13);d.aim(0,p['coral-low'].getFrame().center);
  d.walk(21,13);d.walk(21,0);d.walk(14,0);d.aim(1,p['lagoon-low'].getFrame().center);
  const push=()=>{
   const before=game.teleportCount;
   for(let n=0;n<300;n++){d.worldMove(0,-1);if(n%60===0)game.input.jumpQueued=true;d.frame();}
   d.stop();assert.equal(game.teleportCount,before,'A plumbing collector became a player passage');
  };
  push();assert.ok(d.level.state.tides.levels[1]>1,'The real linked pair must still conduct water');
  d.walk(21,0);d.walk(21,13);d.walk(-14,13);push();
  assert.equal(game.state,'playing');assert.equal(d.level.isWon(),false);
 }});
 assert.ok(result.pass);assert.equal(result.resets,0);assert.equal(result.respawns,0);
});

test('room 30: a slow first-well exit cannot drop directly onto the final island',async()=>{
 await game.selectLevel(29,false);
 const result=await runV8Journey(game,{scenario:d=>{
  const p=d.level.panels;
  d.walk(-21.5,16);game.interact();d.wait(.3);assert.ok(game.velocityCompanion.connected);
  d.walk(-25,13);d.walk(-25,-32);d.aim(1,p['east-arc'].getFrame().center);
  d.walk(-25,-17);d.walk(0,-17);
  for(let n=0;n<240&&game.playerGrounded;n++){d.worldMove(0,-1);game.input.keys.add('ShiftLeft');d.frame();}
  d.stop();d.until(()=>game.playerGrounded,9,'First well must safely catch a dive before its portal exists');
  assert.ok(Math.abs(game.playerPosition.y-16)<.02);
  // Prepare the entry only after gravity's first impulse has been spent.
  // This would skip the whole second flight if the east outlet sat over goal.
  installRoom21Aim(d);const before=game.teleportCount;
  d.aim(0,p['first-well'].getFrame().center);game.input.jumpQueued=true;d.wait(.2);
  d.until(()=>game.teleportCount>before,5,'Slow first-well entry');d.stop();
  d.until(()=>game.playerGrounded,12,'Low-speed exit must find physical support');
  assert.equal(game.teleportCount,before+1);assert.ok(game.playerPosition.y<.2,'A first receiver provided a shortcut onto the final island');
  assert.equal(game.state,'playing');assert.equal(d.level.isWon(),false);assert.ok(game.velocityCompanion.isNear());
 }});
 assert.ok(result.pass);assert.equal(result.resets,0);assert.equal(result.respawns,0);
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
