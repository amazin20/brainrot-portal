import './styles.css';
import {LabGame} from './game/LabGame.js';
import {CAMPAIGN,campaignSpec} from './game/LabCampaignLevels.js';
import {LabPreferences,QUALITY_PRESETS,applyLabQuality} from './game/LabPreferences.js';
import {LabPlatform,loadYandexSDK} from './game/LabPlatform.js';
import {readCampaignRoute,nextCampaignLevel} from './game/LabCampaignRoute.js';
import {FOUNDATION_INDICES,readFoundationEdition,foundationStorage,nextFoundationLevel} from './game/LabFoundationEdition.js';
import {OPEN_ROOM_INDICES,readOpenEdition,nextOpenRoom,openEditionStorage} from './game/LabOpenEdition.js';
const $=s=>document.querySelector(s),query=new URLSearchParams(location.search);
const debug=query.get('debug')==='1'||query.get('smoke')==='1';
const campaignRoute=readCampaignRoute(query,CAMPAIGN.length),openEdition=readOpenEdition(query),foundationEdition=readFoundationEdition(query);
const availableRooms=foundationEdition.enabled?FOUNDATION_INDICES:openEdition.enabled?OPEN_ROOM_INDICES:CAMPAIGN.map((_,i)=>i);
// Retired speed-mode links return to the campaign without reloading or touching saves.
if(campaignRoute.legacyVelocityLink)history.replaceState(history.state,'',location.pathname+campaignRoute.search+location.hash);
const yandex=import.meta.env.MODE==='yandex';
let storage;try{storage=localStorage;}catch{}
const preferences=new LabPreferences(foundationEdition.enabled?foundationStorage(storage):openEdition.enabled?openEditionStorage(storage):storage),holds=new Set();
const screens=['loading','start-screen','pause-screen','win-screen','error-screen'];
const hudNodes={level:$('#level-number'),chamber:$('#chamber'),objective:$('#objective'),cargo:$('#cargo-status'),portals:$('#portal-status')};
function hudText(key,value){const node=hudNodes[key];if(node.textContent!==value)node.textContent=value;}
let platform,entering=false,hintBusy=false;
function screen(id,visible){const e=$('#'+id);e.classList.toggle('screen--active',visible);e.setAttribute('aria-hidden',String(!visible));e.inert=!visible;}
function hideScreens(){screens.forEach(id=>screen(id,false));}
function clearInput(){game.resetInput();}
function syncActivity(){const active=game.state==='playing'&&!holds.size;platform?.gameplay(active);game.audio?.block('menu',game.state!=='playing'&&game.state!=='won');game.audio?.block('external',holds.size>0);}
function setState(state){document.body.dataset.playState=state;document.documentElement.dataset.runtimeState=state;
  const mobile=$('#mobile-controls'),active=state==='playing';mobile.classList.toggle('mobile-controls--active',active);mobile.inert=!active;mobile.setAttribute('aria-hidden',String(!active));
  syncActivity();}
function hold(reason,on){on?holds.add(reason):holds.delete(reason);game.externalBlocked=holds.size>0;
  clearInput();game.accumulator=0;game.lastFrame=performance.now();document.body.dataset.externalPause=String(holds.size>0);syncActivity();}
function diagnostics(){const d=game.diagnostics();Object.assign(document.documentElement.dataset,{gameReady:String(d.modelsLoaded>0&&!d.missingModels.length),modelsLoaded:String(d.modelsLoaded),levelIndex:String(game.levelIndex)});
  if(debug)window.__NESI_DEMO_DIAGNOSTICS__={...d,settings:preferences.value,adBusy:platform?.busy};return d;}
