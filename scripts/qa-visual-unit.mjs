/** Full active CPU regression. Browser evidence is recorded separately. */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {spawnSync,execFileSync} from 'node:child_process';

const out=path.resolve(process.env.OUT_DIR||'qa/v66-unit');
assert.ok(!fs.existsSync(out)||fs.readdirSync(out).length===0,'Use a fresh regression output directory');
fs.mkdirSync(out,{recursive:true});
const allFiles=fs.readdirSync('tests').filter(name=>name.endsWith('.test.js')&&!name.startsWith('lab-tower')).sort();
const shard={index:Number(process.env.UNIT_SHARD_INDEX||0),count:Number(process.env.UNIT_SHARD_COUNT||1)};
assert.ok(Number.isSafeInteger(shard.count)&&shard.count>=1&&shard.count<=8&&Number.isSafeInteger(shard.index)&&shard.index>=0&&shard.index<shard.count);
const files=allFiles.filter((_,index)=>index%shard.count===shard.index);assert.ok(files.length>0);
const commit=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
assert.equal(execFileSync('git',['status','--porcelain','--untracked-files=no'],{encoding:'utf8'}).trim(),'','Commit exact source before regression evidence');
assert.equal(commit,process.env.BUILD_COMMIT||process.env.GITHUB_SHA||commit);
const result=spawnSync(process.execPath,['--max-old-space-size=1024','--test','--test-reporter=tap','--test-concurrency=2',...files.map(name=>'tests/'+name)],{encoding:'utf8',maxBuffer:128*1024*1024});
fs.writeFileSync(path.join(out,'full.tap'),(result.stdout||'')+(result.stderr||''));
const metric=key=>Number([...(result.stdout||'').matchAll(new RegExp('^# '+key+' (\\d+)$','gm'))].at(-1)?.[1]);
const counts=Object.fromEntries(['tests','pass','fail','cancelled','skipped','todo'].map(key=>[key,metric(key)]));
const pass=result.status===0&&result.signal===null&&counts.tests>0&&counts.pass===counts.tests&&['fail','cancelled','skipped','todo'].every(key=>counts[key]===0);
const report={kind:'full-active-game-regression',pass,sourceCommit:commit,runId:process.env.GITHUB_RUN_ID||null,runAttempt:process.env.GITHUB_RUN_ATTEMPT||null,allFiles,shard,files,counts,exitCode:result.status,signal:result.signal,error:result.error?String(result.error):null,sourceAccepted:false,publicationAccepted:false,scope:'Deterministic file shard of the same complete active test selection as npm test; summary verifies exact union without duplication. Archived lab-tower tests remain excluded by the existing active-suite contract. No failing test is excluded for this review.'};
fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');
process.stdout.write(result.stdout||'');process.stderr.write(result.stderr||'');assert.equal(pass,true,JSON.stringify(report));
