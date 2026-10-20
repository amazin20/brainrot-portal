import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';

const part=Number(process.env.CPU_PART),parts=Number(process.env.CPU_PARTS||6);
assert.ok(Number.isInteger(parts)&&parts>=1&&parts<=32,'CPU_PARTS must be between 1 and 32');
assert.ok(Number.isInteger(part)&&part>=0&&part<parts);
const all=fs.readdirSync('tests').filter(n=>n.endsWith('.test.js')&&!n.startsWith('lab-tower')).sort();
const files=all.filter((_,i)=>i%parts===part).map(name=>'tests/'+name);
assert.ok(files.length);const out=`qa/cpu-${part}`;fs.mkdirSync(out,{recursive:true});
const log=fs.createWriteStream(path.join(out,'full.tap'));let footer='';
console.log('CPU PART',part,'OF',parts,'FILES',files.length,'SOURCE',process.env.BUILD_COMMIT);
const child=spawn(process.execPath,['--max-old-space-size=1024','--test','--test-reporter=tap','--test-concurrency=2',...files],{stdio:['ignore','pipe','pipe']});
for(const stream of [child.stdout,child.stderr])stream.on('data',chunk=>{log.write(chunk);process.stdout.write(chunk);footer=(footer+chunk.toString()).slice(-16000);});
const exit=await new Promise((resolve,reject)=>{child.on('error',reject);child.on('close',(code,signal)=>resolve({code,signal}));});
await new Promise(resolve=>log.end(resolve));
const metric=key=>Number([...footer.matchAll(new RegExp('^# '+key+' (\\d+)$','gm'))].at(-1)?.[1]);
const counts=Object.fromEntries(['tests','pass','fail','cancelled','skipped','todo'].map(key=>[key,metric(key)]));
const pass=exit.code===0&&exit.signal===null&&counts.tests>0&&counts.pass===counts.tests
 &&['fail','cancelled','skipped','todo'].every(key=>counts[key]===0);
fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({sourceCommit:process.env.BUILD_COMMIT,part,parts,allFiles:all,files,...exit,counts,pass},null,2));
if(!pass)process.exitCode=1;
