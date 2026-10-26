/** Runs the unmodified, pinned Nioris checker in a TEST browser only.
 * It observes the real SDK calls and asks the original UI to compute/copy its
 * own report. No rule, report verdict or game/SDK result is substituted here.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import vm from 'node:vm';

export const YANDEX_CHECKER_PIN=Object.freeze({
 repository:'https://github.com/Nioris/yandex-games-debug-checker',
 commit:'f86d4ebd1d17f92911ff64b373286fc8d85aec8e',
 version:'1.1.0',
 filename:'qa/vendor/yandex-games-debug-checker/debugcheck.js',
 bytes:99613,
 sha256:'adb1ca16e9b3172712d5eda9b64d6fd6792b5e00e85102a0bf0a2390b3239e00',
});
const sha=value=>createHash('sha256').update(value).digest('hex');
const HASH=/^[a-f0-9]{64}$/;
const GIT=/^[a-f0-9]{40}$/;
export const YANDEX_CHECKER_SCOPE='Original third-party pre-submit checker on the actual Yandex-compiled game with an explicitly mocked SDK. Not live advertising, platform/device performance or moderation approval. WARN and NOT VERIFIED retain their original meanings.';
// This exact pinned upstream label is inserted into its UI as raw HTML. The
// browser consumes the <audio> tag, while the original Copy report retains it.
// Preserve both names; never normalize arbitrary labels or checker verdicts.
export const YANDEX_CHECKER_PINNED_LABEL_RENDERINGS=Object.freeze({
 'Music via Web Audio, not <audio>/new Audio (п.1.6.1.6/1.6.2.5)':
  'Music via Web Audio, not /new Audio (п.1.6.1.6/1.6.2.5)',
});

export function bindOriginalYandexCopiedRows(rows,originalReport){
 assert.ok(Array.isArray(rows)&&typeof originalReport==='string');
 const copied=originalReport.split('\n').flatMap(line=>{
  const match=line.match(/^  \[(PASS|FAIL|WARN|NOT VERIFIED)\]\[([^\]]+)\] (.*)$/);
  return match?[{line,status:match[1]==='NOT VERIFIED'?'not_verified':match[1].toLowerCase(),metadata:match[2],text:match[3]}]:[];
 });
 assert.equal(copied.length,rows.length,'Original copied row count differs from actual DOM');
 return rows.map((row,index)=>{
  const actual=copied[index];assert.equal(actual.status,row.status,'Original copied row status differs from actual DOM');
  assert.equal(actual.metadata,row.metadata,'Original copied metadata differs from actual DOM');
  const rawName=Object.entries(YANDEX_CHECKER_PINNED_LABEL_RENDERINGS).find(([,rendered])=>rendered===row.name)?.[0]??row.name;
  assert.ok(actual.text===rawName||actual.text.startsWith(rawName+' — '),'Original copied name differs from actual DOM/pinned label rendering');
  return {...row,renderedDOMName:row.name,copiedName:actual.text.slice(0,rawName.length),copiedLine:actual.line};
 });
}

export function loadPinnedYandexChecker({sourceRoot=process.cwd()}={}){
 const filename=path.join(path.resolve(sourceRoot),YANDEX_CHECKER_PIN.filename);
 assert.ok(fs.lstatSync(filename).isFile()&&!fs.lstatSync(filename).isSymbolicLink(),'Plain pinned original checker required');
 const bytes=fs.readFileSync(filename);
 assert.equal(bytes.length,YANDEX_CHECKER_PIN.bytes);assert.equal(sha(bytes),YANDEX_CHECKER_PIN.sha256,'Do not modify or replace the original checker');
 const source=bytes.toString('utf8');assert.deepEqual(Buffer.from(source),bytes);
 new vm.Script(source,{filename:YANDEX_CHECKER_PIN.filename});
 return {source,pin:{...YANDEX_CHECKER_PIN}};
}

/** Closure-free browser preload. The real SDK script load event is captured
 * before its onload handler resumes the game's SDK initializer. Inline
 * execution here is the exact original file, not an altered checker bundle.
 */
