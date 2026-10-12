import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {SINGULARITY_ROOMS} from '../src/game/LabSingularityLayout.js';
import {assertUpgradeInfo,assertUpgradeEvidence} from '../scripts/lib/singularity-upgrade-proof.mjs';
import {parseTap,verifyRuntimeModels} from '../scripts/qa-tower41-next-cell-source.mjs';

const rooms=SINGULARITY_ROOMS.map(({id,name,rule,requires})=>({id,name,rule,requires:[...requires]}));
function current(){return {commit:process.env.BUILD_COMMIT||'a'.repeat(40),version:'v54-unified-campaign',artVersion:'v54-unified-campaign',levels:51,edition:'foundation',features:{tower:{level:41,stages:11,checkpoints:false},foundation:{rooms:Array.from({length:51},(_,i)=>i+1)}}};}
function legacy(){const info=current();info.version=info.artVersion='v49-manufactured-light';info.levels=41;info.features.foundation.rooms=Array.from({length:41},(_,i)=>i+1);Object.assign(info.features.tower,{rooms,uniqueRules:11,independentHalls:rooms.filter(r=>r.requires.length===0).length});return info;}
test('unified native metadata checks the current frozen definitions without changing stamped metadata',()=>{
 const info=current(),original=structuredClone(info),verified=assertUpgradeInfo(info,SINGULARITY_ROOMS);
 assert.deepEqual(info,original);assert.deepEqual(verified.rooms,rooms);assert.equal(verified.definitionOrigin,'frozen-source');
 for(const mutate of [i=>i.levels=41,i=>i.artVersion='v49-manufactured-light',i=>i.edition='archive',i=>i.features.tower.stages=500,i=>i.features.tower.checkpoints=true,i=>i.features.foundation.rooms.pop(),i=>i.features.tower.rooms=[...rooms].reverse()]){const bad=current();mutate(bad);assert.throws(()=>assertUpgradeInfo(bad));}
});
test('historical v49 native metadata retains its separate embedded-definition contract',()=>{
 assert.deepEqual(assertUpgradeInfo(legacy(),SINGULARITY_ROOMS).rooms,rooms);const bad=legacy();delete bad.features.tower.rooms;assert.throws(()=>assertUpgradeInfo(bad));
});
test('unified whole-castle evidence rejects missing mechanisms, wrong rules, replaced cargo and resets',()=>{
 const info=current(),proof={sourceCommit:info.commit,version:info.version,result:{pass:true,metrics:{won:true,completedStages:11,solvedIds:rooms.map(r=>r.id),checkpoints:false},resets:0,respawns:0,cargoResets:0,sameCompanion:true,activeSeconds:1},observed:{events:rooms.map(({id,rule})=>({id,rule})),seenResets:0},errors:[]};
 assert.equal(assertUpgradeEvidence(proof,info).stages,11);
 for(const mutate of [p=>p.observed.events.pop(),p=>p.observed.events[0].rule='fake',p=>p.result.sameCompanion=false,p=>p.result.cargoResets=1,p=>p.observed.seenResets=1]){const bad=structuredClone(proof);mutate(bad);assert.throws(()=>assertUpgradeEvidence(bad,info));}
});
test('review TAP receipt uses actual positive totals and rejects incomplete, duplicate or unhealthy footers',()=>{
 const footer='# tests 1719\n# pass 1719\n# fail 0\n# cancelled 0\n# skipped 0\n# todo 0\n';
 assert.deepEqual(parseTap(footer),{tests:1719,pass:1719,fail:0,cancelled:0,skipped:0,todo:0});
 for(const log of [footer+footer,footer.replace('# pass 1719','# pass 1718'),footer.replace('# fail 0','# fail 1'),footer.replace('# skipped 0','# skipped 1'),footer.replace('# todo 0','# todo 1'),footer.replace('# cancelled 0','# cancelled 1'),footer.replaceAll('1719','0'),footer.replace('# todo 0\n','')])assert.throws(()=>parseTap(log));
});
test('captured compact production manifest retains the fourteen original runtime GLBs and rejects replaced bytes or records',()=>{
 // This fixture is the real Vite production manifest, captured unchanged from
 // dist. Its source catalogue contains authoring audit fields and more assets.
 const sourceBytes=fs.readFileSync(new URL('../public/models/runtime/manifest.json',import.meta.url)),productionBytes=fs.readFileSync(new URL('fixtures/tower41-runtime-production-manifest.json',import.meta.url));
 const readOriginal=filename=>fs.readFileSync(new URL('../public/models/runtime/'+filename,import.meta.url));
 const input={sourceBytes,productionBytes,readOriginal,readProduction:readOriginal},receipt=verifyRuntimeModels(input);
 assert.equal(receipt.canonicalRecords.length,14);assert.notEqual(receipt.sourceManifestSha256,receipt.productionManifestSha256);
 assert.throws(()=>verifyRuntimeModels({...input,readProduction:filename=>{const bytes=readOriginal(filename);if(filename==='model-02-cargo.glb')bytes[bytes.length-1]^=1;return bytes;}}),/Original runtime model bytes/);
 const replaced=JSON.parse(productionBytes);replaced.models.find(m=>m.id===2).outputSHA256='f'.repeat(64);
 assert.throws(()=>verifyRuntimeModels({...input,productionBytes:Buffer.from(JSON.stringify(replaced))}),/replaced an original model record/);
});
