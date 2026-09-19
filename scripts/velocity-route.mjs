// Real uploaded assets + production physics, companion and portal projectiles.
// Rendering evidence is recorded separately by velocity-browser.mjs.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHeadlessGame} from './lab-headless.mjs';
import {runVelocityJourney} from '../src/game/LabVelocityEvidence.js';
const game=await createHeadlessGame();game.epicMode=true;
const report={pass:false,chapters:[],recovery:null};
try{
 for(const chapter of [1,2]){
  game.velocityChapter=chapter;await game.selectLevel(0,true);
  const route=await runVelocityJourney(game,{renderFps:30});
  assert.equal(route.teleports,chapter===1?3:4);assert.equal(route.companionFinishedTogether,true);
  assert.ok(route.requests.every(shot=>shot.aimDegrees>3.8),'The route must tolerate visibly coarse aim');
  report.chapters.push(route);
 }
 game.velocityChapter=1;await game.selectLevel(0,true);
 report.recovery=await runVelocityJourney(game,{renderFps:30,retryCheckpoint:true,missAtCheckpoint:true,forgetFirstExit:true});
 assert.deepEqual(report.recovery.retries.map(r=>r.kind),['unlinked-intake','manual','missed-route']);
 assert.equal(report.recovery.teleports,3);assert.equal(report.recovery.companionFinishedTogether,true);
 report.pass=true;fs.mkdirSync('qa',{recursive:true});fs.writeFileSync('qa/velocity-route.json',JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify({pass:true,chapters:report.chapters.map(r=>({chapter:r.chapter,seconds:r.seconds,
  peakSpeed:r.peakSpeed,teleports:r.teleports,companionFinishedTogether:r.companionFinishedTogether})),
  recovery:{pass:true,retries:report.recovery.retries.map(r=>r.kind),seconds:report.recovery.seconds}},null,2));
}finally{game.velocityCompanion?.dispose();game.physics.dispose();game.portals.dispose();}
