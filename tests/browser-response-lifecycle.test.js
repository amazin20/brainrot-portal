import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {EventEmitter} from 'node:events';
import test from 'node:test';
import {installResponseBodyLifecycle,enableDurableResponseBodies,DURABLE_RESPONSE_BUFFER} from '../scripts/lib/browser-response-lifecycle.mjs';

// Protocol mocks test scheduling only; they are not browser response evidence.
const deferred=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return{promise,resolve,reject};};
const microtasks=async()=>{for(let n=0;n<8;n++)await Promise.resolve();};
const tracked=promise=>{void promise.catch(()=>{});return promise;};
const events=['request','requestfinished','requestfailed','response'];
class MockPage extends EventEmitter{
  constructor(){super();this.location='https://example.test/campaign-v63/';this.closed=false;this.operations=[];this.idleCalls=0;}
  url(){return this.location;}
  isClosed(){return this.closed;}
  async waitForNetworkIdle(options){this.idleCalls++;this.lastIdleOptions=options;}
  async goto(url){this.operations.push({method:'goto',url});this.location=url;return{method:'goto'};}
  async reload(){this.operations.push({method:'reload'});return{method:'reload'};}
  async close(){this.operations.push({method:'close'});this.closed=true;}
}
let requestSequence=0;
function request(name,errorText='net::ERR_FAILED',id='mock-request-'+(++requestSequence)){
  return{id,url:()=>`https://example.test/campaign-v63/${name}`,failure:()=>({errorText}),resourceType:()=> 'script',method:()=> 'GET'};
}
function response(req,gate=deferred()){
  return{url:req.url,status:()=>200,request:()=>req,buffer:()=>gate.promise,gate};
}
function installed(options={}){
  const page=new MockPage(),originals=Object.fromEntries(['goto','reload','close'].map(name=>[name,page[name]]));
  const lifecycle=installResponseBodyLifecycle(page,{consumeResponse:async value=>{await value.buffer();},timeoutMs:1000,idleTime:0,...options});
  const detach=()=>{
    lifecycle.detach();lifecycle.detach();
    for(const event of events)assert.equal(page.listenerCount(event),0,'Leaked '+event+' listener');
    for(const[name,original]of Object.entries(originals))assert.equal(page[name],original,'Did not restore page.'+name);
  };
  return{page,lifecycle,detach};
}

test('reload waits for an already in-flight request and its later response body',async()=>{
  const seen=[],{page,lifecycle,detach}=installed({consumeResponse:async value=>{seen.push('body-start');await value.buffer();seen.push('body-finished');}});
  try{
    const req=request('late.js');page.emit('request',req);
    const operation=tracked(page.reload());await microtasks();
    assert.deepEqual(page.operations,[],'Reload invalidated a request before its response existed');
    const res=response(req);page.emit('response',res);page.emit('requestfinished',req);await microtasks();
    assert.deepEqual(seen,['body-start']);assert.deepEqual(page.operations,[],'Network finish is not response-body completion');
    res.gate.resolve(Buffer.from('actual response bytes'));assert.deepEqual(await operation,{method:'reload'});
    assert.deepEqual(seen,['body-start','body-finished']);assert.deepEqual(page.operations,[{method:'reload'}]);
    assert.deepEqual(lifecycle.failures,[]);assert.equal(lifecycle.diagnostics().pending,0);assert.equal(lifecycle.diagnostics().inflight,0);
  }finally{detach();}
});

test('a request and response arriving during a pending drain are not lost to its first snapshot',async()=>{
  const first=deferred(),second=deferred(),secondStarted=deferred(),order=[];
  const reqA=request('a.js'),reqB=request('b.js'),resA=response(reqA,first),resB=response(reqB,second);
  let page;
  const setup=installed({consumeResponse:async value=>{
    if(value===resA){await value.buffer();order.push('a');page.emit('request',reqB);page.emit('response',resB);page.emit('requestfinished',reqB);}
    else{secondStarted.resolve();await value.buffer();order.push('b');}
  }});page=setup.page;
  try{
    page.emit('request',reqA);page.emit('response',resA);page.emit('requestfinished',reqA);
    const operation=tracked(page.reload());await microtasks();assert.deepEqual(page.operations,[]);
    first.resolve(Buffer.from('a'));await secondStarted.promise;await microtasks();
    assert.deepEqual(order,['a']);assert.deepEqual(page.operations,[],'Reload dropped the body created during its first wait');
    second.resolve(Buffer.from('b'));await operation;
    assert.deepEqual(order,['a','b']);assert.deepEqual(page.operations,[{method:'reload'}]);
    assert.equal(setup.lifecycle.diagnostics().pending,0);assert.ok(page.idleCalls>=2,'New activity should trigger a stable-generation check');
  }finally{setup.detach();}
});

