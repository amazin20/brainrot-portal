import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {playFromReachableMenu} from '../scripts/lib/release-session-ui.mjs';

// DOM/Puppeteer contract fake, not a browser or a rendering measurement. The
// production callbacks execute in a separate VM. Only native input entry points
// can move this overflow menu or dispatch a trusted click in the fixture.
// Its initial inert/paint ordering tests the helper's contract; it does not
// reproduce the unrecorded event ordering of the failed I browser run.
function menuContract(options={}) {
  const state={width:960,height:600,buttonLeft:680,buttonTop:272,buttonWidth:180,buttonHeight:56,
    scrollHeight:600,scroll:0,opacity:'1',menuInert:false,buttonInert:false,ancestorInert:false,
    visibility:'visible',disabled:false,hidden:false,focused:true,locked:false,obstructed:false,
    nativeStartsPlaying:true,nativeTrusted:true,internalReady:true,...options};
  const inputs=[],waits=[],violations=[],listeners=[];
  const runtime={runtimeState:state.internalReady?'ready':'loading'};
  const bodyData={externalPause:options.externalPause??'false'};
  const rect=(left,top,width,height)=>({x:left,y:top,left,top,right:left+width,bottom:top+height,width,height});
  const buttonRect=()=>rect(state.buttonLeft,state.buttonTop-state.scroll,state.buttonWidth,state.buttonHeight);
  const forbidden=operation=>{violations.push(operation);throw Error('Forbidden DOM mutation: '+operation);};
  const style=new Proxy({}, {set:(_,key)=>forbidden('style.'+String(key))});
  const canvas={id:'canvas',tagName:'CANVAS'},overlay={id:'obstruction',tagName:'DIV'};
  const ancestor={id:'inert-parent',tagName:'DIV',get inert(){return state.ancestorInert;}};
  let cursor={x:-1,y:-1};
  const containsPoint=(r,x,y)=>x>=r.left&&x<=r.right&&y>=r.top&&y<=r.bottom;
  const interactable=()=>!state.menuInert&&!state.buttonInert&&!state.ancestorInert&&!state.disabled&&
    state.visibility==='visible'&&!state.hidden&&!state.obstructed;
  const menu={id:'start-screen',tagName:'SECTION',style,
    get inert(){return state.menuInert;},get scrollTop(){return state.scroll;},
    set scrollTop(value){forbidden('scrollTop='+value);},
    get scrollHeight(){return state.scrollHeight;},get clientHeight(){return state.height;},
    getBoundingClientRect:()=>rect(0,0,state.width,state.height),
    scrollIntoView:()=>forbidden('scrollIntoView'),scrollTo:()=>forbidden('scrollTo')};
  const button={id:'play-button',tagName:'BUTTON',style,
    get disabled(){return state.disabled;},get inert(){return state.buttonInert;},
    getBoundingClientRect:buttonRect,
    contains:target=>target===button,
    closest:selector=>selector==='[inert]'?
      (state.buttonInert?button:state.menuInert?menu:state.ancestorInert?ancestor:null):selector==='.screen'?menu:null,
    matches:selector=>selector===':hover'&&containsPoint(buttonRect(),cursor.x,cursor.y),
    addEventListener:(type,callback,settings)=>listeners.push({type,callback,once:settings?.once}),
    click:()=>forbidden('DOM click'),scrollIntoView:()=>forbidden('scrollIntoView')};
  const document={documentElement:{dataset:runtime},body:{dataset:bodyData},
    get hidden(){return state.hidden;},hasFocus:()=>state.focused,
    get pointerLockElement(){return state.locked?canvas:null;},
    querySelector:selector=>selector==='#play-button'?button:selector==='#start-screen'?menu:null,
    elementFromPoint:(x,y)=>{
      if(x<0||y<0||x>state.width||y>state.height)return null;
      if(state.obstructed)return overlay;
      return interactable()&&containsPoint(buttonRect(),x,y)?button:menu;
    }};
  const context=vm.createContext({document,window:{__NESI_DEMO_GAME__:{get state(){return state.internalReady?'ready':'loading';}}},
    getComputedStyle:element=>({opacity:element===menu?state.opacity:'1',visibility:state.visibility,display:'block'}),
    performance:{now:()=>123.5},innerWidth:state.width,innerHeight:state.height});
  const execute=(callback,args=[])=>{
    context.__contractArgs=args;
    try{return vm.runInContext('('+callback.toString()+')(...__contractArgs)',context);}
    finally{delete context.__contractArgs;}
  };
  const scrollBy=delta=>{state.scroll=Math.max(0,Math.min(state.scrollHeight-state.height,state.scroll+delta));};
  const nativeClick=async(x,y,input)=>{
    cursor={x,y};inputs.push({type:input,x,y});
    if(document.elementFromPoint(x,y)!==button||!state.focused||state.locked)return;
    const event={type:'click',isTrusted:state.nativeTrusted,target:button,currentTarget:button,clientX:x,clientY:y};
    for(const listener of [...listeners])if(listener.type==='click'){
      listener.callback(event);if(listener.once)listeners.splice(listeners.indexOf(listener),1);
    }
    // main.enterLevel reconciles a stale focus hold on the real click before
    // checking other holds. It never clears a genuine hidden/ad interruption.
    if(options.staleFocusHold&&state.focused&&!state.hidden)bodyData.externalPause='false';
    if(bodyData.externalPause!=='true'&&state.nativeStartsPlaying)runtime.runtimeState='playing';
  };
  const page={
    evaluate:async(callback,...args)=>execute(callback,args),
    $eval:async(selector,callback,...args)=>{
      const element=document.querySelector(selector);assert.ok(element,'Fixture selector must exist');
      return execute(callback,[element,...args]);
    },
    waitForFunction:async(callback,settings={},...args)=>{
      const wait={attempts:0,passed:false};waits.push(wait);
      for(let poll=0;poll<8;poll++){
        wait.attempts++;
        if(execute(callback,args)){wait.passed=true;return;}
        options.onPoll?.({state,runtime,bodyData,poll,wait});
      }
      const error=Error('Contract wait timed out');error.name='TimeoutError';throw error;
    },
    bringToFront:async()=>{inputs.push({type:'bring-to-front'});if(options.frontRestoresFocus!==false)state.focused=true;},
    click:async selector=>{
      assert.equal(selector,'#play-button');const r=buttonRect();await nativeClick(r.x+r.width/2,r.y+r.height/2,'native click');
    },
    mouse:{move:async(x,y)=>{cursor={x,y};inputs.push({type:'native move',x,y});},
      wheel:async({deltaY})=>{inputs.push({type:'native wheel',deltaY});if(containsPoint(menu.getBoundingClientRect(),cursor.x,cursor.y))scrollBy(deltaY);},
      click:async(x,y)=>nativeClick(x,y,'native click')},
    touchscreen:{
      touchStart:async(x,y)=>{
        inputs.push({type:'native touch start',x,y});let previousY=y,ended=false;
        return {move:async(nextX,nextY)=>{
          assert.equal(ended,false);inputs.push({type:'native touch move',x:nextX,y:nextY});
          scrollBy(previousY-nextY);previousY=nextY;
        },end:async()=>{ended=true;inputs.push({type:'native touch end'});}};
      },tap:async(x,y)=>nativeClick(x,y,'native tap')},
  };
  return {page,state,runtime,bodyData,inputs,waits,violations,
    activations:()=>inputs.filter(input=>input.type==='native click'||input.type==='native tap')};
}

