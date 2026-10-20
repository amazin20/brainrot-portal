import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {CAMPAIGN,campaignSpec} from '../../src/game/LabCampaignLevels.js';
import {FOUNDATION_INDICES} from '../../src/game/LabFoundationEdition.js';
import {CASTLE_LEVEL_INDEX,FOUNDATION_SEQUENCE_REVISION,foundationDisplayNumber} from '../../src/game/LabCampaignSequence.js';
import {PROGRESSION_INDICES} from '../../src/game/LabPuzzleProgression.js';
import {CAMPAIGN_THEMES,campaignTheme} from '../../src/game/LabCampaignThemes.js';
import {SINGULARITY_ROOMS,SINGULARITY_SPEC} from '../../src/game/LabSingularityLayout.js';
import {RELEASE_VERSION,DEFAULT_EDITION,EDITION_VERSION,RELEASE_ORIGINS,ACTIVE_FOUNDATION_RUNTIME_FLAGS} from '../../src/game/ReleaseIdentity.js';
import {PHYSICAL_REVIEW_ENTRIES} from '../../src/game/LabPhysicalReviewEntry.js';

export const sha256=bytes=>createHash('sha256').update(bytes).digest('hex');
export function walkFiles(directory){
 if(!fs.existsSync(directory))return [];
 return fs.readdirSync(directory,{withFileTypes:true}).flatMap(entry=>{
  const file=path.join(directory,entry.name);
  assert.equal(entry.isSymbolicLink(),false,`Unexpected symlink: ${file}`);
  return entry.isDirectory()?walkFiles(file):[file];
 }).sort();
}
export function buildSourceInputs(root=process.cwd()){
 const names=['index.html','vite.config.js','package.json','package-lock.json',
  ...['src','public/models/runtime','public/draco','public/art'].flatMap(dir=>walkFiles(path.join(root,dir)).map(file=>path.relative(root,file)))];
 return names.filter(file=>fs.existsSync(path.join(root,file))).sort().map(filename=>({filename:filename.split(path.sep).join('/'),sha256:sha256(fs.readFileSync(path.join(root,filename)))}));
}
export function packageFiles(directory){
 return walkFiles(directory).filter(file=>!['build-info.json','release-manifest.json'].includes(path.relative(directory,file))).map(file=>({
  path:path.relative(directory,file).split(path.sep).join('/'),bytes:fs.statSync(file).size,sha256:sha256(fs.readFileSync(file)),
 }));
}
export function verifyReleasePackage(manifest,directory){
 const actual=packageFiles(directory);
 assert.deepEqual(actual,manifest.files,'Package files differ from the stamped inventory');
 assert.equal(sha256(JSON.stringify(actual)),manifest.packageFilesSha256,'Package inventory digest differs');
 return actual;
}
/** Metadata is excluded from the file digest to avoid self-reference. Verify
 * its complete definition/configuration separately against the pinned source. */
