import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {execFileSync} from 'node:child_process';
import {pathToFileURL,fileURLToPath} from 'node:url';

export const OBSERVED_PUBLIC_BASE='https://amazin20.github.io/brainrot-portal/campaign-v55/';
const REPO='amazin20/brainrot-portal',WORKFLOW='.github/workflows/publish-campaign-v55.yml';
const MAX_BYTES=25_000_000,MAX_EVENTS=20_000;
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const copy=value=>JSON.parse(JSON.stringify(value));
const integer=(value,label)=>assert.ok(Number.isSafeInteger(value)&&value>0,label);
const digest=value=>assert.match(value||'',/^[a-f0-9]{64}$/);
const commit=value=>assert.match(value||'',/^[a-f0-9]{40}$/);
const runURL=id=>'https://github.com/'+REPO+'/actions/runs/'+id;
function observerSpecifier(value){value=value.replace(/^['"]|['"]$/g,'');try{return path.resolve(value.startsWith('file:')?fileURLToPath(value):value)===fileURLToPath(import.meta.url);}catch{return false;}}
export function withoutObserverPreload(nodeOptions=''){
 const tokens=nodeOptions.match(/(?:[^\s"']+|"[^"]*"|'[^']*')+/g)||[],kept=[];
 for(let i=0;i<tokens.length;i++){if(tokens[i]==='--import'&&observerSpecifier(tokens[i+1]||'')){i++;continue;}if(tokens[i].startsWith('--import=')&&observerSpecifier(tokens[i].slice(9)))continue;kept.push(tokens[i]);}return kept.join(' ');
}
function requestedPreload(args,nodeOptions){const tokens=[...args,...(nodeOptions.match(/(?:[^\s"']+|"[^"]*"|'[^']*')+/g)||[])];for(let i=0;i<tokens.length;i++){if(tokens[i]==='--import'&&observerSpecifier(tokens[i+1]||''))return true;if(tokens[i].startsWith('--import=')&&observerSpecifier(tokens[i].slice(9)))return true;}return false;}
function positiveEnv(env,key){assert.match(env[key]||'',/^[1-9][0-9]*$/,key);const value=Number(env[key]);integer(value,key);return value;}

export function observerIdentity(env=process.env){
 assert.equal(env.GITHUB_ACTIONS,'true');assert.equal(env.GITHUB_REPOSITORY,REPO);assert.equal(env.GITHUB_REF,'refs/heads/main');assert.equal(env.GITHUB_EVENT_NAME,'push');assert.equal(env.GITHUB_RUN_ATTEMPT,'1');
 commit(env.GITHUB_SHA);assert.match(env.GITHUB_JOB||'',/^[A-Za-z0-9_-]+$/);const publicationRun=positiveEnv(env,'GITHUB_RUN_ID'),jobId=positiveEnv(env,'PUBLIC_OBSERVER_JOB_ID');
 if(env.GITHUB_WORKFLOW_REF)assert.equal(env.GITHUB_WORKFLOW_REF,REPO+'/'+WORKFLOW+'@refs/heads/main');if(env.GITHUB_WORKFLOW_SHA)assert.equal(env.GITHUB_WORKFLOW_SHA,env.GITHUB_SHA);
 for(const key of ['EXPECTED_SOURCE_COMMIT','EXPECTED_SOURCE_TREE','EXPECTED_SOURCE_PARENT'])commit(env[key]);
 const sourceReview={runId:positiveEnv(env,'EXPECTED_SOURCE_RUN'),runAttempt:positiveEnv(env,'EXPECTED_SOURCE_ATTEMPT')};assert.notEqual(sourceReview.runId,publicationRun,'SOURCE run cannot produce PUBLIC observations');assert.notEqual(env.EXPECTED_SOURCE_COMMIT,env.GITHUB_SHA,'SOURCE commit cannot be PUBLIC producer');
 const expectedBuildInfo={bytes:positiveEnv(env,'PUBLIC_BUILD_INFO_BYTES'),sha256:env.PUBLIC_BUILD_INFO_SHA256};assert.ok(expectedBuildInfo.bytes<=MAX_BYTES);digest(expectedBuildInfo.sha256);
 return {producerOrigin:{kind:'github-actions-public-browser-observer',repository:REPO,ref:'refs/heads/main',event:'push',publisherCommit:env.GITHUB_SHA,publicationRun,publicationRunAttempt:1,workflow:WORKFLOW,jobKey:env.GITHUB_JOB,jobId,runURL:runURL(publicationRun),jobURL:runURL(publicationRun)+'/job/'+jobId},
  source:{sourceCommit:env.EXPECTED_SOURCE_COMMIT,sourceTree:env.EXPECTED_SOURCE_TREE,sourceParent:env.EXPECTED_SOURCE_PARENT,sourceReview,sourceReviewURL:runURL(sourceReview.runId)},expectedBuildInfo};
}
export function assertObservedPageURL(value){
 assert.equal(typeof value,'string');const url=new URL(value);assert.equal(url.origin,'https://amazin20.github.io');assert.equal(url.pathname,'/brainrot-portal/campaign-v55/');assert.equal(url.hash,'');assert.equal(url.username,'');assert.equal(url.password,'');
 if(!url.search)return url.href;if(url.search==='?debug=1')return url.href;
 assert.equal(url.searchParams.get('edition'),'foundation');assert.match(url.searchParams.get('level')||'',/^(?:[1-9]|[1-4][0-9]|5[01])$/);assert.equal(url.searchParams.get('debug'),'1');assert.equal([...url.searchParams].length,3);
 for(const key of url.searchParams.keys())assert.ok(['edition','level','debug'].includes(key));return url.href;
}
function metadataURL(value){const url=new URL(value);assert.equal(url.origin,'https://amazin20.github.io');assert.equal(url.pathname,'/brainrot-portal/campaign-v55/build-info.json');assert.equal(url.hash,'');assert.equal(url.username,'');assert.equal(url.password,'');return url.href;}
function looksLikeMetadata(value){try{return new URL(value).pathname.endsWith('/build-info.json');}catch{return false;}}
function noSymlinks(file){let cursor=path.parse(file).root;for(const component of file.slice(cursor.length).split(path.sep)){if(!component)continue;cursor=path.join(cursor,component);let st;try{st=fs.lstatSync(cursor);}catch(error){if(error.code==='ENOENT')continue;throw error;}assert.equal(st.isSymbolicLink(),false,'Observer output symlink');}}
function imageDescription(encoded,kind){assert.equal(typeof encoded,'string');assert.ok(encoded.length<=MAX_BYTES*4/3+4&&/^[A-Za-z0-9+/]*={0,2}$/.test(encoded),'Observed capture byte limit/encoding');const bytes=Buffer.from(encoded,'base64');return {kind,bytes:bytes.length,sha256:hash(bytes)};}
function resultDescription(value,{cdpScreenshot=false}={}){
 const result={};if(Buffer.isBuffer(value)||value instanceof Uint8Array){result.capture={kind:'screenshot-bytes',bytes:value.byteLength,sha256:hash(value)};return result;}
 if(!value||typeof value!=='object')return result;
 const frame=value.frame&&typeof value.frame==='object'?value.frame:value;
 const selected={};for(const key of ['levelIndex','state','cargoUUID','cargoBodyId','frames','physicsSteps'])if(typeof frame[key]==='string'||Number.isFinite(frame[key]))selected[key]=frame[key];
 if(Object.keys(selected).length)result.frame=selected;
 if(typeof value.data==='string'){const match=value.data.match(/^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/]*={0,2})$/);if(match)result.capture=imageDescription(match[2],'canvas-'+match[1]);else if(cdpScreenshot)result.capture=imageDescription(value.data,'cdp-screenshot');}
 for(const key of ['frames','angleCaptures'])if(Array.isArray(value[key])){assert.ok(value[key].length<=6001,'Observed encoded capture count');const captures=value[key].filter(row=>typeof row?.jpeg==='string').map(row=>({...imageDescription(row.jpeg,key==='frames'?'animation-frame':'animation-angle'),...(Number.isSafeInteger(row.sample)?{sample:row.sample}:{})}));if(captures.length)(result.captures??=[]).push(...captures);}
 return result;
}

export function createBrowserObserver({identity,output,maximumBytes=MAX_BYTES,httpTimeoutMs=30_000}){
 assert.equal(maximumBytes,MAX_BYTES,'Original observer budget cannot be enlarged');assert.ok(path.isAbsolute(output),'Observer sidecar path must be absolute');output=path.resolve(output);noSymlinks(output);
 assert.ok(Number.isSafeInteger(httpTimeoutMs)&&httpTimeoutMs>0&&httpTimeoutMs<=30_000,'Observer HTTP wait budget');
 const origin=copy(identity.producerOrigin),source=copy(identity.source),expected=copy(identity.expectedBuildInfo),pending=new Set(),cancelReads=new Set(),browsers=new WeakMap(),pages=new WeakMap(),handles=new WeakMap(),sessions=new WeakMap();
 const record={schemaVersion:1,kind:'campaign-v55-public-browser-observations',pass:false,publicationAccepted:false,producerOrigin:origin,source,requestedBaseURL:OBSERVED_PUBLIC_BASE,
  expectedBuildInfo:expected,observedURLs:[],pages:[],observations:[],metadataResponses:[],launchAttempts:[],moduleHooks:[],errors:[],counts:{launches:0,startedBrowsers:0,pages:0,evaluations:0,captures:0,nodeMetadataResponses:0,browserMetadataResponses:0},
  scope:'Read-only Puppeteer operation/mainframe URL observations and actual HTTP response body hashes. No game-code injection, render-frame coverage, route acceptance or new deployment is claimed.'};
 let sequence=0,bytesEstimated=0,saturated=false;
 function fail(error,phase){if(record.errors.length<100)record.errors.push({phase,error:String(error?.message||error)});}
 function append(collection,item){if(saturated)return;const size=Buffer.byteLength(JSON.stringify(item));bytesEstimated+=size;if(sequence>=MAX_EVENTS||bytesEstimated>MAX_BYTES-100_000){saturated=true;fail('Observer record/byte limit','budget');return;}collection.push(item);}
 function event(pageInfo,method,phase,url,details={}){
  let approved=false;try{assertObservedPageURL(url);approved=true;pageInfo.seenPublic=true;if(!record.observedURLs.includes(url))record.observedURLs.push(url);if(!pageInfo.row.observedURLs.includes(url))pageInfo.row.observedURLs.push(url);}
  catch(error){if(!(url==='about:blank'&&!pageInfo.seenPublic))fail(error,'page-url');}
  append(record.observations,{sequence:++sequence,pageId:pageInfo.id,browserId:pageInfo.browserId,method,phase,url,approved,...details});pageInfo.row.events++;
 }
 function actualURL(page){try{return page.url();}catch(error){fail(error,'page-url-read');return '';}}
 function describe(value,options){try{return resultDescription(value,options);}catch(error){fail(error,'capture-description');return {};}}
 function count(description){record.counts.captures+=(description.capture?1:0)+(description.captures?.length||0);}
 function track(promise){const observed=Promise.resolve(promise).catch(error=>fail(error,'http-body')).finally(()=>pending.delete(observed));pending.add(observed);return observed;}
 function summary(bytes){assert.equal(bytes.length,expected.bytes,'Actual build-info body bytes differ');assert.equal(hash(bytes),expected.sha256,'Actual build-info body hash differs');const value=JSON.parse(bytes);
  for(const key of ['commit','gameCommit','interfaceCommit'])assert.equal(value[key],source.sourceCommit);assert.equal(value.publisherCommit,null);assert.equal(value.run,String(source.sourceReview.runId));assert.equal(value.verified,false);assert.equal(value.version,'v55-castle-finale');
  return {commit:value.commit,gameCommit:value.gameCommit,interfaceCommit:value.interfaceCommit,publisherCommit:value.publisherCommit,run:value.run,verified:value.verified,version:value.version,sourceInputsSha256:value.sourceInputsSha256,packageFilesSha256:value.packageFilesSha256};}
 async function retainMetadata({transport,requestURL,responseURL,status,read}){
  metadataURL(requestURL);metadataURL(responseURL);assert.equal(status,200,'Actual build-info response must be HTTP200');const bytes=await read();assert.ok(Buffer.isBuffer(bytes));assert.ok(bytes.length>0&&bytes.length<=MAX_BYTES);const sourceSummary=summary(bytes);
  append(record.metadataResponses,{sequence:++sequence,transport,requestURL,responseURL,status,bytes:bytes.length,sha256:hash(bytes),sourceSummary});record.counts[transport==='node-fetch'?'nodeMetadataResponses':'browserMetadataResponses']++;
 }
 function wrapMethod(target,name,around){if(typeof target[name]!=='function')return()=>{};const original=target[name];const wrapped=function(...args){return around.call(this,original,args);};target[name]=wrapped;return()=>{if(target[name]===wrapped)target[name]=original;};}
 function attachHandle(handle,page,info){if(!handle||typeof handle!=='object'||handles.has(handle))return;handles.set(handle,true);
  wrapMethod(handle,'screenshot',async function(original,args){event(info,'element.screenshot','before',actualURL(page));try{const value=await Reflect.apply(original,this,args),description=describe(value);count(description);event(info,'element.screenshot','after',actualURL(page),description);return value;}catch(error){event(info,'element.screenshot','error',actualURL(page));throw error;}});
 }
 function attachSession(session,page,info){if(!session||sessions.has(session))return session;sessions.set(session,true);wrapMethod(session,'send',async function(original,args){if(args[0]!=='Page.captureScreenshot')return Reflect.apply(original,this,args);
  event(info,'cdp.Page.captureScreenshot','before',actualURL(page));try{const value=await Reflect.apply(original,this,args),description=describe(value,{cdpScreenshot:true});count(description);event(info,'cdp.Page.captureScreenshot','after',actualURL(page),description);return value;}catch(error){event(info,'cdp.Page.captureScreenshot','error',actualURL(page));throw error;}});return session;}
 function attachPage(page,browserId){if(pages.has(page))return page;const row={id:++record.counts.pages,browserId,events:0,observedURLs:[]},info={id:row.id,browserId,row,seenPublic:false};if(row.id>512){fail('Observer page limit','budget');return page;}pages.set(page,info);record.pages.push(row);event(info,'newPage','returned',actualURL(page));
  page.on?.('framenavigated',frame=>{try{if(frame===page.mainFrame())event(info,'mainframe','navigation',frame.url());}catch(error){fail(error,'mainframe');}});
  page.on?.('response',response=>{try{if(!looksLikeMetadata(response.url()))return;track(retainMetadata({transport:'browser-response',requestURL:response.request().url(),responseURL:response.url(),status:response.status(),read:async()=>Buffer.from(await response.buffer())}));}catch(error){fail(error,'browser-response');}});
  for(const method of ['goto','evaluate','evaluateHandle','$eval','$$eval','screenshot'])wrapMethod(page,method,async function(original,args){
   if(method==='goto'){try{assertObservedPageURL(String(args[0]));}catch(error){fail(error,'requested-navigation');}}
   event(info,method,'before',actualURL(page));if(['evaluate','evaluateHandle','$eval','$$eval'].includes(method))record.counts.evaluations++;
   try{const value=await Reflect.apply(original,this,args),description=describe(value);count(description);event(info,method,'after',actualURL(page),description);return value;}
   catch(error){event(info,method,'error',actualURL(page));throw error;}
  });
  for(const method of ['$','$$','waitForSelector'])wrapMethod(page,method,async function(original,args){const value=await Reflect.apply(original,this,args);for(const handle of Array.isArray(value)?value:[value])attachHandle(handle,page,info);return value;});
  wrapMethod(page,'createCDPSession',async function(original,args){return attachSession(await Reflect.apply(original,this,args),page,info);});
  wrapMethod(page,'close',async function(original,args){event(info,'page.close','before',actualURL(page));try{await flush('before-page-close');}catch(error){fail(error,'page-close-observer');}return Reflect.apply(original,this,args);});return page;
 }
 function attachBrowser(browser){if(browsers.has(browser))return browser;const id=++record.counts.startedBrowsers;if(id>32){fail('Observer browser limit','budget');return browser;}browsers.set(browser,id);
  wrapMethod(browser,'newPage',async function(original,args){return attachPage(await Reflect.apply(original,this,args),id);});
  wrapMethod(browser,'pages',async function(original,args){const values=await Reflect.apply(original,this,args);for(const page of values)attachPage(page,id);return values;});
  wrapMethod(browser,'close',async function(original,args){try{await flush('before-browser-close');}catch(error){fail(error,'browser-close-observer');}try{return await Reflect.apply(original,this,args);}finally{try{await flush('after-browser-close');}catch(error){fail(error,'browser-close-observer');}}});return browser;
 }
 function patchPuppeteer(puppeteer,label){assert.equal(typeof puppeteer.launch,'function','Actual Puppeteer launch export required');record.moduleHooks.push(label);
  return wrapMethod(puppeteer,'launch',async function(original,args){const attempt={id:++record.counts.launches,module:label,status:'starting'};record.launchAttempts.push(attempt);
   try{const browser=await Reflect.apply(original,this,args);attempt.status='started';attachBrowser(browser);return browser;}catch(error){attempt.status='failed-before-browser-return';attempt.error=String(error.message||error);throw error;}});
 }
 function patchFetch(target=globalThis){assert.equal(typeof target.fetch,'function');return wrapMethod(target,'fetch',async function(original,args){const response=await Reflect.apply(original,this,args);let requestURL;
  try{requestURL=typeof args[0]==='string'?args[0]:args[0]?.url||String(args[0]);if(looksLikeMetadata(requestURL)||looksLikeMetadata(response.url)){const cloned=response.clone();track(retainMetadata({transport:'node-fetch',requestURL,responseURL:response.url,status:response.status,read:async()=>{
   const reader=cloned.body?.getReader();assert.ok(reader,'Actual build-info body missing');const cancel=()=>{void Promise.resolve(reader.cancel()).catch(()=>{});};cancelReads.add(cancel);
   try{const chunks=[];let size=0;for(;;){const {value,done}=await reader.read();if(done)break;size+=value.byteLength;if(size>MAX_BYTES){cancel();throw Error('Actual build-info exceeds observer byte limit');}chunks.push(Buffer.from(value));}return Buffer.concat(chunks,size);}finally{cancelReads.delete(cancel);}}}));}}
  catch(error){fail(error,'node-fetch-observer');}return response;});}
 function snapshot(phase){return {...copy(record),phase,pendingHTTPReads:pending.size,pass:record.errors.length===0&&!saturated&&record.counts.startedBrowsers>0&&record.counts.pages>0&&record.counts.evaluations>0&&record.observedURLs.length>0&&record.metadataResponses.length>0&&pending.size===0};}
 function write(phase){try{const receipt=snapshot(phase),bytes=Buffer.from(JSON.stringify(receipt,null,2)+'\n');assert.ok(bytes.length<=MAX_BYTES,'Observer serialized metadata exceeds byte limit');noSymlinks(output);fs.mkdirSync(path.dirname(output),{recursive:true});noSymlinks(path.dirname(output));const temporary=output+'.'+process.pid+'.tmp';noSymlinks(temporary);fs.writeFileSync(temporary,bytes,{flag:'w'});fs.renameSync(temporary,output);return receipt;}catch(error){fail(error,'observer-write');throw error;}}
 async function flush(phase='flush'){const deadline=Date.now()+httpTimeoutMs;while(pending.size){let timer;const remaining=deadline-Date.now();if(remaining<=0){fail('Observer HTTP read deadline exceeded','http-timeout');for(const cancel of cancelReads)try{cancel();}catch{}break;}
   const settled=await Promise.race([Promise.allSettled([...pending]).then(()=>true),new Promise(resolve=>{timer=setTimeout(()=>resolve(false),remaining);})]);clearTimeout(timer);if(!settled){fail('Observer HTTP read deadline exceeded','http-timeout');for(const cancel of cancelReads)try{cancel();}catch{}break;}}
  return write(phase);}
 function exit(code){record.exitCode=code;if(code!==0)fail('Capture process exited with code '+code,'exit');if(pending.size)fail('Pending HTTP bodies at process exit','exit');return write('process-exit');}
 return {patchPuppeteer,patchFetch,flush,write,exit,snapshot,recordError:fail};
}

export async function resolvePuppeteerModules(sourceDirectory){
 const require=createRequire(path.join(path.resolve(sourceDirectory),'package.json')),cjsPath=require.resolve('puppeteer-core');let root=path.dirname(cjsPath),pkg;
 for(let i=0;i<8;i++){const candidate=path.join(root,'package.json');if(fs.existsSync(candidate)){const value=JSON.parse(fs.readFileSync(candidate));if(value.name==='puppeteer-core'){pkg=value;break;}}const next=path.dirname(root);assert.notEqual(next,root,'Puppeteer package root not found');root=next;}
 assert.ok(pkg);assert.equal(pkg.version,'24.16.0','Declared Puppeteer version required');let entry=pkg.exports?.['.']?.import;while(entry&&typeof entry==='object')entry=entry.default||entry.node||entry.import;assert.equal(typeof entry,'string','Actual Puppeteer ESM import entry required');
 const esmPath=path.resolve(root,entry);assert.ok(esmPath.startsWith(root+path.sep),'Unsafe Puppeteer import path');const esm=(await import(pathToFileURL(esmPath).href)).default,cjsNamespace=require('puppeteer-core'),cjs=cjsNamespace.default??cjsNamespace;assert.ok(esm&&cjs);
 return {esm,cjs,cjsNamespace,esmPath,cjsPath,version:pkg.version};
}
/** CI control after npm installation: uses Node's real bare-import resolver,
 * replaces launches with a sentinel, and never launches a browser. */
export async function verifyActualPuppeteerImportIdentity({sourceDirectory}){
 const modules=await resolvePuppeteerModules(sourceDirectory),parent=pathToFileURL(path.join(path.resolve(sourceDirectory),'scripts/qa-creative-browser.mjs')).href;
 const code='process.stdout.write(import.meta.resolve("puppeteer-core",process.argv[1]))';
 const actualURL=execFileSync(process.execPath,['--experimental-import-meta-resolve','--input-type=module','-e',code,parent],{encoding:'utf8',maxBuffer:1024*1024,env:{...process.env,NODE_OPTIONS:withoutObserverPreload(process.env.NODE_OPTIONS)}}).trim();
 assert.equal(actualURL,pathToFileURL(modules.esmPath).href,'Source ESM bare import differs from observer target');const futureImport=(await import(actualURL)).default;assert.strictEqual(futureImport,modules.esm);
 const observer=createBrowserObserver({identity:{producerOrigin:{kind:'module-identity-control'},source:{kind:'module-identity-control'},expectedBuildInfo:{bytes:1,sha256:'0'.repeat(64)}},output:path.join(process.cwd(),'unused-module-identity-observer.json')});
 const targets=[...new Set([modules.esm,modules.cjs,modules.cjsNamespace])],originals=targets.map(target=>Object.getOwnPropertyDescriptor(target,'launch')),sentinel={};let calls=0;
 try{for(const [index,target]of targets.entries()){target.launch=async()=>{calls++;return sentinel;};observer.patchPuppeteer(target,'actual-module-'+index);}
  assert.strictEqual(await futureImport.launch({}),sentinel);assert.strictEqual(await(modules.cjsNamespace.default??modules.cjsNamespace).launch({}),sentinel);if(modules.cjsNamespace!==modules.cjs)assert.strictEqual(await modules.cjsNamespace.launch({}),sentinel);
  const state=observer.snapshot('module-identity-control');assert.equal(state.counts.launches,calls);assert.equal(state.counts.startedBrowsers,1);
  return {kind:'puppeteer-core-24.16.0-import-identity-control',pass:true,esmSpecifier:actualURL,cjsSpecifier:pathToFileURL(modules.cjsPath).href,esmDefaultIsObserverTarget:true,cjsDefaultIsObserverTarget:true,allInvokedLaunchesObserved:true,launchCalls:calls,browserLaunches:0,sourceFilesChanged:false};
 }finally{targets.forEach((target,index)=>{if(originals[index])Object.defineProperty(target,'launch',originals[index]);else delete target.launch;});}
}
export function assertBrowserObservations(receipt,{identity}){
 assert.equal(receipt.kind,'campaign-v55-public-browser-observations');assert.equal(receipt.schemaVersion,1);assert.equal(receipt.pass,true);assert.equal(receipt.publicationAccepted,false);assert.deepEqual(receipt.errors,[]);assert.equal(receipt.pendingHTTPReads,0);
 assert.equal(receipt.phase,'process-exit','Finalized process receipt required');assert.equal(receipt.exitCode,0);
 assert.deepEqual(receipt.producerOrigin,identity.producerOrigin);assert.deepEqual(receipt.source,identity.source);assert.deepEqual(receipt.expectedBuildInfo,identity.expectedBuildInfo);assert.equal(receipt.requestedBaseURL,OBSERVED_PUBLIC_BASE);
 assert.ok(receipt.observedURLs.length>0);assert.equal(new Set(receipt.observedURLs).size,receipt.observedURLs.length);receipt.observedURLs.forEach(assertObservedPageURL);assert.ok(receipt.counts.startedBrowsers>0&&receipt.counts.pages>0&&receipt.counts.evaluations>0);
 assert.equal(receipt.pages.length,receipt.counts.pages);assert.equal(new Set(receipt.pages.map(page=>page.id)).size,receipt.pages.length);assert.ok(receipt.metadataResponses.length>0);assert.equal(receipt.metadataResponses.length,receipt.counts.nodeMetadataResponses+receipt.counts.browserMetadataResponses);
 for(const response of receipt.metadataResponses){metadataURL(response.requestURL);metadataURL(response.responseURL);assert.equal(response.status,200);assert.deepEqual({bytes:response.bytes,sha256:response.sha256},identity.expectedBuildInfo);assert.equal(response.sourceSummary.commit,identity.source.sourceCommit);assert.equal(response.sourceSummary.run,String(identity.source.sourceReview.runId));}
 for(const event of receipt.observations){assert.ok(receipt.pages.some(page=>page.id===event.pageId&&page.browserId===event.browserId));if(event.approved)assertObservedPageURL(event.url);else assert.equal(event.url,'about:blank');for(const capture of [...(event.capture?[event.capture]:[]),...(event.captures||[])]){integer(capture.bytes,'Actual capture byte count');digest(capture.sha256);}}
 return receipt;
}
async function preload(){
 const identity=observerIdentity(),output=process.env.PUBLIC_BROWSER_OBSERVATIONS;assert.ok(output&&path.isAbsolute(output),'PUBLIC_BROWSER_OBSERVATIONS absolute sidecar required');
 const sourceDirectory=path.resolve(process.env.SOURCE_DIR||(fs.existsSync(path.resolve('source/package.json'))?'source':'.'));const relative=path.relative(sourceDirectory,output);assert.ok(relative.startsWith('..'+path.sep)||path.isAbsolute(relative),'Observer must not write SOURCE files');
 const git=(...args)=>execFileSync('git',args,{cwd:sourceDirectory,encoding:'utf8'}).trim();assert.equal(git('rev-parse','HEAD'),identity.source.sourceCommit);assert.equal(git('rev-parse','HEAD^{tree}'),identity.source.sourceTree);assert.equal(git('rev-parse','HEAD^'),identity.source.sourceParent);assert.equal(git('status','--porcelain','--untracked-files=no'),'');
 const observer=createBrowserObserver({identity,output}),modules=await resolvePuppeteerModules(sourceDirectory);for(const [index,target]of[...new Set([modules.esm,modules.cjs,modules.cjsNamespace])].entries())observer.patchPuppeteer(target,['esm-default','cjs-default','cjs-namespace'][index]+':'+(target===modules.esm?modules.esmPath:modules.cjsPath));observer.patchFetch();observer.write('preloaded');
 let finishing=false;process.on('beforeExit',()=>{if(finishing)return;finishing=true;void observer.flush('before-process-exit').then(receipt=>{if(!receipt.pass){observer.recordError('Incomplete/failed observer at process completion','final-validation');process.exitCode=1;observer.write('final-validation-failed');}}).catch(()=>{process.exitCode=1;});});
 process.on('exit',code=>{try{observer.exit(code);}catch{}});
}
const invokedAsPreload=requestedPreload(process.execArgv,process.env.NODE_OPTIONS||'');
if(invokedAsPreload)await preload();
