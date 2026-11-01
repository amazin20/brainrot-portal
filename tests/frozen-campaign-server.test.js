import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {serveFrozenCampaign} from '../scripts/lib/frozen-campaign-server.mjs';
import {RELEASE_VERSION} from '../src/game/ReleaseIdentity.js';

const activeNamespace='campaign-'+RELEASE_VERSION.split('-')[0];
for(const namespace of ['campaign-v55','campaign-v56','campaign-v57','campaign-v58','campaign-v59','campaign-v60','campaign-v61','campaign-v62','campaign-v63','campaign-v64','campaign-v65','campaign-v66',activeNamespace])test(`${namespace} QA serves exact frozen bytes and returns 404 instead of a source or HTML fallback`,async()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'brainrot-frozen-mount-'));fs.mkdirSync(path.join(root,'assets'));
 const html='<script src="./assets/frozen.js"></script>',asset='exact committed artifact bytes';
 fs.writeFileSync(path.join(root,'index.html'),html);fs.writeFileSync(path.join(root,'assets/frozen.js'),asset);
 // The active release exercises the public default; it previously rejected v67.
 const mounted=await serveFrozenCampaign(root,namespace===activeNamespace?{}:{namespace});
 try{
  assert.equal(await(await fetch(mounted.url)).text(),html);
  assert.equal(await(await fetch(new URL('assets/frozen.js',mounted.url))).text(),asset);
  assert.equal(await(await fetch(mounted.url.replace(`/${namespace}/`,`/brainrot-portal/${namespace}/`))).text(),html);
  for(const url of [new URL('missing.js',mounted.url),new URL('../index.html',mounted.url),new URL('src/main.js',mounted.url),mounted.url.replace(`/${namespace}/`,'/')])assert.equal((await fetch(url)).status,404);
 }finally{await new Promise(resolve=>mounted.server.close(resolve));fs.rmSync(root,{recursive:true});}
});
