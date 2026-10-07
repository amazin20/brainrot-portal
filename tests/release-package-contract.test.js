import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {campaignPackageExpectations,verifyCampaignPackage} from '../scripts/v8-package-check.mjs';
import {FOUNDATION_INDICES} from '../src/game/LabFoundationEdition.js';
import {OPEN_ROOM_INDICES} from '../src/game/LabOpenEdition.js';
import {CAMPAIGN,FOUNDATION_LATE_SPECS} from '../src/game/LabCampaignLevels.js';
import {CAMPAIGN_ASSET_IDS} from '../src/game/labAssets.js';

function packageFixture(){
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'release-package-')),runtime=path.join(directory,'models/runtime');
 fs.mkdirSync(runtime,{recursive:true});
 const source=new URL('../public/models/runtime/',import.meta.url),catalog=JSON.parse(fs.readFileSync(new URL('manifest.json',source)));
 const models=catalog.models.filter(model=>CAMPAIGN_ASSET_IDS.includes(model.id));
 for(const model of models)fs.copyFileSync(new URL(model.filename,source),path.join(runtime,model.filename));
 const manifest={models,totalBytes:models.reduce((sum,model)=>sum+model.outputBytes,0)};
 const manifestPath=path.join(runtime,'manifest.json');fs.writeFileSync(manifestPath,JSON.stringify(manifest));
 fs.writeFileSync(path.join(directory,'index.html'),'<select id="settings-level-select"></select>');
 return {directory,runtime,manifest,manifestPath,dispose:()=>fs.rmSync(directory,{recursive:true,force:true})};
}

test('package expectations include the whole explicit foundation registry after the Tower and retain both archive editions',()=>{
 const expected=campaignPackageExpectations();
 assert.equal(expected.foundation.length,FOUNDATION_INDICES.length);
 assert.equal(expected.classic.length,CAMPAIGN.length);
 assert.equal(expected.classic.length,33,'The preserved classic archive is not truncated');
 assert.equal(expected.open.length,OPEN_ROOM_INDICES.length);
 assert.deepEqual([...OPEN_ROOM_INDICES],[23,27,29,30,31,32]);
 assert.deepEqual(expected.late,FOUNDATION_LATE_SPECS);
 assert.equal(expected.foundation[40].id,'tower-singularity');
 assert.equal(expected.foundation.at(-1).id,'echo-horizon');
 assert.equal(expected.foundation[32].id,'siphon-observatory');
 assert.ok(expected.foundation.length>41&&expected.late.length>11,'The package gate must not truncate the accepted expansion');
});

test('the production asset package accepts every current room and the original model bytes',()=>{
 const fixture=packageFixture();try{
  const result=verifyCampaignPackage(fixture.directory);assert.equal(result.pass,true);
  assert.deepEqual(result.editions,{foundation:FOUNDATION_INDICES.length,classic:CAMPAIGN.length,open:OPEN_ROOM_INDICES.length});
  assert.equal(result.models,CAMPAIGN_ASSET_IDS.length);
 }finally{fixture.dispose();}
});

test('a same-length corrupted model fails the package gate rather than passing a file-size smoke check',()=>{
 const fixture=packageFixture();try{
  const filename=path.join(fixture.runtime,fixture.manifest.models[0].filename),bytes=fs.readFileSync(filename);bytes[100]^=1;fs.writeFileSync(filename,bytes);
  assert.throws(()=>verifyCampaignPackage(fixture.directory),/hash changed/);
 }finally{fixture.dispose();}
});

test('a missing or duplicated packaged model fails even when remaining files still exist',()=>{
 const fixture=packageFixture();try{
  fixture.manifest.models.pop();fs.writeFileSync(fixture.manifestPath,JSON.stringify(fixture.manifest));
  assert.throws(()=>verifyCampaignPackage(fixture.directory),/exactly once/);
  fixture.manifest.models.push(fixture.manifest.models[0]);fs.writeFileSync(fixture.manifestPath,JSON.stringify(fixture.manifest));
  assert.throws(()=>verifyCampaignPackage(fixture.directory),/exactly once/);
 }finally{fixture.dispose();}
});
