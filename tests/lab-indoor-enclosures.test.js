import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import {createHeadlessGame} from '../scripts/lab-headless.mjs';
import {runV8Journey} from '../src/game/LabV8Journey.js';

const game=await createHeadlessGame();
after(()=>{game.physics.dispose();game.portals.dispose();});

const routes=[
 [24,[{route:'carry-through'},{route:'counterweight'}]],
 [27,[{gravityReturn:false},{gravityReturn:true}]],
 [28,[{},{route:'full-tide-observatory'}]],
 [29,[{},{carryRoute:true}]],
 [30,[{},{east:true}]],
];
for(const [number,options] of routes)for(const [variant,journeyOptions] of options.entries())
 test(`enclosed room ${number}: route ${variant+1} retains its physical solution`,async()=>{
  await game.selectLevel(number-1,false);
  const level=game.firstLevel,roof=number===30
   ?game.colliders.find(c=>c.mesh.name==='Solid hangar roof')
   :level.world.surfaces.find(s=>s.name==='Non-portal ceiling tiles')?.collider;
  assert.ok(roof?.enabled,`room ${number} has no solid roof`);
  assert.equal(level.chapterArt?.openSky,false);
  assert.ok(roof.box.min.y>level.goal.position.y+2,`room ${number} roof blocks the destination`);
  if(number===30)assert.equal(game.colliders.filter(c=>c.mesh.name.startsWith('Solid hangar ')&&!c.mesh.name.includes('roof')).length,4);
  const cargo=game.cargo,body=game.physics.cargoBody;
  const report=await runV8Journey(game,{journeyOptions});
  assert.equal(report.pass,true);assert.equal(game.state,'won');
  assert.equal(report.resets+report.respawns,0);
  assert.equal(game.cargo,cargo);assert.equal(game.physics.cargoBody,body);
 });
