import {foundationStorage} from './LabFoundationEdition.js';

export const FOUNDATION_STORAGE_PREFIX='brainrot-foundation-v1:';
export const CAMPAIGN_V55_STORAGE_PREFIX='brainrot-campaign-v55:';
export const CAMPAIGN_PREFERENCE_KEY='brainrot-portal.preferences.v24';
const LEGACY_PREFERENCE_KEY='nesi.preferences.v8';
const paths=new Set(['','/brainrot-portal'].flatMap(base=>['','/','/index.html'].map(suffix=>`${base}/campaign-v55${suffix}`)));

export const isCampaignV55Path=pathname=>paths.has(pathname);
export function foundationCampaignPrefix(pathname,{fullFoundationCampaign=true}={}){
 return fullFoundationCampaign&&isCampaignV55Path(pathname)?CAMPAIGN_V55_STORAGE_PREFIX:FOUNDATION_STORAGE_PREFIX;
}

/** A first visit imports historical Foundation progress/settings by reading.
 * Every save goes to the new namespace. Once either own preference key exists,
 * neither a corrupt record nor a missing legacy key can re-import old data. */
export function foundationCampaignStorage(storage,{pathname='',fullFoundationCampaign=false}={}){
 if(!storage)return undefined;
 if(foundationCampaignPrefix(pathname,{fullFoundationCampaign})!==CAMPAIGN_V55_STORAGE_PREFIX)return foundationStorage(storage);
 return {
  getItem(key){
   const own=storage.getItem(CAMPAIGN_V55_STORAGE_PREFIX+CAMPAIGN_PREFERENCE_KEY),legacy=storage.getItem(CAMPAIGN_V55_STORAGE_PREFIX+LEGACY_PREFERENCE_KEY);
   const prefix=own!==null&&own!==undefined||legacy!==null&&legacy!==undefined?CAMPAIGN_V55_STORAGE_PREFIX:FOUNDATION_STORAGE_PREFIX;
   return storage.getItem(prefix+key);
  },
  setItem:(key,value)=>storage.setItem(CAMPAIGN_V55_STORAGE_PREFIX+key,value),
 };
}
