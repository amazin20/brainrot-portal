import {WORKSHOP_CAMPAIGN,buildWorkshopCampaign} from './LabWorkshopCampaign.js';
import {addExplorationSurfaces} from './LabExplorationSurfaces.js';
import {CAMPAIGN as INTRODUCTORY_CAMPAIGN,buildLabCampaignLevel as buildIntroductoryLevel} from './LabIntroductoryCampaign.js';
import {EXTENDED_CAMPAIGN,buildExtendedCampaign} from './LabExtendedCampaign.js';

// Preserve the verified introductory rooms; extend the public registry once.
export const CAMPAIGN=Object.freeze([...INTRODUCTORY_CAMPAIGN,...EXTENDED_CAMPAIGN.slice(0,3),...WORKSHOP_CAMPAIGN]);
export function buildLabCampaignLevel(game,index){
 if(!Number.isInteger(index)||index<0||index>=CAMPAIGN.length)throw new RangeError('Unknown campaign course');
 if(index>=8)return buildWorkshopCampaign(game,index);
 const level=index<INTRODUCTORY_CAMPAIGN.length?buildIntroductoryLevel(game,index):buildExtendedCampaign(game,index);
 return addExplorationSurfaces(game,level,index);
}
