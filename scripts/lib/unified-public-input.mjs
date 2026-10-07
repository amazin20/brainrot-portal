/** Native publication QA input. This module never changes CSS, scroll offsets,
 * actor transforms or game state. Scrolls are wheel events or real finger moves.
 */
import assert from 'node:assert/strict';

export const MATRIX_LEVELS=Object.freeze([1,17,33,41,51]);
export const MATRIX_VIEWPORTS=Object.freeze([
 Object.freeze({width:1280,height:800,touch:false}),
 Object.freeze({width:390,height:844,touch:true}),
 Object.freeze({width:736,height:414,touch:true}),
]);
export const MAX_SCROLL_ATTEMPTS=20;
export const SWIPE_STEPS=8;
export const STABLE_MEASUREMENTS=4;
export const STABLE_INTERVAL_MS=100;
export const GEOMETRY_TOLERANCE=.25;
export const MAX_STABILITY_MEASUREMENTS=80;
const wait=milliseconds=>new Promise(resolve=>setTimeout(resolve,milliseconds));

function geometry(snapshot){
 const fields=['left','top','right','bottom','width','height'];
 return {rect:fields.map(key=>snapshot.rect?.[key]),viewport:[snapshot.viewport?.width,snapshot.viewport?.height],
  clips:(snapshot.clips||[]).map(clip=>[clip.id??null,clip.clipX??true,clip.clipY??true,...fields.map(key=>clip[key])]),
  scrolls:(snapshot.scrolls||[]).map(scroll=>[scroll.id??null,scroll.top,scroll.left])};
}
export function sameSnapshotGeometry(first,last,tolerance=GEOMETRY_TOLERANCE){
 const compare=(a,b)=>Array.isArray(a)?Array.isArray(b)&&a.length===b.length&&a.every((value,index)=>compare(value,b[index])):
  typeof a==='number'&&typeof b==='number'?Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a-b)<=tolerance:a===b;
 const a=geometry(first),b=geometry(last);
 return Object.keys(a).every(key=>compare(a[key],b[key]));
}
export function targetReachable(snapshot){
 const rect=snapshot.rect,viewport=snapshot.viewport;
 if(!rect||!viewport||!snapshot.visible||!snapshot.hit||snapshot.focused===false||snapshot.hidden||snapshot.pointerLocked||snapshot.externalPause||snapshot.inert||snapshot.disabled||Number(snapshot.opacity??1)!==1)return false;
 if(rect.width<44||rect.height<44||rect.left<0||rect.top<0||rect.right>viewport.width||rect.bottom>viewport.height)return false;
 for(const clip of snapshot.clips||[]){
  if(clip.clipX!==false&&(rect.left<clip.left||rect.right>clip.right))return false;
  if(clip.clipY!==false&&(rect.top<clip.top||rect.bottom>clip.bottom))return false;
 }
 return true;
}
export function assertMatrix(rows,{root,chapter}={}){
 assert.equal(rows.length,30,'Native publication matrix requires exactly 30 full scenarios');
 const routeIdentity=value=>{const url=new URL(value);return url.origin+url.pathname;};
 const expectedRoutes=root&&chapter?[routeIdentity(root),routeIdentity(chapter)]:[...new Set(rows.map(row=>routeIdentity(row.url)))];
 assert.equal(expectedRoutes.length,2,'Native matrix requires both public entry points');
 assert.ok(expectedRoutes.some(route=>route.endsWith('/chapter-atlas/')),'Native matrix lacks chapter-atlas');
 const expected=new Set(expectedRoutes.flatMap(route=>MATRIX_VIEWPORTS.flatMap(viewport=>MATRIX_LEVELS.map(level=>JSON.stringify([route,viewport.width,viewport.height,viewport.touch,level])))));
 const found=new Set();
 for(const row of rows){
  const key=JSON.stringify([routeIdentity(row.url),row.width,row.height,row.touch,row.level]);
  assert.ok(expected.has(key),'Unexpected native matrix scenario: '+key);assert.ok(!found.has(key),'Duplicate native matrix scenario: '+key);found.add(key);
  for(const flag of ['nativeTrustedPlay','pauseRestartResumeReturnPlay','reloadAndReplay'])assert.equal(row[flag],true,'Incomplete native lifecycle: '+flag+' '+key);
 }
 assert.equal(found.size,expected.size,'Native matrix must not accept a subset');
 return {levels:[...MATRIX_LEVELS],routes:root&&chapter?[String(root),String(chapter)]:expectedRoutes,viewports:MATRIX_VIEWPORTS.map(viewport=>({...viewport})),expected:30,verified:found.size,exact:true};
}

