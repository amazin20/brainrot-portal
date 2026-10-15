import {foundationStorage} from './LabFoundationEdition.js';

export const FOUNDATION_STORAGE_PREFIX='brainrot-foundation-v1:';
export const CAMPAIGN_V55_STORAGE_PREFIX='brainrot-campaign-v55:';
export const CAMPAIGN_V56_STORAGE_PREFIX='brainrot-campaign-v56:';
export const CAMPAIGN_V57_STORAGE_PREFIX='brainrot-campaign-v57:';
export const CAMPAIGN_PREFERENCE_KEY='brainrot-portal.preferences.v24';
const LEGACY_PREFERENCE_KEY='nesi.preferences.v8';
const campaignPaths=version=>new Set(['','/brainrot-portal'].flatMap(base=>['','/','/index.html'].map(suffix=>`${base}/campaign-${version}${suffix}`)));
const v55Paths=campaignPaths('v55'),v56Paths=campaignPaths('v56'),v57Paths=campaignPaths('v57');

export const isCampaignV55Path=pathname=>v55Paths.has(pathname);
export const isCampaignV56Path=pathname=>v56Paths.has(pathname);
export const isCampaignV57Path=pathname=>v57Paths.has(pathname);
export function foundationCampaignPrefix(pathname,{fullFoundationCampaign=true}={}){
 if(!fullFoundationCampaign)return FOUNDATION_STORAGE_PREFIX;
 return isCampaignV57Path(pathname)?CAMPAIGN_V57_STORAGE_PREFIX:isCampaignV56Path(pathname)?CAMPAIGN_V56_STORAGE_PREFIX:isCampaignV55Path(pathname)?CAMPAIGN_V55_STORAGE_PREFIX:FOUNDATION_STORAGE_PREFIX;
}

/** A first visit reads the newest preceding campaign, then Foundation progress.
 * Every save goes to the new namespace. Once either own preference key exists,
 * neither a corrupt record nor a missing legacy key can re-import old data.
 * Select the namespace as a whole, so a legacy key cannot mix two editions. */
export function foundationCampaignStorage(storage,{pathname='',fullFoundationCampaign=false}={}){
 if(!storage)return undefined;
 const ownPrefix=foundationCampaignPrefix(pathname,{fullFoundationCampaign});
 if(ownPrefix===FOUNDATION_STORAGE_PREFIX)return foundationStorage(storage);
 const imports=ownPrefix===CAMPAIGN_V57_STORAGE_PREFIX?[CAMPAIGN_V56_STORAGE_PREFIX,CAMPAIGN_V55_STORAGE_PREFIX,FOUNDATION_STORAGE_PREFIX]:ownPrefix===CAMPAIGN_V56_STORAGE_PREFIX?[CAMPAIGN_V55_STORAGE_PREFIX,FOUNDATION_STORAGE_PREFIX]:[FOUNDATION_STORAGE_PREFIX];
 const hasRecord=prefix=>[CAMPAIGN_PREFERENCE_KEY,LEGACY_PREFERENCE_KEY].some(name=>{
  const value=storage.getItem(prefix+name);return value!==null&&value!==undefined;
 });
 return {
  getItem(key){
   const prefix=hasRecord(ownPrefix)?ownPrefix:imports.find(hasRecord)??FOUNDATION_STORAGE_PREFIX;
   return storage.getItem(prefix+key);
  },
  setItem:(key,value)=>storage.setItem(ownPrefix+key,value),
 };
}
