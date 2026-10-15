import assert from 'node:assert/strict';
import {test} from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {assertSourceProvider,assertFrozenPins,movieChecker} from './publish-campaign-v56.mjs';
import {SHORTCUT_CASES,SEQUENCE} from './lib/campaign-v56-proof.mjs';
const read=file=>JSON.parse(fs.readFileSync(file,'utf8'));
test('source provider includes the exact 24 jobs and 25 artifact producers',()=>{
 const pins=read('tools/campaign-v56-release.json');
 const provider={run:read('provider/source-run.json'),gitCommit:read('provider/source-git.json'),jobs:read('provider/source-jobs.json').jobs,artifacts:read('provider/source-artifacts.json')};
 const result=assertSourceProvider(provider,pins);assert.deepEqual(result.jobs,pins.sourceJobs);assert.deepEqual(result.artifacts,pins.sourceArtifacts);
 const wrong=structuredClone(provider);wrong.artifacts=wrong.artifacts.filter(row=>row.name!=='campaign-polish-yandex');assert.throws(()=>assertSourceProvider(wrong,pins));
 const forged=structuredClone(provider);forged.artifacts.find(row=>row.name==='campaign-polish-yandex').workflow_run.head_sha='0'.repeat(40);assert.throws(()=>assertSourceProvider(forged,pins));
});
test('frozen pins require independently accepted exact source and baseline receipts',()=>{
 const pins=read('tools/campaign-v56-release.json');assertFrozenPins(pins);const wrong=structuredClone(pins);wrong.sourceCommit='0'.repeat(40);assert.throws(()=>assertFrozenPins(wrong));
});
test('campaign preserves all stable IDs and finishes in the castle',()=>{assert.equal(SEQUENCE.length,51);assert.equal(new Set(SEQUENCE).size,51);assert.equal(SEQUENCE.at(-1),41);assert.equal(SHORTCUT_CASES.length,5);});
test('movie semantics stay identical when the same verified payload moves directories',()=>{
 const source=process.env.V56_ANIMATION_FIXTURE;if(!source)return;
 const temporary=fs.mkdtempSync(path.join(os.tmpdir(),'campaign-v56-movie-test-'));
 try{for(const name of ['producer','aggregate']){fs.mkdirSync(path.join(temporary,name));fs.copyFileSync(path.join(source,'free-jump.mp4'),path.join(temporary,name,'free-jump.mp4'));}
 const expected={frames:48,fps:15,width:960,height:540,duration:3.2};
 const a=movieChecker(path.join(temporary,'producer'))('free-jump.mp4',expected),b=movieChecker(path.join(temporary,'aggregate'))('free-jump.mp4',expected);assert.deepEqual(a,b);assert.equal(a.probe.format.filename,'free-jump.mp4');
 }finally{fs.rmSync(temporary,{recursive:true,force:true});}
});
