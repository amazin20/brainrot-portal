import test from 'node:test';
import assert from 'node:assert/strict';
import {assertOpticsHTTPBindings} from './audit-optics.mjs';

// Synthetic units exercise offline rejection logic. They are never emitted as
// provider, browser, movie, Source or original-checker evidence.
function fixture(){
 const pageURL='http://127.0.0.1:42341/campaign-v63/?edition=foundation&level=35&debug=1';
 const review={files:[{path:'index.html',bytes:100,sha256:'a'.repeat(64)},{path:'assets/game.js',bytes:200,sha256:'b'.repeat(64)},{path:'models/runtime/original.glb',bytes:500,sha256:'e'.repeat(64)}],buildInfoBytes:300,buildInfoSha256:'c'.repeat(64)},sdk={bytes:400,sha256:'d'.repeat(64)};
 const rows=[
  {url:pageURL,path:'index.html',bytes:100,sha256:'a'.repeat(64),mockSdk:false,checkerSourceScan:false},
  {url:'http://127.0.0.1:42341/sdk.js',path:'/sdk.js',bytes:400,sha256:'d'.repeat(64),mockSdk:true,checkerSourceScan:false},
  {url:'http://127.0.0.1:42341/campaign-v63/index.html?_dc=1234',path:'index.html',bytes:100,sha256:'a'.repeat(64),mockSdk:false,checkerSourceScan:true},
  {url:'http://127.0.0.1:42341/campaign-v63/assets/game.js?_dc=1235',path:'assets/game.js',bytes:200,sha256:'b'.repeat(64),mockSdk:false,checkerSourceScan:true},
  {url:'http://127.0.0.1:42341/campaign-v63/models/runtime/original.glb?v='+('e'.repeat(12))+'&_dc=1236',path:'models/runtime/original.glb',bytes:500,sha256:'e'.repeat(64),mockSdk:false,checkerSourceScan:true},
 ].map(row=>({...row,status:200,fromCache:false}));
 return {observation:{kind:'actual-browser-response-body-hashes',allReceivedBytesMatched:true,responses:rows,responseCount:rows.length,totalObservedBytes:1300},args:{pageURL,review,sdk}};
}
test('offline HTTP binding checks every supplied byte observation and original source scans',()=>{
 const {observation,args}=fixture();assert.equal(assertOpticsHTTPBindings(observation,args),observation);
});
test('offline HTTP binding rejects changed bytes, paths, origins, summaries and mock/source-scan relabelling',()=>{
 const mutations=[
  x=>x.observation.responses[0].sha256='e'.repeat(64),x=>x.observation.responses[0].bytes++,x=>x.observation.responses[0].path='assets/game.js',
  x=>x.observation.responses[0].status=304,x=>x.observation.responses[0].url=x.observation.responses[0].url.replace('42341','42342'),
  x=>x.observation.responses[0].url=x.observation.responses[0].url.replace('/campaign-v63/','/campaign-v62/'),
  x=>x.observation.responses[2].checkerSourceScan=false,x=>x.observation.responses[1].mockSdk=false,
  x=>x.observation.responses[3].url+='&injected=1',x=>x.observation.totalObservedBytes++,x=>x.observation.responseCount++,
  x=>x.observation.allReceivedBytesMatched=false,x=>x.args.review.files[1].sha256='e'.repeat(64),x=>x.args.sdk.sha256='e'.repeat(64),
  x=>x.args.pageURL=x.args.pageURL.replace('http:','https:'),x=>x.observation.responses[0].fromCache='false',
  x=>{x.observation.responses.splice(3,1);x.observation.responseCount--;x.observation.totalObservedBytes-=200;},
  x=>x.observation.responses[4].url=x.observation.responses[4].url.replace('v='+('e'.repeat(12)),'v='+('f'.repeat(12))),
  x=>x.observation.responses[4].url=x.observation.responses[4].url.replace('v='+('e'.repeat(12)),'v='+('e'.repeat(64))),
  x=>x.observation.responses[4].url+='&v='+('e'.repeat(12)),x=>x.observation.responses[4].url+='&debug=1',
  x=>x.observation.responses[4].url=x.observation.responses[4].url.replace('_dc=1236','_dc=bad'),
  x=>x.observation.responses[3].url+='&v='+('b'.repeat(12)),x=>x.observation.responses[1].url+='?v='+('d'.repeat(12)),
  x=>x.observation.responses[3].url+='&debug=1',x=>x.observation.responses[1].url+='?debug=1',
  x=>x.observation.responses[4].url=x.observation.responses[4].url.replace('original.glb','unknown.glb'),
  x=>x.observation.responses[4].sha256='f'.repeat(64),x=>x.observation.responses[4].bytes++,
 ];
 for(const mutate of mutations){const x=fixture();mutate(x);assert.throws(()=>assertOpticsHTTPBindings(x.observation,x.args));}
});
