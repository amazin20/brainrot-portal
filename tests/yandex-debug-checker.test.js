import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {YANDEX_CHECKER_PIN,loadPinnedYandexChecker,preloadPinnedYandexChecker,assertYandexCheckerDiagnostic} from '../scripts/lib/yandex-debug-checker.mjs';
import {createMockYandexSDKSource} from '../scripts/lib/yandex-review-sdk.mjs';
import {parsePlatformRouteLevels,observePlatformPackageResponses,serveYandexReviewPackage} from '../scripts/qa-campaign-platform-route.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
const hash=value=>createHash('sha256').update(value).digest('hex');

test('vendored original checker and MIT license retain exact reviewed upstream bytes',()=>{
 const {source,pin}=loadPinnedYandexChecker({sourceRoot:root});assert.deepEqual(pin,YANDEX_CHECKER_PIN);
 const metadata=JSON.parse(fs.readFileSync(path.join(root,'qa/vendor/yandex-games-debug-checker/upstream.json')));
 assert.equal(metadata.commit,pin.commit);assert.equal(metadata.version,pin.version);assert.equal(metadata.license,'MIT');
 for(const file of metadata.files){const bytes=fs.readFileSync(path.join(root,'qa/vendor/yandex-games-debug-checker',file.path));assert.equal(bytes.length,file.bytes);assert.equal(hash(bytes),file.sha256);}
 assert.equal(hash(source),pin.sha256);
});

/** This VM exercises unchanged upstream instrumentation, not a browser panel,
 * DOM rule verdict, playthrough, live SDK or acceptance result. */
function actualCheckerVM(){
 const handlers=new Map(),insertions=[],timers=new Map();let time=10,serial=0,context;
 const document={
  addEventListener(name,callback){const list=handlers.get(name)||[];list.push(callback);handlers.set(name,list);},
  removeEventListener(name,callback){handlers.set(name,(handlers.get(name)||[]).filter(value=>value!==callback));},
  createElement(name){return {tagName:name.toUpperCase(),dataset:{},textContent:'',remove(){}};},
  head:{appendChild(node){insertions.push(node);if(node.tagName==='SCRIPT')vm.runInContext(node.textContent,context,{filename:'unchanged-upstream-checker.js'});}},
 };
 const scope={document,URL,Set,performance:{now:()=>++time},location:{href:'http://test.invalid/campaign-v63/',origin:'http://test.invalid'},
  console:{log(){},warn(){},error(){}},setInterval(fn){timers.set(++serial,fn);return serial;},clearInterval(id){timers.delete(id);},
  setTimeout(fn){timers.set(++serial,fn);return serial;},clearTimeout(id){timers.delete(id);},
  addEventListener(){},module:{exports:{}}};
 scope.window=scope;scope.top=scope;context=vm.createContext(scope);
 return {scope,context,insertions,handlers,dispatch(name,event){for(const fn of [...(handlers.get(name)||[])])fn(event);}};
}

test('real upstream is installed on actual SDK load before init and forwards language/ready/gameplay calls',async()=>{
 const {source,pin}=loadPinnedYandexChecker({sourceRoot:root}),world=actualCheckerVM();
 vm.runInContext('('+preloadPinnedYandexChecker.toString()+')('+JSON.stringify({source,pin})+')',world.context);
 assert.equal(world.scope.__LAB_YANDEX_CHECKER_BOOT__.installed,false);
 // Unrelated scripts cannot cause a fabricated installation.
 world.dispatch('load',{target:{tagName:'SCRIPT',src:'http://test.invalid/game.js'}});
 assert.equal(world.insertions.length,0);
 vm.runInContext(createMockYandexSDKSource(),world.context);
 world.dispatch('load',{target:{tagName:'SCRIPT',src:'http://test.invalid/sdk.js'}});
 assert.equal(world.insertions.length,1);assert.equal(world.insertions[0].textContent,source);
 assert.equal(world.scope.__LAB_YANDEX_CHECKER_BOOT__.installed,true);
 assert.equal(world.scope.__dbg.TIMING.sdkInit,0);assert.equal(world.scope.__dbg.TIMING.gameReady,0);
 const sdk=await world.scope.YaGames.init();
 assert.equal(world.scope.__dbg.RT._i18nRead,false,'The original instrumentation itself must not fake a game language read');
 assert.equal(sdk.environment.i18n.lang,'ru');sdk.features.LoadingAPI.ready();sdk.features.GameplayAPI.start();sdk.features.GameplayAPI.stop();
 const timing=world.scope.__dbg.TIMING;
 assert.ok(timing.sdkInit>0&&timing.sdkPatched>timing.sdkInit&&timing.langDetected>timing.sdkPatched&&timing.gameReady>timing.langDetected&&timing.gameplayStart>timing.gameReady);
 assert.equal(world.scope.__dbg.RT._i18nRead,true);assert.equal(world.scope.__dbg.RT._i18nObservation,'early');
 assert.deepEqual(Array.from(world.scope.__LAB_YANDEX_MOCK__.log,row=>row.event),['init','sdk-language-get','ready','start','stop']);
 assert.equal(world.handlers.get('load').length,0,'SDK load capture must remove itself after installing');
 assert.throws(()=>vm.runInContext('('+preloadPinnedYandexChecker.toString()+')('+JSON.stringify({source,pin})+')',world.context),/One checker preload/);
});