export function preloadPinnedYandexChecker({source,pin}){
 if(window!==window.top)return;
 const key='__LAB_YANDEX_CHECKER_BOOT__';
 if(Object.hasOwn(window,key))throw Error('One checker preload per fresh document');
 const boot={pin,installed:false,method:'captured /sdk.js load before game SDK initialization',sdkScript:null,
  installedAt:null,originalPublicVersion:null,clipboardReportTransport:'original Copy button; clipboard delivery captured only',error:null};
 Object.defineProperty(window,key,{value:boot,configurable:false,writable:false});
 const loaded=event=>{
  const script=event.target;
  if(!script||String(script.tagName).toLowerCase()!=='script'||!script.src)return;
  const url=new URL(script.src,location.href);
  if(url.origin!==location.origin||url.pathname!=='/sdk.js')return;
  if(boot.installed||boot.error)return;
  boot.sdkScript=url.href;
  try{
   if(typeof window.YaGames?.init!=='function')throw Error('Loaded SDK did not expose YaGames.init');
   if(window.YGDebugChecker||window.__dbg?.TIMING)throw Error('Checker already present before pinned installation');
   const node=document.createElement('script');node.dataset.yandexCheckerSha256=pin.sha256;node.textContent=source;
   (document.head||document.documentElement).appendChild(node);node.remove();
   if(window.YGDebugChecker?.version!==pin.version||!window.__dbg?.TIMING||!window.__dbg?.RT)throw Error('Original checker did not install');
   if(window.__dbg.TIMING.sdkInit||window.__dbg.TIMING.gameReady)throw Error('Original checker attached after game SDK initialization');
   boot.installed=true;boot.installedAt=performance.now();boot.originalPublicVersion=window.YGDebugChecker.version;
   document.removeEventListener('load',loaded,true);
  }catch(error){boot.error=String(error?.message||error);throw error;}
 };
 document.addEventListener('load',loaded,true);
}

export async function installPinnedYandexChecker(page,options={}){
 const {source,pin}=loadPinnedYandexChecker(options);
 const installed=await page.evaluateOnNewDocument(preloadPinnedYandexChecker,{source,pin});
 return {pin,preloadIdentifier:installed?.identifier??null,
  scope:'Test observer only; requires actual /sdk.js in a Yandex-compiled package before game scripts.'};
}

/** Closure-free reader. Every name/status/detail and every total below comes
 * from the original checker's freshly rendered DOM, never from copied rules.
 */
export function readOriginalYandexCheckerPanel(){
 const body=document.querySelector('.dc-body');
 if(!body?.querySelector('.dc-sum')||typeof window._dcSource!=='string')throw Error('No completed original checker panel');
 const counts={};
 for(const node of body.querySelectorAll('.dc-sum .dc-sc')){
  const key=node.querySelector('.dc-sl')?.textContent.trim(),text=node.querySelector('.dc-sn')?.textContent.trim();
  if(!key||!text||Object.hasOwn(counts,key))throw Error('Ambiguous original checker total');
  counts[key]=text.endsWith('%')?Number(text.slice(0,-1)):Number(text);
 }
 const rows=[...body.querySelectorAll('.dc-row')].map(node=>{
  const nameNode=node.querySelector('.dc-name'),nameCopy=nameNode?.cloneNode(true);nameCopy?.querySelector('.dc-meta')?.remove();
  const icon=node.querySelector('.dc-icon'),statuses=['pass','fail','warn','nv'].filter(s=>icon?.classList.contains('dc-'+s));
  if(statuses.length!==1)throw Error('Ambiguous original checker row');
  return {category:node.closest('.dc-sec')?.querySelector('.dc-st')?.textContent.trim()??null,
   name:nameCopy?.textContent.trim()??null,metadata:nameNode?.querySelector('.dc-meta')?.textContent.trim()??null,
   status:statuses[0]==='nv'?'not_verified':statuses[0],description:node.querySelector('.dc-desc')?.textContent??'',
   detail:node.querySelector('.dc-det')?.textContent??'',text:node.innerText};
 });
 const unusedCategories=[...body.querySelectorAll('.dc-sec')].filter(node=>node.querySelector('.dc-badge')?.textContent.trim()==='N/A')
  .map(node=>({category:node.querySelector('.dc-st')?.textContent.trim()??null,status:'not_used',text:node.innerText}));
 const serialize=value=>{
  if(typeof value==='number')return Number.isFinite(value)?value:String(value);
  if(value===null||typeof value==='string'||typeof value==='boolean')return value;
  if(value instanceof Set)return [...value].map(serialize);
  if(Array.isArray(value))return value.map(serialize);
  if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).filter(([,v])=>typeof v!=='function'&&v!==undefined).map(([k,v])=>[k,serialize(v)]));
  throw Error('Unserializable actual checker observation');
 };
 return {publicVersion:window.YGDebugChecker?.version,boot:serialize(window.__LAB_YANDEX_CHECKER_BOOT__),counts,rows,unusedCategories,
  timing:serialize(window.__dbg.TIMING),runtime:serialize(window.__dbg.RT),scannedSource:window._dcSource,
  observedPage:{url:location.href,levelIndex:Number(document.documentElement.dataset.levelIndex),visibleRoom:document.documentElement.dataset.visibleRoom??null,
   runtimeState:document.documentElement.dataset.runtimeState??null,documentLang:document.documentElement.lang},
  originalPanelText:body.innerText};
}

