import assert from 'node:assert/strict';
import {assertMatrix,matrixRoutes} from './unified-public-input.mjs';
import {PUBLICATION_TARGET as TARGET,recordingStem,NATIVE_SHARD_CASES,NATIVE_TOTAL_CASES} from './unified-publication-config.mjs';

export function verifyNativeShard(report,{source,root,chapter,shard,expectedBuildInfoSHA256,expectedReceiptSHA256,expectedPreviousReceiptSHA256,expectedVerifierCommit}){
 assert.ok(TARGET.native.routeKeys.includes(shard));
 assert.match(expectedVerifierCommit,/^[a-f0-9]{40}$/);assert.equal(report.verifierCommit,expectedVerifierCommit);
 assert.equal(report.pass,true);assert.deepEqual(report.errors,[]);
 assert.equal(report.sourceCommit,source);assert.equal(report.identity.commit,source);
 assert.equal(report.identity.rootAndChapterIdentical,true);
 assert.match(report.identity.buildInfoSHA256,/^[a-f0-9]{64}$/);
 assert.match(report.publicationReceiptSHA256,/^[a-f0-9]{64}$/);
 for(const hash of [expectedBuildInfoSHA256,expectedReceiptSHA256,expectedPreviousReceiptSHA256])assert.match(hash,/^[a-f0-9]{64}$/);
 assert.equal(report.identity.buildInfoSHA256,expectedBuildInfoSHA256,'Native build bytes differ from the frozen accepted manifest');
 assert.equal(report.publicationReceiptSHA256,expectedReceiptSHA256,'Native receipt differs from the frozen accepted manifest');
 assert.equal(report.previousPublicationReceiptSHA256,expectedPreviousReceiptSHA256,'Historical receipt differs from the accepted F pin');
 assert.deepEqual(report.routeKeys,[shard]);
 const matrix=assertMatrix(report.ordinary,{root,chapter,routeKeys:[shard]});
 assert.deepEqual(report.matrix,matrix);assert.equal(matrix.verified,NATIVE_SHARD_CASES);
 for(const row of report.ordinary){assert.equal(row.buildInfoSHA256,report.identity.buildInfoSHA256);assert.equal(row.ordinaryQAGlobalsAbsent,true);}
 assert.equal(report.activeOriginalModels.length,1);
 const actors=report.activeOriginalModels[0];assert.equal(actors.sourceCommit,source);
 const actorURL=new URL(actors.url),expectedActorURL=new URL(matrixRoutes({root,chapter,routeKeys:[shard]})[0]);
 assert.equal(actorURL.origin,expectedActorURL.origin);assert.equal(actorURL.pathname,expectedActorURL.pathname);
 assert.equal(actors.state,'playing');assert.equal(actors.level,TARGET.native.actorLevel);assert.ok(actors.renderFrames>0&&actors.animationFrames>0);
 assert.deepEqual(actors.missingModels,[]);assert.equal(actors.cargoVisible,true);
 assert.deepEqual(actors.rows.map(row=>row.id).sort((a,b)=>a-b),[...TARGET.native.actorIds].sort((a,b)=>a-b));
 for(const actor of actors.rows){assert.equal(actor.sourceLoaded,true);assert.ok(actor.activeRoots>0);assert.ok(actor.visibleOriginalMeshes.some(mesh=>mesh.vertices>0&&mesh.triangles>0));}
 const gallery=report.gallery;
 assert.equal(gallery.progress.stage,'complete');assert.equal(gallery.currentRecordings.length,TARGET.recordings.length);
 assert.deepEqual(gallery.currentRecordings.map(row=>row.id).sort(),TARGET.recordings.map(record=>record.id).sort());
 for(const movie of gallery.currentRecordings){
  const target=TARGET.recordings.find(record=>record.id===movie.id),expectedURL=new URL('walkthroughs/'+recordingStem(target,source)+'.mp4',root),url=new URL(movie.src);
  assert.equal(url.origin,expectedURL.origin);assert.equal(url.pathname,expectedURL.pathname);
  assert.equal(movie.completed,true);assert.ok(movie.actualPlaybackSeconds>.1);
  assert.equal(movie.decodedSeekFrames.length,2);
  for(const frame of movie.decodedSeekFrames)assert.ok(frame.width>0&&frame.height>0&&frame.luminanceRange>12&&frame.quantizedColors>12);
  assert.equal(movie.seekAttempts.length,2);assert.ok(movie.seekAttempts.every(attempt=>attempt.completed));
 }
 assert.equal(gallery.historicalGalleries.length,4);
 assert.deepEqual(gallery.historicalGalleries.map(row=>row.relative).sort(),[
  'walkthroughs-v54-578c31e.html','chapter-atlas/walkthroughs-v54-578c31e.html',
  'walkthroughs-v50.html','chapter-atlas/walkthroughs-v53.html'].sort());
 for(const historical of gallery.historicalGalleries){
  assert.equal(historical.status,200);assert.ok(historical.videoCount>0||historical.cards>0);
  assert.equal(new URL(historical.url).href,new URL(historical.relative,root).href);
  assert.ok(historical.videoSources.length>0);
  for(const src of historical.videoSources)assert.equal(new URL(src).origin,new URL(root).origin);
  const prefix=historical.relative.startsWith('chapter-atlas/')?'chapter-atlas/':'';
  const isF=historical.relative.includes('v54'),ids=isF?(prefix?['17']:['17','17-lower','1']):[historical.relative.includes('v53')?'33':'1'];
  assert.deepEqual(historical.nativeMediaSamples.map(sample=>sample.id).sort(),[...ids].sort());
  for(const sample of historical.nativeMediaSamples){
   assert.equal(sample.completed,true);assert.ok(sample.actualPlaybackSeconds>.1);assert.equal(new URL(sample.src).origin,new URL(root).origin);
   const stem=isF?'v54-level-'+sample.id:'level-'+String(Number(sample.id)).padStart(2,'0');
   assert.equal(new URL(sample.src).pathname,new URL(prefix+'walkthroughs/'+stem+'.mp4',root).pathname);
   const frame=sample.decodedSeekFrame;assert.ok(frame.width>0&&frame.height>0&&frame.luminanceRange>12&&frame.quantizedColors>12);
  }
 }
 return matrix;
}

