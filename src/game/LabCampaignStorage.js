import {foundationStorage} from './LabFoundationEdition.js';
import {CASTLE_LEVEL_INDEX} from './LabCampaignSequence.js';

export const FOUNDATION_STORAGE_PREFIX='brainrot-foundation-v1:';
export const CAMPAIGN_V55_STORAGE_PREFIX='brainrot-campaign-v55:';
export const CAMPAIGN_V56_STORAGE_PREFIX='brainrot-campaign-v56:';
export const CAMPAIGN_V57_STORAGE_PREFIX='brainrot-campaign-v57:';
export const CAMPAIGN_V58_STORAGE_PREFIX='brainrot-campaign-v58:';
export const CAMPAIGN_V59_STORAGE_PREFIX='brainrot-campaign-v59:';
export const CAMPAIGN_V60_STORAGE_PREFIX='brainrot-campaign-v60:';
export const CAMPAIGN_V61_STORAGE_PREFIX='brainrot-campaign-v61:';
export const CAMPAIGN_V62_STORAGE_PREFIX='brainrot-campaign-v62:';
export const CAMPAIGN_V63_STORAGE_PREFIX='brainrot-campaign-v63:';
export const CAMPAIGN_V64_STORAGE_PREFIX='brainrot-campaign-v64:';
export const CAMPAIGN_PREFERENCE_KEY='brainrot-portal.preferences.v24';
const LEGACY_PREFERENCE_KEY='nesi.preferences.v8';
const campaignPaths=version=>new Set(['','/brainrot-portal'].flatMap(base=>['','/','/index.html'].map(suffix=>`${base}/campaign-${version}${suffix}`)));
const v55Paths=campaignPaths('v55'),v56Paths=campaignPaths('v56'),v57Paths=campaignPaths('v57'),v58Paths=campaignPaths('v58'),v59Paths=campaignPaths('v59'),v60Paths=campaignPaths('v60'),v61Paths=campaignPaths('v61'),v62Paths=campaignPaths('v62'),v63Paths=campaignPaths('v63'),v64Paths=campaignPaths('v64');

export const isCampaignV55Path=pathname=>v55Paths.has(pathname);
export const isCampaignV56Path=pathname=>v56Paths.has(pathname);
export const isCampaignV57Path=pathname=>v57Paths.has(pathname);
export const isCampaignV58Path=pathname=>v58Paths.has(pathname);
export const isCampaignV59Path=pathname=>v59Paths.has(pathname);
export const isCampaignV60Path=pathname=>v60Paths.has(pathname);
export const isCampaignV61Path=pathname=>v61Paths.has(pathname);
export const isCampaignV62Path=pathname=>v62Paths.has(pathname);
export const isCampaignV63Path=pathname=>v63Paths.has(pathname);
export const isCampaignV64Path=pathname=>v64Paths.has(pathname);
export function foundationCampaignPrefix(pathname,{fullFoundationCampaign=true}={}){
 if(!fullFoundationCampaign)return FOUNDATION_STORAGE_PREFIX;
 return isCampaignV64Path(pathname)?CAMPAIGN_V64_STORAGE_PREFIX:isCampaignV63Path(pathname)?CAMPAIGN_V63_STORAGE_PREFIX:isCampaignV62Path(pathname)?CAMPAIGN_V62_STORAGE_PREFIX:isCampaignV61Path(pathname)?CAMPAIGN_V61_STORAGE_PREFIX:isCampaignV60Path(pathname)?CAMPAIGN_V60_STORAGE_PREFIX:isCampaignV59Path(pathname)?CAMPAIGN_V59_STORAGE_PREFIX:isCampaignV58Path(pathname)?CAMPAIGN_V58_STORAGE_PREFIX:isCampaignV57Path(pathname)?CAMPAIGN_V57_STORAGE_PREFIX:isCampaignV56Path(pathname)?CAMPAIGN_V56_STORAGE_PREFIX:isCampaignV55Path(pathname)?CAMPAIGN_V55_STORAGE_PREFIX:FOUNDATION_STORAGE_PREFIX;
}

/** The expanded castle must be played again, while its stable bookmark and all
 * ordinary-room progress survive. Only imported records are adapted: a later
 * v59 castle victory belongs to the new mechanism and must remain completed. */
function importExpandedCastleRecord(value){
 try{
  const record=JSON.parse(value);
  if(!record||typeof record!=='object'||Array.isArray(record))return value;
  let changed=false;
  if(Array.isArray(record.completed)&&record.completed.includes(CASTLE_LEVEL_INDEX)){
   record.completed=record.completed.filter(index=>index!==CASTLE_LEVEL_INDEX);changed=true;
  }
  if(record.hints&&typeof record.hints==='object'&&Object.hasOwn(record.hints,CASTLE_LEVEL_INDEX)){
   record.hints=Object.fromEntries(Object.entries(record.hints).filter(([index])=>Number(index)!==CASTLE_LEVEL_INDEX));changed=true;
  }
  return changed?JSON.stringify(record):value;
 }catch{return value;}
}

/** A first visit reads the newest preceding campaign, then Foundation progress.
 * Every save goes to the new namespace. Once either own preference key exists,
 * neither a corrupt record nor a missing legacy key can re-import old data.
 * Select the namespace as a whole, so a legacy key cannot mix two editions. */
