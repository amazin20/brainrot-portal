import './styles.css';
import {LabGame} from './game/LabGame.js';
import {CAMPAIGN} from './game/LabCampaignLevels.js';
import {LabPreferences,QUALITY_PRESETS,applyLabQuality} from './game/LabPreferences.js';
import {LabPlatform,loadYandexSDK} from './game/LabPlatform.js';
import {Vector3} from 'three';
import {VELOCITY_CHAPTERS,LabVelocityProgress,getVelocityInterlude,velocityChapterURL,readVelocityRoute} from './game/LabVelocityChapters.js';
import {bindVelocityHoldButton} from './game/LabVelocityHoldButton.js';
const $=s=>document.querySelector(s),query=new URLSearchParams(location.search);
const debug=query.get('debug')==='1'||query.get('smoke')==='1';
const velocityMode=query.get('mode')==='velocity';
const velocityRoute=readVelocityRoute(query),velocityChapter=velocityRoute.chapter;
const touchControls=globalThis.matchMedia?.('(pointer: coarse)').matches ?? false;
const motionReduced=globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
const yandex=import.meta.env.MODE==='yandex';
let storage;try{storage=localStorage;}catch{}
const preferences=new LabPreferences(storage),holds=new Set(),velocityHoldButtons=[];
const velocityProgress=new LabVelocityProgress(storage);
const screens=['loading','start-screen','pause-screen','win-screen','error-screen'];
let platform,entering=false,hintBusy=false;
function screen(id,visible){const e=$('#'+id);e.classList.toggle('screen--active',visible);e.setAttribute('aria-hidden',String(!visible));e.inert=!visible;}
function hideScreens(){screens.forEach(id=>screen(id,false));}
function clearInput(){game.resetInput();for(const button of velocityHoldButtons)button.reset();}
function syncActivity(){const active=game.state==='playing'&&!holds.size;platform?.gameplay(active);game.audio?.block('menu',game.state!=='playing'&&game.state!=='won');game.audio?.block('external',holds.size>0);}
function setState(state){document.body.dataset.playState=state;document.documentElement.dataset.runtimeState=state;
  const mobile=$('#mobile-controls'),active=state==='playing';mobile.classList.toggle('mobile-controls--active',active);mobile.inert=!active;mobile.setAttribute('aria-hidden',String(!active));
  if(velocityMode&&!active){$('#velocity-focus-hint').dataset.active='false';$('#velocity-focus').classList.remove('is-active');}syncActivity();}
function hold(reason,on){on?holds.add(reason):holds.delete(reason);game.externalBlocked=holds.size>0;
  clearInput();game.accumulator=0;game.lastFrame=performance.now();document.body.dataset.externalPause=String(holds.size>0);syncActivity();}
function diagnostics(){const d=game.diagnostics();Object.assign(document.documentElement.dataset,{gameReady:String(d.modelsLoaded>0&&!d.missingModels.length),modelsLoaded:String(d.modelsLoaded),levelIndex:String(game.levelIndex)});
  if(debug)window.__NESI_DEMO_DIAGNOSTICS__={...d,settings:preferences.value,adBusy:platform?.busy};return d;}
function failure(error){console.error(error);clearInput();game.renderer?.setAnimationLoop(null);game.state='error';setState('error');hideScreens();$('#error-detail').textContent=error?.message||String(error);screen('error-screen',true);}
function choices(){for(const selector of ['#level-select','#settings-level-select']){const e=$(selector),old=e.value;e.replaceChildren();CAMPAIGN.forEach((l,i)=>{const option=document.createElement('option');option.value=i;option.textContent=`${String(i+1).padStart(2,'0')} · ${l.title}${preferences.value.completed.includes(i)?' ✓':''}`;e.append(option);});e.value=old||String(game.levelIndex);}}
function pauseInfo(){ $('#settings-level-select').value=String(game.levelIndex);$('#pause-course').textContent=velocityMode?`ПРЕДЕЛ ${velocityChapter.chapter} · ${velocityChapter.title}`:`${game.levelIndex+1} / ${CAMPAIGN.length} · ${CAMPAIGN[game.levelIndex].title}`;$('#hint-detail').hidden=true;
  if(velocityMode){const checkpoint=game.firstLevel?.getGuidance?.()?.checkpointLabel;$('#restart-button').textContent=checkpoint?`Повторить участок · ${checkpoint}`:'Повторить текущий участок';}}
