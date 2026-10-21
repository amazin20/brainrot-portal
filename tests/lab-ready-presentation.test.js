import test from 'node:test';
import assert from 'node:assert/strict';
import {waitForMenuPaint,LabStartupError,startupFailureMessage} from '../src/game/LabReadyPresentation.js';

const tick=async()=>{for(let i=0;i<8;i++)await Promise.resolve();};
function fixture(){
 let finishFonts,finishImage;const frames=[],src=[],style={display:'grid',visibility:'visible',opacity:'0',backgroundImage:'url("/art/menu.webp")'};
 const document={fonts:{ready:new Promise(resolve=>finishFonts=resolve)}};
 const options={document,panel:{getClientRects:()=>[{}]},getStyle:()=>style,requestFrame:callback=>frames.push(callback),createImage:()=>({set src(value){src.push(value);},decode:()=>new Promise(resolve=>finishImage=resolve)})};
 return{options,style,frames,src,finishFonts:()=>finishFonts(),finishImage:()=>finishImage(),frame:async()=>{assert.ok(frames.length);frames.shift()(0);await tick();}};
}
test('loading-screen paint cannot announce the still transparent menu; fonts, image and two opaque menu frames are required',async()=>{
 const f=fixture();let ready=false;const promise=waitForMenuPaint(f.options).then(value=>ready=value);
 await tick();assert.equal(f.frames.length,0);assert.deepEqual(f.src,[]);
 f.finishFonts();await tick();assert.deepEqual(f.src,['/art/menu.webp']);assert.equal(f.frames.length,0);
 f.finishImage();await tick();await f.frame();assert.equal(ready,false);
 f.style.opacity='1';await f.frame();assert.equal(ready,false);await f.frame();await promise;assert.equal(ready,true);
});
test('a hidden menu between visible frames restarts the presentation boundary',async()=>{
 const f=fixture();let ready=false;const p=waitForMenuPaint(f.options).then(v=>ready=v);f.finishFonts();await tick();f.finishImage();await tick();f.style.opacity='1';await f.frame();
 f.style.visibility='hidden';await f.frame();f.style.visibility='visible';await f.frame();assert.equal(ready,false);await f.frame();await p;assert.equal(ready,true);
});
test('an interrupted startup does not announce readiness or wait for more frames',async()=>{
 const f=fixture();let current=true;const p=waitForMenuPaint({...f.options,isCurrent:()=>current});f.finishFonts();await tick();f.finishImage();await tick();current=false;await f.frame();assert.equal(await p,false);assert.equal(f.frames.length,0);
});
test('menu artwork decode failures propagate instead of announcing readiness',async()=>{
 const f=fixture();const p=waitForMenuPaint({...f.options,createImage:()=>({decode:async()=>{throw Error('broken artwork');}})});f.finishFonts();await assert.rejects(p,/broken artwork/);assert.equal(f.frames.length,0);
});

test('finite card entrance animations finish before readiness while endless decoration does not block play',async()=>{
 const f=fixture();let ready=false;const card={playState:'running',effect:{getComputedTiming:()=>({endTime:400})}},decoration={playState:'running',effect:{getComputedTiming:()=>({endTime:Infinity})}};
 f.options.panel.getAnimations=()=>[card,decoration];const p=waitForMenuPaint(f.options).then(v=>ready=v);
 f.finishFonts();await tick();f.finishImage();await tick();f.style.opacity='1';await f.frame();await f.frame();assert.equal(ready,false);
 card.playState='finished';await f.frame();assert.equal(ready,false);await f.frame();await p;assert.equal(ready,true);
});
test('recovery text remains Russian and excludes raw graphics/SDK/browser errors',()=>{
 for(const cause of [new Error('WebGL is not supported'),new Error('SDK initialization rejected'),'<script>internal data</script>']){
  const graphics=startupFailureMessage(new LabStartupError('graphics',cause)),sdk=startupFailureMessage(new LabStartupError('sdk',cause)),generic=startupFailureMessage(cause);
  assert.match(graphics,/3D-сцену/);assert.match(sdk,/Яндекс Играм/);
  for(const text of [graphics,sdk,generic]){assert.match(text,/Повторить загрузку/);assert.match(text,/прогресс/);assert.doesNotMatch(text,/WebGL|initialization|script|internal/);}
 }
});