test('late or duplicate upstream instrumentation is rejected instead of reported as observed startup',()=>{
 const {source,pin}=loadPinnedYandexChecker({sourceRoot:root}),world=actualCheckerVM();
 vm.runInContext('('+preloadPinnedYandexChecker.toString()+')('+JSON.stringify({source,pin})+')',world.context);
 world.scope.YaGames={init:async()=>({})};world.scope.YGDebugChecker={version:'1.1.0'};
 assert.throws(()=>world.dispatch('load',{target:{tagName:'SCRIPT',src:'http://test.invalid/sdk.js'}}),/already present/);
 assert.equal(world.scope.__LAB_YANDEX_CHECKER_BOOT__.installed,false);assert.match(world.scope.__LAB_YANDEX_CHECKER_BOOT__.error,/already present/);
});

test('the real upstream static checks detect actual SDK tag and direct LoadingAPI call architecture',()=>{
 const {source}=loadPinnedYandexChecker({sourceRoot:root}),world=actualCheckerVM();vm.runInContext(source,world.context);
 const checks=world.scope.module.exports.__CATS.flatMap(category=>category.checks),byName=name=>checks.find(check=>check.name===name);
 assert.equal(byName('SDK script tag').test('<head></head>'),false);
 assert.equal(byName('SDK script tag').test('<head><script src="/sdk.js"></script></head>'),true);
 assert.equal(byName('LoadingAPI.ready()').test('const api=sdk.features.LoadingAPI;api.ready();'),false);
 assert.equal(byName('LoadingAPI.ready()').test('sdk.features.LoadingAPI.ready();'),true);
 assert.equal(byName('YaGames.init()').test('scope.YaGames.init()'),true);
});

/** Synthetic validator fixtures only. These must never become browser proof. */
function syntheticDiagnostic(){
 const rows=['SDK script tag','YaGames.init()','LoadingAPI.ready()','SDK loaded','SDK initialized','environment.i18n.lang','SDK language read before Game Ready'].map(name=>({name,category:'SYNTHETIC VALIDATOR FIXTURE',metadata:'SYNTHETIC',status:'pass'}));
 rows.push({name:'Fixture warning',category:'SYNTHETIC VALIDATOR FIXTURE',metadata:'SYNTHETIC',status:'warn'},
  {name:'Fixture insufficient evidence',category:'SYNTHETIC VALIDATOR FIXTURE',metadata:'SYNTHETIC',status:'not_verified'});
 return {syntheticTestFixture:true,kind:'original-yandex-debug-checker-browser-diagnostic',context:'mock-yandex-platform',checker:{...YANDEX_CHECKER_PIN},publicVersion:'1.1.0',
  sourceAccepted:false,publicationAccepted:false,liveSdkAccepted:false,moderationAccepted:false,
  identity:{sourceCommit:'1'.repeat(40),sourceTree:'2'.repeat(40),runId:1,runAttempt:1,level:1},
  observedPage:{levelIndex:0,runtimeState:'won',url:'http://test.invalid/campaign-v63/'},
  boot:{pin:{...YANDEX_CHECKER_PIN},installed:true,error:null,method:'captured /sdk.js load before game SDK initialization',originalPublicVersion:'1.1.0',installedAt:10,sdkScript:'http://test.invalid/sdk.js'},
  sourceScan:{bytes:101,sha256:'3'.repeat(64)},rows,unusedCategories:[],counts:{PASS:7,FAIL:0,WARN:1,'N/V':1,SCORE:88},coveragePercent:89,
  timing:{sdkInit:11,sdkPatched:12,langDetected:13,gameReady:14,gameplayStart:15,_patched:true,log:[{event:'sdkInit'},{event:'gameReady'}]},
  runtime:{_i18nRead:true,_i18nObservation:'early',errors:[],warnings:[]},
  originalReport:'YG DEBUG CHECKER REPORT\n'+rows.map(row=>'  ['+(row.status==='not_verified'?'NOT VERIFIED':row.status.toUpperCase())+'][SYNTHETIC] '+row.name).join('\n')+'\nTOTAL: 7 pass, 0 fail, 1 warn, 1 not verified (88% score; 89% automated coverage)\n'};
}

test('validator preserves WARN and NOT VERIFIED as distinct insufficient/risk states',()=>{
 const summary=assertYandexCheckerDiagnostic(syntheticDiagnostic());assert.equal(summary.hardFailures,0);assert.equal(summary.warnings,1);assert.equal(summary.notVerified,1);
 assert.equal(summary.originalScorePercent,88);assert.equal(summary.originalCoveragePercent,89);assert.equal(summary.liveSdkAccepted,false);
});

