/** Completeness of actual CI artifacts, with original checker verdicts intact.
 * A technical PASS is deliberately separate from a human visual review. */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {RELEASE_VERSION} from '../src/game/ReleaseIdentity.js';

const root=path.resolve(process.env.ARTIFACT_DIR||'qa/review-artifacts'),out=path.resolve(process.env.OUT_DIR||'qa/v67-review-summary');
assert.ok(!fs.existsSync(out)||fs.readdirSync(out).length===0,'Never overwrite an earlier acceptance record');fs.mkdirSync(out,{recursive:true});
const source=process.env.BUILD_COMMIT||process.env.GITHUB_SHA;assert.match(source||'',/^[a-f0-9]{40}$/);
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const read=relative=>JSON.parse(fs.readFileSync(path.join(root,relative),'utf8'));
const parts=['early','energy','living','optics','fracture','castle'],expected=Array.from({length:51},(_,i)=>i+1);
const report={kind:'v67-technical-review-completeness',pass:false,sourceCommit:source,runId:process.env.GITHUB_RUN_ID||null,runAttempt:process.env.GITHUB_RUN_ATTEMPT||null,
 sourceAccepted:false,publicationAccepted:false,humanVisualAccepted:false,liveSdkAccepted:false,liveAdsAccepted:false,moderationAccepted:false,hardwareFpsMeasured:false,
 scope:'Exact-source build, full active regression, extracted production startup/retry,51 ordinary-input TEST routes with unchanged original checker verdicts, and51 native-start balanced multi-view capture sets. A technical PASS is not a declaration that the human visual inspection, physical devices, live SDK/ads or moderation passed.'};