/** Original refresh performs asynchronous real source requests. Observe its
 * own fresh dc-body replacement so a prior report is never reused.
 */
export function refreshOriginalYandexChecker(timeoutMs){
 return new Promise((resolve,reject)=>{
  if(typeof window.YGDebugChecker?.refresh!=='function')throw Error('Original checker absent');
  const finish=error=>{clearTimeout(timer);observer.disconnect();error?reject(error):resolve(true);};
  const observer=new MutationObserver(records=>{
   if(records.some(row=>row.type==='childList'&&row.target.nodeType===1&&row.target.matches('.dc-body')&&row.target.querySelector('.dc-sum')))finish();
  });
  const timer=setTimeout(()=>finish(Error('Original checker did not finish a fresh report')),timeoutMs);
  observer.observe(document.documentElement,{childList:true,subtree:true});
  try{window.YGDebugChecker.refresh();}catch(error){finish(error);}
 });
}

/** Capture the text delivered by the ORIGINAL Copy button. Replacing the
 * clipboard delivery does not compute, replace or edit a checker verdict.
 * The native clipboard property is restored synchronously after the click.
 */
export function copyOriginalYandexCheckerReport(){
 const button=document.querySelector('.dc-copy');if(!button)throw Error('Original Copy button absent');
 const own=Object.getOwnPropertyDescriptor(navigator,'clipboard');let copied=null;
 try{
  Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText(text){copied=String(text);return Promise.resolve();}}});
  button.click();
 }finally{if(own)Object.defineProperty(navigator,'clipboard',own);else delete navigator.clipboard;}
 if(typeof copied!=='string'||!copied.startsWith('YG DEBUG CHECKER REPORT\n'))throw Error('Original checker did not copy its own report');
 return copied;
}

