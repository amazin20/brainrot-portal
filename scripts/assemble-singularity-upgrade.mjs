import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {assertUpgradeInfo,assertUpgradeEvidence,upgradePreviewPath} from './lib/singularity-upgrade-proof.mjs';

const config=JSON.parse(fs.readFileSync(process.env.RELEASE_CONFIG||'tools/singularity-upgrade-release.json','utf8'));
assert.ok(['demo','complete'].includes(config.mode));
const hash=p=>createHash('sha256').update(fs.readFileSync(p)).digest('hex'),read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const site=path.resolve('site'),previewPath=upgradePreviewPath(config),target=path.join(site,previewPath);
const files=root=>fs.readdirSync(root,{withFileTypes:true}).flatMap(e=>e.isDirectory()?files(path.join(root,e.name)):[path.join(root,e.name)]);
const baseProvenance=read('base-pages/base-provenance.json');
assert.equal(baseProvenance.rootCommit,config.baseCommit);assert.equal(baseProvenance.originalCampaignRun,config.baseRun);
assert.equal(baseProvenance.publisherRun,36580171792);assert.equal(baseProvenance.publisherCommit,'a3878d7f17c69319178238db2106a6c41d87cd84');
assert.equal(baseProvenance.originalArtifactId,11039257191);assert.equal(baseProvenance.preservedBySourceCommit,config.sourceCommit);assert.equal(baseProvenance.preservedByRun,String(config.candidateRun));
assert.equal(baseProvenance.archiveSHA256,'7c310c2220d9ae7839d6bddd030f52e1c7730091ade768805975d605f5b8352d');
assert.equal(hash('base-pages/artifact.tar'),baseProvenance.archiveSHA256);assert.equal(fs.statSync('base-pages/artifact.tar').size,baseProvenance.archiveBytes);
const originalSnapshot=files(site).map(p=>({path:path.relative(site,p),bytes:fs.statSync(p).size,sha256:hash(p)})).sort((a,b)=>a.path.localeCompare(b.path));
assert.deepEqual(originalSnapshot,baseProvenance.files,'The preserved publication differs from its pinned archive snapshot');
assert.equal(read(path.join(site,'build-info.json')).commit,config.baseCommit,'Refresh the pinned base when the public root has changed');
const originals=new Map(files(site).filter(p=>!p.startsWith(target+path.sep)).map(p=>[path.relative(site,p),hash(p)]));
const info=read('candidate/build-info.json'),tower=assertUpgradeInfo(info);
assert.equal(info.commit,config.sourceCommit);assert.equal(info.run,String(config.candidateRun));
assert.equal(info.verified,true,'Only the package whose automated verification passed may become the primary game');
const native=read('proof/singularity-route/evidence.json');assertUpgradeEvidence(native,info);
const candidateFiles=files(path.resolve('candidate')).map(p=>({path:path.relative(path.resolve('candidate'),p),sha256:hash(p),bytes:fs.statSync(p).size})).sort((a,b)=>a.path.localeCompare(b.path));
const previousManifest=read(path.join(site,'walkthroughs/manifest.json'));
assert.equal(previousManifest.levels.length,41);assert.deepEqual(previousManifest.levels.map(r=>r.level),Array.from({length:41},(_,i)=>i+1));
const retainedEntries=previousManifest.levels.filter(r=>r.level<=40);
const galleryAppFiles=['walkthroughs.html','walkthroughs.css','walkthroughs.js'];
const retainedMedia=[...originals].filter(([p])=>p.startsWith('media/')||(p.startsWith('walkthroughs/')&&!['walkthroughs/manifest.json','walkthroughs/level-41.mp4','walkthroughs/level-41.jpg'].includes(p))).map(([path,sha256])=>({path,sha256}));
for(const entry of retainedEntries){assert.equal(hash(path.join(site,entry.src)),entry.sha256,'An approved retained walkthrough changed');assert.ok(originals.has(entry.poster));}
const sharedAssets=candidateFiles.filter(f=>f.path.startsWith('models/')||f.path.startsWith('draco/'));
for(const f of sharedAssets)assert.equal(f.sha256,originals.get(f.path),'The upgrade must retain the original model and Draco bytes: '+f.path);
for(const f of candidateFiles){const retained=retainedMedia.find(m=>m.path===f.path);if(retained)assert.equal(f.sha256,retained.sha256,'A candidate cannot replace approved legacy media');}

