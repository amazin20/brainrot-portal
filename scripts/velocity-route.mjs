// Real assets + production physics, controls and timed portal projectiles.
// This is simulation evidence; WebGL images are recorded separately.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHeadlessGame} from './lab-headless.mjs';
import {runVelocityJourney} from '../src/game/LabVelocityEvidence.js';
const game=await createHeadlessGame();game.epicMode=true;
await game.selectLevel(0,true);
try{
 const report=await runVelocityJourney(game);
 // R must not inherit a tilted portal frame from the finishing camera yaw.
 game.yaw=1.7;game.pitch=.6;
 const repeated=await runVelocityJourney(game);
 assert.equal(repeated.airborneShots,4);
 assert.ok(Math.abs(repeated.seconds-report.seconds)<1/120+.0001,'Restart changed route timing');
 report.restart={pass:true,seconds:repeated.seconds,peakSpeed:repeated.peakSpeed};
 fs.mkdirSync('qa',{recursive:true});fs.writeFileSync('qa/velocity-route.json',JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify({pass:report.pass,seconds:report.seconds,peakSpeed:report.peakSpeed,teleports:report.teleports,airborneShots:report.airborneShots,restart:report.restart},null,2));
}finally{game.physics.dispose();game.portals.dispose();}
