/** Route evidence for every selectable chamber. Run with Node after `npm ci`.
 * The driver moves, interacts and fires through production game controls;
 * headless simulation cannot substitute for a browser playtest. */
import assert from 'node:assert/strict';
import {renameSync,writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHeadlessGame} from './lab-headless.mjs';
import {CAMPAIGN,campaignSpec} from '../src/game/LabCampaignLevels.js';
import {FOUNDATION_INDICES} from '../src/game/LabFoundationEdition.js';
import {OPEN_ROOM_INDICES} from '../src/game/LabOpenEdition.js';
import {runV8Journey} from '../src/game/LabV8Journey.js';

const editions=['foundation','classic','open'];
const foundationAlternates=Object.fromEntries(FOUNDATION_INDICES.filter(i=>i<5).map(i=>[i+1,[
 {name:'alternate',options:{alternate:true},source:'tests/lab-foundation.test.js'},
 ...([0,1,2,3,4].includes(i)?[{name:'recovery',kind:'recovery',options:{recover:true},source:i===3?'tests/lab-foundation-fourth-order.test.js':i===1?'src/game/LabFoundationJourney.js':'tests/lab-foundation.test.js'}]:[]),
]]));
// Tested completion options and explicit new QA recovery attempts appear here.
// Missing entries remain visible as gaps; they do not silently become PASS.
const classicAlternates={
 1:[{name:'trench-drop',options:{route:'trench-drop'},source:'tests/lab-introductory-causal-routes.test.js'}],
 2:[{name:'cargo-first-vent',options:{route:'cargo-first-vent'},source:'tests/lab-classic-2-3-5-causal.test.js'}],
 3:[{name:'send-friend-first',options:{route:'send-friend-first'},source:'tests/lab-classic-2-3-5-causal.test.js'}],
 4:[{name:'ride-lift',options:{route:'ride-lift'},source:'tests/lab-introductory-causal-routes.test.js'}],
 5:[{name:'roof-drop',options:{route:'roof-drop'},source:'tests/lab-classic-2-3-5-causal.test.js'}],
 6:[{name:'light-first',options:{order:'light-first'},source:'tests/lab-extended-alternatives.test.js'}],
 7:[{name:'braked-return',options:{order:'braked-return'},source:'tests/lab-extended-alternatives.test.js'},
  {name:'load-first',kind:'preparation',options:{order:'load-first'},source:'tests/lab-extended-alternatives.test.js'}],
 8:[{name:'wind-through',options:{order:'wind-through'},source:'tests/lab-extended-alternatives.test.js'},
  {name:'air-first',kind:'preparation',options:{order:'air-first'},source:'tests/lab-extended-alternatives.test.js'}],
 9:[{name:'carried-front-drop',options:{route:'carried-front-drop'},source:'tests/lab-workshop-room-routes.test.js'}],
 10:[{name:'cargo-chute',options:{route:'cargo-chute'},source:'tests/lab-workshop-alternative-feed.test.js'}],
 11:[{name:'turntable-air',options:{route:'turntable-air'},source:'tests/lab-wind-alternatives.test.js'}],
 12:[{name:'remote-freight',options:{order:'remote-freight'},source:'tests/lab-rooms12-14-causal-routes.test.js'},
  {name:'scout-first',kind:'exploration',options:{order:'scout-first'},source:'tests/lab-portal-room12.test.js',module:'../src/game/LabRoom12Journey.js',exportName:'runRoom12'}],
 13:[{name:'north-with-companion',options:{order:'north-with-companion'},source:'tests/lab-rooms12-14-causal-routes.test.js'},
  {name:'scout-first',kind:'exploration',options:{order:'scout-first'},source:'tests/lab-room13.test.js'},
  {name:'power-interruption',kind:'recovery',options:{interruptPower:true},source:'tests/lab-room13.test.js'}],
 14:[{name:'remote-companion',options:{order:'remote-companion'},source:'tests/lab-rooms12-14-causal-routes.test.js'},
  {name:'scout-first',kind:'exploration',options:{order:'scout-first'},source:'tests/lab-room14-light-bridge.test.js'}],
 15:[{name:'carry-crossing',options:{order:'carry-crossing'},source:'tests/lab-room15-carry-crossing.test.js'},
  {name:'scout-first',kind:'exploration',options:{order:'scout-first'},source:'tests/lab-room15-journey.test.js'}],
 16:[{name:'staged-portal',options:{order:'staged-portal'},source:'tests/lab-room16-alternate.test.js'},
  {name:'scout-first',kind:'exploration',options:{order:'scout-first',supportPause:20},source:'tests/lab-room16-journey.test.js'}],
 17:[{name:'cargo-first-momentum',options:{route:'cargo-first-momentum'},source:'tests/lab-room17-alternate.test.js'},
  {name:'scout-first',kind:'exploration',exercisesRecovery:true,options:{order:'scout-first',interruptBrake:true},source:'tests/lab-room17.test.js'}],
 18:[{name:'send-ahead',options:{order:'send-ahead'},source:'tests/lab-room18-send-ahead.test.js'},
  {name:'direct-turn',options:{order:'direct-turn'},source:'tests/lab-room18-direct-turn.test.js'},
  {name:'retrieve-first',kind:'preparation',options:{order:'retrieve-first'},source:'tests/lab-late-causal-routes.test.js'},
  {name:'delayed-shot',kind:'timing',options:{aimDelayFrames:12},source:'tests/lab-room18.test.js'}],
 19:[{name:'cargo-first-return',options:{order:'cargo-first'},source:'tests/lab-room19-journey.test.js'},
  {name:'light-interruption',kind:'recovery',options:{interruptLight:true,coastDelay:30},source:'tests/lab-room19-journey.test.js'}],
 20:[{name:'early-return',options:{route:'early-return'},source:'tests/lab-room20-journey.test.js'},
  {name:'scout-first',kind:'exploration',options:{order:'scout-first'},source:'tests/lab-room20-journey.test.js'},
  {name:'power-interruption',kind:'recovery',options:{interruptPower:true},source:'tests/lab-room20-journey.test.js'}],
 21:[{name:'service-car',options:{route:'service-car'},source:'tests/lab-room21.test.js'},
  {name:'brake-first',kind:'preparation',options:{order:'brake-first'},source:'tests/lab-room21.test.js'},
  {name:'erased-pair-recovery',kind:'recovery',options:{recovery:true},source:'tests/lab-room21.test.js'}],
 22:[{name:'send-freight-first',options:{order:'send-freight-first'},source:'tests/lab-room22-send-first.test.js'},
  {name:'portal-first',kind:'preparation',options:{order:'portal-first'},source:'tests/lab-room22-23.test.js'},
  {name:'cargo-recovery',kind:'recovery',options:{recovery:true},source:'tests/lab-room22-23.test.js'}],
 23:[{name:'coupled-west-first',options:{order:'coupled-west-first'},source:'tests/lab-room23-coupling-alternate.test.js'},
  {name:'floor-first',kind:'preparation',options:{order:'floor-first'},source:'tests/lab-room22-23.test.js'},
  {name:'cargo-recovery',kind:'recovery',options:{recovery:true},source:'tests/lab-room22-23.test.js'}],
 24:[{name:'counterweight',options:{route:'counterweight'},source:'tests/lab-room24-garden.test.js'},
  {name:'lower-court-recovery',kind:'recovery',options:{route:'carry-through',recovery:'ground-return'},source:'tests/lab-room24-garden.test.js'}],
 25:[{name:'receiver-hoist',options:{order:'receiver-hoist'},source:'tests/lab-causal-routes-25-29.test.js'},
  {name:'light-first',kind:'preparation',exercisesRecovery:true,options:{order:'light-first',interruptLight:true},source:'tests/lab-room25-optics.test.js'}],
 26:[{name:'air-freight',options:{route:'air-freight'},source:'tests/lab-room26-air-freight.test.js'},
  {name:'reverse-first',kind:'preparation',options:{route:'reverse-first'},source:'tests/lab-late-causal-routes.test.js'},
  {name:'recover-first-fall',kind:'recovery',options:{firstFall:true,reverse:true},source:'tests/lab-room26.test.js'}],
 27:[{name:'gravity-return',options:{gravityReturn:true},source:'tests/lab-room27.test.js'},
  {name:'missed-first-landing',kind:'recovery',options:{recoverFirst:true,inspectEastFirst:true},source:'tests/lab-room27.test.js'}],
 28:[{name:'full-tide-observatory',options:{route:'full-tide-observatory'},source:'tests/lab-room28-tides.test.js'},
  {name:'recover-fall',kind:'recovery',options:{recoverFall:true},source:'tests/lab-room28-tides.test.js'}],
 29:[{name:'garden-catch',options:{gardenCatch:true},source:'tests/lab-causal-routes-25-29.test.js'},
  {name:'undercroft-recovery',kind:'recovery',options:{recover:true,undercroft:true},source:'tests/lab-room29.test.js'}],
 30:[{name:'east-arc',options:{east:true},source:'tests/lab-room30.test.js'},
  {name:'east-arc-recovery',kind:'recovery',options:{east:true,recovery:true},source:'tests/lab-room30.test.js'}],
 31:[{name:'island-freight',options:{route:'island-freight'},source:'tests/lab-research31-island-freight.test.js'},
  {name:'scout-first',kind:'exploration',exercisesRecovery:true,options:{route:'scout-first',recover:true},source:'tests/lab-research-chapter.test.js',borrowedFrom:'open edition'}],
 32:[{name:'stored-energy',options:{route:'stored-energy'},source:'tests/lab-research-chapter.test.js',borrowedFrom:'open edition'},
  {name:'recall-recovery',kind:'recovery',options:{recover:true},source:'tests/lab-research-chapter.test.js',borrowedFrom:'open edition'}],
 33:[{name:'companion-first',options:{route:'companion-first'},source:'tests/lab-late-causal-routes.test.js'},
  {name:'recovery',kind:'recovery',options:{recover:true},source:'tests/lab-research-chapter.test.js',borrowedFrom:'open edition'}],
};
// The new campaign reuses the archive builders for rooms 6–30. Keep their
// tested input routes without extending the five foundation-specific routes.
for(let n=6;n<=30;n++)if(classicAlternates[n])foundationAlternates[n]=classicAlternates[n];
const openAlternates={
 24:[{name:'ride-first',options:{route:'ride-first'},source:'src/game/LabOpenJourney.js'},
  {name:'ride-first-recovery',kind:'recovery',options:{route:'ride-first',recover:true},source:'tests/lab-open-chambers.test.js'}],
 28:[{name:'full-east',options:{route:'full-east'},source:'src/game/LabOpenJourney.js'},
  {name:'full-east-interruption',kind:'recovery',options:{route:'full-east',interrupt:true},source:'tests/lab-open-chambers.test.js'}],
 30:[{name:'ceiling-descent',options:{route:'ceiling-descent'},source:'tests/lab-open-launch-ceiling-route.test.js'}],
 31:classicAlternates[31],32:classicAlternates[32],33:classicAlternates[33],
};
const alternativeMaps={foundation:foundationAlternates,classic:classicAlternates,open:openAlternates};