test('contract fake: internal ready can precede paint; helper waits and emits one trusted click',async()=>{
  const early=()=>menuContract({opacity:'0',menuInert:true,onPoll:({state,poll})=>{
    state.menuInert=false;state.opacity=poll===0?'.5':'1';
  }});
  const naive=early();
  await naive.page.waitForFunction(()=>window.__NESI_DEMO_GAME__.state==='ready');
  await naive.page.click('#play-button');
  assert.equal(naive.runtime.runtimeState,'ready','A single early native click misses the inactive menu');
  assert.equal(naive.activations().length,1);
  const guarded=early(),proof=await playFromReachableMenu(guarded.page);
  assert.equal(guarded.runtime.runtimeState,'playing');assert.equal(guarded.activations().length,1);
  assert.ok(guarded.waits.some(wait=>wait.passed&&wait.attempts===3),'Paint availability must actually be awaited');
  assert.equal(proof.nativePlay,true);assert.equal(proof.trusted,true);
  assert.equal(proof.event.trusted,true);assert.equal(proof.event.target,'play-button');
  assert.equal(proof.event.state,'ready','The event records the menu before the game transition');
  assert.equal(proof.event.externalPause,'false');assert.equal(proof.event.time,123.5);
  assert.equal(proof.event.focused,true);assert.equal(proof.event.hidden,false);assert.equal(proof.event.locked,false);
  assert.deepEqual(guarded.violations,[]);
});

test('contract fake: offscreen desktop Play is reached only by native wheel input',async()=>{
  const fixture=menuContract({buttonTop:920,scrollHeight:1800});
  const proof=await playFromReachableMenu(fixture.page);
  assert.ok(proof.initial.bottom>proof.initial.viewportHeight);
  assert.ok(proof.reachable.top>=0&&proof.reachable.bottom<=proof.reachable.viewportHeight);
  assert.equal(proof.scrolls.length,2);assert.ok(proof.scrolls.every(scroll=>scroll.input==='native wheel'&&scroll.after>scroll.before));
  assert.equal(fixture.inputs.filter(input=>input.type==='native wheel').length,2);
  assert.equal(fixture.activations().length,1);assert.equal(fixture.state.scroll,720);
  assert.deepEqual(fixture.violations,[]);
});

