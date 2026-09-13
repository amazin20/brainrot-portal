import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHeadlessGame} from './lab-headless.mjs';
import {runV8Journey} from '../src/game/LabV8Journey.js';
import {runRoom21} from '../src/game/LabRoom21Journey.js';
const g=await createHeadlessGame();await g.selectLevel(20,false);
g.renderer={domElement:{requestPointerLock(){}}};
const options=JSON.parse(process.argv[2]||'{}');
try{
 const report=await runV8Journey(g,{onMilestone:m=>console.log(m.name,m.player.map(x=>+x.toFixed(3)),m.cargo.map(x=>+x.toFixed(3))),scenario:async d=>runRoom21(d,options)});
 assert.equal(g.state,'won');assert.equal(report.resets,0);assert.equal(report.respawns,0);
 report.kind='complete ordinary route';report.options=options;report.simulationSeconds=report.frames/60;
 fs.mkdirSync('qa/w03',{recursive:true});fs.writeFileSync(`qa/w03/${options.order||'cargo-first'}${options.interrupt?'-pause':''}${options.recovery?'-recovery':''}${options.eraseInFlight?'-erase':''}${options.offsetX?'-offset'+options.offsetX:''}${options.approach?'-pace'+options.approach:''}.json`,JSON.stringify(report,null,2));
 console.log('PASS',report.frames,report.simulationSeconds);
}finally{g.physics.dispose();g.portals.dispose();}
