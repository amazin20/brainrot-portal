import test from 'node:test';
import assert from 'node:assert/strict';
import {createHeadlessGame} from '../scripts/lab-headless.mjs';
import {runV8Journey} from '../src/game/LabV8Journey.js';
import {POST_A_SPECS} from '../src/game/LabPostCampaignA.js';

async function room(number){
 const game=await createHeadlessGame();
 game.chamberEdition='foundation';
 await game.selectLevel(number-1,false);
 return game;
}

const alternatives=new Map([
 [31,'empty-upper-first'],[32,'prepare-return-first'],
 [33,'friend-before-passenger'],[34,'explore-service-first'],
 [35,'carry-after-first-latch'],
]);
for(let number=31;number<=35;number++)for(const route of [undefined,alternatives.get(number)]){
 test(`post-campaign room ${number}: ${route||'primary route'} reaches the exit with the original companion`,async()=>{
  const game=await room(number),cargo=game.cargo,body=game.physics.cargoBody.id;
  try{
   const report=await runV8Journey(game,{journeyOptions:route?{route}:{}});
   assert.equal(report.pass,true);
   assert.equal(game.state,'won');
   assert.equal(report.resets,0);
   assert.equal(report.respawns,0);
   assert.equal(game.cargo,cargo);
   assert.equal(game.physics.cargoBody.id,body);
   assert.equal(game.firstLevel.id,POST_A_SPECS[number-31].id);
   assert.equal(game.firstLevel.puzzleGeometry.noProgressFlags,true);
   assert.ok(game.firstLevel.workshop.enclosed);
  }finally{game.physics.dispose();game.portals.dispose();}
 });
}

test('31: a loaded, raised first dock permits a complete physical service-floor recovery',async()=>{
 const game=await room(31),cargo=game.cargo,body=game.physics.cargoBody.id;
 try{
  const report=await runV8Journey(game,{journeyOptions:{recover:true}});
  assert.equal(report.pass,true);
  assert.equal(game.state,'won');
  assert.equal(report.resets,0);
  assert.equal(report.respawns,0);
  assert.equal(game.cargo,cargo);
  assert.equal(game.physics.cargoBody.id,body);
  assert.ok(report.milestones.some(m=>m.name.includes('loaded first dock stays high')));
  assert.ok(report.milestones.some(m=>m.name.includes('same real portal')));
  assert.ok(report.teleports>=1);
 }finally{game.physics.dispose();game.portals.dispose();}
});

for(const [number,topZ] of [[31,-2],[33,2]]){
 test(`${number}: west return ramp reaches the departure deck after a real service-floor miss`,async()=>{
  const game=await room(number),original=game.cargo,body=game.physics.cargoBody.id;
  try{
   const report=await runV8Journey(game,{scenario:d=>{
    d.walk(-8,8);
    game.input.jumpQueued=true;
    for(let i=0;i<130;i++){
     d.worldMove(1,0);d.frame();
     if(game.playerPosition.x>-3&&game.playerPosition.y<-.8)break;
    }
    d.stop();d.until(()=>game.playerGrounded&&game.playerPosition.y<-3.8,5,'Service floor was not reached');
    d.walk(-15,-15);d.walk(-22,-15);d.walk(-22,topZ);d.walk(-22,8);
    assert.ok(game.playerGrounded&&game.playerPosition.y>-.1,'West ramp did not reconnect to departure');
    assert.equal(game.state,'playing');
   }});
   assert.equal(report.pass,true);
   assert.equal(report.resets,0);
   assert.equal(report.respawns,0);
   assert.equal(game.cargo,original);
   assert.equal(game.physics.cargoBody.id,body);
  }finally{game.physics.dispose();game.portals.dispose();}
 });
}

for(const [number,side,gateZ] of [[32,-22,6],[32,22,6],[35,-25,9],[35,25,9]]){
 test(`${number}: closed first shutter cannot be bypassed on ${side<0?'left':'right'} perimeter`,async()=>{
  const game=await room(number),first=number===32?game.firstLevel.entry:game.firstLevel.first;
  try{
   const report=await runV8Journey(game,{scenario:d=>{
    d.walk(side,gateZ+5);
    for(let n=0;n<720&&game.state==='playing';n++){d.worldMove(0,-1);d.frame();}
    d.stop();
    assert.equal(game.state,'playing');
    assert.ok(game.playerPosition.z>gateZ+.79,`Perimeter traversal crossed shut shutter at ${game.playerPosition.toArray()}`);
    assert.ok(first.progress<.01,'No unweighted shutter should move');
   }});
   assert.equal(report.pass,true);
   assert.equal(report.resets,0);
   assert.equal(report.respawns,0);
  }finally{game.physics.dispose();game.portals.dispose();}
 });
}
