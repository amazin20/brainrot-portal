import assert from 'node:assert/strict';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';

const file='qa/room2-jump-regression.json';
execFileSync(process.execPath,['scripts/qa-unexplored-early.mjs'],{
 env:{...process.env,ROOMS:'2',ATTACK:'',OUT:file},stdio:'inherit',
});
const report=JSON.parse(fs.readFileSync(file));
assert.deepEqual(report.counts,{rooms:1,attacks:8,won:0,errors:0});
assert.equal(report.source.unchanged,true);
for(const trial of report.rooms[0].attacks){
 assert.equal(trial.sameIdentity,true,trial.name);
 assert.equal(trial.journeyResets,0,trial.name);
 assert.equal(trial.journeyRespawns,0,trial.name);
 assert.ok(trial.frames>0,trial.name);
 assert.equal(trial.evidence.resetEvents.filter(e=>e.scenarioStarted).length,0,trial.name);
}
console.log('Eight recorded room2 jump timings remain blocked with the original cargo.');
