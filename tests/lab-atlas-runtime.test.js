import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const main=fs.readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
function harness(){
 const node={classList:{toggle(){}},setAttribute(){},inert:false};const loops=[];
 const context={document:{body:{dataset:{}},documentElement:{dataset:{}}},game:{renderer:{setAnimationLoop:fn=>loops.push(fn)}},$:()=>node,syncActivity(){}};
 const body=main.slice(main.indexOf('function setState(state)'),main.indexOf('\nfunction hold('));
 assert.ok(body.includes('function setState'));vm.createContext(context);vm.runInContext(body,context);return {context,loops};
}
test('Actual ready-screen state function stops hidden WebGL rendering without stopping playing or pause controls',()=>{
 const {context,loops}=harness();context.setState('ready');assert.deepEqual(loops,[null]);assert.equal(context.document.documentElement.dataset.runtimeState,'ready');
 for(const state of ['loading','playing','paused','won'])context.setState(state);assert.equal(loops.length,1);
 context.setState('ready');assert.deepEqual(loops,[null,null]);
});
test('Room construction clears stale percentages; actual asset progress restores its real numeric phase',()=>{
 const entry=main.slice(main.indexOf('async function enterLevel('),main.indexOf('async function restartLevel('));
 assert.match(entry,/dataset\.phase='scene'/);assert.match(entry,/removeAttribute\('aria-valuenow'\)/);assert.match(entry,/loading-percent'\)\.textContent=''/);
 assert.match(main,/onProgress:p=>\{\$\('#loading'\)\.dataset\.phase='assets'/);
 assert.match(entry,/setAnimationLoop\(game\.animate\)/);
});