test('goto and close wait for every response-body promise before invalidating the document',async()=>{
  for(const method of ['goto','close']){
    const {page,lifecycle,detach}=installed();
    try{
      const first=response(request('first.js')),second=response(request('second.js'));
      page.emit('response',first);page.emit('response',second);
      const operation=tracked(method==='goto'?page.goto('https://example.test/campaign-v63/next/'):page.close());await microtasks();
      first.gate.resolve(Buffer.from('first'));await microtasks();
      assert.deepEqual(page.operations,[],method+' used only one pending response');assert.equal(page.isClosed(),false);
      second.gate.resolve(Buffer.from('second'));await operation;
      assert.equal(page.operations.length,1);assert.equal(page.operations[0].method,method);assert.equal(lifecycle.diagnostics().pending,0);
      assert.equal(page.isClosed(),method==='close');assert.deepEqual(lifecycle.failures,[]);
    }finally{detach();}
  }
});

test('a response-body read rejection is fatal and cannot be ignored by reload',async()=>{
  const reported=[],{page,lifecycle,detach}=installed({onFailure:detail=>reported.push(detail)});
  try{
    const res=response(request('broken.js'));page.emit('response',res);
    const operation=tracked(page.reload());res.gate.reject(new Error('Network.getResponseBody: No data found'));
    await assert.rejects(operation);assert.deepEqual(page.operations,[]);
    assert.ok(lifecycle.failures.some(item=>String(item.error).includes('Network.getResponseBody')));
    assert.ok(reported.some(item=>String(item.error).includes('Network.getResponseBody')));
    await assert.rejects(lifecycle.drain('retry-after-body-failure'),'A later drain must not erase a failed read');
  }finally{detach();}
});

test('requestfailed is fatal even when no response body was emitted',async()=>{
  const {page,lifecycle,detach}=installed();
  try{
    const req=request('failed.glb','net::ERR_CONNECTION_RESET');page.emit('request',req);page.emit('requestfailed',req);
    await assert.rejects(page.reload());assert.deepEqual(page.operations,[]);
    assert.ok(lifecycle.failures.some(item=>String(item.error).includes('ERR_CONNECTION_RESET')));
    assert.equal(lifecycle.diagnostics().inflight,0);
  }finally{detach();}
});

test('never-finished requests time out, retain failure details and allow listener/method cleanup',async()=>{
  const reported=[],{page,lifecycle,detach}=installed({timeoutMs:20,onFailure:detail=>reported.push(detail)});
  try{
    page.emit('request',request('never-finishes.js'));
    await assert.rejects(page.reload());assert.deepEqual(page.operations,[]);assert.equal(page.isClosed(),false);
    assert.ok(lifecycle.failures.length>0);assert.ok(reported.length>0);
  }finally{detach();}
  await page.close();assert.equal(page.isClosed(),true,'Restored original close must allow failure cleanup');
});

test('a body promise that never settles has the same bounded fatal drain behavior',async()=>{
  const {page,lifecycle,detach}=installed({timeoutMs:20}),res=response(request('unreadable.js'));
  try{
    page.emit('response',res);await assert.rejects(page.close());assert.equal(page.isClosed(),false);
    assert.deepEqual(page.operations,[]);assert.ok(lifecycle.failures.length>0);
    res.gate.resolve(Buffer.from('late bytes'));await microtasks();assert.equal(lifecycle.diagnostics().pending,0);
  }finally{res.gate.resolve(Buffer.from('cleanup'));detach();}
});

const COMPLETE_BODY=Buffer.from('protocol fixture: complete streamed response bytes');
const sha256=bytes=>createHash('sha256').update(bytes).digest('hex');
const completeVerification=requestId=>({requestId,bytes:COMPLETE_BODY.length,sha256:sha256(COMPLETE_BODY)});
async function consumeVerified(value,{requestId}){
  const bytes=await value.buffer();
  assert.equal(bytes.length,COMPLETE_BODY.length,'Response body is truncated');
  assert.equal(sha256(bytes),sha256(COMPLETE_BODY),'Response body digest differs');
  return{requestId,bytes:bytes.length,sha256:sha256(bytes)};
}

