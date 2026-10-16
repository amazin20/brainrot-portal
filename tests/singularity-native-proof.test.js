import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {SINGULARITY_ROOMS as CURRENT_SINGULARITY_ROOMS} from '../src/game/LabSingularityLayout.js';
import {HISTORICAL_SINGULARITY_ROOMS as SINGULARITY_ROOMS,HISTORICAL_SINGULARITY_SOURCE} from '../scripts/lib/singularity-v54-room-snapshot.mjs';
import {assertUpgradeInfo,assertUpgradeEvidence} from '../scripts/lib/singularity-upgrade-proof.mjs';
import {parseTap,verifyRuntimeModels,assertPreviewSaveIsolation} from '../scripts/qa-tower41-next-cell-source.mjs';
import {TOWER41_PREVIEW_LEGACY_STORAGE_PREFIXES} from '../src/game/LabTower41Preview.js';
import {oldSavePrefixes,qualificationKey} from '../scripts/qa-tower41-ratchet-browser.mjs';

const rooms=SINGULARITY_ROOMS.map(({id,name,rule,requires})=>({id,name,rule,requires:[...requires]}));
function current(){return {commit:process.env.BUILD_COMMIT||'a'.repeat(40),version:'v54-unified-campaign',artVersion:'v54-unified-campaign',levels:51,edition:'foundation',features:{tower:{level:41,stages:11,checkpoints:false},foundation:{rooms:Array.from({length:51},(_,i)=>i+1)}}};}
function legacy(){const info=current();info.version=info.artVersion='v49-manufactured-light';info.levels=41;info.features.foundation.rooms=Array.from({length:41},(_,i)=>i+1);Object.assign(info.features.tower,{rooms,uniqueRules:11,independentHalls:rooms.filter(r=>r.requires.length===0).length});return info;}
test('historical unified native metadata checks accepted eleven-room definitions without changing its stamp',()=>{
 const info=current(),original=structuredClone(info),verified=assertUpgradeInfo(info,SINGULARITY_ROOMS);
 assert.deepEqual(info,original);assert.deepEqual(verified.rooms,rooms);assert.equal(verified.definitionOrigin,'frozen-source');assert.equal(verified.definitionCommit,HISTORICAL_SINGULARITY_SOURCE.commit);
 for(const mutate of [i=>i.levels=41,i=>i.artVersion='v49-manufactured-light',i=>i.edition='archive',i=>i.features.tower.stages=500,i=>i.features.tower.checkpoints=true,i=>i.features.foundation.rooms.pop(),i=>i.features.tower.rooms=[...rooms].reverse()]){const bad=current();mutate(bad);assert.throws(()=>assertUpgradeInfo(bad));}
});
test('historical eleven-room proof cannot accept the expanded live castle or a v59 stamp',()=>{
 assert.equal(SINGULARITY_ROOMS.length,11);assert.ok(CURRENT_SINGULARITY_ROOMS.length>11);assert.notEqual(SINGULARITY_ROOMS,CURRENT_SINGULARITY_ROOMS);
 assert.equal(HISTORICAL_SINGULARITY_SOURCE.commit,'f73063b77461be70d7039e2c767fa6df4467ff3b');
 assert.equal(HISTORICAL_SINGULARITY_SOURCE.blob,'91ac64aa28910d47cbda044cdcb39331d724094f');assert.equal(createHash('sha256').update(JSON.stringify(rooms)).digest('hex'),'93642555205c59ae5dfa41221008c1d70deda137fa980b235be79c2a0b355bf5');
 assert.ok(Object.isFrozen(SINGULARITY_ROOMS)&&SINGULARITY_ROOMS.every(r=>Object.isFrozen(r)&&Object.isFrozen(r.at)&&Object.isFrozen(r.requires)));
 assert.throws(()=>assertUpgradeInfo(current(),CURRENT_SINGULARITY_ROOMS));
 const currentStamp=current();currentStamp.version=currentStamp.artVersion='v59-castle-impulse';currentStamp.features.tower.stages=12;currentStamp.features.tower.level=51;assert.throws(()=>assertUpgradeInfo(currentStamp));
 const relabelled=current();relabelled.features.tower.stages=12;relabelled.features.tower.rooms=CURRENT_SINGULARITY_ROOMS.map(({id,name,rule,requires})=>({id,name,rule,requires:[...requires]}));assert.throws(()=>assertUpgradeInfo(relabelled));
});
test('historical v49 native metadata retains its separate embedded-definition contract',()=>{
 assert.deepEqual(assertUpgradeInfo(legacy(),SINGULARITY_ROOMS).rooms,rooms);const bad=legacy();delete bad.features.tower.rooms;assert.throws(()=>assertUpgradeInfo(bad));
});
test('unified whole-castle evidence rejects missing mechanisms, wrong rules, replaced cargo and resets',()=>{
 const info=current(),proof={sourceCommit:info.commit,version:info.version,result:{pass:true,metrics:{won:true,completedStages:11,solvedIds:rooms.map(r=>r.id),checkpoints:false},resets:0,respawns:0,cargoResets:0,sameCompanion:true,activeSeconds:1},observed:{events:rooms.map(({id,rule})=>({id,rule})),seenResets:0},errors:[]};
 assert.equal(assertUpgradeEvidence(proof,info).stages,11);
 for(const mutate of [p=>p.observed.events.pop(),p=>p.observed.events[0].rule='fake',p=>p.result.sameCompanion=false,p=>p.result.cargoResets=1,p=>p.observed.seenResets=1]){const bad=structuredClone(proof);mutate(bad);assert.throws(()=>assertUpgradeEvidence(bad,info));}
});
test('review TAP receipt uses actual positive totals and rejects incomplete, duplicate or unhealthy footers',()=>{
 const footer='# tests 1719\n# pass 1719\n# fail 0\n# cancelled 0\n# skipped 0\n# todo 0\n';
 assert.deepEqual(parseTap(footer),{tests:1719,pass:1719,fail:0,cancelled:0,skipped:0,todo:0});
 for(const log of [footer+footer,footer.replace('# pass 1719','# pass 1718'),footer.replace('# fail 0','# fail 1'),footer.replace('# skipped 0','# skipped 1'),footer.replace('# todo 0','# todo 1'),footer.replace('# cancelled 0','# cancelled 1'),footer.replaceAll('1719','0'),footer.replace('# todo 0\n','')])assert.throws(()=>parseTap(log));
});
test('captured compact production manifest retains the fourteen original runtime GLBs and rejects replaced bytes or records',()=>{
 // This fixture is the real Vite production manifest, captured unchanged from
 // dist. Its source catalogue contains authoring audit fields and more assets.
 const sourceBytes=fs.readFileSync(new URL('../public/models/runtime/manifest.json',import.meta.url)),productionBytes=fs.readFileSync(new URL('fixtures/tower41-runtime-production-manifest.json',import.meta.url));
 const readOriginal=filename=>fs.readFileSync(new URL('../public/models/runtime/'+filename,import.meta.url));
 const input={sourceBytes,productionBytes,readOriginal,readProduction:readOriginal},receipt=verifyRuntimeModels(input);
 assert.equal(receipt.canonicalRecords.length,14);assert.notEqual(receipt.sourceManifestSha256,receipt.productionManifestSha256);
 assert.throws(()=>verifyRuntimeModels({...input,readProduction:filename=>{const bytes=readOriginal(filename);if(filename==='model-02-cargo.glb')bytes[bytes.length-1]^=1;return bytes;}}),/Original runtime model bytes/);
 const pinned={...input,pinnedSourceBytes:sourceBytes,readPinnedOriginal:readOriginal};assert.equal(verifyRuntimeModels(pinned).canonicalRecords.length,14);
 assert.throws(()=>verifyRuntimeModels({...input,pinnedSourceBytes:sourceBytes}),/provided together/);
 const changedSource=JSON.parse(sourceBytes),changedProduction=JSON.parse(productionBytes),replacement=readOriginal('model-02-cargo.glb');replacement[replacement.length-1]^=1;
 const replacementSha=createHash('sha256').update(replacement).digest('hex');changedSource.models.find(m=>m.id===2).outputSHA256=replacementSha;changedProduction.models.find(m=>m.id===2).outputSHA256=replacementSha;
 const readReplacement=filename=>filename==='model-02-cargo.glb'?replacement:readOriginal(filename);
 assert.throws(()=>verifyRuntimeModels({...pinned,sourceBytes:Buffer.from(JSON.stringify(changedSource)),productionBytes:Buffer.from(JSON.stringify(changedProduction)),readOriginal:readReplacement,readProduction:readReplacement}),/pinned accepted parent bytes/,'Coordinated source and production replacement cannot redefine the original catalogue');
 assert.throws(()=>verifyRuntimeModels({...pinned,readPinnedOriginal:filename=>filename==='model-02-cargo.glb'?replacement:readOriginal(filename)}),/Original runtime model bytes/);
 const replaced=JSON.parse(productionBytes);replaced.models.find(m=>m.id===2).outputSHA256='f'.repeat(64);
 assert.throws(()=>verifyRuntimeModels({...input,productionBytes:Buffer.from(JSON.stringify(replaced))}),/replaced an original model record/);
});
test('preview acceptance rejects old namespace writes, edition navigation, room42 replay, missing transitions and qualification mechanics',()=>{
 const key='brainrot-portal.preferences.v24',prefixes=[...oldSavePrefixes,qualificationKey.slice(0,-key.length),...TOWER41_PREVIEW_LEGACY_STORAGE_PREFIXES],baseline=Object.fromEntries(prefixes.map(prefix=>[prefix+key,'{"completed":[0,42],"resumeLevel":42}'])),baselineHash=createHash('sha256').update(JSON.stringify(baseline)).digest('hex');
 const phases=['after-load','after-settings','after-play','after-pause','after-resume','after-win','after-replay','after-reload'],states=['ready','ready','playing','paused','playing','won','playing','ready'];
 const proof={pass:true,namespace:'brainrot-tower41-native-v2:',ownKey:'brainrot-tower41-native-v2:'+key,legacyPrefixes:prefixes,legacySnapshot:baseline,phases:phases.map((phase,i)=>({phase,state:states[i],level:41,preview:true,ratchetCell:false,startChoices:[40],settingsChoices:[40],editionNavigationPresent:false,editionNavigationAnchors:[],oldBytesUnchanged:true,legacySnapshotSha256:baselineHash,ownPreferencesSha256:'a'.repeat(64),namespaceUsed:true,ownResumeLevel:40,ownCompleted:i<5?[]:[40],ownQuality:'low'})),controls:{settings:{control:'native-menu-quality-select',changedTo:'balanced',restoredTo:'low'},pauseResume:{pass:true,pauseControl:'native-escape-or-hud',resumeControl:'focused-native-enter',pointerLockExitFallback:false,pausedState:'paused',resumedState:'playing'},replay:{pass:true,button:'#play-again-button',label:'Пройти ещё раз',level:41,state:'playing',solved:[],atSpawn:true},reload:{pass:true,state:'ready',level:41,completed:[40],resumeLevel:40}}};
 Object.assign(proof,{playerURL:'http://127.0.0.1:4173/?edition=foundation&level=41&tower41preview=1',reviewURL:'http://127.0.0.1:4173/?edition=foundation&level=41&tower41preview=1&debug=1',bareEntry:{applicable:false,reason:'The configured browser review base is outside the standalone tower41-native entry namespace.'}});
 assert.equal(assertPreviewSaveIsolation(proof).pass,true);
 for(const mutate of [p=>p.namespace='brainrot-foundation-v1:',p=>p.phases[1].oldBytesUnchanged=false,p=>p.phases[3].legacySnapshotSha256='f'.repeat(64),p=>p.controls.replay.level=42,p=>p.controls.replay.label='Следующая комната',p=>p.phases.pop(),p=>p.phases[0].ratchetCell=true,p=>p.phases[5].ownCompleted=[42],p=>p.phases[2].namespaceUsed=false,p=>p.controls.reload.resumeLevel=41,p=>p.controls.pauseResume.resumedState='paused']){const bad=structuredClone(proof);mutate(bad);assert.throws(()=>assertPreviewSaveIsolation(bad));}
 for(const [index]of proof.phases.entries())for(const mutate of [phase=>phase.editionNavigationPresent=true,phase=>phase.editionNavigationAnchors=['?edition=foundation&level=41'],phase=>delete phase.editionNavigationPresent,phase=>delete phase.editionNavigationAnchors]){const bad=structuredClone(proof);mutate(bad.phases[index]);assert.throws(()=>assertPreviewSaveIsolation(bad),'Missing or contradictory actual navigation evidence cannot qualify phase '+index);}
 const publicProof=structuredClone(proof);Object.assign(publicProof,{playerURL:'https://amazin20.github.io/brainrot-portal/tower41-native-v2/?edition=foundation&level=41&tower41preview=1',reviewURL:'https://amazin20.github.io/brainrot-portal/tower41-native-v2/?edition=foundation&level=41&tower41preview=1&debug=1',bareEntry:{applicable:true,pass:true,url:'https://amazin20.github.io/brainrot-portal/tower41-native-v2/',pathname:'/brainrot-portal/tower41-native-v2/',search:'',state:'ready',level:41,preview:true,edition:'foundation',startChoices:[40],settingsChoices:[40],editionNavigationPresent:false,editionNavigationAnchors:[],debugGameHook:'undefined',debugPreferencesHook:'undefined',ratchetHook:'undefined',oldBytesUnchanged:true,legacySnapshotSha256:baselineHash,ownKey:'brainrot-tower41-native-v2:'+key,ownPreferencesSha256:'a'.repeat(64),settings:{control:'native-menu-quality-select',changedTo:'balanced',restoredTo:'low',ownQualityChanged:'balanced',ownQualityRestored:'low',beforeSha256:'a'.repeat(64),changedSha256:'b'.repeat(64),restoredSha256:'a'.repeat(64)}}});
 assert.equal(assertPreviewSaveIsolation(publicProof).pass,true);
 for(const mutate of [p=>p.bareEntry=structuredClone(proof.bareEntry),p=>delete p.bareEntry,p=>p.bareEntry.url+='?debug=1',p=>p.bareEntry.search='?tower41preview=1',p=>p.bareEntry.state='playing',p=>p.bareEntry.level=42,p=>p.bareEntry.startChoices=[40,41],p=>p.bareEntry.editionNavigationPresent=true,p=>p.bareEntry.editionNavigationAnchors=['?edition=foundation&level=41'],p=>p.bareEntry.debugGameHook='object',p=>p.bareEntry.oldBytesUnchanged=false,p=>p.bareEntry.legacySnapshotSha256='f'.repeat(64),p=>p.bareEntry.settings.changedSha256=p.bareEntry.settings.beforeSha256,p=>p.bareEntry.settings.restoredSha256='c'.repeat(64),p=>p.bareEntry.ownKey='brainrot-foundation-v1:'+key]){const bad=structuredClone(publicProof);mutate(bad);assert.throws(()=>assertPreviewSaveIsolation(bad),'A missing or forged public bare-entry proof cannot be accepted');}
 const physical=structuredClone(publicProof),namespace='brainrot-tower41-native-v3:';
 physical.playerURL=physical.playerURL.replace('tower41-native-v2/','tower41-native-v3/');physical.reviewURL=physical.reviewURL.replace('tower41-native-v2/','tower41-native-v3/');
 physical.namespace=namespace;physical.ownKey=namespace+key;physical.legacyPrefixes.push('brainrot-tower41-native-v2:','brainrot-foundation20-physical-v1:');physical.legacySnapshot['brainrot-tower41-native-v2:'+key]='{"completed":[40],"resumeLevel":40}';physical.legacySnapshot['brainrot-foundation20-physical-v1:'+key]='{"completed":[19],"resumeLevel":19}';
 const physicalHash=createHash('sha256').update(JSON.stringify(physical.legacySnapshot)).digest('hex');
 for(const phase of physical.phases)phase.legacySnapshotSha256=physicalHash;
 physical.bareEntry.url=physical.bareEntry.url.replace('tower41-native-v2/','tower41-native-v3/');physical.bareEntry.pathname=physical.bareEntry.pathname.replace('tower41-native-v2/','tower41-native-v3/');physical.bareEntry.ownKey=namespace+key;physical.bareEntry.legacySnapshotSha256=physicalHash;
 physical.crossEntry={pass:true,url:'https://amazin20.github.io/brainrot-portal/foundation20-physical-v1/',pathname:'/brainrot-portal/foundation20-physical-v1/',search:'',hash:'',entry:'foundation20-physical-v1',level:20,state:'ready',edition:'foundation',startChoices:[19],settingsChoices:[19],editionNavigationPresent:false,editionNavigationAnchors:[],debugGameHook:'undefined',debugPreferencesHook:'undefined',debugRouteHook:'undefined',own41BytesUnchanged:true,peerBytesUnchanged:true,reloadVerified:true,sourceCommit:process.env.BUILD_COMMIT||'a'.repeat(40),legacySnapshotSha256:physicalHash,own41Sha256:'a'.repeat(64)};
 assert.equal(assertPreviewSaveIsolation(physical).pass,true,'The new physical review uses its actual source-owned namespace while preserving the prior v2 save bytes');
 for(const mutate of [p=>delete p.crossEntry,p=>p.crossEntry.url+='?debug=1',p=>p.crossEntry.level=41,p=>p.crossEntry.startChoices=[19,40],p=>p.crossEntry.debugGameHook='object',p=>p.crossEntry.own41BytesUnchanged=false,p=>p.crossEntry.peerBytesUnchanged=false,p=>p.crossEntry.reloadVerified=false,p=>p.crossEntry.own41Sha256='f'.repeat(64)]){const bad=structuredClone(physical);mutate(bad);assert.throws(()=>assertPreviewSaveIsolation(bad),'Actual cross-entry visit must preserve both namespaces without debug');}
 for(const mutate of [p=>p.namespace='brainrot-tower41-native-v2:',p=>p.ownKey='brainrot-tower41-native-v2:'+key,p=>p.legacyPrefixes.pop(),p=>delete p.legacySnapshot['brainrot-tower41-native-v2:'+key],p=>p.bareEntry.ownKey='brainrot-tower41-native-v2:'+key,p=>p.playerURL=p.playerURL.replace('tower41-native-v3/','foundation20-physical-v1/')]){const bad=structuredClone(physical);mutate(bad);assert.throws(()=>assertPreviewSaveIsolation(bad),'Current review cannot write historical saves or substitute the other chamber');}
 const invented=structuredClone(proof);invented.bareEntry.pass=true;assert.throws(()=>assertPreviewSaveIsolation(invented),'A local review must explicitly mark public bare-entry proof not applicable');
});
