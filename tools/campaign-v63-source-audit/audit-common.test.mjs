import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {execFileSync} from 'node:child_process';
import {hash,read,inventory,assertClosedFiles,assertNetwork,assertRewardedUI,assertNegativeChecker} from './audit-common.mjs';

assert.ok(process.env.SOURCE_DIR&&path.isAbsolute(process.env.SOURCE_DIR),'Set SOURCE_DIR to the exact frozen Source Git checkout, independently of Main/auditor location');
const sourceRoot=path.resolve(process.env.SOURCE_DIR),checkerPath='scripts/lib/yandex-debug-checker.mjs';
assert.deepEqual(fs.readFileSync(path.join(sourceRoot,checkerPath)),execFileSync('git',['show','HEAD:'+checkerPath],{cwd:sourceRoot}),'Test only the exact committed Source checker helper');
const {bindOriginalYandexCopiedRows}=await import(pathToFileURL(path.join(sourceRoot,checkerPath)));

function hintProof(){
 const initial={levelIndex:0,state:'paused',runtimeState:'paused',worldStep:10,externalPause:'false',externalBlocked:false,platformBusy:false,adLocks:0,audioContextState:'suspended',audioAudible:false,
  savedRaw:'{"hints":{}}',savedHintCount:0,runtimeHintCount:0,hintsHidden:false,revealedParagraphs:0,unlockDisabled:false,rewardedOpenCount:0,rewardedConfirmedCount:0,duplicateConfirmedCount:0};
 let previous=initial;const transactions=[];
 for(const outcome of ['close','error','reward']){
  const before={...previous},during={...before,externalPause:'true',externalBlocked:true,platformBusy:true,adLocks:1,unlockDisabled:true,rewardedOpenCount:before.rewardedOpenCount+1};
  const after={...before,rewardedOpenCount:during.rewardedOpenCount};
  if(outcome==='reward')Object.assign(after,{savedRaw:'{"hints":{"0":1}}',runtimeHintCount:1,savedHintCount:1,revealedParagraphs:1,rewardedConfirmedCount:1,duplicateConfirmedCount:1});
  transactions.push({outcome,before,during,after});previous=after;
 }
 return{kind:'actual-rewarded-hint-ui-with-explicit-sdk-mock',level:1,liveAds:false,pass:true,before:initial,transactions,reread:{...previous},resumed:{...previous,state:'playing',runtimeState:'playing',audioContextState:'running'}};
}

test('offline reward assertions require actual held pause, close/error preservation, once-only confirmation and reread',()=>{
 assert.equal(assertRewardedUI(hintProof(),1).transactions,3);
 const changes=[p=>p.transactions[0].after.runtimeHintCount=1,p=>p.transactions[1].after.savedRaw='{}',p=>p.transactions[0].during.audioContextState='running',
  p=>p.transactions[2].after.runtimeHintCount=2,p=>p.transactions[2].after.duplicateConfirmedCount=0,p=>p.transactions[2].during.levelIndex=1,
  p=>p.transactions[1].after.worldStep++,p=>p.reread.rewardedOpenCount++,p=>p.resumed.audioContextState='suspended'];
 for(const change of changes){const value=hintProof();change(value);assert.throws(()=>assertRewardedUI(value,1));}
});

test('offline response binding rejects response and package identity mutations',()=>{
 const files=[{path:'index.html',bytes:10,sha256:'a'.repeat(64)},{path:'assets/app.js',bytes:20,sha256:'b'.repeat(64)}],pkg={files,buildInfoBytes:30,buildInfoSha256:'c'.repeat(64)},sdk={kind:'explicit-local-test-sdk',bytes:40,sha256:'d'.repeat(64),liveSdk:false,liveAds:false};
 const responses=[...files.map(row=>({...row,url:'http://127.0.0.1:1234/campaign-v63/'+row.path+'?_dc=1',status:200,fromCache:false,checkerSourceScan:true,mockSdk:false})),{path:'/sdk.js',url:'http://127.0.0.1:1234/sdk.js',status:200,bytes:sdk.bytes,sha256:sdk.sha256,fromCache:false,checkerSourceScan:false,mockSdk:true}];
 const network={kind:'actual-browser-response-body-hashes',allReceivedBytesMatched:true,responses,responseCount:3,totalObservedBytes:70},args={url:'http://127.0.0.1:1234/campaign-v63/?level=1',package:pkg,sdk};
 assert.equal(assertNetwork(network,args),3);
 const model={path:'models/runtime/original.glb',bytes:50,sha256:'e'.repeat(64)};files.push(model);
 network.responses.push({...model,url:'http://127.0.0.1:1234/campaign-v63/'+model.path+'?v='+model.sha256.slice(0,12),status:200,fromCache:false,checkerSourceScan:false,mockSdk:false});network.responseCount++;network.totalObservedBytes+=model.bytes;
 assert.equal(assertNetwork(network,args),4);
 for(const change of [x=>x.responses[0].sha256='e'.repeat(64),x=>x.responses[1].path='outside.js',x=>x.responses[2].mockSdk=false,x=>x.responses[0].url='http://other.test/index.html',x=>x.responses[1].checkerSourceScan=false,x=>x.totalObservedBytes++,x=>x.responses[0].url+='&unverified=1',x=>x.responses[1].url+='&pilot=progression',x=>x.responses[2].url+='?debug=1',x=>x.responses[1].url=x.responses[1].url.replace('_dc=1','_dc=bad')]){
  const value=structuredClone(network);change(value);assert.throws(()=>assertNetwork(value,args));
 }
 for(const query of ['v=wrong','v='+model.sha256,'v='+model.sha256.slice(0,12)+'&v='+model.sha256.slice(0,12),'v='+model.sha256.slice(0,12)+'&debug=1','v='+model.sha256.slice(0,12)+'&_dc=bad']){
  const value=structuredClone(network);value.responses[3].url=value.responses[3].url.split('?')[0]+'?'+query;assert.throws(()=>assertNetwork(value,args));
 }
 for(const index of [0,1,2]){const value=structuredClone(network);value.responses[index].url+=(index===2?'?':'&')+'v='+model.sha256.slice(0,12);assert.throws(()=>assertNetwork(value,args));}
 const wrongModel=structuredClone(network);wrongModel.responses[3].sha256='f'.repeat(64);assert.throws(()=>assertNetwork(wrongModel,args),'The version prefix never substitutes for complete body SHA256');
});