const ui=read('proof/singularity-inspection/ui-proof.json');assert.equal(ui.sourceCommit,info.commit);assert.equal(ui.version,info.version);
assert.equal(ui.pass,true);assert.equal(ui.ordinaryMenu,true);assert.equal(ui.ordinaryPlay,true);
assert.equal(ui.resetAfterSolvedPuzzle,true);assert.equal(ui.reloadAfterSolvedPuzzle,true);assert.equal(ui.mobile.length,2);assert.deepEqual(ui.errors,[]);
assert.ok(ui.mobile.every(m=>m.ordinaryPlay&&m.pauseRestartResume));
fs.rmSync(target,{recursive:true,force:true});fs.cpSync('candidate',target,{recursive:true});fs.mkdirSync(path.join(target,'media'),{recursive:true});
fs.copyFileSync('proof/singularity-inspection/ordinary-start.png',path.join(target,'media','tower-preview.png'));
fs.copyFileSync('proof/singularity-route/evidence.json',path.join(target,'native-evidence.json'));
fs.copyFileSync('proof/singularity-inspection/ui-proof.json',path.join(target,'ui-evidence.json'));
let evidence=native,video=null;
if(config.mode==='complete'){
 evidence=read('proof/singularity-recording/evidence.json');assertUpgradeEvidence(evidence,info,{record:true});
 const v=evidence.video;assert.equal(path.basename(v.filename),v.filename,'Recording must be one filename');
 const movie=path.join('proof/singularity-recording',v.filename);assert.equal(hash(movie),v.sha256);
 const metadata=JSON.parse(execFileSync('ffprobe',['-v','quiet','-show_streams','-show_format','-of','json',movie],{encoding:'utf8'}));
 const stream=metadata.streams.find(s=>s.codec_type==='video');assert.equal(stream.codec_name,'h264');
 assert.equal(stream.width,v.width);assert.equal(stream.height,v.height);assert.equal(Number(stream.nb_frames),v.frames);
 assert.equal(stream.avg_frame_rate,`${v.fps}/1`);assert.ok(Math.abs(Number(metadata.format.duration)-v.durationSeconds)<.12);
 fs.copyFileSync('proof/singularity-recording/evidence.json',path.join(target,'recording-evidence.json'));
 fs.copyFileSync('proof/singularity-recording/gameplay-start.jpg',path.join(target,'media','tower-poster.jpg'));
 video={...v,originalFilename:v.filename,filename:'../walkthroughs/level-41.mp4',publishedPath:'walkthroughs/level-41.mp4',bytes:fs.statSync(movie).size,graphicsPreset:evidence.graphicsPreset};
}
const release={sourceCommit:info.commit,version:info.version,candidateRun:config.candidateRun,publicationRun:process.env.GITHUB_RUN_ID||null,
 mode:config.mode,previewPath,baseCommit:config.baseCommit,baseProvenance,nativeRouteVerified:true,mobileUIVerified:true,
 video,seconds:evidence.result.seconds,activeSeconds:evidence.result.activeSeconds,completedMachines:tower.stages,independentHalls:tower.independentHalls,
 rooms:tower.rooms,resets:0,checkpoints:false,method:'Ordinary scripted production-physics route. No human speedrun or universal minimum-time claim.'};
// Promote the exact package already checked across all campaign editions. Keep
// approved recordings and the original gallery assets; only its finale binding
// changes. Removing unused old bundles avoids retaining a second game runtime.
const removedBundles=[...originals].filter(([p])=>p.startsWith('assets/')&&!candidateFiles.some(f=>f.path===p)).map(([path,sha256])=>({path,sha256}));
fs.rmSync(path.join(site,'assets'),{recursive:true,force:true});fs.cpSync('candidate',site,{recursive:true});
for(const f of candidateFiles)assert.equal(hash(path.join(site,f.path)),f.sha256,'Promoted root file differs from the checked package: '+f.path);
const galleryApp=galleryAppFiles.map(file=>{fs.copyFileSync(file,path.join(site,file));return {path:file,sha256:hash(path.join(site,file))};});
let finale={level:41,title:'Складчатый замок',sourceCommit:info.commit,version:info.version,stages:tower.stages,independentHalls:tower.independentHalls,
 checkpoints:false,walkthroughURL:previewPath+'/walkthrough.html',recordingPending:!video};
