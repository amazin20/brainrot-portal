import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {FOUNDATION_INDICES} from '../src/game/LabFoundationEdition.js';
import {CAMPAIGN,campaignSpec} from '../src/game/LabCampaignLevels.js';
import {SINGULARITY_ROOMS,SINGULARITY_SPEC} from '../src/game/LabSingularityLayout.js';
const directory=process.argv[2]||'dist';
const commit=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
assert.equal(execFileSync('git',['status','--porcelain','--untracked-files=no'],{encoding:'utf8'}).trim(),'','Stamp the committed candidate, never attribute uncommitted source to HEAD');
assert.equal(execFileSync('git',['status','--porcelain','--untracked-files=all','--','src','public','index.html','vite.config.js','package.json','package-lock.json'],{encoding:'utf8'}).trim(),'','Untracked build inputs must be committed before stamping');
const walk=directory=>fs.existsSync(directory)?fs.readdirSync(directory,{withFileTypes:true}).flatMap(entry=>{const file=path.join(directory,entry.name);assert.equal(entry.isSymbolicLink(),false);return entry.isDirectory()?walk(file):[file];}):[];
const inputNames=['index.html','vite.config.js','package.json','package-lock.json',...walk('src'),...walk('public/models/runtime'),...walk('public/draco'),...walk('public/art')].filter(file=>fs.existsSync(file)).sort();
const inputHashes=inputNames.map(file=>({filename:file.split(path.sep).join('/'),sha256:createHash('sha256').update(fs.readFileSync(file)).digest('hex')}));
const sourceInputsSha256=createHash('sha256').update(JSON.stringify(inputHashes)).digest('hex');
assert.equal(FOUNDATION_INDICES.length,51);assert.ok(fs.existsSync(path.join(directory,'index.html')));
const rooms=FOUNDATION_INDICES.map(index=>({level:index+1,id:campaignSpec({chamberEdition:'foundation'},index).id,title:campaignSpec({chamberEdition:'foundation'},index).title}));
assert.equal(new Set(rooms.map(r=>r.id)).size,51);
const info={commit,sourceInputsSha256,sourceInputFiles:inputHashes.length,version:'v50-expedition',artVersion:'v50-expedition',levels:51,verified:false,
 verificationScope:'Candidate package; independent source, route, production WebGL, SDK and continuous recording reports determine acceptance.',
 acceptance:{humanPlaytest:false,physicalDeviceBenchmark:false,liveYandex:false},
 features:{defaultEdition:'foundation',archiveRooms:CAMPAIGN.length,foundation:{rooms:FOUNDATION_INDICES.map(i=>i+1),newRooms:rooms.slice(41),separateSave:true,sectorMap:true},
 tower:{level:41,title:SINGULARITY_SPEC.name,stages:SINGULARITY_ROOMS.length,checkpoints:false},
 presentation:{unifiedVisualTime:true,modelIdentitiesPreserved:true,menuArtwork:'art/portal-laboratory-menu.webp'},
 collision:{portalEmergenceSweep:true,carriedCargoEmergenceSweep:true}},
 run:process.env.GITHUB_RUN_ID||null};
fs.writeFileSync(path.join(directory,'build-info.json'),JSON.stringify(info,null,2)+'\n');
console.log(`Stamped ${directory}: ${info.version} / ${commit}`);