export function assertYandexCheckerDiagnostic(report,{requireNoHardFailures=true,requireGameplay=true,allowLocalDiagnostic=false}={}){
 assert.equal(report.kind,'original-yandex-debug-checker-browser-diagnostic');assert.equal(report.context,'mock-yandex-platform');
 assert.deepEqual(report.checker,YANDEX_CHECKER_PIN);assert.equal(report.publicVersion,YANDEX_CHECKER_PIN.version);
 assert.equal(report.sourceAccepted,false);assert.equal(report.publicationAccepted,false);assert.equal(report.liveSdkAccepted,false);assert.equal(report.moderationAccepted,false);
 assert.ok(GIT.test(report.identity.sourceCommit)&&GIT.test(report.identity.sourceTree));
 if(report.identity.localDiagnostic!==undefined)assert.equal(typeof report.identity.localDiagnostic,'boolean');
 if(report.identity.localDiagnostic===true){
  // Local evidence must opt in at both the report and validator. It cannot
  // masquerade as a CI run or be accepted by the default CI validator.
  assert.equal(allowLocalDiagnostic,true,'Local checker evidence requires explicit validator opt-in');
  assert.notEqual(process.env.GITHUB_ACTIONS,'true','CI evidence cannot opt out of its actual run identity');
  for(const key of ['runId','runAttempt'])assert.equal(report.identity[key],null,'Local checker evidence must not claim a CI run');
 }else for(const key of ['runId','runAttempt'])assert.ok(Number.isSafeInteger(report.identity[key])&&report.identity[key]>0);
 assert.ok(Number.isSafeInteger(report.identity.level)&&report.identity.level>0);
 assert.ok(report.identity.level<=51);assert.equal(report.observedPage.levelIndex,report.identity.level-1);
 assert.ok(['ready','playing','paused','won'].includes(report.observedPage.runtimeState));
 assert.deepEqual(report.boot.pin,YANDEX_CHECKER_PIN);assert.equal(report.boot.installed,true);assert.equal(report.boot.error,null);
 assert.equal(report.boot.method,'captured /sdk.js load before game SDK initialization');assert.equal(report.boot.originalPublicVersion,YANDEX_CHECKER_PIN.version);
 assert.ok(typeof report.boot.installedAt==='number'&&Number.isFinite(report.boot.installedAt));
 assert.equal(new URL(report.boot.sdkScript).pathname,'/sdk.js');assert.equal(new URL(report.boot.sdkScript).origin,new URL(report.observedPage.url).origin);
 assert.ok(report.sourceScan.bytes>100&&Number.isSafeInteger(report.sourceScan.bytes)&&HASH.test(report.sourceScan.sha256));
 assert.ok(Array.isArray(report.rows)&&report.rows.length>0&&Array.isArray(report.unusedCategories));
 const totals={pass:0,fail:0,warn:0,not_verified:0};
 for(const row of report.rows){assert.ok(Object.hasOwn(totals,row.status));assert.ok(typeof row.name==='string'&&row.name.length>0);assert.ok(typeof row.category==='string'&&row.category.length>0);totals[row.status]++;}
 for(const[key,label]of[['pass','PASS'],['fail','FAIL'],['warn','WARN'],['not_verified','N/V']])assert.equal(report.counts[label],totals[key]);
 const scored=totals.pass+totals.fail+totals.warn,all=scored+totals.not_verified;
 assert.equal(report.counts.SCORE,scored?Math.round(totals.pass/scored*100):0);
 assert.equal(report.rows.length,all);assert.equal(report.coveragePercent,all?Math.round(scored/all*100):0);
 if(requireNoHardFailures)assert.equal(totals.fail,0,'The original checker reported hard failures');
 const required=['SDK script tag','YaGames.init()','LoadingAPI.ready()','SDK loaded','SDK initialized','environment.i18n.lang','SDK language read before Game Ready'];
 for(const name of required)assert.equal(report.rows.filter(row=>row.name===name).length,1,'Required original checker row missing/duplicated: '+name);
 const t=report.timing;for(const key of ['sdkInit','sdkPatched','langDetected','gameReady'])assert.ok(typeof t[key]==='number'&&Number.isFinite(t[key])&&t[key]>0,'Actual original checker timing missing: '+key);
 assert.equal(t._patched,true);assert.equal(report.runtime._i18nRead,true);assert.equal(report.runtime._i18nObservation,'early');
 assert.ok(t.sdkPatched>=t.sdkInit&&t.langDetected>=t.sdkPatched&&t.gameReady>=t.langDetected);
 if(requireGameplay)assert.ok(typeof t.gameplayStart==='number'&&t.gameplayStart>=t.gameReady,'Actual gameplay start not observed');
 assert.ok(Array.isArray(t.log)&&t.log.some(x=>x.event==='sdkInit')&&t.log.some(x=>x.event==='gameReady'));
 assert.ok(typeof report.originalReport==='string'&&report.originalReport.startsWith('YG DEBUG CHECKER REPORT\n'));
 const result=report.originalReport.match(/TOTAL: (\d+) pass, (\d+) fail, (\d+) warn, (\d+) not verified \((\d+)% score; (\d+)% automated coverage\)/);
 assert.ok(result,'Original copied summary absent');assert.deepEqual(result.slice(1).map(Number),[totals.pass,totals.fail,totals.warn,totals.not_verified,report.counts.SCORE,report.coveragePercent]);
 const copiedRows=bindOriginalYandexCopiedRows(report.rows,report.originalReport);
 for(const [index,row]of report.rows.entries()){
  assert.equal(row.renderedDOMName,row.name,'Preserve the actual rendered DOM label');
  assert.equal(row.copiedName,copiedRows[index].copiedName,'Preserve the verbatim original copied label');
  assert.equal(row.copiedLine,copiedRows[index].copiedLine,'Preserve the verbatim original copied row');
  assert.equal(YANDEX_CHECKER_PINNED_LABEL_RENDERINGS[row.copiedName]??row.copiedName,row.renderedDOMName,'Unrecognized pinned label rendering');
 }
 assert.ok(Array.isArray(report.runtime.errors)&&Array.isArray(report.runtime.warnings));
 return {checked:true,checks:all,hardFailures:totals.fail,warnings:totals.warn,notVerified:totals.not_verified,
  originalScorePercent:report.counts.SCORE,originalCoveragePercent:report.coveragePercent,
  context:report.context,localDiagnostic:report.identity.localDiagnostic===true,liveSdkAccepted:false,moderationAccepted:false};
}