if(video){
 fs.copyFileSync(path.join('proof/singularity-recording',video.originalFilename),path.join(site,'walkthroughs/level-41.mp4'));
 fs.copyFileSync(path.join(target,'media/tower-poster.jpg'),path.join(site,'walkthroughs/level-41.jpg'));
 finale={...finale,src:'walkthroughs/level-41.mp4',poster:'walkthroughs/level-41.jpg',durationSeconds:video.durationSeconds,width:video.width,height:video.height,fps:video.fps,
  frameCount:video.frames,bytes:video.bytes,sha256:video.sha256,continuous:true,activeSeconds:evidence.result.activeSeconds,teleports:evidence.result.teleports,maxIdleSeconds:evidence.result.maxIdleSeconds};
 assert.equal(hash(path.join(site,finale.src)),video.sha256);
}
const nextManifest={...previousManifest,supersededLevels:[16,31,32,33,34,36,37,39,40],sourceCommit:info.commit,retainedRecordingSourceCommit:previousManifest.sourceCommit,
 levels:previousManifest.levels.map(r=>r.level===41?finale:r)};
assert.deepEqual(nextManifest.levels.filter(r=>r.level<=40),retainedEntries,'Every retained gallery entry must keep its original values');
fs.writeFileSync(path.join(site,'walkthroughs/manifest.json'),JSON.stringify(nextManifest,null,2)+'\n');
for(const f of retainedMedia)assert.equal(hash(path.join(site,f.path)),f.sha256,'Approved legacy media changed: '+f.path);
const authoredChanges=new Map(candidateFiles.map(f=>[f.path,f.sha256]));
for(const p of [...galleryAppFiles,'walkthroughs/manifest.json',...(video?['walkthroughs/level-41.mp4','walkthroughs/level-41.jpg']:[])])authoredChanges.set(p,hash(path.join(site,p)));
for(const [p,digest]of originals){if(removedBundles.some(f=>f.path===p)){assert.equal(fs.existsSync(path.join(site,p)),false);continue;}assert.equal(hash(path.join(site,p)),authoredChanges.get(p)||digest,'Unexpected root publication change: '+p);}
release.rootPromotion={sourceCommit:info.commit,version:info.version,originalRootCommit:config.baseCommit,
 originalIndexSHA256:originals.get('index.html'),promotedIndexSHA256:hash(path.join(site,'index.html')),
 originalBuildInfoSHA256:originals.get('build-info.json'),promotedBuildInfoSHA256:hash(path.join(site,'build-info.json')),
 exactCandidateFiles:candidateFiles,retainedMedia,galleryApp,sharedAssets,removedBundles,retainedRecordingLevels:Array.from({length:40},(_,i)=>i+1),
 retainedGalleryEntries:retainedEntries.map(e=>({level:e.level,sha256:createHash('sha256').update(JSON.stringify(e)).digest('hex')})),
 rootGalleryManifestSHA256:hash(path.join(site,'walkthroughs/manifest.json')),finale,
 method:'Exact verified candidate promoted to the primary game and the Tower permalink; original approved room 1–40 recordings and shared model/Draco bytes retained.'};