test('contract fake: offscreen mobile Play is reached by a native swipe and one trusted tap',async()=>{
  const fixture=menuContract({width:390,height:844,buttonLeft:130,buttonTop:920,scrollHeight:1800});
  const proof=await playFromReachableMenu(fixture.page,true);
  assert.equal(proof.touch,true);assert.ok(proof.initial.bottom>844);assert.ok(proof.reachable.bottom<=844);
  assert.deepEqual(proof.scrolls.map(scroll=>scroll.input),['native swipe']);
  assert.equal(fixture.inputs.filter(input=>input.type==='native touch start').length,1);
  assert.equal(fixture.inputs.filter(input=>input.type==='native touch move').length,8);
  assert.equal(fixture.inputs.filter(input=>input.type==='native touch end').length,1);
  assert.deepEqual(fixture.activations().map(input=>input.type),['native tap']);assert.equal(proof.event.trusted,true);
  assert.deepEqual(fixture.violations,[]);
});

for(const [name,options]of [
  ['hidden document',{hidden:true}],
  ['unfocused document',{focused:false,frontRestoresFocus:false}],
  ['active pointer lock',{locked:true}],
  ['inert menu',{menuInert:true}],
  ['inert button',{buttonInert:true}],
  ['inert ancestor',{ancestorInert:true}],
  ['hidden menu',{visibility:'hidden'}],
  ['obstructed Play',{obstructed:true}],
  ['disabled Play',{disabled:true}],
])test('contract fake: '+name+' cannot produce a Play acceptance',async()=>{
  const fixture=menuContract(options);
  await assert.rejects(playFromReachableMenu(fixture.page));
  assert.equal(fixture.runtime.runtimeState,'ready');assert.equal(fixture.activations().length,0);
  assert.deepEqual(fixture.violations,[]);
});

test('contract fake: native Play may reconcile a stale focus hold on a visible focused page',async()=>{
  const fixture=menuContract({externalPause:'true',staleFocusHold:true});
  const proof=await playFromReachableMenu(fixture.page);
  assert.equal(fixture.activations().length,1);assert.equal(fixture.runtime.runtimeState,'playing');
  assert.equal(proof.event.externalPause,'true','The capture listener observes the hold before app reconciliation');
  assert.equal(fixture.bodyData.externalPause,'false');
});

test('contract fake: a genuine external hold rejects after one trusted click without retry',async()=>{
  const fixture=menuContract({externalPause:'true'});
  await assert.rejects(playFromReachableMenu(fixture.page),{name:'TimeoutError'});
  assert.equal(fixture.activations().length,1);assert.equal(fixture.runtime.runtimeState,'ready');
  assert.equal(fixture.runtime.releaseTrustedPlay,'true');assert.equal(fixture.bodyData.externalPause,'true');
  assert.deepEqual(fixture.violations,[]);
});

test('contract fake: a trusted click which never starts playing rejects instead of accepting its event',async()=>{
  const fixture=menuContract({nativeStartsPlaying:false});
  await assert.rejects(playFromReachableMenu(fixture.page),{name:'TimeoutError'});
  assert.equal(fixture.activations().length,1);assert.equal(fixture.runtime.runtimeState,'ready');
  assert.equal(fixture.runtime.releaseTrustedPlay,'true');
  assert.deepEqual(fixture.violations,[]);
});

test('contract fake: an untrusted event cannot pass even if runtime becomes playing',async()=>{
  const fixture=menuContract({nativeTrusted:false});
  await assert.rejects(playFromReachableMenu(fixture.page),/Play must respond to native trusted input/);
  assert.equal(fixture.activations().length,1);assert.equal(fixture.runtime.runtimeState,'playing');
  assert.equal(fixture.runtime.releaseTrustedPlay,'false');
});

test('contract fake prohibits DOM click, direct scrolling and CSS changes in evaluated callbacks',async()=>{
  const fixture=menuContract();
  await assert.rejects(fixture.page.$eval('#start-screen',menu=>{menu.scrollTop=100;}),/Forbidden DOM mutation/);
  await assert.rejects(fixture.page.$eval('#play-button',button=>button.scrollIntoView()),/Forbidden DOM mutation/);
  await assert.rejects(fixture.page.$eval('#play-button',button=>{button.style.top='0';}),/Forbidden DOM mutation/);
  await assert.rejects(fixture.page.$eval('#play-button',button=>button.click()),/Forbidden DOM mutation/);
  assert.equal(fixture.state.scroll,0);assert.equal(fixture.runtime.runtimeState,'ready');assert.equal(fixture.activations().length,0);
});
