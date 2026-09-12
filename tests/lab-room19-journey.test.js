import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import {createHeadlessGame} from '../scripts/lab-headless.mjs';
import {runV8Journey} from '../src/game/LabV8Journey.js';
import {runRoom19} from '../src/game/LabRoom19Journey.js';
const game=await createHeadlessGame();after(()=>{game.physics.dispose();game.portals.dispose();});
for(const [name,aspect,options] of [['normal',16/9,{}],['light interruption and thirty-second coast',1.6,{interruptLight:true,coastDelay:30}],['cargo-first return loop',16/9,{order:'cargo-first'}]])test(`room19 ${name} carries the original cargo through glass, air and stored inertia using real controls`,async()=>{
 await game.selectLevel(18,false);game.camera.aspect=aspect;game.camera.updateProjectionMatrix();const body=game.physics.cargoBody;
 const report=await runV8Journey(game,{scenario:d=>runRoom19(d,options)});
 assert.equal(game.state,'won');assert.equal(report.resets+report.respawns,0);assert.equal(game.physics.cargoBody,body);assert.ok(game.physics.portalTransports>0);
 const s=game.firstLevel.state;assert.equal(s.inertia.power,options.order==='cargo-first');assert.equal(s.optical.lit,false);assert.ok(s.inertia.travelWork>100);assert.ok(s['inertial-ferry'].progress>.995);
 const names=report.milestones.map(m=>m.name);for(const n of ['light crosses the sealed chamber','air takes the open duct','inertia carries the return'])assert.ok(names.includes(n));
 assert.ok(report.milestones.find(m=>m.name==='inertia carries the return').cargo[1]>8);
});
