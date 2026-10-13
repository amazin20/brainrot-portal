import {createTower41PreviewPreferences} from './LabTower41Preview.js';

export const PHYSICAL_REVIEW_ENTRIES=Object.freeze([
 Object.freeze({id:'foundation20-physical-v1',levelIndex:19,indices:Object.freeze([19]),storagePrefix:'brainrot-foundation20-physical-v1:',tower:false}),
 Object.freeze({id:'tower41-native-v3',levelIndex:40,indices:Object.freeze([40]),storagePrefix:'brainrot-tower41-native-v3:',tower:true}),
]);
const entries=PHYSICAL_REVIEW_ENTRIES;
const paths=new Map(entries.flatMap(entry=>['','/brainrot-portal'].flatMap(base=>['','/','/index.html'].map(suffix=>[`${base}/${entry.id}${suffix}`,entry]))));

/** A released standalone entry selects one ordinary chamber and its own saves. */
export function readPhysicalReviewEntry(pathname,{yandex=false}={}){
 return yandex?null:paths.get(pathname)??null;
}

export function normalizePhysicalReviewQuery(query,entry){
 const params=new URLSearchParams(query);
 if(!entry)return params;
 params.set('edition','foundation');params.set('level',String(entry.levelIndex+1));
 for(const key of ['pilot','tower41ratchet','tower41preview','mode'])params.delete(key);
 if(entry.tower)params.set('tower41preview','1');
 return params;
}

export function createPhysicalReviewPreferences(storage,entry){
 if(!entries.includes(entry))throw new Error('Unknown physical chamber entry');
 return createTower41PreviewPreferences(storage,{prefix:entry.storagePrefix,revision:entry.id});
}
