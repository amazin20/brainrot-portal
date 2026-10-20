import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {parsePlayerEvidenceJSON} from './audit-player-ui.mjs';

export const hash=value=>createHash('sha256').update(value).digest('hex');
export const read=file=>parsePlayerEvidenceJSON(fs.readFileSync(file,'utf8'));
export const scopes=value=>{for(const key of ['sourceAccepted','publicationAccepted','liveSdkAccepted','moderationAccepted'])assert.equal(value[key],false,'Unexpected acceptance: '+key);};
export function fileRow(root,name){
 assert.equal(typeof name,'string');assert.ok(name&&!path.isAbsolute(name)&&!name.includes('\\')&&!name.split('/').some(part=>!part||part==='.'||part==='..'),'Unsafe member path');
 const file=path.join(root,name),stat=fs.lstatSync(file);assert.ok(stat.isFile()&&!stat.isSymbolicLink());const bytes=fs.readFileSync(file);
 return{path:name,bytes:bytes.length,sha256:hash(bytes)};
}
export function inventory(root){
 const result=[];
 function visit(folder){for(const entry of fs.readdirSync(folder,{withFileTypes:true}).sort((a,b)=>a.name<b.name?-1:a.name>b.name?1:0)){
  assert.equal(entry.isSymbolicLink(),false);const file=path.join(folder,entry.name);
  if(entry.isDirectory())visit(file);else result.push(fileRow(root,path.relative(root,file).split(path.sep).join('/')));
 }}visit(root);return result.sort((a,b)=>a.path<b.path?-1:a.path>b.path?1:0);
}
export function assertClosedFiles(root,artifacts,exclude){
 const actual=inventory(root).filter(row=>row.path!==exclude);
 assert.deepEqual(artifacts.files,actual,'Declared closed artifact inventory differs from actual bytes');
 assert.equal(artifacts.filesSha256,hash(JSON.stringify(actual)));assert.equal(artifacts.fileCount,actual.length);
 return actual;
}
export function decodedImages(root,names){
 const code="import json,sys\nfrom PIL import Image,ImageStat\nout=[]\nfor name in json.loads(sys.argv[2]):\n p=Image.open(sys.argv[1]+'/'+name);p.load();s=p.convert('RGB').resize((64,36));v={'file':name,'width':p.width,'height':p.height,'colors':len(s.getcolors(2305) or []),'maxChannelStd':max(ImageStat.Stat(s).stddev)};assert v['width']>=100 and v['height']>=100 and v['colors']>=4 and v['maxChannelStd']>=1;out.append(v)\nprint(json.dumps(out))";
 const actual=JSON.parse(execFileSync('python3',['-c',code,root,JSON.stringify(names)],{encoding:'utf8'}));
 return actual.map(row=>({...row,...Object.fromEntries(Object.entries(fileRow(root,row.file)).filter(([key])=>key!=='path'))}));
}
export function assertFrozenResponseQuery(url,relative,expected){
 const entryKeys=new Set(['edition','level','debug','pilot','tower41preview','tower41ratchet']);
 const versionedModel=/^models\/runtime\/[^/]+\.glb$/.test(relative)&&url.searchParams.getAll('v').length===1;
 assert.ok([...url.searchParams].every(([key,value])=>key==='_dc'&&/^\d+$/.test(value)||
  relative==='index.html'&&entryKeys.has(key)||key==='v'&&versionedModel&&typeof expected?.sha256==='string'&&value===expected.sha256.slice(0,12)),
 'Unverified response query: '+url.href);
}
export function assertNetwork(network,{url,package:pkg,sdk}){
 assert.equal(network.kind,'actual-browser-response-body-hashes');assert.equal(network.allReceivedBytesMatched,true);
 assert.equal(sdk.kind,'explicit-local-test-sdk');assert.equal(sdk.liveSdk,false);assert.equal(sdk.liveAds,false);
 const base=new URL(url),files=new Map([...pkg.files,{path:'build-info.json',bytes:pkg.buildInfoBytes,sha256:pkg.buildInfoSha256}].map(row=>[row.path,row]));
 assert.equal(network.responseCount,network.responses.length);assert.ok(network.responseCount>0);
 assert.equal(network.totalObservedBytes,network.responses.reduce((sum,row)=>sum+row.bytes,0));
 for(const row of network.responses){
  const response=new URL(row.url);assert.equal(response.origin,base.origin);assert.equal(row.status,200);
  const isSdk=response.pathname==='/sdk.js';assert.equal(row.mockSdk,isSdk);assert.ok(isSdk||response.pathname.startsWith(base.pathname));
  const relative=isSdk?'/sdk.js':decodeURIComponent(response.pathname.slice(base.pathname.length))||'index.html';assert.equal(row.path,relative);
  const expected=isSdk?sdk:files.get(relative);assert.ok(expected,'Actual response outside bound package');
  assertFrozenResponseQuery(response,relative,expected);
  assert.equal(row.bytes,expected.bytes);assert.equal(row.sha256,expected.sha256);assert.equal(typeof row.fromCache,'boolean');
  assert.equal(row.checkerSourceScan,response.searchParams.has('_dc'));
 }
 assert.ok(network.responses.some(row=>row.path==='/sdk.js'));
 assert.ok(network.responses.some(row=>row.path==='index.html'&&row.checkerSourceScan));
 assert.ok(network.responses.some(row=>row.path.endsWith('.js')&&row.checkerSourceScan));
 return network.responseCount;
}
export function assertNegativeChecker(report,{pin,url,originalText,bindCopiedRows}){
 assert.equal(report.kind,'original-checker-on-explicit-negative-sdk-session');scopes(report);assert.equal(report.positiveStartupAccepted,false);assert.equal(report.timing.gameReady,0);
 assert.equal(report.originalReport,originalText);assert.equal(report.publicVersion,pin.version);assert.deepEqual(report.boot.pin,pin);
 assert.equal(report.boot.installed,true);assert.equal(report.boot.error,null);assert.equal(report.boot.method,'captured /sdk.js load before game SDK initialization');assert.equal(report.boot.originalPublicVersion,pin.version);
 assert.ok(Number.isFinite(report.boot.installedAt)&&report.boot.installedAt>0);
 assert.equal(new URL(report.boot.sdkScript).pathname,'/sdk.js');assert.equal(new URL(report.boot.sdkScript).origin,new URL(url).origin);
 assert.ok(Number.isSafeInteger(report.sourceScan.bytes)&&report.sourceScan.bytes>100);assert.match(report.sourceScan.sha256,/^[a-f0-9]{64}$/);
 assert.ok(Array.isArray(report.rows)&&report.rows.length>0);assert.ok(Array.isArray(report.unusedCategories));
 assert.equal(typeof bindCopiedRows,'function','Use the pinned Source original Copy/DOM binding validator');
 const copiedRows=bindCopiedRows(report.rows,report.originalReport);assert.equal(copiedRows.length,report.rows.length);
 const totals={PASS:0,FAIL:0,WARN:0,'N/V':0};
 for(const finding of report.rows){
  const key={pass:'PASS',fail:'FAIL',warn:'WARN',not_verified:'N/V'}[finding.status];assert.ok(key);totals[key]++;
  assert.ok(typeof finding.name==='string'&&finding.name.length>0&&typeof finding.category==='string'&&finding.category.length>0);
 }
 for(const [key,value]of Object.entries(totals))assert.equal(report.counts[key],value);
 const total=Object.values(totals).reduce((n,value)=>n+value,0),scored=total-totals['N/V'];assert.equal(report.counts.SCORE,scored?Math.round(totals.PASS/scored*100):0);
 const copied=report.originalReport.match(/TOTAL: (\d+) pass, (\d+) fail, (\d+) warn, (\d+) not verified \((\d+)% score; (\d+)% automated coverage\)/);assert.ok(copied);
 assert.deepEqual(copied.slice(1).map(Number),[totals.PASS,totals.FAIL,totals.WARN,totals['N/V'],report.counts.SCORE,total?Math.round(scored/total*100):0]);
 return{expectedNegativeStartup:true,originalCounts:report.counts};
}
export function assertRewardedUI(proof,level){
 assert.equal(proof.kind,'actual-rewarded-hint-ui-with-explicit-sdk-mock');assert.equal(proof.level,level);assert.equal(proof.liveAds,false);assert.equal(proof.pass,true);
 const initial=proof.before;assert.equal(initial.levelIndex,level-1);assert.equal(initial.state,'paused');assert.equal(initial.runtimeState,'paused');
 assert.equal(initial.runtimeHintCount,0);assert.equal(initial.savedHintCount,0);assert.equal(initial.hintsHidden,false);assert.equal(initial.revealedParagraphs,0);
 assert.deepEqual(proof.transactions.map(row=>row.outcome),['close','error','reward']);
 let previous=initial;
 for(const transaction of proof.transactions){
  const {outcome,before,during,after}=transaction;
  assert.equal(before.savedRaw,previous.savedRaw);assert.equal(before.rewardedOpenCount,previous.rewardedOpenCount);
  for(const row of [before,during,after]){assert.equal(row.levelIndex,level-1);assert.equal(row.worldStep,initial.worldStep);assert.equal(row.state,'paused');assert.equal(row.runtimeState,'paused');}
  assert.equal(during.externalPause,'true');assert.equal(during.externalBlocked,true);assert.equal(during.platformBusy,true);assert.ok(during.adLocks>0);
  assert.equal(during.audioAudible,false);assert.equal(during.audioContextState,'suspended');assert.equal(during.unlockDisabled,true);
  assert.equal(during.runtimeHintCount,0);assert.equal(during.savedRaw,before.savedRaw);assert.equal(during.rewardedOpenCount,before.rewardedOpenCount+1);
  assert.equal(after.externalPause,'false');assert.equal(after.externalBlocked,false);assert.equal(after.platformBusy,false);assert.equal(after.adLocks,0);
  assert.equal(after.audioAudible,false);assert.equal(after.audioContextState,'suspended');
  const expected=outcome==='reward'?1:0;assert.equal(after.runtimeHintCount,expected);assert.equal(after.savedHintCount,expected);assert.equal(after.revealedParagraphs,expected);
  assert.equal(after.rewardedOpenCount,before.rewardedOpenCount+1);
  if(outcome==='reward'){
   assert.equal(after.rewardedConfirmedCount,before.rewardedConfirmedCount+1);assert.equal(after.duplicateConfirmedCount,before.duplicateConfirmedCount+1);
   const savedBefore=parsePlayerEvidenceJSON(before.savedRaw),savedAfter=parsePlayerEvidenceJSON(after.savedRaw);
   assert.deepEqual(savedAfter,{...savedBefore,hints:{...savedBefore.hints,[level-1]:1}},'Reward changed fields outside this room hint tier');
  }else{
   assert.equal(after.savedRaw,before.savedRaw);assert.equal(after.rewardedConfirmedCount,before.rewardedConfirmedCount);
  }
  previous=after;
 }
 assert.equal(proof.reread.revealedParagraphs,1);assert.equal(proof.reread.savedRaw,previous.savedRaw);assert.equal(proof.reread.rewardedOpenCount,previous.rewardedOpenCount);
 assert.equal(proof.resumed.state,'playing');assert.equal(proof.resumed.runtimeState,'playing');assert.equal(proof.resumed.externalPause,'false');assert.equal(proof.resumed.externalBlocked,false);
 assert.equal(proof.resumed.runtimeHintCount,1);assert.equal(proof.resumed.worldStep,initial.worldStep);assert.equal(proof.resumed.audioContextState,'running');
 return{level,transactions:3,duplicateConfirmedIgnored:true,rereadWithoutAd:true};
}
