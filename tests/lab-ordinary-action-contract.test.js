import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHeadlessGame} from '../scripts/lab-headless.mjs';
import {runV8Journey} from '../src/game/LabV8Journey.js';

test('ordinary journey proofs never call the unavailable pair deletion command',()=>{
 const directory=new URL('../src/game/',import.meta.url);
 const files=fs.readdirSync(directory).filter(name=>/Journey.*\.js$/.test(name));
 assert.ok(files.length>30,'The complete ordinary route catalogue must be checked');
 for(const filename of files){
  const source=fs.readFileSync(new URL(filename,directory),'utf8');
  assert.doesNotMatch(source,/\.clearPortals\s*\(/,filename+' invokes an action absent from desktop and touch controls');
 }
});

test('active finite attacks never call an unavailable player deletion command',()=>{
 for(const filename of ['qa-speedrun-late-new.mjs','qa-speedrun-expansion-new.mjs']){
  const source=fs.readFileSync(new URL('../scripts/'+filename,import.meta.url),'utf8');
  assert.doesNotMatch(source,/\.clearPortals\s*\(/,filename+' must use real charged retargeting or preserve the current pair');
 }
});

let game;
after(()=>{game?.firstLevel?.dispose?.();game?.physics?.dispose();game?.portals?.dispose();});
for(const [level,options] of [[31,{recover:true}],[34,{recover:true}],[48,{alternative:'staged-cargo'}]]){
 test(`${level}: recovery wins using the same cargo while pair deletion is unavailable`,async()=>{
  game??=await createHeadlessGame();game.chamberEdition='foundation';await game.selectLevel(level-1,false);
  const cargo=game.cargo,body=game.physics.cargoBody,clear=game.clearPortals;
  game.clearPortals=()=>{throw Error('Player pair deletion is unavailable');};
  try{
   const report=await runV8Journey(game,{journeyOptions:options});
   assert.equal(report.pass,true);assert.equal(game.state,'won');
   assert.equal(report.resets+report.respawns,0);assert.equal(game.cargo,cargo);assert.equal(game.physics.cargoBody,body);
   if(level===31)assert.ok(game.firstLevel.rack.latched&&game.firstLevel.rack.stroke>12.95);
   if(level===34)assert.ok(report.milestones.some(mark=>mark.name.includes('reversing the actual flow')));
   if(level===48)assert.ok(game.firstLevel.press.pinned&&game.firstLevel.roof.progress>.95);
  }finally{game.clearPortals=clear;}
 });
}