try{
 const upstream=JSON.parse(process.env.UPSTREAM_JOB_RESULTS||'{}');report.upstreamJobResults=upstream;
 assert.deepEqual(Object.keys(upstream).sort(),['unit','build','production-startup','checker-platform','visual-capture'].sort(),'Actual complete upstream job results are required');assert.ok(Object.values(upstream).every(job=>job.result==='success'),'At least one upstream job did not succeed');
 const build=read('v67-build/report.json'),unitShards=Array.from({length:4},(_,index)=>read('v67-unit-'+index+'/report.json')),production=read('v67-production-startup/report.json'),archive=read('v67-yandex/report.json');
 assert.equal(build.version,RELEASE_VERSION,'Reports must belong to the active committed release');
 for(const item of [build,...unitShards,archive]){assert.equal(item.pass,true);assert.equal(item.sourceCommit,source);}
 assert.equal(production.pass,true);assert.equal(production.binding.sourceCommit,source);assert.equal(production.cases.length,3);assert.ok(production.cases.every(row=>row.pass));
 const activeFiles=fs.readdirSync('tests').filter(name=>name.endsWith('.test.js')&&!name.startsWith('lab-tower')).sort(),unit={files:[],counts:{tests:0,pass:0,fail:0,cancelled:0,skipped:0,todo:0}};
 for(const [index,shard]of unitShards.entries()){
  assert.deepEqual(shard.shard,{index,count:4});assert.deepEqual(shard.allFiles,activeFiles);assert.deepEqual(shard.files,activeFiles.filter((_,i)=>i%4===index));
  assert.equal(shard.counts.pass,shard.counts.tests);for(const k of ['fail','cancelled','skipped','todo'])assert.equal(shard.counts[k],0);assert.ok(shard.files.length>0);
  unit.files.push(...shard.files);for(const key of Object.keys(unit.counts))unit.counts[key]+=shard.counts[key];
 }
 assert.deepEqual(unit.files.slice().sort(),activeFiles);
 const packages=new Map(build.packages.map(row=>[row.directory,row]));assert.equal(packages.size,3);assert.equal(new Set(build.packages.map(row=>row.sourceInputsSha256)).size,1);
 const zip=fs.readFileSync(path.join(root,'v67-yandex',archive.archiveFilename));assert.equal(zip.length,archive.compressedBytes);assert.equal(hash(zip),archive.sha256);assert.equal(production.binding.archive.sha256,archive.sha256);
 for(const [directory,artifact]of [['dist','v67-dist'],['dist-yandex-review','v67-yandex-review-dist']]){
  const item=packages.get(directory);for(const file of item.files){const bytes=fs.readFileSync(path.join(root,artifact,file.path));assert.equal(bytes.length,file.bytes);assert.equal(hash(bytes),file.sha256);}
  const stamp=fs.readFileSync(path.join(root,artifact,'build-info.json'));assert.equal(stamp.length,item.buildInfoBytes);assert.equal(hash(stamp),item.buildInfoSha256);
 }
 const routes=[],visuals=[],checkerCounts={PASS:0,FAIL:0,WARN:0,'N/V':0},warnings=[];
 const cameras=JSON.parse(fs.readFileSync('tools/visual-audit-v65-reference-cameras.json','utf8'));
 let actualVisualImages=0;
 for(const part of parts){
  const routeBase='v67-checker-platform-'+part,visualBase='v67-visual-'+part,route=read(routeBase+'/platform-route-report.json'),visual=read(visualBase+'/visual-capture-report.json');
  for(const item of [route,visual]){
   assert.equal(item.pass,true);assert.equal(item.binding.source.commit,source);assert.equal(item.binding.review.packageFilesSha256,packages.get('dist-yandex-review').packageFilesSha256);assert.equal(item.binding.consumer.packageFilesSha256,packages.get('dist').packageFilesSha256);
  }
  assert.equal(visual.humanVisualAccepted,false);assert.deepEqual(visual.errors,[]);
  for(const row of route.rows){
   assert.equal(row.pass,true);assert.equal(row.route.pass,true);assert.equal(row.finished.state,'won');assert.equal(row.finished.actualProductionWin,true);assert.equal(row.checker.summary.hardFailures,0);
   assert.equal(row.hintTransactions.transactions.length,3);assert.deepEqual(row.hintTransactions.transactions.map(item=>item.outcome),['close','error','reward']);assert.equal(row.hintTransactions.pass,true);
   const room='room-'+String(row.level).padStart(2,'0'),checkerPath=path.join(root,routeBase,room,'checker'),jsonBytes=fs.readFileSync(path.join(checkerPath,'yandex-debug-checker-report.json')),textBytes=fs.readFileSync(path.join(checkerPath,'yandex-debug-checker-report.txt'));
   assert.equal(hash(jsonBytes),row.checker.reportSha256);assert.equal(hash(textBytes),row.checker.originalTextSha256);
   const checker=JSON.parse(jsonBytes);assert.equal(checker.identity.sourceCommit,source);assert.equal(checker.counts.FAIL,0);
   for(const key of Object.keys(checkerCounts))checkerCounts[key]+=checker.counts[key];
   warnings.push(...checker.rows.filter(item=>item.status==='warn'||item.status==='not_verified').map(item=>({stableLevel:row.level,displayNumber:row.displayNumber,status:item.status,name:item.copiedName||item.name,metadata:item.metadata})));
   routes.push({stableLevel:row.level,displayNumber:row.displayNumber,checker:row.checker.summary,routePass:true,rewardedTransactions:row.hintTransactions.transactions.length});
  }
  for(const file of visual.artifacts.files){
   assert.ok(!path.isAbsolute(file.path)&&!file.path.split('/').includes('..'));const bytes=fs.readFileSync(path.join(root,visualBase,file.path));assert.equal(bytes.length,file.bytes);assert.equal(hash(bytes),file.sha256);
  }
  for(const row of visual.rows){
   assert.equal(row.pass,true);assert.equal(row.start.elapsed,0);assert.equal(row.start.worldStep,0);assert.equal(row.start.shadowsEnabled,true);assert.equal(row.start.quality.shadowSize,1024);assert.deepEqual(row.start.viewport,{width:1280,height:720});
   assert.equal(row.nativeHUD.ok,true);assert.equal(row.nativeHUD.includesHTML,true);
   const reference=cameras.levels.find(item=>item.stableLevel===row.stableLevel);assert.ok(reference);assert.deepEqual(row.views.map(item=>item.kind),['player-start',...reference.views.map(item=>item.kind)]);
   assert.ok(row.views.every(view=>view.capture.ok&&view.capture.pixels.width===1280&&view.capture.pixels.height===720));
   visuals.push({stableLevel:row.stableLevel,displayNumber:row.displayNumber,canvasViews:row.views.length,nativeHUD:true,shadows:true,ordinaryStart:true});
   actualVisualImages+=row.views.length+1;
  }
 }
 assert.deepEqual(routes.map(row=>row.stableLevel).sort((a,b)=>a-b),expected);assert.deepEqual(visuals.map(row=>row.stableLevel).sort((a,b)=>a-b),expected);
 assert.equal(routes.reduce((n,row)=>n+row.rewardedTransactions,0),153);
 report.version=build.version;report.packages=build.packages.map(({directory,sourceInputsSha256,packageFilesSha256,totalBytes})=>({directory,sourceInputsSha256,packageFilesSha256,totalBytes}));
 report.archive={name:archive.archiveFilename,bytes:archive.compressedBytes,sha256:archive.sha256};report.unit={files:unit.files.length,counts:unit.counts};report.production={cases:production.cases.map(row=>row.scenario),originalChecker:production.cases.find(row=>row.scenario==='positive')?.originalChecker};
 report.routes=routes.sort((a,b)=>a.displayNumber-b.displayNumber);report.visuals=visuals.sort((a,b)=>a.displayNumber-b.displayNumber);report.visualImageCount=actualVisualImages;report.originalCheckerTotals=checkerCounts;report.originalWarningsAndNotVerified=warnings;
 report.pass=true;
}catch(error){report.failure=String(error.stack||error);}
fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({pass:report.pass,sourceCommit:report.sourceCommit,unit:report.unit,routes:report.routes?.length,visuals:report.visuals?.length,visualImageCount:report.visualImageCount,originalCheckerTotals:report.originalCheckerTotals,failure:report.failure}));
assert.equal(report.pass,true,'Technical review incomplete; original failures and warnings remain in the artifacts');
