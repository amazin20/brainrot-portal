import fs from 'node:fs';
import path from 'node:path';
import {mergeNativeShards,verifyNativeShard} from './lib/unified-native-reports.mjs';
const [mode,...args]=process.argv.slice(2),root=new URL(process.env.PUBLIC_BASE),chapter=new URL('chapter-atlas/',root);
const read=file=>JSON.parse(fs.readFileSync(file,'utf8'));
const manifest=read(process.env.MANIFEST_FILE||'proof/manifest.json');
const target=read(new URL('../docs/unified-publication-target.json',import.meta.url));
if(target.sourceCommit!==process.env.SOURCE_SHA)throw Error('Native verifier source does not match the current target');
if(manifest.gameCommit!==process.env.SOURCE_SHA||manifest.interfaceCommit!==process.env.SOURCE_SHA)throw Error('Frozen publication manifest has the wrong source');
const pinnedHash=path=>{const rows=manifest.siteFiles.filter(row=>row.path===path);if(rows.length!==1)throw Error('Missing/duplicated frozen manifest path '+path);return rows[0].sha256;};
const options={source:process.env.SOURCE_SHA,root,chapter,expectedBuildInfoSHA256:pinnedHash('build-info.json'),expectedReceiptSHA256:pinnedHash('publication-receipt.json'),expectedPreviousReceiptSHA256:target.baseline.receiptSha256,expectedVerifierCommit:process.env.GITHUB_SHA};
if(mode==='shard'){
 const [file,shard]=args;verifyNativeShard(read(file),{...options,shard});
 console.log('NATIVE SHARD VERIFIED',shard,read(file).matrix.verified);
}else if(mode==='merge'){
 const [output,...files]=args;if(files.length!==target.native.routeKeys.length)throw Error('Require every target shard report');
 const report=mergeNativeShards(files.map(read),options);fs.mkdirSync(path.dirname(output),{recursive:true});
 fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');console.log('NATIVE MATRIX VERIFIED',report.matrix.verified);
}else throw Error('Use shard FILE root|chapter or merge OUTPUT ROOTREPORT CHAPTERREPORT');