test('negative SDK fixture preserves real checker FAIL while requiring installed original findings',()=>{
 const pin={version:'example-pin'},text='YG DEBUG CHECKER REPORT\n  [FAIL][runtime] SDK initialized\nTOTAL: 0 pass, 1 fail, 0 warn, 0 not verified (0% score; 100% automated coverage)';
 const report={kind:'original-checker-on-explicit-negative-sdk-session',sourceAccepted:false,publicationAccepted:false,liveSdkAccepted:false,moderationAccepted:false,positiveStartupAccepted:false,
  publicVersion:pin.version,boot:{pin,installed:true,error:null,method:'captured /sdk.js load before game SDK initialization',originalPublicVersion:pin.version,installedAt:5,sdkScript:'http://127.0.0.1:1234/sdk.js'},
  timing:{gameReady:0},sourceScan:{bytes:1000,sha256:'a'.repeat(64)},rows:[{status:'fail',name:'SDK initialized',category:'SDK',metadata:'runtime'}],unusedCategories:[],counts:{PASS:0,FAIL:1,WARN:0,'N/V':0,SCORE:0},originalReport:text};
 const args={pin,url:'http://127.0.0.1:1234/uploads/game/',originalText:text,bindCopiedRows:bindOriginalYandexCopiedRows};assert.equal(assertNegativeChecker(report,args).originalCounts.FAIL,1);
 for(const change of [x=>x.boot.installed=false,x=>x.boot.error='bad',x=>x.publicVersion='fake',x=>x.sourceScan.bytes=0,x=>x.rows=[],x=>x.boot.sdkScript='http://other.test/sdk.js',x=>x.counts.FAIL=0,x=>x.positiveStartupAccepted=true]){
  const value=structuredClone(report);change(value);assert.throws(()=>assertNegativeChecker(value,args));
 }
 const rendered='Music via Web Audio, not /new Audio (п.1.6.1.6/1.6.2.5)',copied='Music via Web Audio, not <audio>/new Audio (п.1.6.1.6/1.6.2.5)';
 const audio=structuredClone(report);audio.rows[0].name=rendered;audio.originalReport=text.replace('SDK initialized',copied);
 assert.equal(assertNegativeChecker(audio,{...args,originalText:audio.originalReport}).originalCounts.FAIL,1);
 for(const mutate of [value=>value.rows[0].status='pass',value=>value.rows[0].metadata='fake',value=>value.rows[0].name+=' changed']){
  const value=structuredClone(audio);mutate(value);assert.throws(()=>assertNegativeChecker(value,{...args,originalText:value.originalReport}));
 }
});

test('offline closed reports reject added, missing, changed and duplicate-identity bytes',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'v63-audit-unit-'));
 try{
  fs.writeFileSync(path.join(root,'data.json'),'{}');fs.writeFileSync(path.join(root,'report.json'),'{}');
  const files=inventory(root).filter(row=>row.path!=='report.json'),closure={files,filesSha256:hash(JSON.stringify(files)),fileCount:files.length};
  assertClosedFiles(root,closure,'report.json');fs.writeFileSync(path.join(root,'extra'),'x');assert.throws(()=>assertClosedFiles(root,closure,'report.json'));fs.unlinkSync(path.join(root,'extra'));
  fs.writeFileSync(path.join(root,'data.json'),'[]');assert.throws(()=>assertClosedFiles(root,closure,'report.json'));
  fs.writeFileSync(path.join(root,'data.json'),'{"sourceCommit":"a","sourceCommit":"b"}');assert.throws(()=>read(path.join(root,'data.json')));
  fs.unlinkSync(path.join(root,'data.json'));assert.throws(()=>assertClosedFiles(root,closure,'report.json'));
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});