export function verifyReleaseMetadata(manifest,{directory,commit,platformArchive,root=process.cwd(),run=process.env.GITHUB_RUN_ID||null}){
 const expected=createReleaseManifest({directory,commit,platformArchive,root});
 expected.run=run;
 assert.deepEqual(manifest,expected,'Release definitions or configuration differ from the pinned source');
 return expected;
}
export function createReleaseManifest({directory,commit,platformArchive,root=process.cwd()}){
 assert.match(commit||'',/^[a-f0-9]{40}$/,'Exact source commit required');
 assert.ok(fs.existsSync(path.join(directory,'index.html')),'Stamp an existing production package');
 const inputs=buildSourceInputs(root),files=packageFiles(directory);
 const runtimeConfig={chamberEdition:DEFAULT_EDITION,...ACTIVE_FOUNDATION_RUNTIME_FLAGS};
 const revisions={14:'freight-observation-deep-sill-v1',16:'cable-supported-architecture-v1',19:'portal-tension-physical-v1',22:'counterweight-dynamic-v1',24:'continuous-optical-power-v1',32:'siphon-observatory-v1',36:'magnetic-channel-sealed-end-v2',37:'freight-dispatch-setback-v2',40:'bistable-impulse-branch-v1',
  ...Object.fromEntries(PROGRESSION_INDICES.map(index=>[index,`spatial-progression${index+1}-v1`]))};
 const rooms=FOUNDATION_INDICES.map(index=>{
  const spec=campaignSpec(runtimeConfig,index);
  assert.ok(spec?.id&&spec.title,`Missing definition for room ${index+1}`);
  return {level:foundationDisplayNumber(index),stableLevel:index+1,stableId:`foundation-${String(index+1).padStart(3,'0')}`,id:spec.id,title:spec.title,
   definitionRevision:revisions[index]||'retained-v54',
   ...(index<10?{presentationRevision:'first-chapter-service-frames-v1'}:index<20?{presentationRevision:'second-chapter-industrial-energy-v1'}:[20,21,22,25,28].includes(index)?{presentationRevision:'biosphere-founded-drive-and-shutters-v1'}:index===24?{presentationRevision:'mechanism-readability-v1'}:index===34?{presentationRevision:'optics-powered-receivers-v1'}:index===38?{presentationRevision:'optics-thermal-shutter-leaves-v1'}:index===40?{presentationRevision:'bistable-impulse-branch-v1'}:{}),
   ...(index===35?{queryRevision:'owned-rotor-live-cannon-pose-v1'}:{}),
   specSha256:sha256(JSON.stringify(spec)),theme:campaignTheme(index).id};
 });
 assert.equal(rooms.length,51);assert.equal(new Set(rooms.map(room=>room.stableId)).size,51);assert.equal(new Set(rooms.map(room=>room.id)).size,51);
 const byStableLevel=new Map(rooms.map(room=>[room.stableLevel,room]));
 const replaced=[16,19,22,32,40,...PROGRESSION_INDICES].map(index=>{
  const room=byStableLevel.get(index+1),previousId=index===16?'shifting-berth':index===32?'post-inverse-spring':campaignSpec({chamberEdition:DEFAULT_EDITION},index).id;
  return {level:room.level,stableLevel:room.stableLevel,stableId:room.stableId,previousId,id:room.id,title:room.title,revision:room.definitionRevision};
 });
 return {schemaVersion:2,commit,gameCommit:commit,interfaceCommit:commit,publisherCommit:null,
  origins:RELEASE_ORIGINS,version:RELEASE_VERSION,gameplayVersion:RELEASE_VERSION,artVersion:RELEASE_VERSION,
  edition:DEFAULT_EDITION,editionVersion:EDITION_VERSION,runtimeConfig,sequenceRevision:FOUNDATION_SEQUENCE_REVISION,
  sourceInputsSha256:sha256(JSON.stringify(inputs)),sourceInputFiles:inputs.length,sourceInputs:inputs,
  levels:rooms.length,rooms,files,packageFilesSha256:sha256(JSON.stringify(files)),
  platformArchive:platformArchive?{filename:path.basename(platformArchive),bytes:fs.statSync(platformArchive).size,sha256:sha256(fs.readFileSync(platformArchive))}:null,
  verified:false,status:'technical-candidate',run:process.env.GITHUB_RUN_ID||null,
  verificationScope:'The game and Atlas are built from this single source commit. Exact-package acceptance is recorded separately; this stamp does not assert a completed human, device or live-platform review.',
  acceptance:{humanPlaytest:false,physicalDeviceBenchmark:false,liveYandex:false},
  features:{defaultEdition:DEFAULT_EDITION,archiveRooms:CAMPAIGN.length,
   foundation:{version:EDITION_VERSION,rooms:rooms.map(room=>room.level),stableRooms:rooms.map(room=>room.stableLevel),
    newRooms:rooms.filter(room=>room.stableLevel>=42).map(({level,stableLevel,stableId,id,title})=>({level,stableLevel,stableId,id,title})),separateSave:true,sectorMap:true,castleEndsCampaign:true,
    chapters:CAMPAIGN_THEMES.map(theme=>({id:theme.id,title:theme.name,first:theme.from+1,last:theme.to+1}))},
   tower:{level:foundationDisplayNumber(CASTLE_LEVEL_INDEX),stableLevel:CASTLE_LEVEL_INDEX+1,title:SINGULARITY_SPEC.name,stages:SINGULARITY_ROOMS.length,checkpoints:false},
   standaloneEntries:PHYSICAL_REVIEW_ENTRIES.map(entry=>({path:entry.id+'/',level:entry.levelIndex+1,levels:entry.indices.map(i=>i+1),savePrefix:entry.storagePrefix,ordinaryControls:true})),
   playerAccess:{completedReplay:true,nextUncompleted:true,productionQueryCannotSelectEdition:true,hintsPerRoom:3,rewardedHints:true,freeDemoHints:true,compactPauseAtlas:true},
   presentation:{unifiedVisualTime:true,modelIdentitiesPreserved:true,menuArtwork:'art/portal-laboratory-menu.webp',chapterArchitectureThemes:true,atlasMenu:true,menuSettings:true,chapterArchitecturalRelief:true,responsiveActorAnimation:true},
   collision:{portalEmergenceSweep:true,carriedCargoEmergenceSweep:true},
   replacedRooms:replaced},
  videoCatalogue:{policy:'Existing recordings retain their original source and version. They are not re-labelled as current visual evidence.',
   rooms:rooms.map(room=>({level:room.level,stableLevel:room.stableLevel,stableId:room.stableId,definitionRevision:room.definitionRevision,status:'needs-current-recording',
    gameplayCompatibility:null,visualCompatibility:null}))},
 };
}
