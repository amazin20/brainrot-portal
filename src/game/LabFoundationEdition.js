import {FOUNDATION_SEQUENCE,nextFoundationIndex} from './LabCampaignSequence.js';
/** Fifty ordinary rooms precede the continuous castle. Permanent query and
 * save indices remain unchanged; historical editions require an archive query. */
export const FOUNDATION_INDICES=FOUNDATION_SEQUENCE;
export function readFoundationEdition(query){
 const p=new URLSearchParams(query),edition=p.get('edition'),level=Number(p.get('level')||1);
 const enabled=edition==='foundation'||(!edition&&p.get('mode')!=='velocity');
 return {enabled,levelIndex:Number.isInteger(level)&&level>=1&&level<=FOUNDATION_INDICES.length?level-1:0};
}
export function foundationStorage(storage){
 if(!storage)return undefined;
 return {getItem:key=>storage.getItem('brainrot-foundation-v1:'+key),setItem:(key,value)=>storage.setItem('brainrot-foundation-v1:'+key,value)};
}
export const nextFoundationLevel=nextFoundationIndex;
