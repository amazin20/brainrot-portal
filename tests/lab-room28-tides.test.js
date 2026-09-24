import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {Room28TideVolumes,room28FlowStatus} from '../src/game/LabRoom28Tides.js';
import {createHeadlessGame} from '../scripts/lab-headless.mjs';
import {runV8Journey} from '../src/game/LabV8Journey.js';

test('communicating tide volumes conserve water and stop at the physical aperture equilibrium',()=>{
 const equal=[{basin:0,sill:.6},{basin:1,sill:.6}],pour=[{basin:0,sill:.6},{basin:1,sill:8}];
 const tide=new Room28TideVolumes();tide.step(100,equal);assert.ok(Math.abs(tide.levels[0]-3)<1e-10);assert.ok(Math.abs(tide.levels[1]-3)<1e-10);
 tide.reset();tide.step(100,pour);assert.ok(Math.abs(tide.levels[0]-.6)<1e-10);assert.ok(Math.abs(tide.levels[1]-5.4)<1e-10);
 const stored=[...tide.levels];tide.step(300);assert.deepEqual(tide.levels,stored);tide.step(10,[{basin:0,sill:0},{basin:0,sill:8}]);assert.deepEqual(tide.levels,stored);
 tide.step(100,[{basin:0,sill:8},{basin:1,sill:8}]);assert.deepEqual(tide.levels,stored);assert.throws(()=>tide.step(-1),RangeError);
 const coarse=new Room28TideVolumes(),fine=new Room28TideVolumes();coarse.step(12,equal);for(let i=0;i<1440;i++)fine.step(1/120,equal);
 for(let i=0;i<2;i++)assert.ok(Math.abs(coarse.levels[i]-fine.levels[i])<1e-10);
 for(let i=0;i<600;i++){tide.step(.037,i%2?pour:equal);assert.ok(Math.abs(tide.levels[0]+tide.levels[1]-6)<1e-10);assert.ok(tide.levels.every(n=>n>=0&&n<=6));}
});

test('the in-world meter explains actual disconnection, conservation and equilibrium',()=>{
 const a={basin:0,sill:.5},b={basin:1,sill:.5};
 assert.equal(room28FlowStatus([6,0],null,0),'КОНТУР РАЗОМКНУТ');
 assert.equal(room28FlowStatus([6,0],[a,{basin:0,sill:8}],0),'ОБА УСТЬЯ: БАССЕЙН А');
 assert.equal(room28FlowStatus([6,0],[a,b],.3),'ВОДА: А → Б');
 assert.equal(room28FlowStatus([0,6],[a,b],-.3),'ВОДА: Б → А');
 assert.equal(room28FlowStatus([3,3],[a,b],0),'ДАВЛЕНИЕ ВЫРОВНЕНО');
 assert.equal(room28FlowStatus([3,3],[{basin:0,sill:8},{basin:1,sill:8}],0),'ВОДА НИЖЕ ОБОИХ УСТЬЕВ');
});