test('ERR_ABORTED after a complete verified body preserves the exact request outcome and failure text',async()=>{
  const reported=[],{page,lifecycle,detach}=installed({consumeResponse:consumeVerified,onFailure:detail=>reported.push(detail)});
  try{
    const req=request('streamed.glb','net::ERR_ABORTED','streamed-complete'),res=response(req);
    page.emit('request',req);page.emit('response',res);res.gate.resolve(COMPLETE_BODY);await microtasks();
    page.emit('requestfailed',req);await page.reload();
    assert.deepEqual(page.operations,[{method:'reload'}]);assert.deepEqual(lifecycle.failures,[]);assert.deepEqual(reported,[]);
    const [row]=lifecycle.diagnostics().requests;
    assert.equal(row.requestOrdinal,1);assert.equal(row.requestId,req.id);assert.equal(row.url,req.url());assert.equal(row.documentGeneration,0);
    assert.equal(row.responseStatus,200);assert.equal(row.failureText,'net::ERR_ABORTED');assert.equal(row.outcome,'abortedWithCompleteVerifiedBody');
    assert.deepEqual(row.verifiedBody,completeVerification(req.id));
    await lifecycle.drain('later-check');
    assert.equal(lifecycle.diagnostics().requests[0].outcome,'abortedWithCompleteVerifiedBody','A later successful drain must retain the honest aborted outcome');
  }finally{detach();}
});

test('an early ERR_ABORTED waits for this same request body to finish verification before classification',async()=>{
  const {page,lifecycle,detach}=installed({consumeResponse:consumeVerified});
  try{
    const req=request('early-abort.glb','net::ERR_ABORTED'),res=response(req);
    page.emit('request',req);page.emit('response',res);page.emit('requestfailed',req);
    const operation=tracked(page.reload());await microtasks();
    assert.deepEqual(page.operations,[]);assert.equal(lifecycle.diagnostics().pending,1);
    const before=lifecycle.diagnostics().requests[0];
    assert.equal(before.verifiedBody,null);assert.notEqual(before.outcome,'abortedWithCompleteVerifiedBody');assert.deepEqual(lifecycle.failures,[]);
    res.gate.resolve(COMPLETE_BODY);await operation;
    const after=lifecycle.diagnostics().requests[0];
    assert.equal(after.requestId,req.id);assert.equal(after.failureText,'net::ERR_ABORTED');assert.equal(after.outcome,'abortedWithCompleteVerifiedBody');
    assert.deepEqual(after.verifiedBody,completeVerification(req.id));assert.deepEqual(lifecycle.failures,[]);
  }finally{detach();}
});

test('ERR_ABORTED without a complete verification token remains fatal even if a body was merely read',async()=>{
  for(const readBody of [false,true]){
    const {page,lifecycle,detach}=installed();
    try{
      const req=request('unverified.glb','net::ERR_ABORTED');page.emit('request',req);
      if(readBody){const res=response(req);page.emit('response',res);res.gate.resolve(COMPLETE_BODY);await microtasks();}
      page.emit('requestfailed',req);await assert.rejects(page.reload());assert.deepEqual(page.operations,[]);
      const row=lifecycle.diagnostics().requests[0];
      assert.equal(row.verifiedBody,null);assert.equal(row.failureText,'net::ERR_ABORTED');assert.notEqual(row.outcome,'abortedWithCompleteVerifiedBody');
      assert.ok(lifecycle.failures.some(item=>String(item.error).includes('ERR_ABORTED')));
    }finally{detach();}
  }
});

