import assert from 'node:assert/strict';

export const DURABLE_RESPONSE_BUFFER=Object.freeze({maxTotalBufferSize:134217728,maxResourceBufferSize:67108864,enableDurableMessages:true});
/** Configure the same pinned Puppeteer CDP session used by response.buffer().
 * Durable browser-owned storage also retains streamed fetch bodies after the
 * renderer consumes/releases them. It never supplies replacement bytes. */
export async function enableDurableResponseBodies(page){
 const client=page._client();assert.equal(typeof client.send,'function');
 await client.send('Network.enable',DURABLE_RESPONSE_BUFFER);
 return{kind:'actual-cdp-durable-response-buffer',...DURABLE_RESPONSE_BUFFER};
}

/** Keep each real CDP response body attached to its live document until it has
 * been consumed. A navigation or target close may otherwise discard it even
 * though the page's DOM is ready. No substitute bytes or failed-read skips. */
export function installResponseBodyLifecycle(page,{consumeResponse,timeoutMs=180000,idleTime=250,onFailure=()=>{}}={}){
 assert.equal(typeof consumeResponse,'function');
 assert.ok(Number.isSafeInteger(timeoutMs)&&timeoutMs>0);assert.ok(Number.isSafeInteger(idleTime)&&idleTime>=0);
 const pending=new Set(),inflight=new Set(),failures=[],drains=[],requests=new Map();
 let generation=0,documentGeneration=0,started=false,draining=null,detached=false;
 const methods=Object.fromEntries(['goto','reload','close'].map(name=>[name,page[name]]));
 const record=(stage,{url=page.url(),status=null,error})=>{
  const detail={stage,url,status,documentGeneration,error:String(error?.stack||error)};failures.push(detail);
  try{onFailure(detail);}catch(diagnosticError){failures.push({stage:'diagnostic',url,status,documentGeneration,error:String(diagnosticError?.stack||diagnosticError)});}
 };
 const requestRecord=request=>{
  if(!requests.has(request))requests.set(request,{requestOrdinal:requests.size+1,requestId:typeof request.id==='string'?request.id:null,url:request.url(),documentGeneration,resourceType:request.resourceType?.()??null,method:request.method?.()??null,responseStatus:null,verifiedBody:null,failureText:null,outcome:'inflight',failureRecorded:false});
  return requests.get(request);
 };
 const requestStarted=request=>{requestRecord(request);inflight.add(request);generation++;};
 const requestFinished=request=>{inflight.delete(request);generation++;};
 const requestFailed=request=>{
  const row=requestRecord(request);row.failureText=request.failure()?.errorText||'Browser request failed';requestFinished(request);
  // Chrome can report ERR_ABORTED after a complete streamed fetch. Defer only
  // that classification until this exact request's real body task settles.
  if(row.failureText!=='net::ERR_ABORTED'){row.failureRecorded=true;record('request',{url:row.url,error:Error(row.failureText)});}
 };
 const responseReceived=response=>{
  generation++;const responseGeneration=documentGeneration;
  const request=response.request(),row=requestRecord(request);row.responseStatus=response.status();
  const task=Promise.resolve().then(()=>consumeResponse(response,{documentGeneration:responseGeneration,requestId:row.requestId,requestOrdinal:row.requestOrdinal})).then(verified=>{
   if(verified===undefined||verified===null)return;
   assert.equal(typeof row.requestId,'string','Verified body needs the actual CDP request identity');assert.ok(row.requestId.length>0);
   assert.equal(verified.requestId,row.requestId,'Body belongs to another actual request');assert.ok(Number.isSafeInteger(verified.bytes)&&verified.bytes>0);assert.match(verified.sha256,/^[a-f0-9]{64}$/);
   row.verifiedBody={requestId:verified.requestId,bytes:verified.bytes,sha256:verified.sha256};
  }).catch(error=>{
   record('response body',{url:response.url(),status:response.status(),error});
  }).finally(()=>pending.delete(task));
  pending.add(task);
 };
 for(const[event,handler]of[['request',requestStarted],['requestfinished',requestFinished],['requestfailed',requestFailed],['response',responseReceived]])page.on(event,handler);
 const bounded=async(promise,deadline)=>{
  let timer;
  try{return await Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Browser response drain exhausted its '+timeoutMs+'ms budget')),Math.max(1,deadline-Date.now()));})]);}
  finally{clearTimeout(timer);}
 };
 const drain=async(reason='manual')=>{
  assert.equal(detached,false,'Response lifecycle was detached before target invalidation');
  if(draining)return draining;
  draining=(async()=>{
   const before={reason,documentGeneration,generation,inflight:inflight.size,pending:pending.size};
   try{
    assert.equal(page.isClosed(),false,'Browser target closed before its actual response bodies were drained');
    if(started||inflight.size||pending.size){
     const deadline=Date.now()+timeoutMs;
     for(;;){
      assert.ok(Date.now()<deadline,'Browser response drain deadline passed');
      // Network-idle includes requests that have not emitted response yet.
      // Reading one pending snapshot alone misses those and any later body.
      await bounded(page.waitForNetworkIdle({idleTime,timeout:Math.max(1,deadline-Date.now())}),deadline);
      const observedGeneration=generation;
      while(pending.size)await bounded(Promise.all([...pending]),deadline);
      if(inflight.size===0&&pending.size===0&&generation===observedGeneration)break;
     }
    }
    for(const row of requests.values()){
     if(row.failureText){
      if(row.failureText==='net::ERR_ABORTED'&&row.responseStatus===200&&row.verifiedBody?.requestId===row.requestId&&row.requestId!==null)row.outcome='abortedWithCompleteVerifiedBody';
      else if(!row.failureRecorded){row.failureRecorded=true;record('request',{url:row.url,error:Error(row.failureText+' without a complete verified body for this request')});}
     }else row.outcome=row.verifiedBody?'finishedWithCompleteVerifiedBody':'finished';
    }
    assert.deepEqual(failures,[],'An actual browser request/response failed before '+reason);
    const result={...before,finishedGeneration:generation,inflight:inflight.size,pending:pending.size};drains.push(result);return result;
   }catch(error){record('response drain',{error});throw error;}
  })();
  try{return await draining;}finally{draining=null;}
 };
 for(const name of ['goto','reload','close']){
  page[name]=async function(...args){
   await drain('page.'+name);
   if(name!=='close'){started=true;documentGeneration++;}
   // Call in the same continuation as the settled generation check.
   return methods[name].apply(this,args);
  };
 }
 return{drain,failures,
  diagnostics:()=>({documentGenerations:documentGeneration,activityGeneration:generation,inflight:inflight.size,pending:pending.size,drains:drains.map(row=>({...row})),requests:[...requests.values()].map(({failureRecorded,...row})=>({...row,verifiedBody:row.verifiedBody&&{...row.verifiedBody}}))}),
  detach(){
   if(detached)return;detached=true;
   for(const[event,handler]of[['request',requestStarted],['requestfinished',requestFinished],['requestfailed',requestFailed],['response',responseReceived]])page.off(event,handler);
   for(const[name,original]of Object.entries(methods))page[name]=original;
  }};
}
