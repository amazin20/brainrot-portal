import test from 'node:test';
import assert from 'node:assert/strict';
import {PUBLICATION_TARGET as TARGET,recordingStem} from '../scripts/lib/unified-publication-config.mjs';
import {MATRIX_LEVELS,MATRIX_VIEWPORTS,assertMatrix} from '../scripts/lib/unified-public-input.mjs';
import {mergeNativeShards,verifyNativeShard} from '../scripts/lib/unified-native-reports.mjs';
const source='8f2132cabdee6225bc9ebe34356a3bb1cf643dfe',root=new URL('https://example.test/brainrot-portal/'),chapter=new URL('chapter-atlas/',root);
const options={source,root,chapter,expectedBuildInfoSHA256:'a'.repeat(64),expectedReceiptSHA256:'b'.repeat(64),expectedPreviousReceiptSHA256:'c'.repeat(64),expectedVerifierCommit:'f'.repeat(40)};
function fixture(shard){
 const base=shard==='root'?root:chapter;
 const ordinary=MATRIX_VIEWPORTS.flatMap(viewport=>MATRIX_LEVELS.map(level=>({level,...viewport,url:new URL('?level='+level,base).href,
  selectedThroughMap:true,ordinaryQAGlobalsAbsent:true,nativeTrustedPlay:true,pauseRestartResumeReturnPlay:true,reloadAndReplay:true,buildInfoSHA256:'a'.repeat(64)})));
 const frame={width:854,height:480,luminanceRange:30,quantizedColors:40};
 return {verifierCommit:'f'.repeat(40),pass:true,sourceCommit:source,errors:[],routeKeys:[shard],identity:{commit:source,rootAndChapterIdentical:true,buildInfoSHA256:'a'.repeat(64)},publicationReceiptSHA256:'b'.repeat(64),previousPublicationReceiptSHA256:'c'.repeat(64),
  ordinary,matrix:assertMatrix(ordinary,{root,chapter,routeKeys:[shard]}),activeOriginalModels:[{sourceCommit:source,url:base.href,state:'playing',level:17,renderFrames:10,animationFrames:4,missingModels:[],cargoVisible:true,rows:[1,2,11].map(id=>({id,sourceLoaded:true,activeRoots:1,visibleOriginalMeshes:[{vertices:100,triangles:50}]}))}],
  gallery:{progress:{stage:'complete'},currentRecordings:TARGET.recordings.map(record=>({id:record.id,src:new URL('walkthroughs/'+recordingStem(record,source)+'.mp4',root).href,completed:true,actualPlaybackSeconds:.7,decodedSeekFrames:[frame,frame],seekAttempts:[{completed:true},{completed:true}]})),
   historicalGalleries:['walkthroughs-v54-578c31e.html','chapter-atlas/walkthroughs-v54-578c31e.html','walkthroughs-v50.html','chapter-atlas/walkthroughs-v53.html'].map(relative=>{
    const prefix=relative.startsWith('chapter-atlas/')?'chapter-atlas/':'',isF=relative.includes('v54');
    const ids=isF?(prefix?['17']:['17','17-lower','1']):[relative.includes('v53')?'33':'1'];
    const nativeMediaSamples=ids.map(id=>({id,completed:true,src:new URL(prefix+'walkthroughs/'+(isF?'v54-level-'+id:'level-'+String(Number(id)).padStart(2,'0'))+'.mp4',root).href,actualPlaybackSeconds:.8,decodedSeekFrame:frame}));
    return {relative,url:new URL(relative,root).href,status:200,videoCount:isF?3:1,cards:0,videoSources:nativeMediaSamples.map(row=>row.src),nativeMediaSamples};
   })}};
}
test('two complete independent route shards merge to all48 ordinary native cases',()=>{
 const report=mergeNativeShards([fixture('chapter'),fixture('root')],options);
 assert.equal(report.pass,true);assert.equal(report.matrix.verified,48);assert.equal(report.shards.length,2);
});
for(const [name,mutate] of [
 ['absent shard',rows=>rows.pop()],['duplicated shard',rows=>{rows[1]=rows[0];}],
 ['failed native case',rows=>{rows[0].ordinary[0].reloadAndReplay=false;}],
 ['foreign source',rows=>{rows[1].sourceCommit='c'.repeat(40);}],
 ['different browser bytes',rows=>{rows[1].identity.buildInfoSHA256='d'.repeat(64);for(const row of rows[1].ordinary)row.buildInfoSHA256='d'.repeat(64);}],
 ['different publication receipt',rows=>{rows[1].publicationReceiptSHA256='e'.repeat(64);}],
 ['missing new room47',rows=>{rows[0].ordinary=rows[0].ordinary.filter(row=>row.level!==47);}],
 ['foreign native verifier',rows=>{rows[0].verifierCommit='e'.repeat(40);}],
 ['missing new room46',rows=>{rows[0].ordinary=rows[0].ordinary.filter(row=>row.level!==46);}],
 ['missing seventh current recording',rows=>rows[0].gallery.currentRecordings.pop()],
 ['blank decoded frame',rows=>{rows[0].gallery.currentRecordings[0].decodedSeekFrames[0].luminanceRange=0;}],
 ['missing previous F gallery',rows=>rows[0].gallery.historicalGalleries.pop()],
 ['debug QA globals present',rows=>{rows[0].ordinary[0].ordinaryQAGlobalsAbsent=false;}],
 ['QA absence flag omitted',rows=>{delete rows[0].ordinary[0].ordinaryQAGlobalsAbsent;}],
 ['empty actor evidence',rows=>{rows[0].activeOriginalModels[0].rows=[];}],
 ['actor mesh missing',rows=>{rows[0].activeOriginalModels[0].rows[1].visibleOriginalMeshes=[];}],
 ['historical gallery404',rows=>{rows[0].gallery.historicalGalleries[0].status=404;}],
 ['historical media foreign origin',rows=>{rows[0].gallery.historicalGalleries[0].videoSources=['https://foreign.test/a.mp4'];}],
 ['actor evidence foreign origin',rows=>{rows[0].activeOriginalModels[0].url='https://foreign.test/brainrot-portal/';}],
 ['current movie wrong path',rows=>{rows[0].gallery.currentRecordings[0].src=new URL('walkthroughs/v54-level-17.mp4',root).href;}],
 ['historical sample wrong id',rows=>{rows[0].gallery.historicalGalleries[0].nativeMediaSamples[0].id='1';}],
 ['historical sample wrong path',rows=>{rows[0].gallery.historicalGalleries[0].nativeMediaSamples[0].src=new URL('walkthroughs/level-01.mp4',root).href;}],
 ['historical sample not played',rows=>{rows[0].gallery.historicalGalleries[0].nativeMediaSamples[0].actualPlaybackSeconds=0;}],
 ['historical sample blank',rows=>{rows[0].gallery.historicalGalleries[0].nativeMediaSamples[0].decodedSeekFrame.luminanceRange=0;}],
 ['both shards agree on wrong accepted bytes',rows=>{for(const row of rows){row.identity.buildInfoSHA256='e'.repeat(64);for(const ordinary of row.ordinary)ordinary.buildInfoSHA256='e'.repeat(64);}}],
])test(`native acceptance rejects ${name}`,()=>{
 const rows=[fixture('root'),fixture('chapter')];mutate(rows);assert.throws(()=>mergeNativeShards(rows,options));
});
test('a valid24case shard is insufficient for full publication acceptance',()=>{
 const row=fixture('root');assert.equal(verifyNativeShard(row,{...options,shard:'root'}).verified,24);
 assert.throws(()=>mergeNativeShards([row],options));
});
