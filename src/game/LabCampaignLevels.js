import {buildReadableWindRoom} from './LabWindRoom.js';
import {WORKSHOP_CAMPAIGN,buildWorkshopCampaign} from './LabWorkshopCampaign.js';
import {addExplorationSurfaces} from './LabExplorationSurfaces.js';
import {CAMPAIGN as INTRODUCTORY_CAMPAIGN,buildLabCampaignLevel as buildIntroductoryLevel} from './LabIntroductoryCampaign.js';
import {EXTENDED_CAMPAIGN,buildExtendedCampaign} from './LabExtendedCampaign.js';
import {ROOM12_SPEC,buildRoom12} from './LabPortalRoom12.js';
import {ROOM13_SPEC,buildRoom13} from './LabPortalRoom13.js';
import {ROOM14_SPEC,buildRoom14} from './LabPortalRoom14.js';
import {ROOM15_SPEC,buildRoom15} from './LabPortalRoom15.js';
import {finishAdvancedRoom} from './LabAdvancedArchitecture.js';
import {upgradeBrowser3DArt} from './LabBrowser3DArt.js';
import {applyPremiumBrowser3DArt} from './LabBrowser3DPremium.js';
import {applyMechanismReflections} from './LabMechanismReflections.js';

const withArtAssets=(spec,...extra)=>({...spec,assets:[...new Set([...spec.assets,...extra])]});
const ROOM13_ART_SPEC=withArtAssets(ROOM13_SPEC,19,29);
const ROOM14_ART_SPEC=withArtAssets(ROOM14_SPEC,37);
const ROOM15_ART_SPEC=ROOM15_SPEC;
const finishBrowserArt=level=>applyMechanismReflections(applyPremiumBrowser3DArt(upgradeBrowser3DArt(level)));

// Preserve the verified introductory rooms; extend the public registry once.
export const CAMPAIGN=Object.freeze([...INTRODUCTORY_CAMPAIGN,...EXTENDED_CAMPAIGN.slice(0,3),...WORKSHOP_CAMPAIGN.slice(0,3).map((room,i)=>i===2?{...room,assets:room.assets.filter(id=>id!==39),accent:0x83cfc7,description:'Направь воздух от вентилятора к приводу двери.',hints:['Круглый вентилятор слева создаёт поток. Привод с решёткой дальше по залу принимает воздух передней стороной.','Воздух толкает тебя и друга. Попав в переднюю решётку приёмника, поток сам запускает дверь; кабель показывает связь.','Соедини правую стену напротив вентилятора с другим участком правой стены напротив привода. Включи вентилятор: когда поток попадёт в приёмник, дверь откроется автоматически. Забери друга и пройди в открывшуюся дверь.']}:room),ROOM12_SPEC,ROOM13_ART_SPEC,ROOM14_ART_SPEC,ROOM15_ART_SPEC]);
export function buildLabCampaignLevel(game,index){
 if(!Number.isInteger(index)||index<0||index>=CAMPAIGN.length)throw new RangeError('Unknown campaign course');
 if(index===10)return buildReadableWindRoom(game,CAMPAIGN[index]);
 if(index===11)return finishBrowserArt(buildRoom12(game,index));
 if(index===12)return finishBrowserArt(finishAdvancedRoom(buildRoom13(game,index)));
 if(index===13)return finishBrowserArt(finishAdvancedRoom(buildRoom14(game,index)));
 if(index===14)return finishBrowserArt(finishAdvancedRoom(buildRoom15(game,index)));
 if(index>=8)return buildWorkshopCampaign(game,index);
 const level=index<INTRODUCTORY_CAMPAIGN.length?buildIntroductoryLevel(game,index):buildExtendedCampaign(game,index);
 return addExplorationSurfaces(game,level,index);
}
