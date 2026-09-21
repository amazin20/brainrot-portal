import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import {Room28TideVolumes} from '../src/game/LabRoom28Tides.js';
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

const game=await createHeadlessGame();after(()=>{game.physics.dispose();game.portals.dispose();});
for(const aspect of [1.6,16/9])for(const options of [{},{route:'full-tide-observatory'},{recoverFall:true},{interrupt:true}]){
 test(`room28 physical water route ${aspect} ${JSON.stringify(options)}`,async()=>{
  await game.selectLevel(27,false);game.camera.aspect=aspect;game.camera.updateProjectionMatrix();const body=game.physics.cargoBody,identity=game.cargo.group.uuid;
  let firstHeights=null,returnObserved=false;
  const report=await runV8Journey(game,{journeyOptions:options,onMilestone(mark){
   const s=game.firstLevel.state;assert.ok(Math.abs(s.tides.levels[0]+s.tides.levels[1]-6)<1e-8);
   if(mark.name==='equal tides reveal the middle garden'||mark.name==='a full tide reveals the observatory'){
    firstHeights=[...s.tides.levels];assert.equal(game.heldCube,null);assert.ok(Math.abs(game.cargo.position.y-s['lagoon-float'].position.y)<.9);
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
