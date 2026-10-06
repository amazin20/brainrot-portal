import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {createHeadlessGame} from '../scripts/lab-headless.mjs';
import {runV8Journey} from '../src/game/LabV8Journey.js';
import {installRoom21Aim} from '../src/game/LabRoom21Journey.js';
import {brittleSlowCarry,pressEmptySprint,topplingLowManual} from '../scripts/lib/expansion-b-adversarial.mjs';

// Gameplay rules exercised through actual ordinary inputs and the production
// 120 Hz controller/Cannon loop. No actors, portal planes or mechanism states
// are assigned by these tests. Failed setup is not evidence of a puzzle rule.
const dependencies=['LabExpansionRoomsB.js','LabGame.js','LabPhysics.js','LabPortals.js',
 'LabKineticMovement.js','LabPlateContact.js','LabOpenArchitecture.js','LabResearchArt.js',
 'LabWorkshopKit.js','LabPuzzleMechanics.js','LabLateCampaignMechanisms.js'];
const hash=()=>createHash('sha256').update(dependencies.map(file=>file+'\n'+fs.readFileSync(new URL('../src/game/'+file,import.meta.url))).join('\n')).digest('hex');
const report={scope:'Constructive authored 47–51 gameplay regressions from ordinary Play spawn. No actor or mechanism fixtures. B room/controller/physics hashes exclude independent A chapter edits.',dependencies,rows:[]};
const file=new URL('../qa/expansion-b-causal-rules.json',import.meta.url);
function save(){fs.mkdirSync(new URL('../qa/',import.meta.url),{recursive:true});fs.writeFileSync(file,JSON.stringify(report,null,2)+'\n');}
async function record(name,run){const row={name,sourceBefore:hash(),started:new Date().toISOString()};try{row.result=await run();row.pass=true;}catch(error){row.pass=false;row.error=String(error);throw error;}finally{row.sourceAfter=hash();row.sourceStable=row.sourceBefore===row.sourceAfter;row.finished=new Date().toISOString();report.rows.push(row);save();}}

test('47: slow carried and free lower-floor contact leaves the ceramic intact',()=>record('47 slow original companion',brittleSlowCarry));

test('48: the unloaded press completes its stroke and closes the associated door',()=>record('48 empty guided press',pressEmptySprint));

test('49: missing reflection and a real wrong-side load keep the receiver door closed',()=>record('49 physical optical negatives',async()=>{
 const game=await createHeadlessGame();try{
  game.chamberEdition='foundation';await game.selectLevel(48,false);const cargo=game.cargo,body=game.physics.cargoBody;
  const journey=await runV8Journey(game,{scenario:d=>{
   installRoom21Aim(d);const l=d.level;
   d.walk(-12,18);d.aim(0,l.input.getFrame().center);d.aim(1,l.tray.surface.getFrame().center);d.wait(2);
   assert.ok(l.head.segments.some(s=>s.kind==='portal'),'the source ray must traverse the actual floor outlet');
   assert.equal(l.head.segments.some(s=>s.kind==='mirror'),false);assert.equal(l.head.lit,false);assert.ok(l.door.progress<.05);
   d.mark('Actual portal light without a reflected segment leaves the lens dark');
   d.walk(-12,3);d.aim(1,l.outlet.getFrame().center);d.wait(2);
   assert.ok(l.head.segments.some(s=>s.kind==='mirror'),'the actual ray must reach the live mirror');
   assert.ok(l.head.arm<-.3,'the original spawn load must exert the wrong-side lever moment');
   assert.equal(l.head.lit,false);assert.ok(l.door.progress<.05);assert.equal(game.state,'playing');
   assert.equal(game.teleportCount,0);assert.equal(game.physics.portalTransports,0);
   d.mark('Wrong-side original cargo rotates the real mirror away from the receiver');
  }});
  assert.equal(game.cargo,cargo);assert.equal(game.physics.cargoBody,body);assert.equal(journey.resets+journey.respawns,0);
  return {journey,angle:game.firstLevel.head.angle,arm:game.firstLevel.head.arm,door:game.firstLevel.door.progress};
 }finally{game.firstLevel.dispose?.();game.physics.dispose();game.portals.dispose();}
}));

test('50: original cargo at hand height and ordinary jump contacts leave the wall upright',()=>record('50 low physical contact',topplingLowManual));

test('51: one actual distant membrane impact decays without opening the common latch',()=>record('51 no stored serial solution',async()=>{
 const game=await createHeadlessGame();try{
  game.chamberEdition='foundation';await game.selectLevel(50,false);const cargo=game.cargo,body=game.physics.cargoBody;
  const journey=await runV8Journey(game,{scenario:async d=>{
   const {runEchoHorizon}=await import('../src/game/LabEchoHorizonJourney.js');await runEchoHorizon(d,{stopBeforeCoincidence:true});
   const l=d.level;assert.equal(l.field.arrivals.length,1);assert.equal(l.field.arrivals[0].receiver,'long');
   assert.equal(l.coincidence.latched,false);assert.equal(l.coincidence.membranes[0],0);assert.ok(l.door.progress<.01);assert.equal(game.state,'playing');
  }});
  assert.equal(game.cargo,cargo);assert.equal(game.physics.cargoBody,body);assert.equal(journey.resets+journey.respawns,0);
  return {journey,arrivals:game.firstLevel.field.arrivals,latched:game.firstLevel.coincidence.latched};
 }finally{game.firstLevel.dispose?.();game.physics.dispose();game.portals.dispose();}
}));
