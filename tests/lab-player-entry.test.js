import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizePlayerCampaignQuery} from '../src/game/LabPlayerEntry.js';
import {readFoundationEdition,FOUNDATION_INDICES} from '../src/game/LabFoundationEdition.js';
import {readOpenEdition} from '../src/game/LabOpenEdition.js';
import {readTower41EntryFlags,normalizeTower41PreviewEntry,isTower41NativePreviewPath} from '../src/game/LabTower41Preview.js';
import {readPhysicalReviewEntry,normalizePhysicalReviewQuery} from '../src/game/LabPhysicalReviewEntry.js';
import {readCampaignRoute} from '../src/game/LabCampaignRoute.js';
import {resumeCampaignLevel} from '../src/game/LabResume.js';
import {canAccessCampaignLevel,resolveCampaignLevel} from '../src/game/LabCampaignAccess.js';
import {LabPreferences} from '../src/game/LabPreferences.js';
import {LabPlatform} from '../src/game/LabPlatform.js';
import {createHintProgress} from '../src/game/LabHintProgress.js';

const QA_NAMES=['tower41preview','tower41ratchet','pilot'];
const sparse={completed:[0,1,6,9,10,14,19,20,22,25,28,29,40],hints:{1:2,14:1,22:2,29:1,40:3},resumeLevel:3};

test('ordinary player queries always select the complete foundation campaign without review or pilot flags',()=>{
 for(const input of ['', '?edition=open&level=43&pilot=43', '?edition=archive&level=41&debug=1&tower41ratchet=1',
  '?edition=foundation&tower41preview=1&pilot=progression&level=51', '?mode=velocity&chapter=2&return=21&pilot=progression']){
  const query=normalizePlayerCampaignQuery(input),foundation=readFoundationEdition(query),flags=readTower41EntryFlags(query);
  assert.equal(foundation.enabled,true);assert.equal(readOpenEdition(query).enabled,false);
  assert.equal(flags.preview,false);assert.equal(flags.tower41Qualification,false);
  assert.equal(flags.puzzlePilot43,false);assert.equal(flags.puzzleProgression,false);
  for(const key of QA_NAMES)assert.equal(query.has(key),false);
  assert.equal(FOUNDATION_INDICES.length,51);assert.equal(FOUNDATION_INDICES.at(-1),40);
 }
});

test('ordinary normalization removes every duplicate and encoded review flag without changing its input',()=>{
 const input=new URLSearchParams('edition=open&edition=archive&%70ilot=43&pilot=progression&tower41preview=1&tower41preview=1&tower41ratchet=1&debug=1&smoke=1&clock=1&level=51');
 const original=input.toString(),query=normalizePlayerCampaignQuery(input);
 assert.equal(input.toString(),original);assert.deepEqual(query.getAll('edition'),['foundation']);
 for(const key of QA_NAMES)assert.deepEqual(query.getAll(key),[]);
 for(const [key,value]of [['debug','1'],['smoke','1'],['clock','1'],['level','51']])assert.equal(query.get(key),value);
 assert.equal(normalizePlayerCampaignQuery(query).toString(),query.toString());
});

test('preserved debug, smoke and direct room bookmarks cannot bypass the ordinary completion frontier',()=>{
 for(const input of ['?level=51&debug=1', '?level=43&smoke=1&pilot=43', '?level=41&debug=1&tower41ratchet=1', '?mode=velocity&chapter=2&return=21']){
  const query=normalizePlayerCampaignQuery(input),foundation=readFoundationEdition(query);
  const requested=readCampaignRoute(query,51).legacyVelocityLink?readCampaignRoute(query,51).levelIndex:foundation.levelIndex;
  assert.equal(resolveCampaignLevel(requested,{completed:[]},FOUNDATION_INDICES),0);
  assert.equal(resolveCampaignLevel(requested,sparse,FOUNDATION_INDICES),canAccessCampaignLevel(requested,sparse,FOUNDATION_INDICES)?requested:2);
 }
 const requested=resumeCampaignLevel(normalizePlayerCampaignQuery(''),sparse,FOUNDATION_INDICES,0);
 assert.equal(requested,3);assert.equal(resolveCampaignLevel(requested,sparse,FOUNDATION_INDICES),2);
 assert.equal(sparse.resumeLevel,3);assert.equal(canAccessCampaignLevel(3,sparse,FOUNDATION_INDICES),false);
 assert.equal(canAccessCampaignLevel(40,sparse,FOUNDATION_INDICES),true,'A genuinely completed late room remains replayable');
});

test('only explicit build-time development or trusted entry permission preserves review queries',()=>{
 const value='?edition=foundation&level=43&pilot=progression&debug=1&tower41ratchet=1&tower41preview=1';
 for(const options of [{development:true},{reviewEntry:true}])assert.equal(normalizePlayerCampaignQuery(value,options).toString(),new URLSearchParams(value).toString());
 const runtimeClaims=normalizePlayerCampaignQuery(value+'&development=1&reviewEntry=1&dev=1&yandex-review=1');
 for(const key of QA_NAMES)assert.equal(runtimeClaims.has(key),false);
 assert.equal(readTower41EntryFlags(runtimeClaims).puzzleProgression,false);
});