export function foundationCampaignStorage(storage,{pathname='',fullFoundationCampaign=false}={}){
 if(!storage)return undefined;
 const ownPrefix=foundationCampaignPrefix(pathname,{fullFoundationCampaign});
 if(ownPrefix===FOUNDATION_STORAGE_PREFIX)return foundationStorage(storage);
 const imports=ownPrefix===CAMPAIGN_V64_STORAGE_PREFIX?[CAMPAIGN_V63_STORAGE_PREFIX,CAMPAIGN_V62_STORAGE_PREFIX,CAMPAIGN_V61_STORAGE_PREFIX,CAMPAIGN_V60_STORAGE_PREFIX,CAMPAIGN_V59_STORAGE_PREFIX,CAMPAIGN_V58_STORAGE_PREFIX,CAMPAIGN_V57_STORAGE_PREFIX,CAMPAIGN_V56_STORAGE_PREFIX,CAMPAIGN_V55_STORAGE_PREFIX,FOUNDATION_STORAGE_PREFIX]:ownPrefix===CAMPAIGN_V63_STORAGE_PREFIX?[CAMPAIGN_V62_STORAGE_PREFIX,CAMPAIGN_V61_STORAGE_PREFIX,CAMPAIGN_V60_STORAGE_PREFIX,CAMPAIGN_V59_STORAGE_PREFIX,CAMPAIGN_V58_STORAGE_PREFIX,CAMPAIGN_V57_STORAGE_PREFIX,CAMPAIGN_V56_STORAGE_PREFIX,CAMPAIGN_V55_STORAGE_PREFIX,FOUNDATION_STORAGE_PREFIX]:ownPrefix===CAMPAIGN_V62_STORAGE_PREFIX?[CAMPAIGN_V61_STORAGE_PREFIX,CAMPAIGN_V60_STORAGE_PREFIX,CAMPAIGN_V59_STORAGE_PREFIX,CAMPAIGN_V58_STORAGE_PREFIX,CAMPAIGN_V57_STORAGE_PREFIX,CAMPAIGN_V56_STORAGE_PREFIX,CAMPAIGN_V55_STORAGE_PREFIX,FOUNDATION_STORAGE_PREFIX]:ownPrefix===CAMPAIGN_V61_STORAGE_PREFIX?[CAMPAIGN_V60_STORAGE_PREFIX,CAMPAIGN_V59_STORAGE_PREFIX,CAMPAIGN_V58_STORAGE_PREFIX,CAMPAIGN_V57_STORAGE_PREFIX,CAMPAIGN_V56_STORAGE_PREFIX,CAMPAIGN_V55_STORAGE_PREFIX,FOUNDATION_STORAGE_PREFIX]:ownPrefix===CAMPAIGN_V60_STORAGE_PREFIX?[CAMPAIGN_V59_STORAGE_PREFIX,CAMPAIGN_V58_STORAGE_PREFIX,CAMPAIGN_V57_STORAGE_PREFIX,CAMPAIGN_V56_STORAGE_PREFIX,CAMPAIGN_V55_STORAGE_PREFIX,FOUNDATION_STORAGE_PREFIX]:ownPrefix===CAMPAIGN_V59_STORAGE_PREFIX?[CAMPAIGN_V58_STORAGE_PREFIX,CAMPAIGN_V57_STORAGE_PREFIX,CAMPAIGN_V56_STORAGE_PREFIX,CAMPAIGN_V55_STORAGE_PREFIX,FOUNDATION_STORAGE_PREFIX]:ownPrefix===CAMPAIGN_V58_STORAGE_PREFIX?[CAMPAIGN_V57_STORAGE_PREFIX,CAMPAIGN_V56_STORAGE_PREFIX,CAMPAIGN_V55_STORAGE_PREFIX,FOUNDATION_STORAGE_PREFIX]:ownPrefix===CAMPAIGN_V57_STORAGE_PREFIX?[CAMPAIGN_V56_STORAGE_PREFIX,CAMPAIGN_V55_STORAGE_PREFIX,FOUNDATION_STORAGE_PREFIX]:ownPrefix===CAMPAIGN_V56_STORAGE_PREFIX?[CAMPAIGN_V55_STORAGE_PREFIX,FOUNDATION_STORAGE_PREFIX]:[FOUNDATION_STORAGE_PREFIX];
 const hasRecord=prefix=>[CAMPAIGN_PREFERENCE_KEY,LEGACY_PREFERENCE_KEY].some(name=>{
  const value=storage.getItem(prefix+name);return value!==null&&value!==undefined;
 });
 return {
  getItem(key){
   const prefix=hasRecord(ownPrefix)?ownPrefix:imports.find(hasRecord)??FOUNDATION_STORAGE_PREFIX;
   const value=storage.getItem(prefix+key);
   // v59 already contains the expanded castle. A visual chapter update must
   // preserve its victory; older editions still need the v59 castle migration.
   const preExpandedCastleImport=[CAMPAIGN_V59_STORAGE_PREFIX,CAMPAIGN_V60_STORAGE_PREFIX,CAMPAIGN_V61_STORAGE_PREFIX,CAMPAIGN_V62_STORAGE_PREFIX,CAMPAIGN_V63_STORAGE_PREFIX,CAMPAIGN_V64_STORAGE_PREFIX].includes(ownPrefix)&&prefix!==ownPrefix&&![CAMPAIGN_V59_STORAGE_PREFIX,CAMPAIGN_V60_STORAGE_PREFIX,CAMPAIGN_V61_STORAGE_PREFIX,CAMPAIGN_V62_STORAGE_PREFIX,CAMPAIGN_V63_STORAGE_PREFIX,CAMPAIGN_V64_STORAGE_PREFIX].includes(prefix);
   return preExpandedCastleImport&&[CAMPAIGN_PREFERENCE_KEY,LEGACY_PREFERENCE_KEY].includes(key)?importExpandedCastleRecord(value):value;
  },
  setItem:(key,value)=>storage.setItem(ownPrefix+key,value),
 };
}
