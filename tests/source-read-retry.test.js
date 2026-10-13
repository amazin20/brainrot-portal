import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {get,SOURCE_REVIEW_VERIFIERS} from '../scripts/qa-tower41-next-cell-source.mjs';

const url='https://example.invalid/tower41-native/build-info.json?diagnostic-only=1';
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
function harness(sequence,{clock=0}={}){
 const requests=[],delays=[],logs=[];let next=0;
 const options={fetcher:async(address,request)=>{
  requests.push({address,request});const value=sequence[next++];assert.notEqual(value,undefined,'Unexpected extra baseline request');
  if(value instanceof Error)throw value;return value;
 },wait:async delay=>delays.push(delay),now:()=>clock,logRetry:receipt=>logs.push(receipt)};
 return {options,requests,delays,logs};
}
const success=bytes=>new Response(bytes,{status:200});
const failure=(status,headers={})=>new Response('{"commit":"never-use-transient-response-data"}',{status,headers});
const network=code=>new TypeError('diagnostic-only fetch failure',{cause:Object.assign(new Error('diagnostic-only cause'),{code})});

test('503 retry returns only the fresh successful JSON bytes and hash',async()=>{
 const bytes=Buffer.from('{"commit":"fresh-current-pin","tree":"fresh-tree"}\n'),h=harness([failure(503),success(bytes)]);
 const actual=await get(url,h.options);
 assert.deepEqual(actual,{data:{commit:'fresh-current-pin',tree:'fresh-tree'},bytes:bytes.length,sha256:digest(bytes)});
 assert.equal(h.requests.length,2);assert.deepEqual(h.delays,[1000]);
 assert.deepEqual(h.logs,[{url:'https://example.invalid/tower41-native/build-info.json',status:503,attempt:1,nextAttempt:2,maximumAttempts:4,delayMs:1000}]);
 for(const {address,request} of h.requests){assert.equal(address,url);assert.equal(request.method,'GET');assert.equal(request.cache,'no-store');assert.equal(request.headers.Accept,'application/vnd.github+json');assert.equal(request.headers['User-Agent'],'tower41-next-cell-read-only-review');assert.ok(request.signal instanceof AbortSignal);assert.equal(request.signal.aborted,false);}
 assert.equal(new Set(h.requests.map(row=>row.request.signal)).size,2,'Each fresh attempt has its own bounded timeout signal');
 const native20CameraHelpers=['scripts/lib/foundation20-native-camera-observer.mjs','scripts/lib/foundation20-native-camera-proof.mjs'];
 assert.deepEqual(SOURCE_REVIEW_VERIFIERS.filter(file=>file.startsWith('scripts/lib/foundation20-native-camera-')),native20CameraHelpers);
 assert.equal(SOURCE_REVIEW_VERIFIERS.filter(file=>!native20CameraHelpers.includes(file)).length,18,'Inline retry keeps the eighteen prior verifier anchors; the two added anchors belong to native20 camera sampling');
});

test('only the six transient HTTP statuses retry a fresh GET',async()=>{
 for(const status of [408,429,500,502,503,504]){
  const h=harness([failure(status),success('{"fresh":true}')]);assert.deepEqual((await get(url,h.options)).data,{fresh:true});assert.equal(h.requests.length,2);assert.deepEqual(h.delays,[1000]);assert.equal(h.logs[0].status,status);
 }
});

test('permanent 503 exhaustion fails after exactly four reads with no metadata fallback',async()=>{
 let readBodies=0;const responses=Array.from({length:4},()=>({ok:false,status:503,headers:new Headers(),body:{cancel:async()=>{}},arrayBuffer:async()=>{readBodies++;return Buffer.from('{"commit":"cached-accepted-pin"}');}}));
 const h=harness(responses);await assert.rejects(get(url,h.options),/Read-only baseline request failed: 503/);
 assert.equal(h.requests.length,4);assert.deepEqual(h.delays,[1000,2000,4000]);assert.equal(h.logs.length,3);assert.equal(readBodies,0,'Transient/cached-looking response JSON must never become baseline data');
});

test('nontransient HTTP errors fail on their first read',async()=>{
 for(const status of [400,401,403,404,410,501]){
  const h=harness([failure(status),success('{"mustNotBeRead":true}')]);await assert.rejects(get(url,h.options),new RegExp('request failed: '+status));assert.equal(h.requests.length,1);assert.deepEqual(h.delays,[]);assert.deepEqual(h.logs,[]);
 }
});

test('invalid successful JSON is never retried or repaired from a second response',async()=>{
 const h=harness([success('{invalid-json'),success('{"fallback":true}')]);await assert.rejects(get(url,h.options),SyntaxError);assert.equal(h.requests.length,1);assert.deepEqual(h.delays,[]);assert.deepEqual(h.logs,[]);
});