test('another request object at the same URL cannot provide the aborted request body, even if its CDP ID is reused',async()=>{
  for(const reuseId of [false,true]){
    const {page,lifecycle,detach}=installed({consumeResponse:consumeVerified});
    try{
      const aborted=request('duplicate.glb','net::ERR_ABORTED','aborted-identity');
      const other=request('duplicate.glb','net::ERR_FAILED',reuseId?aborted.id:'another-identity'),res=response(other);
      assert.notEqual(other,aborted);assert.equal(other.url(),aborted.url());
      page.emit('request',aborted);page.emit('requestfailed',aborted);
      page.emit('request',other);page.emit('response',res);page.emit('requestfinished',other);res.gate.resolve(COMPLETE_BODY);
      await assert.rejects(page.reload());assert.deepEqual(page.operations,[]);
      const [failed,verified]=lifecycle.diagnostics().requests;
      assert.equal(failed.requestOrdinal,1);assert.equal(verified.requestOrdinal,2);assert.equal(failed.requestId,aborted.id);assert.equal(verified.requestId,other.id);
      assert.equal(failed.verifiedBody,null);assert.notEqual(failed.outcome,'abortedWithCompleteVerifiedBody');
      assert.deepEqual(verified.verifiedBody,completeVerification(other.id));assert.equal(verified.outcome,'finishedWithCompleteVerifiedBody');
      assert.ok(lifecycle.failures.some(item=>String(item.error).includes('ERR_ABORTED')));
    }finally{detach();}
  }
});

test('a failed or truncated body read cannot be excused by the streamed ERR_ABORTED exception',async()=>{
  for(const failure of ['read-error','truncated','wrong-digest']){
    const {page,lifecycle,detach}=installed({consumeResponse:consumeVerified});
    try{
      const req=request('bad-stream.glb','net::ERR_ABORTED'),res=response(req);
      page.emit('request',req);page.emit('response',res);page.emit('requestfailed',req);
      const operation=tracked(page.close());
      if(failure==='read-error')res.gate.reject(new Error('Network.getResponseBody: No data found'));
      else if(failure==='truncated')res.gate.resolve(COMPLETE_BODY.subarray(0,-1));
      else{const changed=Buffer.from(COMPLETE_BODY);changed[0]^=1;res.gate.resolve(changed);}
      await assert.rejects(operation);assert.deepEqual(page.operations,[]);assert.equal(page.isClosed(),false);
      assert.equal(lifecycle.diagnostics().requests[0].verifiedBody,null);
      assert.ok(lifecycle.failures.some(item=>item.stage==='response body'));
    }finally{detach();}
  }
});

test('the abort exception requires status 200, nonempty actual CDP identity and a valid matching verification token',async()=>{
  for(const invalid of ['status','missing-id','empty-id','different-id','zero-bytes','invalid-hash']){
    const {page,lifecycle,detach}=installed({consumeResponse:async(value,metadata)=>{
      const verified=await consumeVerified(value,metadata);
      if(invalid==='different-id')verified.requestId='unrelated-request';
      if(invalid==='zero-bytes')verified.bytes=0;
      if(invalid==='invalid-hash')verified.sha256='invalid';
      return verified;
    }});
    try{
      const req=request('invalid-proof.glb','net::ERR_ABORTED');
      if(invalid==='missing-id')delete req.id;
      if(invalid==='empty-id')req.id='';
      const res=response(req);if(invalid==='status')res.status=()=>206;
      page.emit('request',req);page.emit('response',res);page.emit('requestfailed',req);res.gate.resolve(COMPLETE_BODY);
      await assert.rejects(page.reload());assert.deepEqual(page.operations,[]);assert.ok(lifecycle.failures.length>0);
      assert.notEqual(lifecycle.diagnostics().requests[0].outcome,'abortedWithCompleteVerifiedBody');
    }finally{detach();}
  }
});

test('durable body configuration uses the page response client and propagates a rejected CDP setup',async()=>{
  const options={maxTotalBufferSize:134217728,maxResourceBufferSize:67108864,enableDurableMessages:true};
  assert.deepEqual(DURABLE_RESPONSE_BUFFER,options);
  const calls=[],client={async send(command,parameters){assert.equal(this,client);calls.push({command,parameters});}};
  const page={_client:()=>client,createCDPSession:()=>assert.fail('A separate CDP session cannot configure the response-body client')};
  assert.deepEqual(await enableDurableResponseBodies(page),{kind:'actual-cdp-durable-response-buffer',...options});
  assert.deepEqual(calls,[{command:'Network.enable',parameters:options}]);
  const failure=new Error('Network.enable durable messages not supported'),rejectedCalls=[];
  const rejectedClient={async send(command,parameters){rejectedCalls.push({command,parameters});throw failure;}};
  await assert.rejects(enableDurableResponseBodies({_client:()=>rejectedClient,createCDPSession:()=>assert.fail('Rejected CDP setup must not select a fallback')}),error=>error===failure);
  assert.deepEqual(rejectedCalls,[{command:'Network.enable',parameters:options}]);
});
