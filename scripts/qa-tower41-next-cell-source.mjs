/** Read-only source/package/evidence receipts for the isolated next-cell CI.
 * This verifier never publishes, rewrites build metadata or declares the
 * requested replacement 500-stage tower complete. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {buildSourceInputs,walkFiles} from './lib/release-manifest.mjs';
import {assertUpgradeEvidence} from './lib/singularity-upgrade-proof.mjs';
import {checkBuild,sourceIdentity,assertObservedRoute} from './qa-tower41-ratchet-browser.mjs';
import {CAMPAIGN_ASSET_IDS} from '../src/game/labAssets.js';

export const PINS=Object.freeze({branch:'upgrade/tower41-next-cell-20261012',main:'569918af19c4dafdc0f9450e668733c474e8ff56',acceptedSource:'0e257837ca157d59d29c2e892e9a81e4f21fc5a1',canonicalSource:'8d2c01eacd86fe9235a35e7ec5f624ba62c3b29e',repository:'amazin20/brainrot-portal',publicBase:'https://amazin20.github.io/brainrot-portal/'});
const sha256=bytes=>createHash('sha256').update(bytes).digest('hex');
const read=file=>JSON.parse(fs.readFileSync(file,'utf8'));
const write=(file,value)=>{fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,JSON.stringify(value,null,2)+'\n');};
const git=(...args)=>execFileSync('git',args,{encoding:'utf8'}).trim();
const sourceFile='qa/tower41-next-cell-build/source.json',packageFile='qa/tower41-next-cell-build/package.json';
function snapshot(){
 const identity=sourceIdentity();assert.equal(git('rev-parse','HEAD'),identity.sourceCommit,'Exact current checkout required');
 assert.equal(git('status','--porcelain','--untracked-files=no'),'','Committed source must remain unchanged');
 if(process.env.GITHUB_REF)assert.equal(process.env.GITHUB_REF,'refs/heads/'+PINS.branch,'Only the isolated review branch is permitted');
 const inputs=buildSourceInputs(),verifiers=['.github/workflows/tower41-next-cell-review.yml','scripts/qa-tower41-next-cell-source.mjs','scripts/qa-tower41-ratchet-browser.mjs','scripts/record-tower41-ratchet-walkthrough.mjs','scripts/singularity-browser.mjs','scripts/lib/singularity-upgrade-proof.mjs','scripts/test-active-game.mjs'].map(file=>({file,sha256:sha256(fs.readFileSync(file))}));
 return {...identity,tree:git('rev-parse','HEAD^{tree}'),sourceInputsSha256:sha256(JSON.stringify(inputs)),sourceInputFiles:inputs.length,verifiers};
}
function verifySource(){const actual=snapshot(),frozen=read(sourceFile);for(const key of ['sourceCommit','sourceReview','tree','sourceInputsSha256','sourceInputFiles','verifiers'])assert.deepEqual(actual[key],frozen[key],'Frozen source mismatch: '+key);return frozen;}
async function get(url,{github=false}={}){
 const headers={Accept:'application/vnd.github+json','User-Agent':'tower41-next-cell-read-only-review'};
 if(github&&process.env.GITHUB_TOKEN)headers.Authorization='Bearer '+process.env.GITHUB_TOKEN;
 const response=await fetch(url,{headers,cache:'no-store',signal:AbortSignal.timeout(30000)});assert.ok(response.ok,'Read-only baseline request failed: '+response.status+' '+new URL(url).pathname);
 const bytes=Buffer.from(await response.arrayBuffer());return {data:JSON.parse(bytes),bytes:bytes.length,sha256:sha256(bytes)};
}
async function guard(){
 const identity=sourceIdentity(),query='?tower41review='+identity.sourceReview.runId+'-'+identity.sourceReview.runAttempt+'-'+Date.now();
 const [main,head,accepted,canonical]=await Promise.all([
  get('https://api.github.com/repos/'+PINS.repository+'/git/ref/heads/main',{github:true}),
  get('https://api.github.com/repos/'+PINS.repository+'/git/ref/heads/'+PINS.branch,{github:true}),
  get(PINS.publicBase+'puzzle-progression-finale/build-info.json'+query),get(PINS.publicBase+'build-info.json'+query)]);
 assert.equal(main.data.object.sha,PINS.main,'Main changed during this isolated review');assert.equal(head.data.object.sha,identity.sourceCommit,'The isolated review branch advanced');
 assert.equal(accepted.data.commit,PINS.acceptedSource,'Accepted isolated namespace changed');assert.equal(canonical.data.commit,PINS.canonicalSource,'Accepted canonical campaign changed');
 return {pass:true,...identity,main:PINS.main,acceptedSource:PINS.acceptedSource,canonicalSource:PINS.canonicalSource,acceptedMetadata:{bytes:accepted.bytes,sha256:accepted.sha256},canonicalMetadata:{bytes:canonical.bytes,sha256:canonical.sha256},checkedAt:new Date().toISOString(),scope:'Read-only main ref and the two explicitly pinned public metadata files; no whole-site byte claim.',publicationAccepted:false};
}
export function verifyRuntimeModels({sourceBytes,productionBytes,readOriginal,readProduction}){
 const source=JSON.parse(sourceBytes),production=JSON.parse(productionBytes);
 assert.equal(production.models.length,14);assert.equal(new Set(source.models.map(model=>model.id)).size,source.models.length,'Original catalogue IDs must be unique');
 assert.equal(new Set(production.models.map(model=>model.id)).size,14,'Production model IDs must be unique');
 assert.deepEqual(production.models.map(model=>model.id).sort((a,b)=>a-b),[...CAMPAIGN_ASSET_IDS].sort((a,b)=>a-b),'All original campaign model IDs required');
 const records=production.models.map(model=>{
  const original=source.models.find(row=>row.id===model.id);assert.ok(original,'Production model missing from original catalogue: '+model.id);
  const canonical=({id,filename,outputSHA256,outputBytes})=>({id,filename,outputSHA256,outputBytes});
  assert.deepEqual(canonical(model),canonical(original),'Production manifest replaced an original model record: '+model.id);
  assert.match(model.filename,/^[A-Za-z0-9_-]+\.glb$/,'Model filename must stay inside runtime directory');
  const originalFile=readOriginal(model.filename),productionFile=readProduction(model.filename);
  for(const bytes of [originalFile,productionFile]){assert.equal(bytes.length,original.outputBytes);assert.equal(sha256(bytes),original.outputSHA256,'Original runtime model bytes required: '+model.id);}
  return canonical(original);
 }).sort((a,b)=>a.id-b.id);
 return {sourceManifestSha256:sha256(sourceBytes),productionManifestSha256:sha256(productionBytes),canonicalRecordsSha256:sha256(JSON.stringify(records)),canonicalRecords:records};
}
function packageReceipt(){
 const source=verifySource(),{info,nativePackage}=checkBuild();assert.equal(info.version,'v54-unified-campaign');assert.equal(info.levels,51);assert.equal(info.verified,false);
 const files=walkFiles('dist'),totalBytes=files.reduce((n,file)=>n+fs.statSync(file).size,0);assert.ok(totalBytes>0&&totalBytes<=100_000_000,'The complete production package must be <=100 MB');
 const runtimeModels=verifyRuntimeModels({sourceBytes:fs.readFileSync('public/models/runtime/manifest.json'),productionBytes:fs.readFileSync('dist/models/runtime/manifest.json'),readOriginal:filename=>fs.readFileSync(path.join('public/models/runtime',filename)),readProduction:filename=>fs.readFileSync(path.join('dist/models/runtime',filename))});
 return {pass:true,sourceCommit:source.sourceCommit,sourceReview:source.sourceReview,tree:source.tree,sourceInputsSha256:source.sourceInputsSha256,version:info.version,totalBytes,buildInfoSha256:sha256(fs.readFileSync('dist/build-info.json')),runtimeModels,nativePackage,fullTowerAccepted:false,publicationAccepted:false};
}
function verifyPackage(){const actual=packageReceipt(),frozen=read(packageFile);assert.deepEqual(actual,frozen,'One exact build artifact must serve every independent review job');return actual;}
export function parseTap(log){
 const field=name=>{const rows=[...log.matchAll(new RegExp('^# '+name+' (\\d+)\\r?$','gm'))];assert.equal(rows.length,1,'One actual final TAP '+name+' footer required');return Number(rows[0][1]);};
 const actual=Object.fromEntries(['tests','pass','fail','cancelled','skipped','todo'].map(name=>[name,field(name)]));
 assert.ok(Number.isSafeInteger(actual.tests)&&actual.tests>0);assert.equal(actual.tests,actual.pass,'Every actual registered test must pass');
 for(const name of ['fail','cancelled','skipped','todo'])assert.equal(actual[name],0,'No '+name+' regressions accepted');return actual;
}
function cpu(logfile){
 const packageProof=verifyPackage(),bytes=fs.readFileSync(logfile),actual=parseTap(bytes.toString('utf8'));
 const receipt={pass:true,...sourceIdentity(),packageFilesSha256:packageProof.nativePackage.packageFilesSha256,actual,log:{file:path.basename(logfile),bytes:bytes.length,sha256:sha256(bytes)},scope:'Full npm test actual final TAP totals, with no stale fixed registration count.',fullTowerAccepted:false,publicationAccepted:false};
 write('qa/tower41-next-cell-cpu/report.json',receipt);console.log('TOWER41_NEXT_CPU',JSON.stringify(receipt));
}
function contact(){
 const frozen=verifyPackage(),native=read('qa/tower41-next-cell-contact/report.json'),movie=read('qa/tower41-next-cell-contact-movie/tower41-ratchet-qualification.json');
 for(const proof of [native,movie]){assert.equal(proof.pass,true);assert.equal(proof.sourceCommit,frozen.sourceCommit);assert.deepEqual(proof.sourceReview,frozen.sourceReview);assert.deepEqual(proof.nativePackage,frozen.nativePackage);assertObservedRoute(proof.observed,'qualification');assert.deepEqual(proof.errors,[]);assert.equal(proof.publicationAccepted,false);}
 for(const proof of [native,movie])assert.equal(proof.observed.cameraReview.outsideSamples.length,0,'Every measured bounded native sample must frame all live original-player vertices');
 assert.equal(movie.video.fps,4);assert.equal(movie.video.width,640);assert.equal(movie.video.height,360);assert.equal(movie.video.pixelCheck.fullMP4Decode,true);
 const moviePath=path.join('qa/tower41-next-cell-contact-movie',movie.video.filename),bytes=fs.readFileSync(moviePath);assert.equal(sha256(bytes),movie.video.sha256);assert.equal(bytes.length,movie.video.bytes);
 write('qa/tower41-next-cell-contact/binding.json',{pass:true,...sourceIdentity(),packageFilesSha256:frozen.nativePackage.packageFilesSha256,nativeReportSha256:sha256(fs.readFileSync('qa/tower41-next-cell-contact/report.json')),recordingReportSha256:sha256(fs.readFileSync('qa/tower41-next-cell-contact-movie/tower41-ratchet-qualification.json')),videoSha256:movie.video.sha256,allBoundedNativeSamplesInLens:true,fullCameraAccepted:false,fullTowerAccepted:false,publicationAccepted:false});
 console.log('TOWER41_NEXT_CONTACT PASS',frozen.sourceCommit);
}
function castle(){
 const frozen=verifyPackage(),info=read('dist/build-info.json'),proof=read('qa/tower41-next-cell-castle/evidence.json');assertUpgradeEvidence(proof,info,{record:true});
 const flywheel=proof.observed.events.find(event=>event.id==='flywheel')?.proof;
 assert.ok(flywheel,'The completed ordinary route must include the real flywheel proof');
 assert.equal(flywheel.originalCargo,true);assert.equal(flywheel.physicalAngularMomentum,true);
 assert.equal(flywheel.originalCargoBodyId,proof.observed.bodyId,'The clutch must use the same original body as the whole route');
 assert.equal(flywheel.ratio,1);assert.equal(flywheel.ratioValue,2/3);assert.equal(flywheel.clutch,true);assert.equal(flywheel.brake,false);
 assert.equal(flywheel.loadContact,true);assert.ok(flywheel.loadContactCount>0&&flywheel.loadNormalForce>0);
 assert.equal(flywheel.contactStep,flywheel.worldStep,'Proof must observe current actual supporting contact');
 assert.ok(flywheel.output>4.9&&flywheel.output<6.1&&flywheel.stable>=2&&flywheel.energy>0);
 assert.equal(flywheel.readyForProof,true);assert.deepEqual(flywheel.constraintEquationCounts,[5,5,5,1,1]);
 assert.equal(flywheel.rotors.length,3);assert.ok(flywheel.rotors.every(rotor=>rotor.angularVelocity.every(Number.isFinite)&&rotor.inertia[2]>0));
 assert.equal(proof.sourceCommit,frozen.sourceCommit);assert.equal(proof.video.fps,4);assert.equal(proof.video.width,640);assert.equal(proof.video.height,360);assert.deepEqual(proof.capture.nativeCanvas,{width:640,height:360});
 const movie=path.join('qa/tower41-next-cell-castle',proof.video.filename),bytes=fs.readFileSync(movie);assert.equal(sha256(bytes),proof.video.sha256);
 execFileSync('ffmpeg',['-hide_banner','-loglevel','error','-xerror','-i',movie,'-f','null','-'],{timeout:300000,stdio:'inherit'});
 write('qa/tower41-next-cell-castle/binding.json',{pass:true,...sourceIdentity(),packageFilesSha256:frozen.nativePackage.packageFilesSha256,buildInfoSha256:frozen.buildInfoSha256,evidenceSha256:sha256(fs.readFileSync('qa/tower41-next-cell-castle/evidence.json')),mechanisms:11,sameCargo:true,resets:0,video:{file:proof.video.filename,bytes:bytes.length,sha256:proof.video.sha256,fullMP4Decode:true},scope:'Complete current ordinary eleven-mechanism castle; not the requested replacement 500-stage tower.',fullTowerAccepted:false,publicationAccepted:false});console.log('TOWER41_NEXT_CASTLE PASS',frozen.sourceCommit,proof.result.seconds);
}
function status(name,directory,...extraDirectories){
 const state=process.env.REVIEW_JOB_STATUS||'unknown',logs=[directory,...extraDirectories].flatMap(folder=>walkFiles(folder)).filter(file=>file.endsWith('.log')).map(file=>({file:path.relative(directory,file),bytes:fs.statSync(file).size,sha256:sha256(fs.readFileSync(file))}));
 const receipt={job:name,status:state,...sourceIdentity(),logs,fullTowerAccepted:false,publicationAccepted:false};write(path.join(directory,'job-status.json'),receipt);console.log('TOWER41_NEXT_JOB',JSON.stringify({job:name,status:state,...sourceIdentity(),logs:logs.length}));
}
async function main(){
 const [command,...args]=process.argv.slice(2);
 if(command==='freeze'){const source=snapshot(),baseline=await guard();write(sourceFile,{...source,baseline});console.log('TOWER41_NEXT_SOURCE',JSON.stringify({...source,verifiers:source.verifiers.length,main:PINS.main}));}
 else if(command==='source')verifySource();
 else if(command==='package'){const receipt=packageReceipt();write(packageFile,receipt);console.log('TOWER41_NEXT_PACKAGE',JSON.stringify({sourceCommit:receipt.sourceCommit,totalBytes:receipt.totalBytes,models:receipt.nativePackage.modelHashes.length,packageFilesSha256:receipt.nativePackage.packageFilesSha256}));}
 else if(command==='verify-package')verifyPackage();
 else if(command==='cpu')cpu(args[0]);
 else if(command==='contact')contact();
 else if(command==='castle')castle();
 else if(command==='status')status(...args);
 else if(command==='guard'){const frozen=verifySource(),current=await guard();for(const key of ['main','acceptedSource','canonicalSource','acceptedMetadata','canonicalMetadata'])assert.deepEqual(current[key],frozen.baseline[key],'Read-only baseline changed: '+key);write('qa/tower41-next-cell-summary/baseline.json',current);}
 else if(command==='summary'){
  const jobs=JSON.parse(process.env.REVIEW_JOB_RESULTS||'{}');for(const [job,result]of Object.entries(jobs))console.log('TOWER41_NEXT_JOB',JSON.stringify({job,status:result,...sourceIdentity()}));
  write('qa/tower41-next-cell-summary/jobs.json',{...sourceIdentity(),jobs,allRequiredJobsPassed:Object.values(jobs).length===4&&Object.values(jobs).every(result=>result==='success'),fullTowerAccepted:false,publicationAccepted:false});
  assert.equal(Object.values(jobs).length,4);assert.ok(Object.values(jobs).every(result=>result==='success'),'Review remains incomplete until every independent required job succeeds');
 }else throw Error('Use freeze, source, package, verify-package, cpu, contact, castle, status, guard or summary');
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))await main();
