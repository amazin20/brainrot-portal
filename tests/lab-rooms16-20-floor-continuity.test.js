import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import {createHeadlessGame} from '../scripts/lab-headless.mjs';
import {runV8Journey} from '../src/game/LabV8Journey.js';

const game=await createHeadlessGame();
after(()=>{game.physics.dispose();game.portals.dispose();});

for(const [room,index] of [[16,15],[20,19]]){
 test(`room ${room} has no coincident ordinary walking tiles`,async()=>{
  game.chamberEdition='foundation';await game.selectLevel(index,false);
  const floors=game.firstLevel.world.surfaces.filter(surface=>surface.floor&&!surface.portal);
  for(let i=0;i<floors.length;i++)for(let j=i+1;j<floors.length;j++){
   const a=floors[i].floor,b=floors[j].floor;
   if(Math.abs(a.y-b.y)>1e-6)continue;
   const width=Math.min(a.maxX,b.maxX)-Math.max(a.minX,b.minX);
   const depth=Math.min(a.maxZ,b.maxZ)-Math.max(a.minZ,b.minZ);
   assert.ok(width<=1e-6||depth<=1e-6,
    `${floors[i].name} overlaps ${floors[j].name} at y=${a.y} by ${width} × ${depth} m`);
  }
 });
}

for(const edition of ['foundation','classic'])for(const [room,index,options] of [
 [16,15,{order:'cargo-first'}],
 [16,15,{order:'staged-portal'}],
 [20,19,{route:'middle-cage'}],
 [20,19,{route:'early-return'}],
])test(`${edition} room ${room} ${Object.values(options)[0]} still completes with original cargo`,async()=>{
 game.chamberEdition=edition;await game.selectLevel(index,false);
 const group=game.cargo.group,body=game.physics.cargoBody;
 const report=await runV8Journey(game,{journeyOptions:options});
 assert.equal(report.pass,true);
 assert.equal(game.state,'won');
 assert.equal(report.resets,0);
 assert.equal(report.respawns,0);
 assert.equal(game.cargo.group,group);
 assert.equal(game.physics.cargoBody,body);
});