function chapterChoices(){
  const menu=$('#velocity-chapters');menu.replaceChildren();
  for(const chapter of VELOCITY_CHAPTERS){
    const link=document.createElement('a');link.href=velocityChapterURL(chapter.chapter);
    link.textContent=`${chapter.chapter}. ${chapter.title}${velocityProgress.has(chapter.chapter)?' ✓':''}`;
    if(velocityMode&&chapter.chapter===velocityChapter.chapter)link.setAttribute('aria-current','page');
    menu.append(link);
  }
}
function velocityInstruction(text=''){
  if(!touchControls)return text;
  return text.replace(/ЛКМ\s*\/\s*ПКМ|ЛКМ|ПКМ/g,'«ПОРТАЛ»').replace(/\bQ\b/g,'«ФОКУС»')
    .replace(/\bE\b/g,'«ДРУГ»').replace(/\bShift\b/gi,'«РАЗГОН»').replace(/\bSpace\b/gi,'«ПРЫЖОК»')
    .replace(/\bR\b/g,'«Пауза → повторить участок»').replace(/\bWASD\b/g,'джойстик').replace(/\bW\b/g,'вперёд');
}
function velocityHud(objective){
  const guidance=game.firstLevel?.getGuidance?.();
  $('#velocity-objective').textContent=velocityInstruction(guidance?.text||objective||'');
  $('#velocity-stage').textContent=guidance?.title||game.velocityRun?.name||velocityChapter.title;
  $('#velocity-speed-value').textContent=String(Math.round(game.playerVelocity.length()*3.6));
  const connected=Boolean(guidance?.companionConnected);
  $('#velocity-companion').textContent=connected?'Друг с тобой':touchControls?'Подойди · нажми «ДРУГ»':'Подойди к другу · E';
  $('#velocity-companion').dataset.connected=String(connected);
  $('#velocity-checkpoint').textContent=guidance?.checkpointLabel||'Старт';
  // Reuse the weapon's visibility/front-face/range check at HUD cadence; a
  // glowing target means the same shot assistance the next click will receive.
  game.velocityAimReady=Boolean(game.state==='playing'&&!game.externalBlocked&&guidance?.kind==='shoot'
    &&game.portalShots?.getAssistTarget?.(1));
}
function velocityMobileControls(){
  if(!velocityMode)return;
  const buttons=document.querySelectorAll('.lab-mobile button');
  if(buttons.length<4)return;
  buttons[0].textContent='ПОРТАЛ';buttons[0].setAttribute('aria-label','Открыть выход на отмеченной панели');
  buttons[1].hidden=true; // Both triggers select the next outlet; one large touch button is clearer.
  buttons[2].textContent='ДРУГ';buttons[2].setAttribute('aria-label','Связаться с другом');
  buttons[3].hidden=true; // The top-right pause button remains accessible on every screen size.
}
function showVictory(){
  if(velocityMode)velocityProgress.complete(velocityChapter.chapter);else preferences.complete(game.levelIndex);
  choices();chapterChoices();clearInput();setState('won');screen('win-screen',true);
  const primary=$('#play-again-button'),secondary=$('#win-secondary-button'),campaignLink=$('#win-campaign-link');
  secondary.hidden=true;campaignLink.hidden=true;
  if(velocityMode){
    $('#win-title').innerHTML='На одной<br />волне<span>.</span>';
    $('#win-screen .eyebrow').textContent=`ПРЕДЕЛ ${velocityChapter.chapter} · ВЫ ДОБРАЛИСЬ ВМЕСТЕ`;
    $('#win-screen .muted').textContent=`${velocityChapter.title} пройден. Пиковая скорость — ${Math.round((game.velocityRun?.peakSpeed||0)*3.6)} км/ч. Друг рядом — можно продолжать.`;
    primary.textContent=velocityRoute.returnLevel?`Продолжить · уровень ${velocityRoute.returnLevel} →`:velocityChapter.chapter===1?'Следующая глава · Каскад →':'Вернуться к головоломкам →';
    secondary.textContent='Пройти эту главу ещё раз ↻';secondary.hidden=false;
    campaignLink.href=`?level=${velocityRoute.returnLevel||velocityChapter.returnLevel}`;campaignLink.hidden=false;
  }else{
    const last=game.levelIndex===CAMPAIGN.length-1,interlude=getVelocityInterlude(game.levelIndex);
    $('#win-title').innerHTML='Вместе<br />получилось<span>.</span>';
    $('#win-screen .eyebrow').textContent='ДРУГ ТОЖЕ ДОБРАЛСЯ';
    primary.textContent=interlude?`ПРЕДЕЛ ${interlude.chapter} · ${interlude.title} ↗`:last?'К первому испытанию ↻':'Следующий уровень →';
    $('#win-screen .muted').textContent=interlude?`Впереди скоростная глава: ${interlude.description} После неё — уровень ${interlude.returnLevel}.`:last?'Все доступные испытания завершены. Друг добрался вместе с тобой.':'Получилось! Следующее испытание добавит новую идею.';
    if(interlude){secondary.textContent=`Сразу к уровню ${interlude.returnLevel} →`;secondary.hidden=false;}
  }
  diagnostics();
}
function showHints(){
  if(velocityMode)return; // The live route guidance replaces campaign spoiler hints here.
  const count=preferences.value.hints[game.levelIndex]||0;$('#hint-detail').hidden=false;$('#hint-text').replaceChildren();
  CAMPAIGN[game.levelIndex].hints.slice(0,count).forEach((text,i)=>{const p=document.createElement('p');p.textContent=`${i+1}. ${text}`;$('#hint-text').append(p);});
  if(!count)$('#hint-text').textContent='Открой сначала намёк. Следующие подсказки раскрывают решение подробнее.';
  const button=$('#hint-unlock');button.hidden=count>=3;button.disabled=hintBusy;
  button.textContent=yandex?'Посмотреть рекламу · следующий намёк':'Следующий намёк · бесплатно в демо';
  $('#ad-status').textContent=yandex?'Подсказка открывается после подтверждённого просмотра. Прочитанные подсказки остаются доступны.':'В демо на GitHub рекламы нет. В сборке для Яндекс Игр здесь добровольный просмотр.';
}
const game=new LabGame({debug,container:$('#game'),touch:{joystick:$('#joystick'),joystickKnob:$('#joystick-knob'),jumpButton:$('#jump-button')},
  onProgress:p=>{const n=Math.max(0,Math.min(100,p.percent||0));$('#loading-bar').style.width=n+'%';$('#loading-percent').textContent=n+'%';$('#loading-label').textContent=p.label||'Загрузка';$('#loading-progress').setAttribute('aria-valuenow',String(n));},
  onReady:()=>{hideScreens();setState('ready');screen('start-screen',true);platform?.ready();
    game.audio.configure(preferences.value);applyLabQuality(game,preferences.value.quality);diagnostics();velocityMobileControls();
    if(debug){window.__NESI_DEMO_GAME__=game;window.__NESI_PLATFORM__=platform;window.__NESI_PREFS__=preferences;
      window.__NESI_RUN_LEVEL_ROUTE__=async(options={})=>{const {runV8Journey}=await import('./game/LabV8Journey.js');game.renderer.setAnimationLoop(null);hideScreens();setState('playing');
        try{return await runV8Journey(game,{journeyOptions:options,onMilestone:mark=>{game.render();window.__NESI_CAPTURE_LEVEL_MARK__?.(mark);}});}finally{game.render();clearInput();setState(game.state);diagnostics();}};
      window.__NESI_RUN_VELOCITY_ROUTE__=async(options={})=>{
        if(!game.epicMode)throw Error('Velocity mode is required');
        const {runVelocityJourney}=await import('./game/LabVelocityEvidence.js');
        game.renderer.setAnimationLoop(null);hideScreens();setState('playing');
        try{return await runVelocityJourney(game,{...options,onFrame:sample=>window.__NESI_CAPTURE_VELOCITY_FRAME__?.(sample)});}
        finally{game.render();clearInput();setState(game.state);diagnostics();}
      };
      window.__NESI_RUN_PORTAL_EDGE_ROUTE__=async(options={})=>{
        const {runPortalEdgeJourney}=await import('./game/LabPortalEdgeJourney.js');
        game.renderer.setAnimationLoop(null);hideScreens();setState('playing');
        try{return await runPortalEdgeJourney(game,{...options,onMilestone:()=>game.render(),
          onFrame:sample=>window.__NESI_CAPTURE_PORTAL_EDGE_FRAME__?.(sample)});}
        finally{game.render();clearInput();setState(game.state);diagnostics();}
      };
      window.__NESI_RUN_BALANCE_BYPASS__=async()=>{
        if(game.levelIndex!==6)throw Error('Balance scenario belongs to room 7');
        const {runV8Journey}=await import('./game/LabV8Journey.js');
        const {runBalanceJumpAttempt}=await import('./game/LabExtendedJourney.js');
        game.renderer.setAnimationLoop(null);hideScreens();setState('playing');let attempt;
        try{const route=await runV8Journey(game,{scenario:d=>{attempt=runBalanceJumpAttempt(d);}});return{route,attempt};}
        finally{game.render();clearInput();setState(game.state);diagnostics();}
      };
      window.__NESI_RUN_ANIMATION_ROUTE__=async(options={})=>{
        const {runAnimationJourney}=await import('./game/LabAnimationJourney.js');
        game.renderer.setAnimationLoop(null);hideScreens();setState('playing');
        try{return await runAnimationJourney(game,{...options,onMilestone:()=>game.render(),
          onFrame:sample=>window.__NESI_CAPTURE_ANIMATION_FRAME__?.(sample)});}
        finally{game.render();clearInput();setState(game.state);diagnostics();}
      };}
    $('#play-button').focus({preventScroll:true});if(query.get('smoke')==='1')enterLevel(game.levelIndex,'initial');},
  onHud:({chamber,objective,hasCargo,portalsReady})=>{if(velocityMode)velocityHud(objective);$('#level-number').textContent=String(game.levelIndex+1);$('#chamber').textContent=chamber;$('#objective').textContent=objective||'';$('#cargo-status').textContent=hasCargo?'Друг на руках':'Друг ждёт';$('#portal-status').textContent=portalsReady?'Связаны':'Два портала';},
  onToast:message=>{if(/Сначала|не помещается|препятствие|белую|Раздвинь|свободное|лицевую/.test(message))game.tutorial.explain(message);},
  onPause:paused=>{clearInput();screen('pause-screen',paused);setState(paused?'paused':'playing');if(paused){pauseInfo();$('#resume-button').focus({preventScroll:true});}},
  onRestartRequest:()=>restartLevel(),
  onWin:showVictory,
});
game.epicMode=velocityMode;
game.velocityChapter=velocityChapter.chapter;
game.epicOptions={dynamicFov:!motionReduced,speedLines:!motionReduced,reducedMotion:motionReduced};
try{const saved=JSON.parse(storage?.getItem('brainrot-portal.velocity-effects')||'null');if(saved)for(const key of ['dynamicFov','speedLines'])if(typeof saved[key]==='boolean')game.epicOptions[key]=saved[key];}catch{}
if(game.epicOptions.speedLines)game.epicOptions.reducedMotion=false;
document.body.dataset.gameMode=velocityMode?'velocity':'campaign';
game.quality={...QUALITY_PRESETS[preferences.value.quality]};game.tutorial.enabled=preferences.value.tutorial;
const requested=velocityMode?0:Number(query.get('level')||1)-1;game.levelIndex=Number.isInteger(requested)&&CAMPAIGN[requested]?requested:0;
choices();chapterChoices();$('#level-select').value=String(game.levelIndex);
async function enterLevel(index,reason='next'){
  if(entering||holds.size)return;entering=true;clearInput();game.audio?.unlock();
  try{
    // All interstitials are tied to an explicit menu transition, never a timer during play.
    if(reason!=='initial')await platform?.interstitial('next');
    hideScreens();screen('loading',true);game.state='loading';setState('loading');
    if(index!==game.levelIndex)await game.selectLevel(index,false);
    game.start();game.renderer.setAnimationLoop(game.animate);hideScreens();setState('playing');$('#level-select').value=String(index);$('#settings-level-select').value=String(index);diagnostics();
  }catch(error){failure(error);}finally{entering=false;}
}
async function restartLevel({full=false}={}){
  if(entering||holds.size)return;entering=true;clearInput();
  try{if(game.state==='playing')game.togglePause(true);await platform?.interstitial('restart');
    hideScreens();if(velocityMode&&!full&&game.restartCheckpoint)game.restartCheckpoint();else game.restart();game.audio.unlock();game.renderer.setAnimationLoop(game.animate);setState('playing');game.requestPointerLock();
  }catch(error){failure(error);}finally{entering=false;}
}
function resume(){if(holds.size)return;game.audio.unlock();game.togglePause(false);game.renderer.setAnimationLoop(game.animate);}
$('#play-button').addEventListener('click',()=>enterLevel(Number($('#level-select').value),game.state==='ready'&&!preferences.value.completed.length?'initial':'next'));
$('#play-again-button').addEventListener('click',()=>{
  if(velocityMode){location.href=velocityRoute.returnLevel?`?level=${velocityRoute.returnLevel}`:velocityChapter.chapter===1?velocityChapterURL(2):`?level=${velocityChapter.returnLevel}`;return;}
  const interlude=getVelocityInterlude(game.levelIndex);
  if(interlude)location.href=velocityChapterURL(interlude.chapter,{returnToCampaign:true});else enterLevel((game.levelIndex+1)%CAMPAIGN.length);
});
$('#win-secondary-button').addEventListener('click',()=>velocityMode?restartLevel({full:true}):enterLevel((game.levelIndex+1)%CAMPAIGN.length));
$('#resume-button').addEventListener('click',resume);$('#restart-button').addEventListener('click',restartLevel);
$('#velocity-full-restart').addEventListener('click',()=>restartLevel({full:true}));
for(const id of ['pause-button','velocity-pause'])$('#'+id).addEventListener('click',()=>game.togglePause(true));
$('#hint-button').hidden=!debug;
$('#hint-button').addEventListener('click',()=>{if(debug)showHints();});
$('#hint-unlock').addEventListener('click',async()=>{
  if(velocityMode||hintBusy||holds.size||(preferences.value.hints[game.levelIndex]||0)>=3)return;
  hintBusy=true;const index=game.levelIndex;showHints();
  try{const result=await platform.hint(()=>preferences.unlockHint(index));showHints();if(!result.rewarded)$('#ad-status').textContent='Просмотр не подтверждён или реклама недоступна. Намёк не списан; игру можно продолжить.';}
  finally{hintBusy=false;$('#hint-unlock').disabled=false;}
});
$('#settings-level-select').addEventListener('change',e=>enterLevel(Number(e.target.value)));
$('#level-menu-button').addEventListener('click',()=>{if(holds.size)return;hideScreens();game.state='ready';setState('ready');screen('start-screen',true);$('#level-select').value=String(game.levelIndex);});
$('#tutorial-toggle').checked=preferences.value.tutorial;$('#tutorial-toggle').addEventListener('change',e=>{game.tutorial.enabled=e.target.checked;preferences.save({tutorial:e.target.checked});});
$('#quality-select').value=preferences.value.quality;$('#quality-select').addEventListener('change',e=>{preferences.save({quality:e.target.value});applyLabQuality(game,e.target.value);});
$('#mute-toggle').checked=preferences.value.muted;$('#volume-control').value=preferences.value.volume*100;
$('#mute-toggle').addEventListener('change',e=>{preferences.save({muted:e.target.checked});game.audio.configure(preferences.value);});
$('#volume-control').addEventListener('input',e=>{preferences.save({volume:Number(e.target.value)/100});game.audio.configure(preferences.value);});
$('#reload-button').addEventListener('click',()=>location.reload());
let captured=false;document.addEventListener('pointerlockchange',()=>{const locked=document.pointerLockElement===game.renderer?.domElement;const lost=captured&&!locked;captured=locked;
  if(lost&&!holds.size&&game.state==='playing'){clearInput();game.togglePause(true);}});