test('a successful but wrong identity stays wrong and fails the existing downstream gate immediately',async()=>{
 const h=harness([success('{"commit":"wrong-source"}'),success('{"commit":"expected-source"}')]);
 await assert.rejects(async()=>{const actual=await get(url,h.options);assert.equal(actual.data.commit,'expected-source','Pinned accepted namespace changed');},/Pinned accepted namespace changed/);
 assert.equal(h.requests.length,1);assert.deepEqual(h.delays,[]);
});

test('explicit transient network resets and timeouts retry, including interrupted response bodies',async()=>{
 for(const error of [network('ECONNRESET'),network('ETIMEDOUT'),network('UND_ERR_CONNECT_TIMEOUT'),network('UND_ERR_HEADERS_TIMEOUT'),network('UND_ERR_BODY_TIMEOUT'),network('UND_ERR_SOCKET'),new DOMException('diagnostic timeout','TimeoutError')]){
  const h=harness([error,success('{"fresh":true}')]);assert.deepEqual((await get(url,h.options)).data,{fresh:true});assert.equal(h.requests.length,2);assert.deepEqual(h.delays,[1000]);
 }
 const reset=network('ECONNRESET'),h=harness([{ok:true,status:200,arrayBuffer:async()=>{throw reset;}},success('{"freshAfterBodyReset":true}')]);
 assert.deepEqual((await get(url,h.options)).data,{freshAfterBodyReset:true});assert.equal(h.requests.length,2);assert.deepEqual(h.delays,[1000]);
});

test('unknown network errors, refused connections, TLS failures and explicit cancellation fail immediately',async()=>{
 for(const error of [new TypeError('unknown fetch failure'),network('ECONNREFUSED'),network('ENOTFOUND'),network('CERT_HAS_EXPIRED'),new DOMException('diagnostic user cancellation','AbortError'),new Error('diagnostic programmer failure')]){
  const h=harness([error,success('{"mustNotBeRead":true}')]);await assert.rejects(get(url,h.options),value=>value===error);assert.equal(h.requests.length,1);assert.deepEqual(h.delays,[]);
 }
 const last=network('ECONNRESET'),h=harness([network('ECONNRESET'),network('ETIMEDOUT'),new DOMException('timeout','TimeoutError'),last]);
 await assert.rejects(get(url,h.options),error=>error===last);assert.equal(h.requests.length,4);assert.deepEqual(h.delays,[1000,2000,4000]);
});

test('Retry-After uses bounded delta/date hints without reducing the 1/2/4 second backoff',async()=>{
 const clock=Date.parse('2026-10-13T12:00:00Z');
 for(const [header,expected] of [['100',5000],['3',3000],['0',1000],['-3',1000],['invalid',1000],['Tue, 13 Oct 2026 12:00:04 GMT',4000],['Tue, 13 Oct 2026 12:00:40 GMT',5000],['Tue, 13 Oct 2026 11:59:00 GMT',1000]]){
  const h=harness([failure(429,{'Retry-After':header}),success('{"fresh":true}')],{clock});await get(url,h.options);assert.deepEqual(h.delays,[expected]);assert.ok(h.delays.every(delay=>delay<=5000));
 }
 const h=harness([failure(503,{'Retry-After':'0'}),failure(503,{'Retry-After':'0'}),failure(503,{'Retry-After':'0'}),success('{"fresh":true}')]);await get(url,h.options);assert.deepEqual(h.delays,[1000,2000,4000]);
});

test('GitHub read-only authorization remains in requests and never enters retry logs',async()=>{
 const previous=process.env.GITHUB_TOKEN;process.env.GITHUB_TOKEN='diagnostic-only-unit-token';
 try{
  const h=harness([failure(503),success('{"fresh":true}')]);await get('https://api.github.com/repos/example/repo/git/ref/heads/main?token=do-not-log',{...h.options,github:true});
  for(const row of h.requests)assert.equal(row.request.headers.Authorization,'Bearer diagnostic-only-unit-token');
  assert.equal(h.logs[0].url,'https://api.github.com/repos/example/repo/git/ref/heads/main');assert.equal(JSON.stringify(h.logs).includes('diagnostic-only-unit-token'),false);assert.equal(JSON.stringify(h.logs).includes('do-not-log'),false);
  const publicRead=harness([success('{"fresh":true}')]);await get(url,publicRead.options);assert.equal(publicRead.requests[0].request.headers.Authorization,undefined);
 }finally{if(previous===undefined)delete process.env.GITHUB_TOKEN;else process.env.GITHUB_TOKEN=previous;}
});