test('trusted standalone physical paths select their one room and cannot be supplied through a query',()=>{
 for(const [path,index]of [['/foundation20-physical-v1/',19],['/brainrot-portal/tower41-native-v3/index.html',40]]){
  const entry=readPhysicalReviewEntry(path);assert.equal(entry.levelIndex,index);assert.deepEqual(entry.indices,[index]);
  const query=normalizePhysicalReviewQuery(normalizePlayerCampaignQuery('?edition=open&level=51&pilot=progression',{reviewEntry:true}),entry);
  assert.equal(readFoundationEdition(query).levelIndex,index);assert.equal(query.has('pilot'),false);
 }
 for(const path of ['/','/campaign-v63/','/foundation20-physical-v1-old/','/other/tower41-native-v3/','/tower41-native-v3//'])assert.equal(readPhysicalReviewEntry(path),null);
 assert.equal(readPhysicalReviewEntry('/campaign-v63/?entry=foundation20-physical-v1'),null);
});

test('native v2 review exceptions require their exact separate path and never activate in Yandex',()=>{
 const path='/brainrot-portal/tower41-native-v2/';assert.equal(isTower41NativePreviewPath(path),true);
 const query=normalizeTower41PreviewEntry(normalizePlayerCampaignQuery('?pilot=progression',{reviewEntry:true}),{pathname:path});
 const flags=readTower41EntryFlags(query);
 assert.equal(flags.preview,true);assert.equal(flags.puzzleProgression,false);assert.equal(readFoundationEdition(query).levelIndex,40);
 assert.equal(isTower41NativePreviewPath('/campaign-v63/?tower41-native-v2=1'),false);
 const yandexQuery=normalizeTower41PreviewEntry(normalizePlayerCampaignQuery('?edition=open&level=41&tower41preview=1&pilot=progression'),{pathname:path,yandex:true});
 const yandexFlags=readTower41EntryFlags(yandexQuery,{yandex:true});
 assert.equal(yandexFlags.preview,false);assert.equal(yandexFlags.puzzleProgression,false);
 assert.equal(readPhysicalReviewEntry('/foundation20-physical-v1/',{yandex:true}),null);
 assert.equal(resolveCampaignLevel(readFoundationEdition(yandexQuery).levelIndex,{completed:[]},FOUNDATION_INDICES),0);
});

function hintFixture(){
 const holds=new Set(),requests=[],writes=[];
 const data=new Map(),storage={getItem:key=>data.get(key)??null,setItem:(key,value)=>{writes.push(key);data.set(key,value);}};
 const preferences=new LabPreferences(storage);writes.length=0;
 const state={value:'paused',entering:false,current:0};
 const platform=new LabPlatform({demo:false,sdk:{adv:{showRewardedVideo:({callbacks})=>requests.push(callbacks)}},hold:(reason,on)=>on?holds.add(reason):holds.delete(reason)});
 const hints=createHintProgress({platform,preferences,hintsFor:index=>index>=0&&index<2?['Найди источник.','Соедини панели.','Приведи спутника.']:[],
  isAvailable:()=>!holds.size&&!state.entering&&state.value==='paused'});
 return{holds,requests,writes,preferences,state,platform,hints};
}

test('paused hint entry rejects active gameplay, scene entry and external holds before requesting any ad',async()=>{
 const f=hintFixture();
 for(const value of ['playing','ready','won','loading']){
  f.state.value=value;assert.equal(f.hints.read(0).canUnlock,false);assert.equal((await f.hints.request(0)).reason,'inactive');
 }
 f.state.value='paused';f.state.entering=true;assert.equal((await f.hints.request(0)).reason,'inactive');
 f.state.entering=false;
 for(const reason of ['ad','focus','hidden','sdk','page']){
  f.holds.add(reason);assert.equal(f.hints.read(0).canUnlock,false);assert.equal((await f.hints.request(0)).reason,'inactive');f.holds.delete(reason);
 }
 assert.equal(f.requests.length,0);assert.deepEqual(f.writes,[]);f.hints.dispose();f.platform.dispose();
});

test('a confirmed reward still unlocks its captured room while the SDK ad hold makes entry unavailable',async()=>{
 const f=hintFixture(),pending=f.hints.request(f.state.current),callbacks=f.requests[0];
 assert.equal(f.holds.has('ad'),true);callbacks.onOpen();assert.equal(f.hints.read(0).canUnlock,false);
 f.state.current=1;f.state.value='ready';
 assert.equal((await f.hints.request(f.state.current)).reason,'busy');
 callbacks.onRewarded();callbacks.onRewarded();
 assert.equal(f.holds.has('ad'),true);assert.deepEqual(f.preferences.value.hints,{0:1});
 assert.deepEqual(f.preferences.value.completed,[]);assert.equal(f.writes.length,1);
 callbacks.onClose();const result=await pending;
 assert.equal(result.index,0);assert.equal(result.rewarded,true);assert.equal(result.rewardConfirmed,true);
 assert.equal(f.holds.size,0);assert.equal(f.hints.read(1).count,0);assert.equal(f.requests.length,1);
 assert.equal(f.hints.read(0).canUnlock,false,'Current ready state blocks a new request after the earned reward');
 f.hints.dispose();f.platform.dispose();
});