test('validator rejects promoted verdicts, inconsistent original text, missing observations and acceptance claims',()=>{
 for(const mutate of [
  report=>{report.rows[0].status='fail';report.counts.PASS--;report.counts.FAIL++;report.counts.SCORE=75;},
  report=>{report.rows.at(-1).status='pass';},
  report=>{report.originalReport=report.originalReport.replace('[WARN]','[PASS]');},
  report=>{report.runtime._i18nRead=false;},report=>{report.timing.gameplayStart=0;},
  report=>{report.timing.sdkPatched=0;},report=>{report.boot.installed=false;},
  report=>{report.boot.pin.sha256='0'.repeat(64);},report=>{report.counts.SCORE=100;},
  report=>{report.sourceAccepted=true;},report=>{report.liveSdkAccepted=true;},
  report=>{report.context='sdk-less-web-demo';},report=>{report.observedPage.levelIndex=1;},
 ]){const report=syntheticDiagnostic();mutate(report);assert.throws(()=>assertYandexCheckerDiagnostic(report));}
});

test('platform route level parser accepts only unique permanent room numbers',()=>{
 assert.equal(parsePlatformRouteLevels().length,51);assert.equal(parsePlatformRouteLevels().at(-1),41);
 assert.deepEqual(parsePlatformRouteLevels('1,31,41'),[1,31,41]);
 for(const invalid of ['','0','52','1,1','1,','x']){if(invalid==='')continue;assert.throws(()=>parsePlatformRouteLevels(invalid));}
});

test('actual-response observer hashes cache-busted bytes and rejects wrong/empty received bodies',async()=>{
 const bytes=Buffer.from('actual frozen index bytes'),js=Buffer.from('actual frozen javascript'),sdk=Buffer.from('explicit mock SDK');
 const file=(path,value)=>({path,bytes:value.length,sha256:hash(value)}),binding={review:{files:[file('index.html',bytes),file('assets/main.js',js)],buildInfoBytes:5,buildInfoSha256:hash('stamp')}};
 const createPage=()=>{let handler;return{on(name,fn){assert.equal(name,'response');handler=fn;},off(){},emit(url,body){handler({url:()=>url,status:()=>200,buffer:async()=>body,fromCache:()=>false});}};};
 const page=createPage(),observe=observePlatformPackageResponses(page,{base:'http://test.invalid/campaign-v63/',binding,sdk:file('/sdk.js',sdk)});
 page.emit('http://test.invalid/campaign-v63/',bytes);page.emit('http://test.invalid/sdk.js',sdk);
 page.emit('http://test.invalid/campaign-v63/index.html?_dc=123',bytes);page.emit('http://test.invalid/campaign-v63/assets/main.js?_dc=123',js);
 assert.equal((await observe.finish()).allReceivedBytesMatched,true);
 const broken=createPage(),bad=observePlatformPackageResponses(broken,{base:'http://test.invalid/campaign-v63/',binding,sdk:file('/sdk.js',sdk)});
 broken.emit('http://test.invalid/campaign-v63/index.html?_dc=123',Buffer.alloc(0));await assert.rejects(()=>bad.finish(),/verification failed/);
});

test('forged production entry selectors are confined to the main index response',async()=>{
 const index=Buffer.from('actual production index'),js=Buffer.from('actual production javascript'),css=Buffer.from('actual production css'),sdk=Buffer.from('explicit mock SDK');
 const file=(path,bytes)=>({path,bytes:bytes.length,sha256:hash(bytes)}),binding={review:{files:[file('index.html',index),file('assets/main.js',js),file('assets/main.css',css)],buildInfoBytes:5,buildInfoSha256:hash('stamp')}};
 const base='http://test.invalid/uploads/yandex-check/game/',entry='debug=1&level=51&pilot=progression&tower41preview=1&tower41ratchet=1&edition=classic';
 const createPage=()=>{let handler;return {on(name,fn){assert.equal(name,'response');handler=fn;},off(){},emit(url,bytes){handler({url:()=>url,status:()=>200,buffer:async()=>bytes,fromCache:()=>false});}};};
 const page=createPage(),observer=observePlatformPackageResponses(page,{base,binding,sdk:file('/sdk.js',sdk)});
 page.emit(base+'?'+entry,index);page.emit('http://test.invalid/sdk.js',sdk);
 page.emit(base+'index.html?'+entry+'&_dc=123',index);page.emit(base+'assets/main.js?_dc=123',js);
 const evidence=await observer.finish();assert.equal(evidence.allReceivedBytesMatched,true);assert.equal(evidence.responses.length,4);
 for(const [relative,body] of [['assets/main.js',js],['assets/main.css',css],['/sdk.js',sdk]]){
  const invalid=createPage(),observed=observePlatformPackageResponses(invalid,{base,binding,sdk:file('/sdk.js',sdk)});
  invalid.emit(new URL(relative,base).href+'?'+entry,body);await assert.rejects(()=>observed.finish(),/verification failed/);
 }
 for(const query of ['unverified=1','_dc=not-a-number']){
  const invalid=createPage(),observed=observePlatformPackageResponses(invalid,{base,binding,sdk:file('/sdk.js',sdk)});
  invalid.emit(base+'index.html?'+query,index);await assert.rejects(()=>observed.finish(),/verification failed/);
 }
});
