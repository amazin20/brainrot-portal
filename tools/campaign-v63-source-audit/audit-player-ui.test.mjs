import test from 'node:test';
import assert from 'node:assert/strict';
import {parsePlayerEvidenceJSON,assertPlayerResponseLifecycle} from './audit-player-ui.mjs';

test('retained UI JSON accepts ordinary report data and escaped key names',()=>{
 const text=' {"pass":true,"sourceAccepted":false,"rows":[{"name":"комната","x":1.25e-2},null],"escaped\\u0020key":"line\\nvalue"}\n';
 assert.deepEqual(parsePlayerEvidenceJSON(text),JSON.parse(text));
});

test('retained UI JSON rejects duplicate identities including escape aliases at any depth',()=>{
 for(const text of ['{"commit":"old","commit":"new"}','{"a":[{"pass":false,"p\\u0061ss":true}]}','{"__proto__":{},"__proto__":{}}'])assert.throws(()=>parsePlayerEvidenceJSON(text),/Duplicate evidence JSON key/);
});

test('retained UI JSON rejects nonfinite, truncated, trailing and excessively nested data',()=>{
 for(const text of ['{"x":1e999}','{"x":NaN}','{"x":Infinity}','{"x":01}','{"x":true,}','[1,]','{"x":"unterminated}','{} {}','[','[null','{"a" 1}','{"a":"\u0001"}','['.repeat(102)+'0'+']'.repeat(102)])assert.throws(()=>parsePlayerEvidenceJSON(text));
});

function responseFixture(){
 const durableBuffer={maxTotalBufferSize:134217728,maxResourceBufferSize:67108864,enableDurableMessages:true},base=new URL('http://127.0.0.1:1234/campaign-v63/');
 const file={path:'index.html',bytes:100,sha256:'a'.repeat(64)},fileMap=new Map([[file.path,file]]);
 const response=(requestOrdinal,requestId,documentGeneration,requestOutcome,requestFailureText)=>({...file,url:base.href,status:200,requestOrdinal,requestId,documentGeneration,requestOutcome,requestFailureText,fromCache:false});
 const responses=[response(1,'request-A',1,'finishedWithCompleteVerifiedBody',null),response(2,'request-B',2,'abortedWithCompleteVerifiedBody','net::ERR_ABORTED')];
 const requests=responses.map(row=>({requestOrdinal:row.requestOrdinal,requestId:row.requestId,url:row.url,documentGeneration:row.documentGeneration,resourceType:'document',method:'GET',responseStatus:200,verifiedBody:{requestId:row.requestId,bytes:row.bytes,sha256:row.sha256},failureText:row.requestFailureText,outcome:row.requestOutcome}));
 requests.push({requestOrdinal:3,requestId:'blob-C',url:'blob:http://127.0.0.1:1234/model',documentGeneration:2,resourceType:'image',method:'GET',responseStatus:200,verifiedBody:null,failureText:null,outcome:'finished'});
 requests.push({requestOrdinal:4,requestId:'favicon-D',url:'http://127.0.0.1:1234/favicon.ico',documentGeneration:2,resourceType:'other',method:'GET',responseStatus:404,verifiedBody:null,failureText:null,outcome:'finished'});
 const drain=(reason,documentGeneration,generation)=>({reason,documentGeneration,generation,finishedGeneration:generation,inflight:0,pending:0});
 const context={url:base.href,allReceivedBytesMatched:true,responses,capture:{kind:'actual-cdp-durable-response-buffer',...durableBuffer},requestOutcomeCounts:{finishedWithCompleteVerifiedBody:1,abortedWithCompleteVerifiedBody:1},
  lifecycle:{documentGenerations:2,activityGeneration:12,inflight:0,pending:0,drains:[drain('page.goto',0,0),drain('page.reload',1,6),drain('context.close',2,12)],requests}};
 return{context,args:{base,fileMap,durableBuffer}};
}

test('retained UI lifecycle preserves an honest complete-body abort by exact request and document identity',()=>{
 const {context,args}=responseFixture(),summary=assertPlayerResponseLifecycle(context,args);
 assert.deepEqual(summary.requestOutcomeCounts,{finishedWithCompleteVerifiedBody:1,abortedWithCompleteVerifiedBody:1});
 assert.equal(summary.responses,2);assert.equal(summary.requests,4);assert.equal(summary.skippedNoncandidateRequests,2);
 assert.equal(context.responses[0].url,context.responses[1].url,'The regression deliberately uses the same URL across reload');
});

test('retained UI lifecycle rejects unread aborts, unrelated failures and duplicate-URL-only matching',()=>{
 const changes=[x=>x.lifecycle.requests[1].verifiedBody=null,x=>x.lifecycle.requests[1].failureText='net::ERR_CONNECTION_RESET',
  x=>x.responses[1].requestId='request-A',x=>x.responses[1].documentGeneration=1,x=>x.responses[1].requestOrdinal=1,
  x=>x.lifecycle.requests[1].verifiedBody.requestId='request-A',x=>x.responses[1].requestOutcome='finishedWithCompleteVerifiedBody',
  x=>x.responses[1].requestFailureText=null,x=>x.lifecycle.requests[1].verifiedBody.sha256='b'.repeat(64),
  x=>x.lifecycle.requests.push({...x.lifecycle.requests[2],requestOrdinal:5,url:'http://127.0.0.1:1234/campaign-v63/unread.js'})];
 for(const change of changes){const {context,args}=responseFixture();change(context);assert.throws(()=>assertPlayerResponseLifecycle(context,args));}
});

test('retained UI lifecycle rejects missing byte records, stale drains and promoted abort totals',()=>{
 const changes=[x=>x.lifecycle.pending=1,x=>x.lifecycle.inflight=1,x=>x.lifecycle.drains.at(-1).finishedGeneration--,
  x=>x.lifecycle.drains.at(-1).reason='page.reload',x=>x.capture.enableDurableMessages=false,
  x=>x.requestOutcomeCounts.abortedWithCompleteVerifiedBody=0,x=>x.responses.pop(),x=>x.lifecycle.requests.splice(1,1),
  x=>x.responses[1].fromCache='false',x=>x.lifecycle.requests[1].outcome='finished'];
 for(const change of changes){const {context,args}=responseFixture();change(context);assert.throws(()=>assertPlayerResponseLifecycle(context,args));}
});