function parseArgs(argv){
 const opts={edition:'all',levels:null,canonicalOnly:false,kind:'all',json:null};
 for(const arg of argv){
  if(arg==='--canonical-only')opts.canonicalOnly=true;
  else if(arg.startsWith('--kind='))opts.kind=arg.slice('--kind='.length);
  else if(arg.startsWith('--edition='))opts.edition=arg.slice('--edition='.length);
  else if(arg.startsWith('--levels=')){
   const value=arg.slice('--levels='.length);
   opts.levels=new Set(value.split(',').flatMap(token=>{
    const match=/^(\d+)-(\d+)$/.exec(token);
    if(match){assert.ok(Number(match[1])<=Number(match[2]),`Descending level range: ${token}`);return Array.from({length:Number(match[2])-Number(match[1])+1},(_,i)=>Number(match[1])+i);}
    return [Number(token)];
   }));
   assert.ok([...opts.levels].every(n=>Number.isInteger(n)&&n>=1&&n<=CAMPAIGN.length),'--levels must be a comma-separated set of 1–33 or ranges');
  }else if(arg.startsWith('--json='))opts.json=arg.slice('--json='.length);
  else throw new Error(`Unknown argument ${arg}`);
 }
 assert.ok(opts.edition==='all'||editions.includes(opts.edition),'--edition must be all, foundation, classic or open');
 assert.ok(['all','canonical','alternate','preparation','exploration','bypass','recovery','timing'].includes(opts.kind),'--kind must be all, canonical, alternate, preparation, exploration, bypass, recovery or timing');
 assert.ok(!opts.canonicalOnly||opts.kind==='all','--canonical-only cannot be combined with --kind');
 assert.ok(!opts.json||!opts.json.startsWith('-'),'--json requires a file path');
 return opts;
}