function failure(error){console.error(error);clearInput();game.renderer?.setAnimationLoop(null);game.state='error';setState('error');hideScreens();$('#error-detail').textContent=error?.message||String(error);screen('error-screen',true);}
function choices(){for(const selector of ['#level-select','#settings-level-select']){const e=$(selector),old=e.value;e.replaceChildren();availableRooms.forEach(i=>{const l=campaignSpec(game,i),option=document.createElement('option');option.value=i;option.textContent=`${String(i+1).padStart(2,'0')} · ${l.title}${preferences.value.completed.includes(i)?' ✓':''}`;e.append(option);});e.value=old||String(game.levelIndex);}}
function pauseInfo(){ $('#settings-level-select').value=String(game.levelIndex);$('#pause-course').textContent=`${game.levelIndex+1} · ${campaignSpec(game,game.levelIndex).title}`;$('#hint-detail').hidden=true;}
function showVictory(){
  preferences.complete(game.levelIndex);
  choices();clearInput();setState('won');screen('win-screen',true);
  const last=game.levelIndex===availableRooms.at(-1);
  $('#win-title').innerHTML='Вместе<br />получилось<span>.</span>';
  $('#win-screen .eyebrow').textContent='ДРУГ ТОЖЕ ДОБРАЛСЯ';
  $('#play-again-button').textContent=last?'К первому испытанию ↻':'Следующий уровень →';
  $('#win-screen .muted').textContent=last?(foundationEdition.enabled?'Пройдены все 30 испытаний кампании. Архив и лабораторные комнаты доступны отдельно.':openEdition.enabled?'Пройдены все испытания этой версии.':'Все доступные испытания завершены. Друг добрался вместе с тобой.'):'Получилось! Следующее испытание добавит новую идею.';
  diagnostics();
}
function showHints(){
  const count=preferences.value.hints[game.levelIndex]||0;$('#hint-detail').hidden=false;$('#hint-text').replaceChildren();
  campaignSpec(game,game.levelIndex).hints.slice(0,count).forEach((text,i)=>{const p=document.createElement('p');p.textContent=`${i+1}. ${text}`;$('#hint-text').append(p);});
  if(!count)$('#hint-text').textContent='Открой сначала намёк. Следующие подсказки раскрывают решение подробнее.';
  const button=$('#hint-unlock');button.hidden=count>=3;button.disabled=hintBusy;
  button.textContent=yandex?'Посмотреть рекламу · следующий намёк':'Следующий намёк · бесплатно в демо';
  $('#ad-status').textContent=yandex?'Подсказка открывается после подтверждённого просмотра. Прочитанные подсказки остаются доступны.':'В демо на GitHub рекламы нет. В сборке для Яндекс Игр здесь добровольный просмотр.';
}
const game=new LabGame({debug,container:$('#game'),touch:{joystick:$('#joystick'),joystickKnob:$('#joystick-knob'),jumpButton:$('#jump-button')},
  onProgress:p=>{const n=Math.max(0,Math.min(100,p.percent||0));$('#loading-bar').style.width=n+'%';$('#loading-percent').textContent=n+'%';$('#loading-label').textContent=p.label||'Загрузка';$('#loading-progress').setAttribute('aria-valuenow',String(n));},
  onReady:()=>{hideScreens();setState('ready');screen('start-screen',true);platform?.ready();
    game.audio.configure(preferences.value);applyLabQuality(game,preferences.value.quality);diagnostics();
    if(debug){window.__NESI_DEMO_GAME__=game;window.__NESI_PLATFORM__=platform;window.__NESI_PREFS__=preferences;
      window.__NESI_RUN_LEVEL_ROUTE__=async(options={})=>{const {runV8Journey}=await import('./game/LabV8Journey.js');game.renderer.setAnimationLoop(null);hideScreens();setState('playing');
        try{return await runV8Journey(game,{journeyOptions:options,onMilestone:mark=>{game.render();window.__NESI_CAPTURE_LEVEL_MARK__?.(mark);}});}finally{game.render();clearInput();setState(game.state);diagnostics();}};
      window.__NESI_RUN_FLOOR_PORTAL_ROUTE__=async(options={})=>{
const {runPortalFloorJourney}=await import('./game/LabPortalFloorJourney.js');
game.renderer.setAnimationLoop(null);hideScreens();setState('playing');
try{return await runPortalFloorJourney(game,{...options,onMilestone:mark=>{game.render();window.__NESI_CAPTURE_LEVEL_MARK__?.(mark);}});}
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
  onHud:({chamber,objective,hasCargo,portalsReady})=>{hudText('level',String(game.levelIndex+1));hudText('chamber',chamber);hudText('objective',objective||'');hudText('cargo',game.velocityCompanion?.connected?'Друг закреплён':hasCargo?'Друг на руках':'Друг ждёт');hudText('portals',portalsReady?'Связаны':'Два портала');},
  onToast:message=>{if(/Сначала|не помещается|препятствие|белую|Раздвинь|свободное|лицевую/.test(message))game.tutorial.explain(message);},
  onPause:paused=>{clearInput();screen('pause-screen',paused);setState(paused?'paused':'playing');if(paused){pauseInfo();$('#resume-button').focus({preventScroll:true});}},
  onRestartRequest:()=>restartLevel(),
  onWin:showVictory,
});
// Every public entry uses the same campaign; the review edition has isolated saves.
game.epicMode=false;
game.chamberEdition=foundationEdition.enabled?'foundation':openEdition.enabled?'open':'classic';
document.body.dataset.chamberEdition=game.chamberEdition;
document.body.dataset.gameMode='campaign';
game.quality={...QUALITY_PRESETS[preferences.value.quality]};game.tutorial.enabled=preferences.value.tutorial;
game.levelIndex=foundationEdition.enabled?foundationEdition.levelIndex:openEdition.enabled?openEdition.levelIndex:campaignRoute.levelIndex;
choices();$('#level-select').value=String(game.levelIndex);
$('#campaign-count').textContent=foundationEdition.enabled?'Кампания · 30 испытаний':openEdition.enabled?`${OPEN_ROOM_INDICES.length} лабораторных испытаний · отдельная версия`:`Архив · ${CAMPAIGN.length} испытания`;
if(foundationEdition.enabled){$('#start-screen .brand').textContent='КАМПАНИЯ · ОТ ОТКРЫТИЯ К ЭКСПЕРИМЕНТУ';$('#start-screen .lead').textContent='Первые пять комнат знакомят с порталами, светом и движением. Затем можно пройти остальные испытания исследовательского комплекса.';}
else if(openEdition.enabled){$('#start-screen .brand').textContent='ЛАБОРАТОРНЫЕ ИСПЫТАНИЯ';$('#start-screen .lead').textContent='Камеры 24, 28, 30 и 31–33. Эта подборка и новая первая глава хранят прогресс отдельно от архива.';}
const editionNav=document.createElement('nav');editionNav.className='edition-navigation';editionNav.setAttribute('aria-label','Версии кампании');
for(const [id,text,href]of [['foundation','Кампания · с начала','?edition=foundation&level=1'],['open','Лабораторная глава 31–33','?edition=open&level=31'],['classic','Архив · 33 испытания','?edition=classic&level=1']]){
 if(game.chamberEdition===id)continue;const a=document.createElement('a');a.textContent=text;a.href=href;editionNav.append(a);
}
$('#start-screen .hero-footer').before(editionNav);
async function enterLevel(index,reason='next'){
  if(entering||holds.size||!availableRooms.includes(index))return;entering=true;clearInput();game.audio?.unlock();
  try{
    // All interstitials are tied to an explicit menu transition, never a timer during play.
    if(reason!=='initial')await platform?.interstitial('next');
    hideScreens();screen('loading',true);game.state='loading';setState('loading');
    if(index!==game.levelIndex)await game.selectLevel(index,false);
    game.start();game.renderer.setAnimationLoop(game.animate);hideScreens();setState('playing');$('#level-select').value=String(index);$('#settings-level-select').value=String(index);diagnostics();
  }catch(error){failure(error);}finally{entering=false;}
}
async function restartLevel(){
  if(entering||holds.size)return;entering=true;clearInput();
  try{if(game.state==='playing')game.togglePause(true);await platform?.interstitial('restart');
    hideScreens();game.restart();game.audio.unlock();game.renderer.setAnimationLoop(game.animate);setState('playing');game.requestPointerLock();
  }catch(error){failure(error);}finally{entering=false;}
}
function resume(){if(holds.size)return;game.audio.unlock();game.togglePause(false);game.renderer.setAnimationLoop(game.animate);}
$('#play-button').addEventListener('click',()=>enterLevel(Number($('#level-select').value),game.state==='ready'&&!preferences.value.completed.length?'initial':'next'));
$('#play-again-button').addEventListener('click',()=>enterLevel(foundationEdition.enabled?nextFoundationLevel(game.levelIndex):openEdition.enabled?nextOpenRoom(game.levelIndex):nextCampaignLevel(game.levelIndex,CAMPAIGN.length)));
$('#resume-button').addEventListener('click',resume);$('#restart-button').addEventListener('click',restartLevel);
$('#pause-button').addEventListener('click',()=>game.togglePause(true));
$('#hint-button').addEventListener('click',showHints);
$('#hint-unlock').addEventListener('click',async()=>{
  if(hintBusy||holds.size||(preferences.value.hints[game.levelIndex]||0)>=3)return;
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
addEventListener('pagehide',event=>{hold('page',true);if(!event.persisted){game.renderer?.setAnimationLoop(null);game.disposeControls();game.epicDirector?.dispose();platform?.dispose();game.audio?.dispose();}});
addEventListener('pageshow',event=>{if(event.persisted)hold('page',false);});
addEventListener('contextmenu',event=>event.preventDefault());
addEventListener('error',event=>{if(event.error)failure(event.error);});
addEventListener('unhandledrejection',event=>{if(/pointer.?lock|user gesture|document is not focused/i.test(String(event.reason))){event.preventDefault();return;}failure(event.reason);});
async function boot(){
  let sdk=null;if(yandex)try{sdk=await loadYandexSDK();}catch(error){console.warn('SDK unavailable; game remains playable',error);}
  platform=new LabPlatform({sdk,demo:!yandex,hold});hideScreens();screen('loading',true);setState('loading');await game.init();
}
boot().catch(failure);
