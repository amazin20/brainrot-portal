import {readFoundationEdition} from './LabFoundationEdition.js';
import {LabPreferences,sanitizePreferences} from './LabPreferences.js';

export const TOWER41_PREVIEW_STORAGE_PREFIX='brainrot-tower41-native-v2:';
export const TOWER41_PREVIEW_LEGACY_STORAGE_PREFIXES=Object.freeze(['brainrot-tower41-native-v1:']);
export const TOWER41_PREVIEW_LEVEL_INDEX=40;
export const TOWER41_PREVIEW_INDICES=Object.freeze([TOWER41_PREVIEW_LEVEL_INDEX]);
const NATIVE_ENTRY_PATHS=new Set(['/tower41-native-v2','/tower41-native-v2/','/tower41-native-v2/index.html','/brainrot-portal/tower41-native-v2','/brainrot-portal/tower41-native-v2/','/brainrot-portal/tower41-native-v2/index.html']);
const PREFERENCE_KEY='brainrot-portal.preferences.v24',LEGACY_KEY='nesi.preferences.v8';
const PREVIEW_REVISION='tower41-native-v2';

export function isTower41NativePreviewPath(pathname){return NATIVE_ENTRY_PATHS.has(pathname);}

/** The standalone native namespace always opens its own ordinary room and saves. */
export function normalizeTower41PreviewEntry(query,{pathname='',yandex=false}={}){
 const params=new URLSearchParams(query);
 if(!yandex&&isTower41NativePreviewPath(pathname)){
  params.set('edition','foundation');params.set('level','41');params.set('tower41preview','1');
 }
 return params;
}

/** This ordinary tower entry is opt-in and cannot change a Yandex or archive entry. */
export function readTower41Preview(query,{yandex=false}={}){
 const params=new URLSearchParams(query);
 return !yandex&&readFoundationEdition(params).enabled&&params.get('tower41preview')==='1';
}

/** Keep the native tower and physical-cell/puzzle reviews mutually exclusive. */
export function readTower41EntryFlags(query,{yandex=false}={}){
 const params=new URLSearchParams(query),foundation=readFoundationEdition(params);
 const preview=readTower41Preview(params,{yandex});
 const debug=!yandex&&(params.get('debug')==='1'||params.get('smoke')==='1');
 return {preview,debug,
  tower41Qualification:!preview&&debug&&foundation.enabled&&foundation.levelIndex===40&&params.get('tower41ratchet')==='1',
  puzzlePilot43:!preview&&!yandex&&foundation.enabled&&params.get('pilot')==='43',
  puzzleProgression:!preview&&!yandex&&foundation.enabled&&params.get('pilot')==='progression'};
}

export function tower41PreviewStorage(storage){
 if(!storage)return undefined;
 return {getItem:key=>storage.getItem(TOWER41_PREVIEW_STORAGE_PREFIX+key),
  setItem:(key,value)=>storage.setItem(TOWER41_PREVIEW_STORAGE_PREFIX+key,value)};
}

/** Only personal settings may seed a first visit; historical progress is never migrated. */
export function createTower41PreviewPreferences(storage){
 const ownStorage=tower41PreviewStorage(storage);
 let existing=false,readSucceeded=false;
 try{existing=Boolean(ownStorage?.getItem(PREFERENCE_KEY)||ownStorage?.getItem(LEGACY_KEY));readSucceeded=true;}catch{}
 const preferences=new LabPreferences(ownStorage,{campaignRevision:PREVIEW_REVISION});
 if(existing||!readSucceeded||preferences.readFailed)return preferences;
 try{
  const raw=storage?.getItem('brainrot-foundation-v1:'+PREFERENCE_KEY)||storage?.getItem('brainrot-foundation-v1:'+LEGACY_KEY);
  if(!raw)return preferences;
  const previous=JSON.parse(raw);
  if(!previous||typeof previous!=='object'||Array.isArray(previous))return preferences;
  const {quality,volume,muted,tutorial}=sanitizePreferences(previous);
  preferences.save({quality,volume,muted,tutorial});
 }catch{/* Corrupt or inaccessible old settings never affect a new tower session. */}
 return preferences;
}
