import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {Readable,Transform,Writable} from 'node:stream';
import {pipeline} from 'node:stream/promises';
const ROOT='https://amazin20.github.io/brainrot-portal/';
const SOURCE='6f1eec54d47fed7916f5346a218525292d15fd62';
const RELEASE_SHA='4b25480f540789f4538538158e2c987d582f1d4c19920e8bfd4dc8ae9e32b0bb';
const SITE=path.resolve(process.env.SITE_DIR||'site');
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const read=file=>JSON.parse(fs.readFileSync(file,'utf8'));
function safe(name){assert.equal(typeof name,'string');assert.ok(name&&!/[\\:%?#\x00-\x1f]/.test(name)&&!name.startsWith('/')&&name.split('/').every(p=>p&&p!=='.'&&p!=='..'),'Unsafe publication path');return name;}
async function buffer(name){const r=await fetch(new URL(safe(name),ROOT),{cache:'no-store',signal:AbortSignal.timeout(90000)});assert.ok(r.ok,'HTTP '+r.status+' '+name);return Buffer.from(await r.arrayBuffer());}
async function transfer(file,directory){
 for(let attempt=0;attempt<3;attempt++){
  let temporary;
  try{
   const url=new URL(safe(file.path),ROOT);url.searchParams.set('atlas-base',SOURCE);
   const r=await fetch(url,{cache:'no-store',signal:AbortSignal.timeout(90000)});assert.ok(r.ok,'HTTP '+r.status+' '+file.path);
   let bytes=0;const digest=createHash('sha256');
   const meter=new Transform({transform(chunk,encoding,cb){bytes+=chunk.length;digest.update(chunk);cb(null,chunk);}});
   let sink;
   if(directory){const filename=path.join(directory,safe(file.path));fs.mkdirSync(path.dirname(filename),{recursive:true});temporary=filename+'.atlas-part';sink=fs.createWriteStream(temporary);}
   else sink=new Writable({write(chunk,encoding,cb){cb();}});
   await pipeline(Readable.fromWeb(r.body),meter,sink);
   assert.equal(digest.digest('hex'),file.sha256,'Changed public bytes: '+file.path);
   if(file.bytes!==undefined)assert.equal(bytes,file.bytes,'Changed public size: '+file.path);
   if(temporary)fs.renameSync(temporary,path.join(directory,file.path));
   return bytes;
  }catch(error){if(temporary)fs.rmSync(temporary,{force:true});if(attempt===2)throw error;await new Promise(r=>setTimeout(r,500*(attempt+1)));}
 }
}
async function bounded(files,fn){
 let cursor=0,bytes=0,count=0;
 await Promise.all(Array.from({length:4},async()=>{
  while(cursor<files.length){
   const f=files[cursor++];
   // Do not read the shared total before an await: other streams may finish.
   const transferred=await fn(f);bytes+=transferred;count++;
   if(count%75===0)console.log('verified',count,'/',files.length);
  }
 }));
 assert.equal(count,files.length);return {files:count,bytes};
}
function inventory(root){return fs.readdirSync(root,{withFileTypes:true}).flatMap(e=>{assert.ok(!e.isSymbolicLink());const p=path.join(root,e.name);return e.isDirectory()?inventory(p):[{path:safe(path.relative(SITE,p).split(path.sep).join('/')),bytes:fs.statSync(p).size,sha256:hash(fs.readFileSync(p))}];}).sort((a,b)=>a.path.localeCompare(b.path));}
function write(relative,bytes){const p=path.join(SITE,safe(relative));fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,bytes);}
function copy(source,relative){const p=path.join(SITE,safe(relative));fs.mkdirSync(path.dirname(p),{recursive:true});fs.copyFileSync(source,p);}
const mode=process.argv[2]||'assemble';
if(mode==='assemble'){
 assert.ok(!fs.existsSync(SITE),'Use a fresh publication directory');fs.mkdirSync(SITE,{recursive:true});
 const releaseBytes=await buffer('expedition-release.json');assert.equal(hash(releaseBytes),RELEASE_SHA,'The public baseline changed');
 const r=JSON.parse(releaseBytes);assert.equal(r.sourceCommit,SOURCE);assert.equal(String(r.publicationRun),'37401009893');
 const info=JSON.parse(await buffer('build-info.json'));assert.equal(info.commit,SOURCE);assert.equal(info.levels,51);assert.equal(info.interfaceVersion,undefined,'Do not overwrite a newer interface');
 const recordings=[...r.newRecordings,...r.alternateRecordings];
 const files=[...r.exactCandidateFiles,...r.exactCandidateFiles.map(f=>({...f,path:r.previewPath+'/'+f.path})),...r.preservedFiles,...r.archivedFiles.map(f=>({...f,path:f.archivedPath})),...r.historicalRuntime.files,r.historicalVideoIndex,...r.generatedPresentationFiles,...recordings.flatMap(v=>[{path:v.src,bytes:v.bytes,sha256:v.sha256},{path:v.poster,sha256:v.posterSHA256},{path:v.finishPoster,sha256:v.finishPosterSHA256},{path:v.evidence,sha256:v.evidenceSHA256}]),...r.supplementalRecordingProof.captureSourceEvidence];
 const unique=new Map();for(const f of files){safe(f.path);assert.match(f.sha256,/^[a-f0-9]{64}$/);const previous=unique.get(f.path);if(previous){assert.equal(previous.sha256,f.sha256);if(previous.bytes!==undefined&&f.bytes!==undefined)assert.equal(previous.bytes,f.bytes);}else unique.set(f.path,f);}
 const preserved=await bounded([...unique.values()],f=>transfer(f,SITE));
 assert.equal(preserved.bytes,inventory(SITE).reduce((total,f)=>total+f.bytes,0),'Preserved size report must match the actual saved files');
 write('expedition-release.json',releaseBytes);
 // Preserve the exact previous playable runtime and its metadata.
 const archive='publication-history/'+SOURCE;
 for(const f of r.exactCandidateFiles)copy(path.join(SITE,f.path),archive+'/'+f.path);
 write('release-snapshots/v50-expedition/expedition-release.json',releaseBytes);
 const sourceFiles=fs.readdirSync('ui').filter(n=>/^atlas-[a-z0-9-]+\.(js|css)$/.test(n)).sort();assert.equal(sourceFiles.length,11);
 const added=sourceFiles.reduce((n,f)=>n+fs.statSync('ui/'+f).size,0);assert.ok(added<100000,'Menu source budget exceeded');
 const changes=[];
 for(const prefix of ['',r.previewPath+'/']){
  const original=fs.readFileSync(path.join(SITE,prefix+'index.html'),'utf8');assert.equal(hash(original),'290b84b41988fb1f5fa1cf7a6c757e4dd38fa9be4248b7bd45ca4b159d8153fb');
  const updated=original.replace('</head>','  <link rel="stylesheet" href="./ui/atlas-v51.css">\n    <script type="module" src="./ui/atlas-v51.js"></script>\n  </head>');assert.notEqual(updated,original);write(prefix+'index.html',updated);changes.push(prefix+'index.html');
  for(const file of sourceFiles){copy('ui/'+file,prefix+'ui/'+file);changes.push(prefix+'ui/'+file);}
  const metadata={...info,gameplayVersion:info.version,version:'v51-atlas',interfaceVersion:'v51-atlas',interfaceCommit:process.env.GITHUB_SHA,interfaceRun:process.env.GITHUB_RUN_ID,presentationOverlay:'atlas-interface.json'};
  write(prefix+'build-info.json',JSON.stringify(metadata,null,2)+'\n');changes.push(prefix+'build-info.json');
 }
 // The game permalink gets real thumbnail files and a working gallery link.
 for(const v of r.newRecordings)copy(path.join(SITE,v.poster),r.previewPath+'/'+v.poster);
 write(r.previewPath+'/walkthroughs.html','<!doctype html><html lang="ru"><meta charset="utf-8"><meta http-equiv="refresh" content="0;url=../walkthroughs.html"><title>Прохождения</title><a href="../walkthroughs.html">Открыть галерею прохождений</a></html>');
 // Prove the gameplay, original models and every old video remain unchanged.
 const immutable=r.exactCandidateFiles.filter(f=>!['index.html','build-info.json'].includes(f.path));
 for(const prefix of ['',r.previewPath+'/'])for(const f of immutable)assert.equal(hash(fs.readFileSync(path.join(SITE,prefix+f.path))),f.sha256,'Gameplay bytes changed');
 const report={version:'v51-atlas',interfaceCommit:process.env.GITHUB_SHA,gameplaySourceCommit:SOURCE,sourceReleaseSHA256:RELEASE_SHA,sourceReleaseRun:r.publicationRun,publicationRun:process.env.GITHUB_RUN_ID,preserved,menuBytes:added,immutableRuntimeFiles:immutable.length,levels:51,changes,files:inventory(SITE),acceptance:{humanPlaytest:false,physicalDeviceBenchmark:false,liveYandex:false}};
 write('atlas-interface.json',JSON.stringify(report,null,2)+'\n');
 fs.mkdirSync('atlas-proof',{recursive:true});fs.writeFileSync('atlas-proof/assembly.json',JSON.stringify(report,null,2));console.log('ATLAS ASSEMBLED',JSON.stringify({levels:51,preserved,menuBytes:added,immutableRuntimeFiles:immutable.length}));
}else if(mode==='verify'){
 const expected=read(path.join(SITE,'atlas-interface.json'));
 const publicBytes=await buffer('atlas-interface.json');assert.equal(hash(publicBytes),hash(fs.readFileSync(path.join(SITE,'atlas-interface.json'))),'Wrong public interface manifest');
 const result=await bounded(expected.files,f=>transfer(f,null));
 assert.equal(result.bytes,expected.files.reduce((total,f)=>total+f.bytes,0));
 const info=JSON.parse(await buffer('build-info.json'));assert.equal(info.interfaceCommit,expected.interfaceCommit);assert.equal(info.commit,SOURCE);assert.equal(info.levels,51);
 fs.mkdirSync('atlas-proof',{recursive:true});fs.writeFileSync('atlas-proof/public-bytes.json',JSON.stringify({pass:true,...result,interfaceCommit:info.interfaceCommit,gameplaySourceCommit:SOURCE},null,2));console.log('ATLAS PUBLIC BYTES VERIFIED',result);
}else throw Error('Unknown operation');