const game=await createHeadlessGame();after(()=>{game.physics.dispose();game.portals.dispose();});
for(const aspect of [1.6,16/9])for(const options of [{},{route:'full-tide-observatory'},{recoverFall:true},{interrupt:true}]){
 test(`room28 physical water route ${aspect} ${JSON.stringify(options)}`,async()=>{
  await game.selectLevel(27,false);game.camera.aspect=aspect;game.camera.updateProjectionMatrix();const body=game.physics.cargoBody,identity=game.cargo.group.uuid;
  const art=game.firstLevel.tidalPresentation;
  for(const basin of ['A','B']){
   const backing=game.firstLevel.world.root.getObjectByName(`Basin ${basin} gauge backing`);
   assert.ok(backing,`Missing basin ${basin} gauge backing`);
   const box=new THREE.Box3().setFromObject(backing);
   assert.ok(box.min.x>game.firstLevel.bounds.minX+.2&&box.max.x<game.firstLevel.bounds.maxX-.2,
    `Basin ${basin} instrument clips the room's side wall`);
   assert.ok(box.min.y>7,'The basin readout must clear the recovery walkway');
   const near=game.firstLevel.world.root.getObjectByName(`Basin ${basin} near-mouth readout backing`);
   assert.ok(near,`Missing basin ${basin} near-mouth reading`);
   const nearBox=new THREE.Box3().setFromObject(near);
   assert.ok(nearBox.min.x>game.firstLevel.bounds.minX+.2&&nearBox.max.x<game.firstLevel.bounds.maxX-.2);
   assert.ok(nearBox.min.y>8.45,'Local reading must clear the occupied floating deck');
   const outlet=game.firstLevel.panels[basin==='A'?'coral-fall':'lagoon-fall'];
   const face=outlet.getFrame().center.x,half=outlet.width/2;
   assert.ok(nearBox.min.x>face+half+.15,
    'Local reading must leave the portal face unobstructed');
  }
  const rear=game.firstLevel.world.root.getObjectByName('Tidal circuit rear-wall backing');
  const rearBox=new THREE.Box3().setFromObject(rear);
  assert.ok(rearBox.min.x>game.firstLevel.bounds.minX+.2&&rearBox.max.x<game.firstLevel.bounds.maxX-.2);
  assert.ok(rearBox.min.y>8,'Rear circuit meter must sit above the garden');
  assert.ok(art.pipes.colliders.length>=4,'Visible plumbing must have physical envelopes');
  assert.match(art.readouts.status.text,/КОНТУР РАЗОМКНУТ/);
  assert.match(art.readouts.status.text,/А 6\.0 \+ Б 0\.0 = 6\.0 м/);
  assert.match(art.readouts.gauges[0].text,/А \/ 6\.0 м/);
  assert.match(art.readouts.gauges[1].text,/Б \/ 0\.0 м/);
  assert.equal(art.readouts.localReadouts[0].text,'А / 6.0 м');
  assert.equal(art.readouts.localReadouts[1].text,'Б / 0.0 м');
  assert.ok(Math.abs(art.readouts.columns[0].scale.y-6)<1e-10);
  assert.ok(art.readouts.columns[1].scale.y<.02);
  let firstHeights=null,returnObserved=false;
  const report=await runV8Journey(game,{journeyOptions:options,onMilestone(mark){
   const s=game.firstLevel.state;assert.ok(Math.abs(s.tides.levels[0]+s.tides.levels[1]-6)<1e-8);
   if(mark.name==='the east gauge and receiving current show the moving tide'){
    assert.ok(Math.abs(s.tides.flow)>.006);
    assert.ok(art.current.ring.visible,'The current should be visible at the actual receiving portal');
    assert.match(art.readouts.status.text,/ВОДА: А → Б/);
    assert.equal(art.readouts.localReadouts[1].text,`Б / ${s.tides.levels[1].toFixed(1)} м`);
   }
   if(mark.name==='equal tides reveal the middle garden'||mark.name==='a full tide reveals the observatory'){
    firstHeights=[...s.tides.levels];assert.equal(game.heldCube,null);assert.ok(Math.abs(game.cargo.position.y-s['lagoon-float'].position.y)<.9);
    assert.ok(Math.abs(art.readouts.columns[1].scale.y-s.tides.levels[1])<.02,'Visible meter follows the actual eastern basin');
    assert.ok(Math.abs(art.readouts.columns[0].scale.y-s.tides.levels[0])<.02,'Visible meter follows the actual western basin');
    assert.ok(Math.abs(art.readouts.localColumns[1].scale.y-s.tides.levels[1])<.02,'Local waterline follows the actual eastern basin');
    assert.ok(Math.abs(art.readouts.localColumns[0].scale.y-s.tides.levels[0])<.02,'Local waterline follows the actual western basin');
   }
   if(mark.name==='the same water returns beneath both travellers'){
    returnObserved=true;assert.equal(game.heldCube,null);assert.ok(game.playerPosition.y>5.19);assert.ok(Math.abs(game.cargo.position.y-s['coral-float'].position.y)<.9);
   }
  }});
  assert.equal(game.state,'won');assert.equal(report.resets+report.respawns,0);assert.equal(game.physics.cargoBody,body);assert.equal(game.cargo.group.uuid,identity);assert.ok(returnObserved);
  assert.ok(game.firstLevel.goal.contains(game.playerPosition));assert.ok(game.firstLevel.goal.contains(game.cargo.position));
  if(options.route==='full-tide-observatory'){assert.ok(firstHeights[1]>5.25);assert.ok(firstHeights[0]<.75);}else assert.ok(Math.abs(firstHeights[0]-firstHeights[1])<.15);
 });
}
