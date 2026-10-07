import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {CAMPAIGN,campaignSpec} from '../../src/game/LabCampaignLevels.js';
import {FOUNDATION_INDICES} from '../../src/game/LabFoundationEdition.js';
import {CAMPAIGN_THEMES,campaignTheme} from '../../src/game/LabCampaignThemes.js';
import {SINGULARITY_ROOMS,SINGULARITY_SPEC} from '../../src/game/LabSingularityLayout.js';
import {RELEASE_VERSION,DEFAULT_EDITION,EDITION_VERSION,RELEASE_ORIGINS} from '../../src/game/ReleaseIdentity.js';

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
 const revisions={16:'cable-supported-architecture-v1',32:'siphon-observatory-v1',50:'echo-horizon-v1'};
 const rooms=FOUNDATION_INDICES.map(index=>{
  const spec=campaignSpec({chamberEdition:DEFAULT_EDITION},index);
  assert.ok(spec?.id&&spec.title,`Missing definition for room ${index+1}`);
  return {level:index+1,stableId:`foundation-${String(index+1).padStart(3,'0')}`,id:spec.id,title:spec.title,
   definitionRevision:revisions[index]||'retained-v53',specSha256:sha256(JSON.stringify(spec)),theme:campaignTheme(index).id};
 });
 assert.equal(rooms.length,51);assert.equal(new Set(rooms.map(room=>room.stableId)).size,51);assert.equal(new Set(rooms.map(room=>room.id)).size,51);
 return {schemaVersion:1,commit,gameCommit:commit,interfaceCommit:commit,publisherCommit:null,
  origins:RELEASE_ORIGINS,version:RELEASE_VERSION,gameplayVersion:RELEASE_VERSION,artVersion:RELEASE_VERSION,
  edition:DEFAULT_EDITION,editionVersion:EDITION_VERSION,sourceInputsSha256:sha256(JSON.stringify(inputs)),sourceInputFiles:inputs.length,
  levels:rooms.length,rooms,files,packageFilesSha256:sha256(JSON.stringify(files)),
  platformArchive:platformArchive?{filename:path.basename(platformArchive),bytes:fs.statSync(platformArchive).size,sha256:sha256(fs.readFileSync(platformArchive))}:null,
  verified:false,status:'technical-candidate',run:process.env.GITHUB_RUN_ID||null,
  verificationScope:'The game and Atlas are built from this single source commit. Exact-package acceptance is recorded separately; this stamp does not assert a completed human, device or live-platform review.',
  acceptance:{humanPlaytest:false,physicalDeviceBenchmark:false,liveYandex:false},
  features:{defaultEdition:DEFAULT_EDITION,archiveRooms:CAMPAIGN.length,
   foundation:{version:EDITION_VERSION,rooms:rooms.map(room=>room.level),newRooms:rooms.slice(41).map(({level,id,title})=>({level,id,title})),separateSave:true,sectorMap:true,
    chapters:CAMPAIGN_THEMES.map(theme=>({id:theme.id,title:theme.name,first:theme.from+1,last:theme.to+1}))},
   tower:{level:41,title:SINGULARITY_SPEC.name,stages:SINGULARITY_ROOMS.length,checkpoints:false},
   presentation:{unifiedVisualTime:true,modelIdentitiesPreserved:true,menuArtwork:'art/portal-laboratory-menu.webp',chapterArchitectureThemes:true,atlasMenu:true,menuSettings:true},
   collision:{portalEmergenceSweep:true,carriedCargoEmergenceSweep:true},
   replacedRooms:[{level:17,previousId:'shifting-berth',id:rooms[16].id,title:rooms[16].title,revision:rooms[16].definitionRevision},
    {level:33,previousId:'post-inverse-spring',id:rooms[32].id,title:rooms[32].title,revision:rooms[32].definitionRevision},
    {level:51,previousId:'expansion-address-relay',id:rooms[50].id,title:rooms[50].title,revision:rooms[50].definitionRevision}]},
  videoCatalogue:{policy:'Existing recordings retain their original source and version. They are not re-labelled as current visual evidence.',
   rooms:rooms.map(room=>({level:room.level,definitionRevision:room.definitionRevision,status:room.level===17?'needs-current-recording':'retained-recording-needs-current-visual-review',
    gameplayCompatibility:room.level===17?null:RELEASE_ORIGINS.game}))},
 };
}
