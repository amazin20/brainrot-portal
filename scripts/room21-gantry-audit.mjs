import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHeadlessGame} from './lab-headless.mjs';
import {runRoom21GantryAttempt} from './room21-gantry-attempt.mjs';
const game=await createHeadlessGame();await game.selectLevel(20,false);
const cases=[];
try {
  for(const startZ of [18,19.7,21.5])for(const startX of [-21.3,-21.85]) {
    const result=await runRoom21GantryAttempt(game,{startX,startZ});
    const pass=!result.bypass&&result.recovered&&result.route.resets===0&&result.route.respawns===0
      &&result.sourceLatched===false&&result.bridge===0&&result.route.teleports===0;
    cases.push({...result,pass});console.log(JSON.stringify({startX,startZ,pass,landing:result.landing}));
  }
  assert.ok(cases.every(c=>c.pass),'One of the declared ordinary jump routes bypassed or failed recovery');
}finally {
  const out=process.env.EVIDENCE_OUT||'qa/room21-gantry';fs.mkdirSync(out,{recursive:true});
  fs.writeFileSync(`${out}/audit.json`,JSON.stringify({scope:'Six finite ordinary-input jump attempts plus walking recovery. Not exhaustive reachability or a browser visual test.',cases,pass:cases.length===6&&cases.every(c=>c.pass)},null,2));
  game.physics.dispose();game.portals.dispose();
}