export function mergeNativeShards(reports,options){
 const {source,root,chapter}=options;
 assert.equal(reports.length,TARGET.native.routeKeys.length,'Every independent public-entry shard is required');
 const byShard=new Map();
 for(const report of reports){
  const shard=report.routeKeys?.[0];assert.ok(!byShard.has(shard),'Duplicate native shard');
  verifyNativeShard(report,{...options,shard});byShard.set(shard,report);
 }
 assert.deepEqual([...byShard.keys()].sort(),[...TARGET.native.routeKeys].sort());
 const ordered=TARGET.native.routeKeys.map(key=>byShard.get(key));
 assert.equal(ordered[0].identity.buildInfoSHA256,ordered[1].identity.buildInfoSHA256);
 assert.equal(ordered[0].publicationReceiptSHA256,ordered[1].publicationReceiptSHA256);
 const ordinary=ordered.flatMap(report=>report.ordinary),matrix=assertMatrix(ordinary,{root,chapter});
 assert.equal(matrix.verified,NATIVE_TOTAL_CASES);
 return {verifierCommit:options.expectedVerifierCommit,pass:true,sourceCommit:source,identity:ordered[0].identity,
  publicationReceiptSHA256:ordered[0].publicationReceiptSHA256,errors:[],matrix,ordinary,
  shards:ordered.map(report=>({routeKeys:report.routeKeys,matrix:report.matrix,
   gallery:report.gallery,activeOriginalModels:report.activeOriginalModels}))};
}