addEventListener('keydown',event=>{
  if(holds.size){event.preventDefault();event.stopImmediatePropagation();return;}
  if(game.state==='paused'&&['Escape','KeyR'].includes(event.code)){event.preventDefault();event.stopImmediatePropagation();if(!event.repeat)(event.code==='KeyR'?restartLevel():resume());}
  else if(game.state!=='playing'&&['Escape','KeyR','Space'].includes(event.code))event.stopImmediatePropagation();
},true);
addEventListener('blur',()=>hold('focus',true));addEventListener('focus',()=>hold('focus',false));
document.addEventListener('visibilitychange',()=>{hold('hidden',document.hidden);if(document.hidden&&game.state==='playing'&&!game.externalBlocked)game.togglePause(true);});
// A bfcache visit keeps the one live controller; a discarded page detaches it.
addEventListener('pagehide',event=>{hold('page',true);if(!event.persisted){for(const button of velocityHoldButtons)button.dispose();game.renderer?.setAnimationLoop(null);game.disposeControls();game.epicDirector?.dispose();platform?.dispose();game.audio?.dispose();}});
addEventListener('pageshow',event=>{if(event.persisted)hold('page',false);});
addEventListener('contextmenu',event=>event.preventDefault());
addEventListener('error',event=>{if(event.error)failure(event.error);});
addEventListener('unhandledrejection',event=>{if(/pointer.?lock|user gesture|document is not focused/i.test(String(event.reason))){event.preventDefault();return;}failure(event.reason);});
async function boot(){
  let sdk=null;if(yandex)try{sdk=await loadYandexSDK();}catch(error){console.warn('SDK unavailable; game remains playable',error);}
  platform=new LabPlatform({sdk,demo:!yandex,hold});hideScreens();screen('loading',true);setState('loading');await game.init();
}
function setVelocityEffects(){
  for(const [id,key] of [['velocity-fov','dynamicFov'],['velocity-lines','speedLines']]){
    const input=$('#'+id);input.checked=game.epicOptions[key];input.addEventListener('change',()=>{
      game.epicOptions[key]=input.checked;if(key==='speedLines'&&input.checked)game.epicOptions.reducedMotion=false;game.epicDirector?.configure(game.epicOptions);
      game.cameraRig?.configureEpic?.({enabled:velocityMode,dynamicFov:game.epicOptions.dynamicFov});
      try{storage?.setItem('brainrot-portal.velocity-effects',JSON.stringify(game.epicOptions));}catch{}
    });
  }
}
setVelocityEffects();
if(velocityMode){
  document.title=`БРЕЙНРОТ ПОРТАЛ · ПРЕДЕЛ ${velocityChapter.chapter}`;
  $('#game-title').innerHTML=velocityChapter.chapter===1?'ВМЕСТЕ<br /><span>В ПОТОК.</span>':'ПОЛНЫЙ<br /><span>КАСКАД.</span>';
  $('#start-screen .brand').textContent=`БРЕЙНРОТ ПОРТАЛ / ПРЕДЕЛ ${velocityChapter.chapter}`;
  $('#start-screen .hero-meta').innerHTML=`<span>ЛЕТИМ ВМЕСТЕ</span><span>КОРОТКИЕ УЧАСТКИ</span><span>${touchControls?'ФОКУС':'ФОКУС НА Q'}</span>`;
  $('#start-screen .lead').textContent=velocityChapter.description+' Синий вход уже готов: открой янтарный выход по маркеру одним кликом. Промахнулся — повтори только текущий участок.';
  $('#play-button').innerHTML='Отправиться вместе <span aria-hidden="true">↗</span>';
  const campaignURL=`?level=${velocityRoute.returnLevel||velocityChapter.returnLevel}`;
  $('#velocity-link').textContent=velocityRoute.returnLevel?`← Продолжить головоломки · уровень ${velocityRoute.returnLevel}`:'← Вернуться к головоломкам';$('#velocity-link').href=campaignURL;
  $('#velocity-campaign-exit').hidden=false;$('#velocity-campaign-exit').href=campaignURL;
  $('#velocity-full-restart').hidden=false;
  $('#velocity-chapter-note').textContent=velocityRoute.returnLevel?`После этой главы продолжишь с уровня ${velocityRoute.returnLevel}. Прогресс головоломок сохранён.`:'Две главы можно пройти подряд или встретить после 10-го и 20-го уровней.';
  for(const id of ['level-select','settings-level-select','tutorial-toggle'])$('#'+id).closest('label').hidden=true;
  for(const id of ['level-number','level-menu-button','hint-button'])$('#'+id).hidden=true;
  $('#restart-button').textContent='Повторить текущий участок';
  $('#start-screen .control-grid').innerHTML='<span><kbd>WASD</kbd> движение</span><span><kbd>SHIFT</kbd> разгон</span><span><kbd class="amber">ЛКМ</kbd> открыть выход</span><span><kbd>Q</kbd> удерживать: фокус</span><span><kbd>E</kbd> связаться с другом</span><span><kbd>SPACE</kbd> прыжок</span><span><kbd>C</kbd> скольжение</span><span><kbd>R</kbd> повторить участок</span>';
  $('#start-screen .mobile-note').textContent='Слева — движение. Нажми «ДРУГ» рядом с брейнротом — полетите вместе. Удерживай «ФОКУС» и открывай выход кнопкой «ПОРТАЛ». Синий вход уже готов. «РАЗГОН» ускоряет бег.';
  if(touchControls)$('#velocity-focus-hint kbd').textContent='ФОКУС';
  $('#start-screen .desktop-note').textContent='Маркер — следующая цель · Q — время прицелиться · R — повторить участок';
  $('#loading .muted').textContent='Готовим маршрут для вас двоих.';
  $('#start-screen .start-caption')?.remove();
  for(const [id,key] of [['velocity-sprint','ShiftLeft'],['velocity-focus','KeyQ']]){
    velocityHoldButtons.push(bindVelocityHoldButton($('#'+id),{key,getInput:()=>game.input,
      isActive:()=>game.state==='playing'&&!holds.size&&!game.externalBlocked}));
  }

  // One world-space destination, rendered by the game's existing frame loop.
  // It never follows the cursor or changes camera aim.
  const target=$('#velocity-target'),label=$('#velocity-target-label'),focusHint=$('#velocity-focus-hint');
  const projected=new Vector3(),cameraSpace=new Vector3();
  game.onVelocityFrame=()=>{
    const guidance=game.firstLevel?.getGuidance?.();
    const active=game.state==='playing'&&!game.externalBlocked;
    const focusing=active&&Boolean(game.velocityFocus);
    focusHint.dataset.active=String(focusing);
    $('#velocity-focus').classList.toggle('is-active',focusing);
    if(!active||!guidance?.target||!game.camera){target.hidden=true;return;}
    projected.copy(guidance.target).project(game.camera);
    cameraSpace.copy(guidance.target).applyMatrix4(game.camera.matrixWorldInverse);
    if(!Number.isFinite(projected.x)||!Number.isFinite(projected.y)){target.hidden=true;return;}
    const width=innerWidth,height=innerHeight;
    let dx=projected.x*width/2,dy=-projected.y*height/2;
    const behind=cameraSpace.z>=0;
    if(behind){dx=-dx;dy=-dy;if(Math.abs(dx)+Math.abs(dy)<1)dy=height;}
    const horizontal=Math.max(30,width/2-82),vertical=Math.max(30,height/2-110);
    const edge=behind||Math.abs(dx)>horizontal||Math.abs(dy)>vertical;
    if(edge){const scale=Math.max(Math.abs(dx)/horizontal,Math.abs(dy)/vertical,.001);dx/=scale;dy/=scale;}
    target.style.transform=`translate(${Math.round(width/2+dx)}px,${Math.round(height/2+dy)}px)`;
    target.style.setProperty('--target-angle',`${Math.atan2(dy,dx)*180/Math.PI+90}deg`);
    const aimReady=Boolean(game.velocityAimReady);
    target.dataset.edge=String(edge);target.dataset.kind=guidance.kind||'fly';target.dataset.slot=String(guidance.slot??'');target.dataset.ready=String(aimReady);
    label.textContent=guidance.kind==='shoot'?(aimReady?(touchControls?'ПОРТАЛ · ОТКРЫТЬ':'ЛКМ · ОТКРЫТЬ'):'НАВЕДИ НА ПАНЕЛЬ'):guidance.kind==='friend'?(touchControls?'СВЯЗАТЬСЯ':'E · СВЯЗАТЬСЯ'):guidance.kind==='land'?'ПЛОЩАДКА':'ЛЕТИ СЮДА';
    target.hidden=false;
  };
}
boot().catch(failure);
