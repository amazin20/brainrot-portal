import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import {verifyReleaseMetadata} from './lib/release-manifest.mjs';
import {verifyCampaignPackage} from './v8-package-check.mjs';
import {assertCampaignBrowserState} from './lib/campaign-browser-contract.mjs';
import {assertFoundation20Route} from './lib/foundation20-native-proof.mjs';
import {assertPendulumPhysicalProof} from './lib/tower41-pendulum-proof.mjs';
import {RELEASE_VERSION} from '../src/game/ReleaseIdentity.js';

const LIMIT=100_000_000;
const read=file=>JSON.parse(fs.readFileSync(file,'utf8'));
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const write=(file,value)=>{fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,JSON.stringify(value,null,2)+'\n');};
const git=(...args)=>execFileSync('git',args,{encoding:'utf8'}).trim();
const vector=value=>Array.isArray(value)&&value.length===3&&value.every(Number.isFinite);
function identity(){
 const sourceCommit=process.env.BUILD_COMMIT||process.env.GITHUB_SHA;
 assert.match(sourceCommit||'',/^[a-f0-9]{40}$/);assert.equal(git('rev-parse','HEAD'),sourceCommit);
 assert.equal(git('status','--porcelain','--untracked-files=no'),'','Review only a committed source snapshot');
 assert.equal(git('status','--porcelain','--untracked-files=all','--','src','public','index.html','vite.config.js','package.json','package-lock.json'),'');
 assert.equal(RELEASE_VERSION,'v57-physical-power');
 const runId=process.env.SOURCE_REVIEW_RUN_ID||process.env.GITHUB_RUN_ID,runAttempt=process.env.SOURCE_REVIEW_RUN_ATTEMPT||process.env.GITHUB_RUN_ATTEMPT;
 for(const value of [runId,runAttempt])if(value!==undefined)assert.ok(/^[1-9][0-9]*$/.test(value)&&Number.isSafeInteger(Number(value)));
 return {sourceCommit,sourceTree:git('rev-parse','HEAD^{tree}'),sourceParent:git('cat-file','commit','HEAD').match(/^parent ([a-f0-9]{40})$/m)?.[1]??null,
  sourceReview:{runId:runId?Number(runId):null,runAttempt:runAttempt?Number(runAttempt):null},version:RELEASE_VERSION};
}
export function inventory(directory,maximum=LIMIT){
 const rows=[];let bytes=0;
 function visit(folder){for(const name of fs.readdirSync(folder).sort()){
  const file=path.join(folder,name),st=fs.lstatSync(file);assert.equal(st.isSymbolicLink(),false);
  if(st.isDirectory())visit(file);else{assert.equal(st.isFile(),true);bytes+=st.size;assert.ok(bytes<=maximum);
   rows.push({path:path.relative(directory,file).split(path.sep).join('/'),bytes:st.size,sha256:sha(fs.readFileSync(file))});}
 }}visit(directory);assert.ok(rows.length>0);return rows.sort((a,b)=>a.path<b.path?-1:a.path>b.path?1:0);
}
function packageStamp(manifest){return {commit:manifest.commit,version:manifest.version,editionVersion:manifest.editionVersion,sourceInputsSha256:manifest.sourceInputsSha256};}
export function verifyPackage(directory='dist'){
 const source=identity(),manifest=read(path.join(directory,'build-info.json'));
 verifyReleaseMetadata(manifest,{directory,commit:source.sourceCommit,root:process.cwd(),run:source.sourceReview.runId===null?null:String(source.sourceReview.runId)});
 verifyCampaignPackage(directory);const files=inventory(directory),bytes=files.reduce((n,row)=>n+row.bytes,0);
 assert.equal(manifest.verified,false);assert.equal(manifest.levels,51);assert.equal(manifest.rooms.at(-1).stableLevel,41);
 return {source,manifest,files,bytes,inventorySha256:sha(Buffer.from(JSON.stringify(files)))};
}
function build(){
 const result=verifyPackage(),yandex=read('qa/yandex-package/report.json'),archive=fs.readFileSync('qa/yandex-package/brainrot-portal-v57-yandex.zip');
 assert.equal(yandex.pass,true);assert.equal(yandex.sourceCommit,result.source.sourceCommit);assert.equal(yandex.sourceTree,result.source.sourceTree);
 assert.equal(yandex.workingTreeModified,false);assert.equal(yandex.builtFromCurrentSource,true);assert.equal(yandex.compressedBytes,archive.length);
 assert.equal(yandex.sha256,sha(archive));assert.ok(archive.length<=LIMIT&&yandex.unpackedBytes<=LIMIT);assert.equal(yandex.limitBytes,LIMIT);
 const report={schemaVersion:1,kind:'physical-power-source-package',pass:true,sourceAccepted:false,publicationAccepted:false,...result.source,
  dist:{files:result.files,bytes:result.bytes,inventorySha256:result.inventorySha256},yandex:{filename:yandex.archiveFilename,bytes:archive.length,sha256:yandex.sha256,unpackedBytes:yandex.unpackedBytes},
  limitations:['Build integrity is not completed source or public acceptance.','Headless/software WebGL checks do not establish human playtests, device FPS or live platform approval.']};
 write('qa/physical-power-build/report.json',report);console.log(JSON.stringify({kind:report.kind,source:result.source,files:result.files.length,bytes:result.bytes,yandexBytes:archive.length}));
}
function pixels(directory,names){
 const code="import json,sys\nfrom PIL import Image,ImageStat\nout=[]\nfor name in json.loads(sys.argv[2]):\n p=Image.open(sys.argv[1]+'/'+name);p.load();p=p.convert('RGB');s=p.resize((64,36));v={'file':name,'width':p.width,'height':p.height,'colors':len(s.getcolors(2305) or []),'maxChannelStd':max(ImageStat.Stat(s).stddev)};assert v['width']>=100 and v['height']>=100 and v['colors']>=4 and v['maxChannelStd']>=1;out.append(v)\nprint(json.dumps(out))";
 const decoded=JSON.parse(execFileSync(process.env.CODEX_PRIMARY_RUNTIME_PYTHON||'python3',['-c',code,directory,JSON.stringify(names)],{encoding:'utf8'}));
 assert.equal(decoded.length,names.length);return decoded.map(row=>{const file=path.join(directory,row.file);assert.equal(fs.lstatSync(file).isFile(),true);const bytes=fs.readFileSync(file);return {...row,bytes:bytes.length,sha256:sha(bytes)};});
}
export function verifyBrowser(file,levels,mode='route'){
 const {source,manifest}=verifyPackage(),report=read(file),names=[];
 assert.equal(report.sourceCommit,source.sourceCommit);assert.deepEqual(report.package,packageStamp(manifest));assert.equal(report.mode,mode);
 assert.equal(report.pass,true);assert.equal(report.capturePass,true);assert.equal(report.strictCapture,true);assert.deepEqual(report.errors,[]);assert.equal(report.active,undefined);
 assert.deepEqual(report.rows.map(row=>row.level),levels);const novelProofs=[];
 for(const row of report.rows){
  assert.equal(row.pass,true);assert.equal(row.capturePass,true);assert.deepEqual(row.errors,[]);assert.equal(row.error,undefined);
  assertCampaignBrowserState(row.start,row.level);assert.deepEqual(row.start.missingModels,[]);
  if(mode==='route'){
   assert.equal(row.gameplayPassed,true);const route=row.route;assert.equal(route.pass,true);assert.equal(route.state,'won');assert.equal(route.sameCompanion,true);assert.equal(route.sameCargoShape,true);
   assert.equal(route.cargoUUID,row.start.cargoUUID);assert.equal(route.cargoBodyId,row.start.cargoBodyId);assert.ok(Number.isFinite(route.frames)&&route.frames>0);
   assert.equal(route.resets??0,0);assert.equal(route.respawns??0,0);assert.equal(route.cargoResets??0,0);assert.deepEqual(Object.keys(row.captures),['finish']);
   const capture=row.captures.finish;assert.equal(capture.ok,true);assert.equal(capture.includesHTML,false);assert.ok(capture.renderer.calls>0&&capture.renderer.triangles>0);
   assert.equal(capture.frame?.state,'won');assert.equal(capture.frame.levelIndex,row.level-1);assert.equal(capture.frame.cargoUUID,row.start.cargoUUID);assert.equal(capture.frame.cargoBodyId,row.start.cargoBodyId);
   if(row.level===20)assertFoundation20Route(route.foundation20Proof);
   if(row.level===41){
    assert.deepEqual(route.milestones.filter(mark=>mark.name?.startsWith('Solved ')).map(mark=>mark.name.slice(7)),['freight','sluice','optics','hoist','archive','flywheel','magnet','migrant','pendulum','inertia','crown']);
    const proof=route.milestones.find(mark=>mark.name==='Solved pendulum')?.physicsProof;
    assert.equal(proof?.twoPhysicalCatches,true);assert.equal(proof.physicalUpperCatch,true);assert.equal(Object.hasOwn(proof,'upperCatchKinematic'),false);
    novelProofs.push({level:41,...assertPendulumPhysicalProof(proof,row.start.cargoBodyId)});
   }
   names.push(`${row.level}-finish.jpg`);
  }else{
   assert.equal(report.inspectionQuality,'balanced');assert.equal(row.start.quality,'balanced');assert.equal(row.start.shadows,true);
   assert.deepEqual(Object.keys(row.captures),['start','overview']);for(const kind of ['start','overview']){assert.equal(row.captures[kind].ok,true);names.push(`${row.level}-${kind}.jpg`);}
   const f=row.framing,b=f?.bounds;assert.equal(f?.kind,'interior-camera-inspection');assert.equal(f.geometryVisibilityChanged,false);assert.ok(vector(f.eye)&&vector(f.target));
   for(const key of ['minX','maxX','minZ','maxZ','base','roof'])assert.ok(Number.isFinite(b?.[key]));
   assert.ok(b.maxX>b.minX&&b.maxZ>b.minZ&&b.roof-b.base>=4);assert.ok(f.eye[0]>b.minX&&f.eye[0]<b.maxX&&f.eye[2]>b.minZ&&f.eye[2]<b.maxZ&&f.eye[1]>b.base&&f.eye[1]<b.roof-1);
   assert.ok(f.roofClearance>1&&Math.abs(f.roofClearance-(b.roof-f.eye[1]))<1e-9);assert.ok(f.visibleFloorPoints>=3);
  }
 }
 const reportOut={schemaVersion:1,kind:'physical-power-'+mode+'-check',pass:true,sourceAccepted:false,publicationAccepted:false,...source,levels,
  sourceReport:{path:path.basename(file),bytes:fs.statSync(file).size,sha256:sha(fs.readFileSync(file))},decodedImages:pixels(path.dirname(file),names),novelProofs,
  scope:mode==='route'?'Actual production WebGL wins and original-body finish pixels; not full-route movies.':'Balanced interior stills of the two changed rooms; no puzzle win or human visual acceptance claimed.'};
 write(path.join(path.dirname(file),'checked.json'),reportOut);console.log(JSON.stringify({kind:reportOut.kind,pass:true,levels,decodedImages:reportOut.decodedImages.length,novelProofs:novelProofs.length}));return reportOut;
}
function physicsTap(file,testFiles){
 const source=identity(),tap=fs.readFileSync(file),counts=Object.fromEntries(['tests','pass','fail','cancelled','skipped','todo'].map(key=>{const matches=[...tap.toString().matchAll(new RegExp('^# '+key+' (\\d+)$','gm'))];assert.equal(matches.length,1);return [key,Number(matches[0][1])];}));
 assert.ok(Object.values(counts).every(Number.isSafeInteger)&&counts.tests>0);assert.equal(counts.pass,counts.tests);for(const key of ['fail','cancelled','skipped','todo'])assert.equal(counts[key],0);
 assert.ok(testFiles.length>=5&&new Set(testFiles).size===testFiles.length);const files=testFiles.map(file=>({path:file,sha256:sha(fs.readFileSync(file))}));
 write(path.join(path.dirname(file),'report.json'),{schemaVersion:1,kind:'physical-power-novel-physics-regressions',pass:true,sourceAccepted:false,publicationAccepted:false,...source,files,counts,tap:{path:path.basename(file),bytes:tap.length,sha256:sha(tap)},scope:'Explicit finite current-load/light/contact/energy and bypass regressions; not exhaustive exploit closure.'});
 console.log(JSON.stringify({pass:true,files:files.length,counts}));
}
if(process.argv[1]&&pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url){
 const [command,file,list,...extra]=process.argv.slice(2);
 if(command==='package')build();else if(command==='verify-package'){const result=verifyPackage();console.log(JSON.stringify({pass:true,...result.source,files:result.files.length,bytes:result.bytes,inventorySha256:result.inventorySha256}));}
 else if(command==='native'||command==='architecture'){const levels=String(list).split(',').map(Number);assert.ok(levels.length&&levels.every(level=>Number.isSafeInteger(level)&&level>=1&&level<=51));verifyBrowser(file,levels,command==='native'?'route':'overview');}
 else if(command==='physics-tap')physicsTap(file,[list,...extra]);else throw Error('Unknown physical-power review command');
}