export async function measureNativeTarget(page,selector){
 return page.evaluate(selector=>{
  const element=document.querySelector(selector);
  if(!element)return {visible:false,hit:false,rect:null,viewport:{width:innerWidth,height:innerHeight},clips:[],scrolls:[],scrollAction:null};
  const style=getComputedStyle(element),rect=element.getBoundingClientRect(),screen=element.closest('.screen');
  const plain=rect=>({left:rect.left,top:rect.top,right:rect.right,bottom:rect.bottom,width:rect.width,height:rect.height});
  const clips=[],scrolls=[],owners=[];
  for(let ancestor=element.parentElement,depth=0;ancestor;ancestor=ancestor.parentElement,depth++){
   const css=getComputedStyle(ancestor),bounds=ancestor.getBoundingClientRect(),id=ancestor.id||ancestor.tagName+':'+[...ancestor.classList].join('.')+'@'+depth;
   const clipX=/(?:auto|scroll|hidden|clip)/.test(css.overflowX),clipY=/(?:auto|scroll|hidden|clip)/.test(css.overflowY);
   const inner={left:bounds.left+ancestor.clientLeft,top:bounds.top+ancestor.clientTop,width:ancestor.clientWidth,height:ancestor.clientHeight};inner.right=inner.left+inner.width;inner.bottom=inner.top+inner.height;
   if(clipX||clipY)clips.push({id,...inner,clipX,clipY});
   if((/(?:auto|scroll)/.test(css.overflowY)&&ancestor.scrollHeight>ancestor.clientHeight)||(/(?:auto|scroll)/.test(css.overflowX)&&ancestor.scrollWidth>ancestor.clientWidth)){
    const scroll={id,top:ancestor.scrollTop,left:ancestor.scrollLeft};scrolls.push(scroll);
    owners.push({id,...inner,topOffset:ancestor.scrollTop,leftOffset:ancestor.scrollLeft,maxTop:ancestor.scrollHeight-ancestor.clientHeight,maxLeft:ancestor.scrollWidth-ancestor.clientWidth,vertical:/(?:auto|scroll)/.test(css.overflowY),horizontal:/(?:auto|scroll)/.test(css.overflowX)});
   }
  }
  scrolls.push({id:'window',top:scrollY,left:scrollX});
  if(document.documentElement.scrollHeight>innerHeight)owners.push({id:'window',left:0,top:0,right:innerWidth,bottom:innerHeight,width:innerWidth,height:innerHeight,topOffset:scrollY,leftOffset:scrollX,maxTop:document.documentElement.scrollHeight-innerHeight,maxLeft:document.documentElement.scrollWidth-innerWidth,vertical:true,horizontal:true});
  let scrollAction=null;
  for(const owner of owners){
   const top=Math.max(0,owner.top),bottom=Math.min(innerHeight,owner.bottom),left=Math.max(0,owner.left),right=Math.min(innerWidth,owner.right);
   const directionY=rect.top<top?-1:rect.bottom>bottom?1:0,directionX=rect.left<left?-1:rect.right>right?1:0;
   if(bottom-top<50||right-left<50)continue;
   const axis=directionY&&owner.vertical&&((directionY>0&&owner.topOffset<owner.maxTop)||(directionY<0&&owner.topOffset>0))?'y':directionX&&owner.horizontal&&((directionX>0&&owner.leftOffset<owner.maxLeft)||(directionX<0&&owner.leftOffset>0))?'x':null;
   if(axis){scrollAction={id:owner.id,axis,direction:axis==='y'?directionY:directionX,x:(left+right)/2,y:(top+bottom)/2,distance:Math.min(320,Math.max(80,(axis==='y'?bottom-top:right-left)*.65))};break;}
  }
  const x=rect.left+rect.width/2,y=rect.top+rect.height/2,hit=document.elementFromPoint(x,y);
  return {rect:plain(rect),viewport:{width:innerWidth,height:innerHeight},clips,scrolls,scrollAction,
   visible:style.display!=='none'&&style.visibility!=='hidden'&&rect.width>0&&rect.height>0,
   focused:document.hasFocus(),hidden:document.hidden,pointerLocked:!!document.pointerLockElement,externalPause:document.body.dataset.externalPause==='true',
   disabled:!!element.disabled,inert:!!element.closest('[inert]'),opacity:Number(getComputedStyle(screen||element).opacity),hit:element.contains(hit),hitId:hit?.id||hit?.className||null};
 },selector);
}
function scrollChanged(before,after,axis,owner){
 return before.scrolls.some(previous=>(!owner||previous.id===owner)&&after.scrolls.some(current=>current.id===previous.id&&Math.abs(current[axis==='y'?'top':'left']-previous[axis==='y'?'top':'left'])>GEOMETRY_TOLERANCE));
}
async function scrollNative(page,action,touch,pause){
 if(!touch){await page.mouse.move(action.x,action.y);await page.mouse.wheel({deltaX:action.axis==='x'?action.distance*action.direction:0,deltaY:action.axis==='y'?action.distance*action.direction:0});return;}
 const travel=Math.min(action.distance,Math.max(40,(action.axis==='y'?action.y:action.x)*.7));
 const startX=action.x+(action.axis==='x'?action.direction*travel/2:0),startY=action.y+(action.axis==='y'?action.direction*travel/2:0);
 const finger=await page.touchscreen.touchStart(startX,startY);
 try{for(let step=1;step<=SWIPE_STEPS;step++){await finger.move(startX-(action.axis==='x'?action.direction*travel*step/SWIPE_STEPS:0),startY-(action.axis==='y'?action.direction*travel*step/SWIPE_STEPS:0));await pause(20);}}
 finally{await finger.end();}
}
export async function nativeActivate(page,selector,touch=false,options={}){
 const pause=options.wait||wait,measure=options.measure||(()=>measureNativeTarget(page,selector)),evidence={selector,touch,scrolls:[],stabilityMeasurements:0};
 const arm=options.armTrust||(()=>page.$eval(selector,element=>{
  window.__unifiedNativeInputEvent=null;
  element.addEventListener('click',event=>{window.__unifiedNativeInputEvent={trusted:event.isTrusted,target:event.currentTarget.contains(event.target),type:event.type};},{capture:true,once:true});
 }));
 const read=options.readTrust||(()=>page.evaluate(()=>window.__unifiedNativeInputEvent));
 const limit=options.maxStabilityMeasurements??MAX_STABILITY_MEASUREMENTS;assert.ok(Number.isInteger(limit)&&limit>=4&&limit<=MAX_STABILITY_MEASUREMENTS,'Invalid bounded geometry measurement limit');
 await page.bringToFront();let snapshot=await measure(),attempts=0;
 while(!targetReachable(snapshot)&&snapshot.scrollAction){
  assert.ok(attempts<MAX_SCROLL_ATTEMPTS,'Native scrolling exhausted all 20 attempts');attempts++;
  const before=snapshot,action=snapshot.scrollAction;await scrollNative(page,action,touch,pause);
  let changed=false;
  for(let sample=0;sample<10;sample++){await pause(STABLE_INTERVAL_MS);snapshot=await measure();if(scrollChanged(before,snapshot,action.axis,action.id)){changed=true;break;}}
  assert.ok(changed,'Native '+(touch?'swipe':'wheel')+' did not change actual '+(action.axis==='y'?'scrollTop':'scrollLeft'));
  evidence.scrolls.push({attempt:attempts,axis:action.axis,direction:action.direction,actualScrollChanged:true,fingerMoves:touch?SWIPE_STEPS:0});
 }
 let baseline=null,stable=0;
 for(let count=0;count<limit;count++){
  if(count){await pause(STABLE_INTERVAL_MS);snapshot=await measure();}evidence.stabilityMeasurements++;
  if(!targetReachable(snapshot)){baseline=null;stable=0;continue;}
  if(!baseline||!sameSnapshotGeometry(baseline,snapshot)){baseline=snapshot;stable=1;}else stable++;
  if(stable===STABLE_MEASUREMENTS)break;
 }
 assert.equal(stable,STABLE_MEASUREMENTS,'Native target failed four stable 100 ms geometry measurements');
 await arm();const fresh=await measure();
 assert.ok(targetReachable(fresh),'Final native target is clipped, obstructed, inactive or below 44px');
 assert.ok(sameSnapshotGeometry(baseline,fresh),'Native target geometry/scroll changed immediately before input');
 const x=fresh.rect.left+fresh.rect.width/2,y=fresh.rect.top+fresh.rect.height/2;
 if(touch)await page.touchscreen.tap(x,y);else await page.mouse.click(x,y);
 const event=await read();assert.ok(event?.trusted===true&&event?.target===true,'Target did not receive its genuine trusted click');
 evidence.final={x,y,rect:fresh.rect,clips:fresh.clips,scrolls:fresh.scrolls};evidence.trustedClick=event;evidence.scrollAttempts=attempts;
 options.onEvidence?.(evidence);return evidence;
}
