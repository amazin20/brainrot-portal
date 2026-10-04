import test from 'node:test';
import assert from 'node:assert/strict';
import {createHeadlessGame} from '../scripts/lab-headless.mjs';
import {towerCrownRoute} from '../src/game/LabTowerCrown.js';

test('The crown has two supported vertical portal transfers and an elevated physical finish',async()=>{
 const game=await createHeadlessGame();game.chamberEdition='foundation';await game.selectLevel(40,true);
 try{
  const level=game.firstLevel,panels=Object.fromEntries(game.portalPanels
   .filter(p=>p.userData.towerCrown).map(p=>[p.userData.towerCrown,p]));
  assert.deepEqual(Object.keys(panels).sort(),['final-outlet','intake','middle-intake','outlet']);
  assert.ok(panels['middle-intake'].userData.center.y-panels.intake.userData.center.y>4);
  assert.ok(panels['final-outlet'].userData.center.y-panels.outlet.userData.center.y>4);
  for(const [slot,key]of [[0,'intake'],[1,'outlet'],[0,'middle-intake'],[1,'final-outlet']])
   assert.equal(game.placeOnPanel(slot,panels[key],panels[key].userData.center),true,`${key} must fit an actual portal`);
  const finish=level.finalRoute.at(-1).target;
  assert.ok(finish[1]>=48,'The original ground level is not the finish');
  assert.ok(game.floors.some(f=>f.y===finish[1]&&f.minX<finish[0]&&f.maxX>finish[0]
   &&f.minZ<finish[2]&&f.maxZ>finish[2]),'The elevated finish has a real supporting floor');
  assert.equal(level.isWon(),false);
  const route=towerCrownRoute();
  assert.equal(route.filter(a=>a.kind==='floorEnter').length,2);
  assert.equal(route.filter(a=>a.kind==='shoot').length,4);
  assert.equal(route.filter(a=>a.kind==='pickup').length,2);
  assert.equal(level.getTowerMetrics().crownCrossings,0);
  game.resetRun(true);
  assert.equal(level.getTowerMetrics().crownCrossings,0);
 }finally{game.firstLevel.dispose();game.physics.dispose();game.portals.dispose();}
});