async function main(){
 const opts=parseArgs(process.argv.slice(2));
 const selected=opts.edition==='all'?editions:[opts.edition];
 const indices={foundation:FOUNDATION_INDICES,classic:CAMPAIGN.map((_,i)=>i),open:OPEN_ROOM_INDICES};
 assert.ok(selected.some(edition=>indices[edition].some(index=>!opts.levels||opts.levels.has(index+1))),
  'No selectable levels match the requested edition and --levels');
 const game=await createHeadlessGame();
 const rows=[],gaps=[];
 const save=(report)=>{
  if(!opts.json)return;
  const temporary=`${opts.json}.tmp-${process.pid}`;
  writeFileSync(temporary,JSON.stringify(report,null,2)+'\n');
  renameSync(temporary,opts.json);
 };
 try{
  for(const edition of selected){
   for(const index of indices[edition]){
    const level=index+1;
    if(opts.levels&&!opts.levels.has(level))continue;
    const variants=alternativeMaps[edition][level]??[];
    if(!variants.some(route=>!route.kind||route.kind==='alternate'))gaps.push({edition,level,kind:'no established distinct puzzle-solving route'});
    const routes=[{name:'canonical',source:'src/game/LabV8Journey.js',options:{}},...variants];
    for(const route of routes.filter(route=>opts.canonicalOnly?route.name==='canonical':opts.kind==='all'||(route.kind??(route.name==='canonical'?'canonical':'alternate'))===opts.kind)){
     const row={edition,level,route:route.name,kind:route.kind??(route.name==='canonical'?'canonical':'alternate'),source:route.source,options:route.options,pass:false};
     if(route.borrowedFrom&&edition==='classic')row.borrowedFrom=route.borrowedFrom;
     if(route.exercisesRecovery)row.exercisesRecovery=true;
     const started=performance.now();
     try{
      game.chamberEdition=edition;
      await game.selectLevel(index,false);
      game.camera.aspect=16/9;game.camera.updateProjectionMatrix();
      const expected=campaignSpec(game,index),companion=game.cargo,group=game.cargo.group,body=game.physics.cargoBody;
      const scenario=route.module?async d=>{
       const fn=(await import(route.module))[route.exportName];
       await fn(d,route.options);
      }:null;
      const report=await runV8Journey(game,{journeyOptions:route.options,scenario});
      assert.equal(report.pass,true,'route driver did not finish');
      // runV8Journey reports scenario PASS for diagnostic probes too; the real
      // win and original actor identities are essential completion evidence.
      assert.equal(game.state,'won','route did not win the actual level');
      assert.equal(report.level,level);
      assert.equal(report.id,expected.id);
      assert.equal(report.resets,0,'companion reset');
      assert.equal(report.respawns,0,'player respawn');
      assert.equal(game.cargo,companion,'companion was replaced');
      assert.equal(game.cargo.group,group,'companion mesh was replaced');
      assert.equal(game.physics.cargoBody,body,'companion physics body was replaced');
      Object.assign(row,{pass:true,id:report.id,frames:report.frames,teleports:report.teleports,milestones:report.milestones});
     }catch(error){row.error=error?.stack??String(error);}
     row.seconds=Number(((performance.now()-started)/1000).toFixed(2));rows.push(row);
     console.log(`${row.pass?'PASS':'FAIL'} ${edition.padEnd(10)} ${String(level).padStart(2)} ${route.name.padEnd(24)} ${row.seconds}s${row.pass?'':` — ${row.error.split('\n')[0]}`}`);
     save({incomplete:true,generatedAt:new Date().toISOString(),edition:opts.edition,
      canonicalOnly:opts.canonicalOnly,kind:opts.kind,
      summary:{pass:rows.filter(r=>r.pass).length,fail:rows.filter(r=>!r.pass).length,total:rows.length},rows,gaps});
    }
   }
  }
 }finally{game.physics.dispose();game.portals.dispose();}
 assert.ok(rows.length,'No route matches the requested edition, levels and kind');
 const summary={pass:rows.filter(r=>r.pass).length,fail:rows.filter(r=>!r.pass).length,total:rows.length};
 const git=()=>{try{return {commit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),dirty:!!execFileSync('git',['status','--porcelain'],{encoding:'utf8'}).trim()};}catch{return {commit:process.env.GITHUB_SHA??null,dirty:null};}};
 const output={generatedAt:new Date().toISOString(),...git(),edition:opts.edition,canonicalOnly:opts.canonicalOnly,kind:opts.kind,summary,rows,gaps,limitations:[
  'Headless physics and scripted production inputs cannot verify visibility, usability, aesthetics, performance or human discoverability.',
  'One successful path and one scripted alternative do not prove every possible route avoids softlocks or shortcuts.',
  'The default foundation campaign exposes rooms 1–30; classic 1–33 and open review 24, 28, 30–33 require an explicit edition.',
 ]};
 save(output);
 console.log(`Routes: ${summary.pass}/${summary.total} passed, ${summary.fail} failed; distinct-solution evidence gaps: ${gaps.length}.`);
 if(opts.json)console.log(`JSON: ${opts.json}`);
 if(summary.fail)process.exitCode=1;
}

main().catch(error=>{console.error(error);process.exitCode=1;});
