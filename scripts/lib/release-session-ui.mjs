import assert from 'node:assert/strict';
import {waitForStartMenu} from './singularity-ui-check.mjs';

async function playBounds(page){
 return page.evaluate(()=>{
  const button=document.querySelector('#play-button'),menu=document.querySelector('#start-screen');
  const r=button.getBoundingClientRect(),m=menu.getBoundingClientRect();
  const target=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2),opacity=getComputedStyle(menu).opacity;
  return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height,
   viewportWidth:innerWidth,viewportHeight:innerHeight,scrollTop:menu.scrollTop,scrollHeight:menu.scrollHeight,clientHeight:menu.clientHeight,
   menu:{left:m.left,right:m.right,top:m.top,bottom:m.bottom,opacity,inert:menu.inert},
   active:!button.closest('[inert]')&&!button.disabled&&opacity==='1',
   hit:button.contains(target),hitTarget:target?.id||target?.tagName||null,hovered:button.matches(':hover')};
 });
}

/** Reach the existing overflow menu through native wheel/swipe inputs only.
 * Reading layout is allowed; CSS, element positions and scrollTop are never set. */
export async function reachStartPlay(page,touch=false){
 await waitForStartMenu(page);await page.bringToFront();
 await page.waitForFunction(()=>document.hasFocus()&&!document.hidden&&!document.pointerLockElement);
 const initial=await playBounds(page),scrolls=[];
 for(let attempt=0;attempt<20;attempt++){
  const box=await playBounds(page);
  const fits=box.left>=0&&box.right<=box.viewportWidth&&box.top>=0&&box.bottom<=box.viewportHeight;
  if(fits&&box.active&&box.hit){
   assert.ok(box.width>=44&&box.height>=44,'Play must remain a usable pointer/touch target');
   return {initial,reachable:box,scrolls,touch};
  }
  assert.ok(box.left>=0&&box.right<=box.viewportWidth,'The menu clips Play horizontally');
  const dy=Math.sign((box.top+box.bottom)/2-box.viewportHeight/2)*box.viewportHeight*.6;
  assert.ok(dy,'Play is obstructed at the centre of the viewport');
  const x=Math.min(box.viewportWidth-18,box.menu.right-18),high=Math.max(45,box.menu.top+45),low=Math.min(box.viewportHeight-45,box.menu.bottom-45);
  assert.ok(low>high,'The real menu has no reachable scrolling area');
  if(touch){
   const start=dy>0?low:high,end=dy>0?high:low;
   const finger=await page.touchscreen.touchStart(x,start);
   try{for(let step=1;step<=8;step++){await finger.move(x,start+(end-start)*step/8);await new Promise(resolve=>setTimeout(resolve,20));}}
   finally{await finger.end();}
  }else{await page.mouse.move(x,(high+low)/2);await page.mouse.wheel({deltaY:dy});}
  await new Promise(resolve=>setTimeout(resolve,150));
  const after=await playBounds(page);scrolls.push({before:box.scrollTop,after:after.scrollTop,input:touch?'native swipe':'native wheel'});
  assert.notEqual(after.scrollTop,box.scrollTop,'Ordinary input cannot scroll the real menu to Play');
 }
 assert.fail('Play is unreachable after ordinary menu scrolling');
}

export async function playFromReachableMenu(page,touch=false){
 const proof=await reachStartPlay(page,touch);
 await page.$eval('#play-button',button=>{
  document.documentElement.dataset.releaseTrustedPlay='pending';
  document.documentElement.dataset.releasePlayEvent='pending';
  button.addEventListener('click',event=>{
   document.documentElement.dataset.releaseTrustedPlay=String(event.isTrusted);
   document.documentElement.dataset.releasePlayEvent=JSON.stringify({trusted:event.isTrusted,time:performance.now(),
    state:document.documentElement.dataset.runtimeState,externalPause:document.body.dataset.externalPause||null,
    focused:document.hasFocus(),hidden:document.hidden,locked:!!document.pointerLockElement,
    target:event.target?.id||event.target?.tagName||null,hovered:button.matches(':hover')});
  },{once:true,capture:true});
 });
 const {left,right,top,bottom}=proof.reachable,x=(left+right)/2,y=(top+bottom)/2;
 if(touch)await page.touchscreen.tap(x,y);else await page.mouse.click(x,y);
 await page.waitForFunction(()=>document.documentElement.dataset.runtimeState==='playing');
 assert.equal(await page.evaluate(()=>document.documentElement.dataset.releaseTrustedPlay),'true','Play must respond to native trusted input');
 return {...proof,nativePlay:true,trusted:true,event:await page.evaluate(()=>JSON.parse(document.documentElement.dataset.releasePlayEvent))};
}