fs.writeFileSync(path.join(target,'preview-release.json'),JSON.stringify(release,null,2)+'\n');
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const clock=s=>`${Math.floor(s/60)}:${String(Math.floor(s%60)).padStart(2,'0')}`;
const chapters=evidence.result.milestones.filter(m=>m.name.startsWith('Start ')).map(m=>({name:tower.rooms.find(r=>r.id===m.name.slice(6))?.name||m.name,seconds:m.seconds}));
const media=video?`<video id="walkthrough" controls playsinline preload="metadata" poster="media/tower-poster.jpg" src="${escape(video.filename)}"></video><div class="chapters">${chapters.map(c=>`<button data-seek="${c.seconds}"><span>${clock(c.seconds)}</span>${escape(c.name)}</button>`).join('')}</div><p><a href="${escape(video.filename)}">Открыть MP4 отдельно</a> · <a href="recording-evidence.json">Отчёт записи</a></p>`:`<img class="preview" src="media/tower-preview.png" alt="Реальный кадр обновлённой башни"><p class="notice">Игровая демка проверена. Полное видео этой версии пока не опубликовано.</p>`;
const html=`<!doctype html><html lang="ru"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Складчатый замок — обновление</title><style>
*{box-sizing:border-box}body{margin:0;background:#0e1c27;color:#e8f0ef;font:17px/1.6 system-ui,sans-serif}main{max-width:1120px;margin:auto;padding:48px 24px}small{color:#77d9ca;letter-spacing:.12em}h1{font-size:clamp(32px,5vw,56px);line-height:1.1;margin:18px 0}h2{font-size:26px}p{max-width:880px;color:#b7ccd4}.lead{font-size:20px}.actions{display:flex;gap:16px;flex-wrap:wrap;margin:28px 0}.primary{display:inline-block;background:#86e2cf;color:#0c2730!important;border-radius:12px;padding:14px 22px;font-weight:750;text-decoration:none}a{color:#8debdc}video,.preview{width:100%;display:block;border-radius:18px;border:1px solid #385664;background:#061017;margin-top:28px}.stats{display:flex;gap:24px;flex-wrap:wrap;padding:22px 0;border-top:1px solid #304957;border-bottom:1px solid #304957}.stats strong{font-size:28px;display:block}.stats div{min-width:145px;color:#b7ccd4}.chapters,.rooms{display:grid;grid-template-columns:repeat(auto-fit,minmax(235px,1fr));gap:9px;margin:20px 0}.chapters button{font:inherit;font-size:14px;text-align:left;border:1px solid #355463;background:#172f3c;color:#eaf1ef;padding:12px;border-radius:9px;cursor:pointer}.chapters span{color:#8debdc;display:block;font-weight:700}.rooms div{padding:12px 16px;border:1px solid #304957;border-radius:9px;font-size:14px}.notice{padding:16px 20px;background:#19313c;border-left:3px solid #88dcce;border-radius:8px}footer{font-size:13px;color:#8faab6;margin-top:42px;overflow-wrap:anywhere}
</style><main><small>БРЕЙНРОТ ПОРТАЛ / ОБНОВЛЁННЫЙ УРОВЕНЬ 41</small><h1>Складчатый замок</h1><p class="lead">Пять высотных поясов вокруг глубокого атриума: грузовые шлюзы, движущиеся стены, канаты, магнитные каналы и портальные переходы. ${tower.stages} самостоятельных задач; ${tower.independentHalls} залов доступны в свободном порядке. Без контрольных точек.</p><div class="actions"><a class="primary" href="./?edition=foundation&level=41">Играть в обновлённую башню</a><a href="../">Основная кампания</a></div><div class="stats"><div><strong>${tower.stages}</strong>разных правил</div><div><strong>${tower.independentHalls}</strong>независимых залов</div><div><strong>${clock(evidence.result.seconds)}</strong>измеренное прохождение</div><div><strong>0</strong>сбросов попытки</div></div>${media}<h2>Каждый зал — своя задача</h2><div class="rooms">${tower.rooms.map(r=>`<div>${escape(r.name)}</div>`).join('')}</div><p class="notice">Время измерено по автоматическому маршруту с обычными игровыми действиями и настоящей физикой. Это не рекорд человека и не гарантия, что уровень невозможно пройти быстрее. ${video?`Непрерывное видео записано в масштабе 1×, ${video.fps} кадров/с, на профиле «${escape(video.graphicsPreset||'low')}».`:'Браузерная проверка достигла настоящей победы.'}</p><p><a href="native-evidence.json">Отчёт прохождения</a> · <a href="ui-evidence.json">Проверка управления</a> · <a href="preview-release.json">Версия демки</a></p><footer><a href="https://github.com/amazin20/brainrot-portal/tree/${info.commit}">Исходный коммит ${info.commit}</a></footer></main><script>document.querySelectorAll('[data-seek]').forEach(b=>b.addEventListener('click',()=>{const v=document.getElementById('walkthrough');v.currentTime=Number(b.dataset.seek);v.play().catch(()=>{});v.scrollIntoView({behavior:'smooth',block:'center'});}));</script></html>`;
fs.writeFileSync(path.join(target,'walkthrough.html'),html);
const siteBytes=files(site).reduce((sum,p)=>sum+fs.statSync(p).size,0);assert.ok(siteBytes<=500*1024*1024,'The published game and media must stay below 500 MiB');
fs.mkdirSync('publication-proof',{recursive:true});fs.writeFileSync('publication-proof/assembly.json',JSON.stringify({...release,siteBytes},null,2)+'\n');
console.log('PRIMARY GAME UPGRADE ASSEMBLED',JSON.stringify({sourceCommit:info.commit,version:info.version,stages:tower.stages,rootFiles:candidateFiles.length,retainedMedia:retainedMedia.length,siteBytes,video:video?.sha256}));