export async function captureYandexChecker(page,{outputDirectory,identity,context='mock-yandex-platform',timeoutMs=20000,requireGameplay=true,localDiagnostic=false}={}){
 assert.equal(context,'mock-yandex-platform','Do not present an SDK-less web demo as a Yandex platform check');
 assert.ok(outputDirectory&&identity);assert.ok(Number.isSafeInteger(timeoutMs)&&timeoutMs>0&&timeoutMs<=60000);
 assert.equal(identity.localDiagnostic===true,localDiagnostic,'Capture and report must agree on local evidence scope');
 assert.ok(!localDiagnostic||process.env.GITHUB_ACTIONS!=='true','CI capture must retain its actual run identity');
 const directory=path.resolve(outputDirectory);fs.mkdirSync(directory,{recursive:true});
 for(const name of ['yandex-debug-checker-report.json','yandex-debug-checker-report.txt'])assert.ok(!fs.existsSync(path.join(directory,name)),'Never overwrite an earlier checker capture');
 let report;
 try{
  await page.waitForFunction(()=>window.__LAB_YANDEX_CHECKER_BOOT__?.installed&&window.__dbg?.TIMING?.gameReady>0,{timeout:timeoutMs});
  await page.evaluate(refreshOriginalYandexChecker,timeoutMs);
  const actual=await page.evaluate(readOriginalYandexCheckerPanel),originalReport=await page.evaluate(copyOriginalYandexCheckerReport);
  actual.rows=bindOriginalYandexCopiedRows(actual.rows,originalReport);
  assert.ok(Buffer.byteLength(actual.scannedSource)<=12_000_000,'Bounded actual checker source scan required');
  const scanned=Buffer.from(actual.scannedSource);delete actual.scannedSource;
  const scored=actual.counts.PASS+actual.counts.FAIL+actual.counts.WARN,total=scored+actual.counts['N/V'];
  report={kind:'original-yandex-debug-checker-browser-diagnostic',pass:false,context,checker:{...YANDEX_CHECKER_PIN},identity:{...identity},
   capturedAt:new Date().toISOString(),...actual,sourceScan:{bytes:scanned.length,sha256:sha(scanned)},originalReport,
   coveragePercent:total?Math.round(scored/total*100):0,sourceAccepted:false,publicationAccepted:false,liveSdkAccepted:false,moderationAccepted:false,
   scope:YANDEX_CHECKER_SCOPE,limitations:['The original regex/runtime checker cannot prove gameplay quality, every bypass, actual advertising delivery or moderation approval.','Mock SDK callbacks test lifecycle only. NOT VERIFIED is insufficient evidence and WARN is an observed risk; neither is promoted to PASS.','Source-scan XHR responses are actual same-origin game files; strict package observers must hash them despite the checker cache-busting query.']};
  fs.writeFileSync(path.join(directory,'yandex-debug-checker-report.txt'),originalReport);
  const verified=assertYandexCheckerDiagnostic(report,{requireGameplay,allowLocalDiagnostic:localDiagnostic});report.pass=true;report.summary=verified;
  fs.writeFileSync(path.join(directory,'yandex-debug-checker-report.json'),JSON.stringify(report,null,2)+'\n');
  console.log('YANDEX_DEBUG_CHECKER_CAPTURE_COMPLETE',identity.level,identity.sourceCommit,identity.runId,JSON.stringify(verified));
  return report;
 }catch(error){
  if(report){report.pass=false;report.failure=String(error?.stack||error);fs.writeFileSync(path.join(directory,'yandex-debug-checker-report.json'),JSON.stringify(report,null,2)+'\n');}
  else fs.writeFileSync(path.join(directory,'yandex-debug-checker-failure.json'),JSON.stringify({kind:'original-yandex-checker-capture-failure',pass:false,context,identity,error:String(error?.stack||error),sourceAccepted:false,publicationAccepted:false},null,2)+'\n');
  throw error;
 }finally{await page.evaluate(()=>window.YGDebugChecker?.close()).catch(()=>{});}
}
